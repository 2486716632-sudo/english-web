import { describe, it, expect } from 'vitest'
import {
  AIError,
  type AIChatRequest,
  type AIChatResult,
  type AICallMeta,
  type AIClientPort,
  type AIStructuredResult,
  type AIStructuredSchema,
} from '@/application/ports/ai-client'
import { withAITracing, AI_CHAT_SPAN_NAME, AI_CHAT_STRUCTURED_SPAN_NAME } from '@/application/observability/traced-ai-client'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * AI 调用可观测性（Phase 5 任务文档 Part 7 / Part 13 第 5、6、11、12 项）。
 * 用假 AIClientPort：不访问真实 provider。
 */

const PROMPT_MARKER = 'PLAINTEXT-PROMPT-MARKER-9f2c'
const OUTPUT_MARKER = 'PLAINTEXT-OUTPUT-MARKER-4a71'

const baseMeta: AICallMeta = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  latencyMs: 812,
  attempts: 2,
  usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 },
  finishReason: 'stop',
}

class FakeAIClient implements AIClientPort {
  readonly chatRequests: AIChatRequest[] = []
  readonly structuredRequests: AIChatRequest[] = []

  constructor(private readonly failure?: Error) {}

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    this.chatRequests.push(request)
    if (this.failure) throw this.failure
    return { content: OUTPUT_MARKER, meta: baseMeta }
  }

  async chatStructured<T>(
    request: AIChatRequest,
  ): Promise<AIStructuredResult<T>> {
    this.structuredRequests.push(request)
    if (this.failure) throw this.failure
    return { data: { ok: true } as T, meta: baseMeta }
  }
}

const schema: AIStructuredSchema<{ ok: boolean }> = {
  name: 'article-processing',
  validate(value: unknown): value is { ok: boolean } {
    return !!value && typeof value === 'object' && 'ok' in (value as Record<string, unknown>)
  },
}

function harness(inner: AIClientPort = new FakeAIClient()) {
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  const trace = recorder.startTrace('http.assistant', { category: 'http' })
  return { recorder, trace, inner, client: withAITracing(inner, trace) }
}

describe('withAITracing — chat()', () => {
  it('记录 provider / model / latency / attempts / usage / finishReason，且不改变返回值', async () => {
    const { recorder, trace, client } = harness()

    const result = await client.chat({
      messages: [{ role: 'user', content: PROMPT_MARKER }],
      temperature: 0.7,
      maxTokens: 1024,
      timeoutMs: 30_000,
      totalBudgetMs: 30_000,
      retry: { maxAttempts: 1 },
      metadata: { useCase: 'assistant.qa', promptVersion: '1.0' },
    })
    trace.end('ok')

    expect(result.content).toBe(OUTPUT_MARKER)
    const span = recorder.getLastTrace()?.spans[1]
    expect(span).toMatchObject({
      name: AI_CHAT_SPAN_NAME,
      category: 'ai',
      status: 'ok',
      parentSpanId: trace.spanId,
    })
    expect(span?.metadata).toMatchObject({
      'ai.operation': 'chat',
      'ai.provider': 'deepseek',
      'ai.model': 'deepseek-chat',
      'ai.latencyMs': 812,
      'ai.attempts': 2,
      'ai.usage.promptTokens': 120,
      'ai.usage.completionTokens': 40,
      'ai.usage.totalTokens': 160,
      'ai.finishReason': 'stop',
      'ai.response.chars': OUTPUT_MARKER.length,
      'ai.request.messageCount': 1,
      'ai.request.promptChars': PROMPT_MARKER.length,
      'ai.request.temperature': 0.7,
      'ai.request.maxTokens': 1024,
      'ai.request.retryMaxAttempts': 1,
      'label.useCase': 'assistant.qa',
      'label.promptVersion': '1.0',
    })
  })

  it('默认不记录 prompt / 模型输出内容（metadata-first）', async () => {
    const { recorder, trace, client } = harness()

    await client.chat({ messages: [{ role: 'user', content: PROMPT_MARKER }] })
    trace.end('ok')

    const serialized = JSON.stringify(recorder.getLastTrace())
    expect(serialized).not.toContain(PROMPT_MARKER)
    expect(serialized).not.toContain(OUTPUT_MARKER)

    const metadataKeys = Object.keys(recorder.getLastTrace()?.spans[1].metadata ?? {})
    for (const forbidden of ['prompt', 'content', 'messages', 'output', 'response', 'text']) {
      expect(metadataKeys).not.toContain(forbidden)
    }
  })

  it('provider 未暴露 usage 时不写 token 键（不伪造 0）', async () => {
    class NoUsageClient extends FakeAIClient {
      override async chat(): Promise<AIChatResult> {
        return { content: 'x', meta: { provider: 'fake', model: 'fake-model', latencyMs: 3, attempts: 1 } }
      }
    }
    const { recorder, trace, client } = harness(new NoUsageClient())

    await client.chat({ messages: [{ role: 'user', content: 'hi' }] })
    trace.end('ok')

    const metadata = recorder.getLastTrace()?.spans[1].metadata ?? {}
    expect(metadata).not.toHaveProperty('ai.usage.totalTokens')
    expect(metadata).not.toHaveProperty('ai.finishReason')
    expect(metadata['ai.provider']).toBe('fake')
  })

  it('AI 失败：span 标记 error，并记录归一化 code / provider / retryable，错误原样重抛', async () => {
    const failure = new AIError('rate_limited', 'DeepSeek HTTP 429: slow down', {
      status: 429,
      provider: 'deepseek',
    })
    const { recorder, trace, client } = harness(new FakeAIClient(failure))

    const thrown = await client.chat({ messages: [{ role: 'user', content: 'hi' }] }).catch((error: unknown) => error)
    trace.end('error')

    expect(thrown).toBe(failure)
    expect(recorder.getLastTrace()?.spans[1]).toMatchObject({
      name: AI_CHAT_SPAN_NAME,
      status: 'error',
      error: {
        code: 'rate_limited',
        provider: 'deepseek',
        retryable: true,
        status: 429,
        operation: 'ai.call',
      },
    })
  })

  it('调用标签里的密钥字段被清洗（不进入 trace）', async () => {
    const { recorder, trace, client } = harness()

    await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      metadata: { useCase: 'assistant.qa', DEEPSEEK_API_KEY: 'sk-live-0123456789abcdef' },
    })
    trace.end('ok')

    const serialized = JSON.stringify(recorder.getLastTrace())
    expect(serialized).not.toContain('sk-live-0123456789abcdef')
    expect(recorder.getLastTrace()?.spans[1].metadata['label.useCase']).toBe('assistant.qa')
  })

  /**
   * 外部审核 v1 阻断问题 B-01：`AIChatRequest.metadata` 是自由 `Record<string, string>`，
   * 因此只在**源头**搬运明确批准的标签，其余（含内容型 / 凭据型键）在加 `label.` 前缀之前就被丢弃。
   */
  it('未批准的调用标签不会进入 trace（prompt / query / content / output / apiKey）', async () => {
    const { recorder, trace, client } = harness()

    await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      metadata: {
        useCase: 'assistant.qa',
        step: 'qa',
        promptVersion: '1.0',
        prompt: 'SECRET_PROMPT_TEXT',
        query: 'USER_QUERY_TEXT',
        content: 'USER_CONTENT_TEXT',
        output: 'MODEL_OUTPUT_TEXT',
        apiKey: 'sk-live-0123456789abcdef',
      },
    })
    trace.end('ok')

    const record = recorder.getLastTrace()
    const metadata = record?.spans[1].metadata ?? {}

    // 已批准的标签仍然存在
    expect(metadata).toMatchObject({
      'label.useCase': 'assistant.qa',
      'label.step': 'qa',
      'label.promptVersion': '1.0',
    })

    // 未批准的标签连键都不存在，marker 文本不出现在序列化后的 TraceRecord 中
    for (const key of [
      'label.prompt',
      'label.query',
      'label.content',
      'label.output',
      'label.apiKey',
    ]) {
      expect(metadata).not.toHaveProperty(key)
    }
    const serialized = JSON.stringify(record)
    for (const marker of [
      'SECRET_PROMPT_TEXT',
      'USER_QUERY_TEXT',
      'USER_CONTENT_TEXT',
      'MODEL_OUTPUT_TEXT',
      'sk-live-0123456789abcdef',
    ]) {
      expect(serialized).not.toContain(marker)
    }
    expect(recorder.getLifecycleViolations()).toEqual([])
  })

  it('标签大小写 / 命名空间变体同样不会绕过 allowlist', async () => {
    const { recorder, trace, client } = harness()

    await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      metadata: {
        USECASE: 'assistant.qa',
        Prompt: 'SECRET_PROMPT_TEXT',
        'label.prompt': 'SECRET_PROMPT_TEXT',
        'label.useCase': 'spoofed.value',
      },
    })
    trace.end('ok')

    const serialized = JSON.stringify(recorder.getLastTrace()?.spans[1].metadata ?? {})
    expect(serialized).not.toContain('SECRET_PROMPT_TEXT')
    expect(serialized).not.toContain('spoofed.value')
    // 大小写不敏感地识别已批准标签，并写回规范名
    expect(recorder.getLastTrace()?.spans[1].metadata['label.useCase']).toBe('assistant.qa')
  })
})

describe('withAITracing — chatStructured()', () => {
  it('span 名为 ai.chat_structured，记录 schema 名与解析修复上限', async () => {
    const { recorder, trace, client } = harness()

    const result = await client.chatStructured(
      {
        messages: [{ role: 'user', content: PROMPT_MARKER }],
        metadata: { useCase: 'reading.ingest', step: 'process-article' },
      },
      schema,
      { maxRepairAttempts: 0 },
    )
    trace.end('ok')

    expect(result.data).toEqual({ ok: true })
    expect(recorder.getLastTrace()?.spans[1]).toMatchObject({
      name: AI_CHAT_STRUCTURED_SPAN_NAME,
      category: 'ai',
      status: 'ok',
      metadata: {
        'ai.operation': 'chatStructured',
        'ai.schema': 'article-processing',
        'ai.repairAllowed': 0,
        'label.useCase': 'reading.ingest',
        'label.step': 'process-article',
      },
    })
  })

  it('结构化失败（invalid_response）：span error + code，且不记录原始响应内容', async () => {
    const failure = new AIError('invalid_response', `Structured output for "x" failed validation: not JSON`)
    const { recorder, trace, client } = harness(new FakeAIClient(failure))

    await client
      .chatStructured({ messages: [{ role: 'user', content: PROMPT_MARKER }] }, schema, {
        maxRepairAttempts: 0,
      })
      .catch(() => undefined)
    trace.end('degraded')

    const span = recorder.getLastTrace()?.spans[1]
    expect(span?.status).toBe('error')
    expect(span?.error).toMatchObject({ code: 'invalid_response', retryable: false })
    expect(JSON.stringify(recorder.getLastTrace())).not.toContain(OUTPUT_MARKER)
  })
})
