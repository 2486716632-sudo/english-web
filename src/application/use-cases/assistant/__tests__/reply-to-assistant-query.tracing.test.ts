import { describe, it, expect } from 'vitest'
import {
  AIError,
  type AIChatRequest,
  type AIChatResult,
  type AIClientPort,
} from '@/application/ports/ai-client'
import type { WordCard, WordLookupPort } from '@/application/ports/word-lookup'
import type { TraceRecord } from '@/application/ports/trace'
import { runInTrace } from '@/application/observability/trace-helpers'
import { ReplyToAssistantQueryUseCase } from '@/application/use-cases/assistant/reply-to-assistant-query.use-case'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * Assistant Use Case trace 关联（Phase 5 任务文档 Part 9 / Part 13 第 7、11、12 项）。
 *
 * 复现交付层的职责（HTTP Route 创建 root trace），但不经过 Next.js：
 * trace 结构必须是 `http.assistant` → `assistant.reply` → `assistant.word_lookup` / `ai.chat`。
 */

const QUERY_MARKER = 'PLAINTEXT-QUERY-MARKER'
const REPLY_MARKER = 'PLAINTEXT-REPLY-MARKER'

const wordCard: WordCard = {
  word: 'disorder',
  phonetic: '/dɪsˈɔːdə/',
  partOfSpeech: 'noun',
  definition: '混乱',
  collocations: null,
  example: null,
  exampleZh: null,
}

class FakeAIClient implements AIClientPort {
  readonly requests: AIChatRequest[] = []

  constructor(private readonly failure?: Error) {}

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    this.requests.push(request)
    if (this.failure) throw this.failure
    return {
      content: REPLY_MARKER,
      meta: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        latencyMs: 640,
        attempts: 1,
        usage: { promptTokens: 200, completionTokens: 60, totalTokens: 260 },
        finishReason: 'stop',
      },
    }
  }

  async chatStructured(): Promise<never> {
    throw new Error('chatStructured() is not used by the assistant use case')
  }
}

class FakeWordLookup implements WordLookupPort {
  constructor(private readonly card: WordCard | null) {}

  async findByWord(): Promise<WordCard | null> {
    return this.card
  }
}

function harness(options: { card?: WordCard | null; aiFailure?: Error } = {}) {
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  const aiClient = new FakeAIClient(options.aiFailure)
  const useCase = new ReplyToAssistantQueryUseCase({
    aiClient,
    wordLookup: new FakeWordLookup(options.card === undefined ? wordCard : options.card),
  })

  // 等价于 `POST /api/assistant` Route 中 runInTrace(..., 'http.assistant') 的行为。
  const run = () =>
    runInTrace(recorder, 'http.assistant', { category: 'http', metadata: { 'http.route': '/api/assistant' } }, (trace) =>
      useCase.execute({ query: QUERY_MARKER }, { trace }),
    )

  return { recorder, useCase, aiClient, run }
}

function spans(record: TraceRecord | undefined) {
  if (!record) throw new Error('trace not recorded')
  return record.spans
}

describe('ReplyToAssistantQueryUseCase — trace 关联', () => {
  it('HTTP → Use Case → 词卡查询 → AI 调用 在同一 trace 下且父子关系正确', async () => {
    const { recorder, run } = harness()

    const result = await run()
    const record = recorder.getLastTrace()

    expect(result.reply).toBe(REPLY_MARKER)
    expect(record?.status).toBe('ok')
    expect(spans(record).map((span) => span.name)).toEqual([
      'http.assistant',
      'assistant.reply',
      'assistant.word_lookup',
      'ai.chat',
    ])
    expect(new Set(spans(record).map((span) => span.traceId))).toEqual(new Set([record?.traceId]))
    expect(spans(record).map((span) => span.parentSpanId)).toEqual([
      null,
      record?.spans[0].spanId,
      record?.spans[1].spanId,
      record?.spans[1].spanId,
    ])
    expect(spans(record).map((span) => span.category)).toEqual([
      'http',
      'use_case',
      'persistence',
      'ai',
    ])

    expect(spans(record)[2].metadata).toMatchObject({
      'assistant.lookupKeyLength': QUERY_MARKER.length,
      'assistant.wordFound': true,
    })
    expect(spans(record)[3].metadata).toMatchObject({
      'ai.operation': 'chat',
      'ai.provider': 'deepseek',
      'ai.model': 'deepseek-chat',
      'ai.usage.totalTokens': 260,
      'ai.finishReason': 'stop',
      'label.useCase': 'assistant.qa',
      'label.promptVersion': '1.0',
    })
    expect(spans(record)[1].metadata).toMatchObject({ 'assistant.wordFound': true })
    expect(recorder.activeTraceCount()).toBe(0)
    expect(recorder.getLifecycleViolations()).toEqual([])
  })

  it('默认不记录用户查询文本与模型输出（只记录尺寸 / 计数 / 命中情况）', async () => {
    const { recorder, run } = harness()

    await run()

    const serialized = JSON.stringify(recorder.getLastTrace())
    expect(serialized).not.toContain(QUERY_MARKER)
    expect(serialized).not.toContain(REPLY_MARKER)
    expect(serialized).not.toContain('disorder')
  })

  it('词卡未命中：仍然完成，span 记录 found=false 且不报错', async () => {
    const { recorder, run } = harness({ card: null })

    const result = await run()
    const record = recorder.getLastTrace()

    expect(result.wordData).toBeNull()
    expect(record?.status).toBe('ok')
    expect(spans(record)).toHaveLength(4)
    expect(spans(record)[2].metadata).toMatchObject({ 'assistant.wordFound': false })
  })

  it('AI 失败：AI span 记录归一化错误，trace 被标记为失败但错误原样抛给上层', async () => {
    const failure = new AIError('timeout', 'AI request timed out after 30000ms (deepseek)', {
      provider: 'deepseek',
    })
    const { recorder, run } = harness({ aiFailure: failure })

    const thrown = await run().catch((error: unknown) => error)
    const record = recorder.getLastTrace()

    expect(thrown).toBe(failure)
    expect(record?.status).toBe('error')
    expect(record?.error).toMatchObject({ code: 'timeout' })
    expect(spans(record).find((span) => span.name === 'ai.chat')).toMatchObject({
      status: 'error',
      error: { code: 'timeout', provider: 'deepseek', retryable: true },
    })
    expect(spans(record).find((span) => span.name === 'assistant.reply')?.status).toBe('error')
    expect(recorder.activeTraceCount()).toBe(0)
    expect(recorder.getLifecycleViolations()).toEqual([])
  })

  it('未提供 ExecutionContext 时行为不变（Null Object）', async () => {
    const { useCase } = harness()

    const result = await useCase.execute({ query: QUERY_MARKER })

    expect(result.reply).toBe(REPLY_MARKER)
    expect(result.wordData).toEqual(wordCard)
  })
})
