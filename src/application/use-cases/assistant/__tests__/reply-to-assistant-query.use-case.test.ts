import { describe, it, expect } from 'vitest'
import {
  AIError,
  type AIChatRequest,
  type AIChatResult,
  type AIClientPort,
  type AIStructuredResult,
  type AIStructuredSchema,
} from '@/application/ports/ai-client'
import type { WordCard, WordLookupPort } from '@/application/ports/word-lookup'
import {
  ReplyToAssistantQueryUseCase,
  deriveWordLookupKey,
} from '@/application/use-cases/assistant/reply-to-assistant-query.use-case'

const fakeMeta = { provider: 'fake', model: 'fake-model', latencyMs: 1, attempts: 1 }

class FakeAIClient implements AIClientPort {
  readonly requests: AIChatRequest[] = []
  readonly structuredCalls: string[] = []

  constructor(private readonly behavior: { content?: string; error?: Error } = {}) {}

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    this.requests.push(request)
    if (this.behavior.error) throw this.behavior.error
    return { content: this.behavior.content ?? '', meta: fakeMeta }
  }

  async chatStructured<T>(
    _request: AIChatRequest,
    schema: AIStructuredSchema<T>,
  ): Promise<AIStructuredResult<T>> {
    this.structuredCalls.push(schema.name)
    throw new Error('chatStructured is not used by the Phase 3 reference migration')
  }
}

class FakeWordLookup implements WordLookupPort {
  readonly calls: string[] = []

  constructor(private readonly card: WordCard | null) {}

  async findByWord(word: string): Promise<WordCard | null> {
    this.calls.push(word)
    return this.card
  }
}

const sampleCard: WordCard = {
  word: 'disorder',
  phonetic: '/dɪsˈɔːdə/',
  partOfSpeech: 'n.',
  definition: '混乱；失调',
  collocations: 'eating disorder 饮食失调',
  example: 'The room was in complete disorder. ||| He suffers from a sleep disorder.',
  exampleZh: '房间里一片混乱。 ||| 他患有睡眠障碍。',
}

describe('deriveWordLookupKey', () => {
  it('取 query 的首个词并去掉非字母字符', () => {
    expect(deriveWordLookupKey({ query: 'disorder, please' })).toBe('disorder')
    expect(deriveWordLookupKey({ query: '  Abide-by  ' })).toBe('Abide-by')
    expect(deriveWordLookupKey({ query: '“serendipity”' })).toBe('serendipity')
  })

  it('没有 query 时使用最后一条消息', () => {
    expect(
      deriveWordLookupKey({
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'ai', content: 'ok' },
          { role: 'user', content: 'abandon ship!' },
        ],
      }),
    ).toBe('abandon')
  })

  it('纯中文或空输入 → 空 key', () => {
    expect(deriveWordLookupKey({ query: '你好' })).toBe('')
    expect(deriveWordLookupKey({})).toBe('')
  })
})

describe('ReplyToAssistantQueryUseCase', () => {
  it('返回 AI 回复与词卡，并把推导出的 key 交给 WordLookupPort', async () => {
    const aiClient = new FakeAIClient({ content: 'disorder 的意思是混乱。' })
    const wordLookup = new FakeWordLookup(sampleCard)
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup })

    const result = await useCase.execute({ query: 'disorder' })

    expect(result).toEqual({ reply: 'disorder 的意思是混乱。', wordData: sampleCard })
    expect(wordLookup.calls).toEqual(['disorder'])
  })

  it('词卡不存在或数据源降级时仍返回回复（wordData = null）', async () => {
    const aiClient = new FakeAIClient({ content: 'hi' })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    const result = await useCase.execute({ query: 'nonexistentword' })

    expect(result.wordData).toBeNull()
    expect(result.reply).toBe('hi')
  })

  it('无有效查询键时不触发词卡查询', async () => {
    const aiClient = new FakeAIClient({ content: 'hi' })
    const wordLookup = new FakeWordLookup(sampleCard)
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup })

    await useCase.execute({ query: '你好' })

    expect(wordLookup.calls).toEqual([])
  })

  it('把词卡数据注入 system prompt（作为主数据源）', async () => {
    const aiClient = new FakeAIClient({ content: 'ok' })
    const useCase = new ReplyToAssistantQueryUseCase({
      aiClient,
      wordLookup: new FakeWordLookup(sampleCard),
    })

    await useCase.execute({ query: 'disorder' })

    const system = aiClient.requests[0].messages[0]
    expect(system.role).toBe('system')
    expect(system.content).toContain('## Word data found in database (use this as the primary source):')
    expect(system.content).toContain('Word: disorder')
    expect(system.content).toContain('Phonetic: /dɪsˈɔːdə/')
    expect(system.content).toContain('Definition: 混乱；失调')
    expect(system.content).toContain('Example ZH: 房间里一片混乱。 ||| 他患有睡眠障碍。')
  })

  it('无词卡时 system prompt 不含词卡数据段', async () => {
    const aiClient = new FakeAIClient({ content: 'ok' })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    await useCase.execute({ query: 'nonexistentword' })

    expect(aiClient.requests[0].messages[0].content).not.toContain('Word data found in database')
  })

  it('把 UI 的 ai 角色映射为 provider 的 assistant，并保留历史顺序', async () => {
    const aiClient = new FakeAIClient({ content: 'ok' })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    await useCase.execute({
      messages: [
        { role: 'user', content: 'q1' },
        { role: 'ai', content: 'a1' },
        { role: 'user', content: 'q2' },
      ],
    })

    expect(aiClient.requests[0].messages).toEqual([
      { role: 'system', content: expect.any(String) },
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ])
  })

  it('AI 调用参数与迁移前保持一致，且超时显式', async () => {
    const aiClient = new FakeAIClient({ content: 'ok' })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    await useCase.execute({ query: 'hello' })

    const request = aiClient.requests[0]
    expect(request.temperature).toBe(0.7)
    expect(request.maxTokens).toBe(1024)
    expect(request.timeoutMs).toBe(30_000)
    expect(request.totalBudgetMs).toBe(30_000)
    expect(request.responseFormat).toBeUndefined()
    expect(request.metadata).toMatchObject({ useCase: 'assistant.qa' })
  })

  it('显式退出网络重试（maxAttempts = 1），保持迁移前"只发一次请求"的行为', async () => {
    const aiClient = new FakeAIClient({ content: 'ok' })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    await useCase.execute({ query: 'hello' })

    expect(aiClient.requests[0].retry).toEqual({ maxAttempts: 1 })
  })

  it('只是关闭网络重试，其余迁移前参数不受影响', async () => {
    const aiClient = new FakeAIClient({ content: 'ok' })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    await useCase.execute({ query: 'hello' })

    const request = aiClient.requests[0]
    expect(Object.keys(request).sort()).toEqual(
      ['maxTokens', 'messages', 'metadata', 'retry', 'temperature', 'timeoutMs', 'totalBudgetMs'].sort(),
    )
    expect(request.model).toBeUndefined()
    expect(request.responseFormat).toBeUndefined()
  })

  it('AI 失败向上抛出 AIError（由 Route 统一映射为友好回复）', async () => {
    const aiClient = new FakeAIClient({ error: new AIError('provider_error', 'DeepSeek HTTP 500: boom') })
    const useCase = new ReplyToAssistantQueryUseCase({ aiClient, wordLookup: new FakeWordLookup(null) })

    await expect(useCase.execute({ query: 'hello' })).rejects.toMatchObject({
      code: 'provider_error',
      message: 'DeepSeek HTTP 500: boom',
    })
  })
})
