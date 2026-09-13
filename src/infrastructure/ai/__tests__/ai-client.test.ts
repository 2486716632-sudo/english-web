import { describe, it, expect, vi } from 'vitest'
import { AIError, type AIStructuredSchema } from '@/application/ports/ai-client'
import { AIClient, DEFAULT_AI_TIMEOUT_MS, DEFAULT_AI_TOTAL_BUDGET_MS } from '@/infrastructure/ai/ai-client'
import type { AIProviderAdapter, ProviderChatRequest, ProviderChatResponse } from '@/infrastructure/ai/adapters/types'

type Step = { ok: true; response: Partial<ProviderChatResponse> } | { ok: false; error: Error }

class FakeAdapter implements AIProviderAdapter {
  readonly provider = 'fake'
  readonly defaultModel = 'fake-model'
  readonly requests: ProviderChatRequest[] = []
  private index = 0

  constructor(private readonly steps: Step[]) {}

  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    this.requests.push(request)
    const step = this.steps[Math.min(this.index, this.steps.length - 1)]
    this.index += 1
    if (!step.ok) throw step.error
    return { content: '', model: request.model, ...step.response }
  }
}

/** 永远不返回，直到被 abort（用于验证超时归一化）。 */
const hangingAdapter: AIProviderAdapter = {
  provider: 'hang',
  defaultModel: 'hang-model',
  chat: (_request, signal) =>
    new Promise<ProviderChatResponse>((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('This operation was aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }),
}

const okResponse = (content: string): Step => ({
  ok: true,
  response: { content, model: 'fake-model', finishReason: 'stop', usage: { totalTokens: 5 } },
})

function clientWith(adapter: AIProviderAdapter, overrides: Partial<ConstructorParameters<typeof AIClient>[0]> = {}) {
  return new AIClient({ adapter, ...overrides })
}

const oneMessage = [{ role: 'user' as const, content: 'hi' }]

interface Demo {
  title: string
}

const demoSchema: AIStructuredSchema<Demo> = {
  name: 'demo',
  validate(value: unknown): value is Demo {
    return (
      !!value &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).title === 'string' &&
      ((value as Record<string, unknown>).title as string).length > 0
    )
  },
}

describe('AIClient — 成功路径', () => {
  it('返回 content 与归一化 metadata', async () => {
    const adapter = new FakeAdapter([okResponse('hello')])
    const client = clientWith(adapter)

    const result = await client.chat({ messages: oneMessage })

    expect(result.content).toBe('hello')
    expect(result.meta).toMatchObject({
      provider: 'fake',
      model: 'fake-model',
      attempts: 1,
      finishReason: 'stop',
      usage: { totalTokens: 5 },
    })
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('默认值：未指定 model 时使用 adapter 默认模型，未指定超时时使用默认超时', async () => {
    const adapter = new FakeAdapter([okResponse('x')])
    const client = clientWith(adapter)

    await client.chat({ messages: oneMessage })

    expect(adapter.requests[0].model).toBe('fake-model')
    expect(DEFAULT_AI_TIMEOUT_MS).toBe(30_000)
    expect(DEFAULT_AI_TOTAL_BUDGET_MS).toBe(30_000)
  })

  it('调用方指定的 model / temperature / maxTokens / responseFormat 传递到 adapter', async () => {
    const adapter = new FakeAdapter([okResponse('x')])
    const client = clientWith(adapter)

    await client.chat({
      messages: oneMessage,
      model: 'explicit-model',
      temperature: 0.3,
      maxTokens: 512,
      responseFormat: 'json_object',
    })

    expect(adapter.requests[0]).toEqual({
      model: 'explicit-model',
      messages: oneMessage,
      temperature: 0.3,
      maxTokens: 512,
      jsonObject: true,
    })
  })

  it('provider-neutral metadata 不会发送给 provider', async () => {
    const adapter = new FakeAdapter([okResponse('x')])
    const client = clientWith(adapter)

    await client.chat({ messages: oneMessage, metadata: { useCase: 'assistant.qa', promptVersion: '1.0' } })

    expect(Object.keys(adapter.requests[0]).sort()).toEqual([
      'jsonObject',
      'maxTokens',
      'messages',
      'model',
      'temperature',
    ])
  })
})

describe('AIClient — 超时', () => {
  it('provider 超时被归一化为 timeout 错误（可重试）', async () => {
    const client = clientWith(hangingAdapter, { defaultTimeoutMs: 20, defaultTotalBudgetMs: 20 })

    const error = (await client
      .chat({ messages: oneMessage, timeoutMs: 20, totalBudgetMs: 20, retry: { maxAttempts: 1 } })
      .catch((e: unknown) => e)) as AIError

    expect(error).toBeInstanceOf(AIError)
    expect(error.code).toBe('timeout')
    expect(error.retryable).toBe(true)
    expect(error.message).toContain('timed out')
  })

  it('整体预算耗尽后不再发起新的尝试', async () => {
    let clock = 0
    const adapter = new FakeAdapter([
      { ok: false, error: new AIError('provider_error', 'always 500') },
    ])
    const client = clientWith(adapter, {
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms
      },
      random: () => 0.5,
    })

    await expect(
      client.chat({
        messages: oneMessage,
        totalBudgetMs: 200,
        retry: { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 500, jitterRatio: 0 },
      }),
    ).rejects.toMatchObject({ code: 'provider_error' })

    expect(adapter.requests).toHaveLength(1)
  })
})

describe('AIClient — 重试', () => {
  it('可重试失败后成功，attempts 与退避正确', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
    const adapter = new FakeAdapter([
      { ok: false, error: new AIError('provider_error', '500') },
      { ok: false, error: new AIError('rate_limited', '429') },
      okResponse('recovered'),
    ])
    const client = clientWith(adapter, { sleep, random: () => 0.5 })

    const result = await client.chat({ messages: oneMessage })

    expect(result.content).toBe('recovered')
    expect(result.meta.attempts).toBe(3)
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000])
  })

  it('不可重试错误（auth_error）不重试', async () => {
    const sleep = vi.fn(async () => {})
    const adapter = new FakeAdapter([{ ok: false, error: new AIError('auth_error', 'bad key') }])
    const client = clientWith(adapter, { sleep })

    await expect(client.chat({ messages: oneMessage })).rejects.toMatchObject({ code: 'auth_error' })
    expect(adapter.requests).toHaveLength(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('重试次数有上限（默认最多 3 次尝试）', async () => {
    const adapter = new FakeAdapter([{ ok: false, error: new AIError('provider_error', 'always 500') }])
    const client = clientWith(adapter, { sleep: async () => {} })

    await expect(client.chat({ messages: oneMessage })).rejects.toMatchObject({ code: 'provider_error' })
    expect(adapter.requests).toHaveLength(3)
  })

  it('调用方可通过 request.retry 关闭重试', async () => {
    const adapter = new FakeAdapter([{ ok: false, error: new AIError('provider_error', '500') }])
    const client = clientWith(adapter, { sleep: async () => {} })

    await expect(client.chat({ messages: oneMessage, retry: { maxAttempts: 1 } })).rejects.toMatchObject({
      code: 'provider_error',
    })
    expect(adapter.requests).toHaveLength(1)
  })
})

describe('AIClient — 结构化输出', () => {
  it('合法 JSON：解析 + 校验成功，并强制 json_object 模式', async () => {
    const adapter = new FakeAdapter([okResponse('{"title":"ok"}')])
    const client = clientWith(adapter)

    const result = await client.chatStructured({ messages: oneMessage }, demoSchema)

    expect(result.data).toEqual({ title: 'ok' })
    expect(result.meta.attempts).toBe(1)
    expect(adapter.requests[0].jsonObject).toBe(true)
  })

  it('fence 包裹的 JSON 同样可解析', async () => {
    const adapter = new FakeAdapter([okResponse('```json\n{"title":"fenced"}\n```')])
    const client = clientWith(adapter)

    const result = await client.chatStructured({ messages: oneMessage }, demoSchema)

    expect(result.data).toEqual({ title: 'fenced' })
  })

  it('解析失败 → 有界解析修复（默认 1 次）后成功', async () => {
    const adapter = new FakeAdapter([okResponse('not json at all'), okResponse('{"title":"repaired"}')])
    const client = clientWith(adapter)

    const result = await client.chatStructured({ messages: oneMessage }, demoSchema)

    expect(result.data).toEqual({ title: 'repaired' })
    expect(result.meta.attempts).toBe(2)
    expect(adapter.requests[1].messages.at(-1)?.content).toContain('demo')
    expect(adapter.requests[1].messages).toHaveLength(2)
  })

  it('多次无效结构化响应 → invalid_response（非重试码）', async () => {
    const adapter = new FakeAdapter([okResponse('nope')])
    const client = clientWith(adapter, { sleep: async () => {} })

    const error = (await client
      .chatStructured({ messages: oneMessage }, demoSchema)
      .catch((e: unknown) => e)) as AIError

    expect(error).toBeInstanceOf(AIError)
    expect(error.code).toBe('invalid_response')
    expect(error.retryable).toBe(false)
    expect(adapter.requests).toHaveLength(2)
  })

  it('maxRepairAttempts = 0 时不做解析修复', async () => {
    const adapter = new FakeAdapter([okResponse('nope')])
    const client = clientWith(adapter)

    await expect(
      client.chatStructured({ messages: oneMessage }, demoSchema, { maxRepairAttempts: 0 }),
    ).rejects.toMatchObject({ code: 'invalid_response' })

    expect(adapter.requests).toHaveLength(1)
  })

  it('HTTP 层失败仍然走网络重试，而不是解析修复', async () => {
    const adapter = new FakeAdapter([
      { ok: false, error: new AIError('provider_error', '500') },
      okResponse('{"title":"after retry"}'),
    ])
    const client = clientWith(adapter, { sleep: async () => {} })

    const result = await client.chatStructured({ messages: oneMessage }, demoSchema)

    expect(result.data).toEqual({ title: 'after retry' })
    expect(result.meta.attempts).toBe(2)
  })
})

/**
 * 单一总预算（external review v1, blocking issue #2）。
 *
 * `totalBudgetMs` 必须覆盖**整个**逻辑调用：网络重试与解析修复共享同一个 deadline，
 * 后续 provider 请求只拿到剩余预算；预算耗尽时不再发请求，失败归一化为 timeout。
 * 全部用注入的时钟（`now`/`sleep`）做确定性断言。
 */
describe('AIClient — chatStructured 单一总预算', () => {
  /** 适配器在指定调用序号上执行 `onCall`，再返回 `content`。 */
  function scriptedAdapter(
    script: Array<{ content?: string; error?: Error; advanceClockMs?: number }>,
    clock: { value: number },
    calls: ProviderChatRequest[],
  ): AIProviderAdapter {
    return {
      provider: 'fake',
      defaultModel: 'fake-model',
      chat: async (request, signal) => {
        const step = script[Math.min(calls.length, script.length - 1)]
        calls.push(request)
        if (step.advanceClockMs) clock.value += step.advanceClockMs
        if (step.error) throw step.error
        if (step.content !== undefined) return { content: step.content, model: 'fake-model' }
        // 没有内容也没有错误 → 挂起，直到被超时中止
        return new Promise<ProviderChatResponse>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = new Error('This operation was aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      },
    }
  }

  it('A. 解析修复共享原始总预算（修复请求只拿到剩余预算，而不是新预算）', async () => {
    const clock = { value: 0 }
    const calls: ProviderChatRequest[] = []
    // 第 1 次调用消耗 120ms 后返回无效 JSON；deadline = 150ms → 修复只剩 30ms。
    const adapter = scriptedAdapter(
      [{ content: 'not json', advanceClockMs: 120 }, {}],
      clock,
      calls,
    )
    const client = clientWith(adapter, { now: () => clock.value })

    const error = (await client
      .chatStructured(
        { messages: oneMessage, timeoutMs: 100, totalBudgetMs: 150 },
        demoSchema,
        { maxRepairAttempts: 1 },
      )
      .catch((e: unknown) => e)) as AIError

    expect(error).toBeInstanceOf(AIError)
    expect(error.code).toBe('timeout')
    expect(calls).toHaveLength(2)

    // 若每次修复都重新计时，这里应是 timeoutMs = 100ms；共享预算时必须小于它。
    const reported = Number(/timed out after (\d+)ms/.exec(error.message)?.[1])
    expect(Number.isNaN(reported)).toBe(false)
    expect(reported).toBeLessThan(100)
  })

  it('B. 预算耗尽后不再发起修复请求，失败归一化为 timeout', async () => {
    const clock = { value: 0 }
    const calls: ProviderChatRequest[] = []
    // 第 1 次调用把时钟推到 deadline 之后，同时返回无效 JSON。
    const adapter = scriptedAdapter([{ content: 'not json', advanceClockMs: 10_000 }], clock, calls)
    const client = clientWith(adapter, { now: () => clock.value })

    const error = (await client
      .chatStructured(
        { messages: oneMessage, timeoutMs: 100, totalBudgetMs: 150 },
        demoSchema,
        { maxRepairAttempts: 2 },
      )
      .catch((e: unknown) => e)) as AIError

    expect(error).toBeInstanceOf(AIError)
    expect(error.code).toBe('timeout')
    expect(error.retryable).toBe(true)
    expect(calls).toHaveLength(1) // 修复请求根本没有发出
  })

  it('C. 预算充足时网络重试与解析修复共享同一份预算并可成功', async () => {
    const clock = { value: 0 }
    const calls: ProviderChatRequest[] = []
    const adapter = scriptedAdapter(
      [
        { error: new AIError('provider_error', '500') },
        { content: 'not json' },
        { content: '{"title":"repaired"}' },
      ],
      clock,
      calls,
    )
    const client = clientWith(adapter, {
      now: () => clock.value,
      // 退避会推进同一时钟 → 消耗的是同一份总预算
      sleep: async (ms: number) => {
        clock.value += ms
      },
      random: () => 0.5,
    })

    const result = await client.chatStructured(
      { messages: oneMessage, timeoutMs: 900, totalBudgetMs: 1000 },
      demoSchema,
      { maxRepairAttempts: 1 },
    )

    expect(result.data).toEqual({ title: 'repaired' })
    expect(result.meta.attempts).toBe(3) // 1 次重试 + 1 次修复 + 1 次成功
    expect(calls).toHaveLength(3)
  })

  it('D. 普通 chat() 的有界重试行为不受结构化预算改动影响', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
    const adapter = new FakeAdapter([{ ok: false, error: new AIError('provider_error', 'always 500') }])
    const client = clientWith(adapter, { sleep })

    await expect(client.chat({ messages: oneMessage })).rejects.toMatchObject({ code: 'provider_error' })
    expect(adapter.requests).toHaveLength(3) // 默认 maxAttempts = 3
    expect(sleep).toHaveBeenCalledTimes(2)
  })
})
