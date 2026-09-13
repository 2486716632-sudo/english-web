import { describe, it, expect, vi } from 'vitest'
import { AIError, type AIErrorCode } from '@/application/ports/ai-client'
import {
  DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_DEFAULT_MODEL,
  DeepSeekAdapter,
} from '@/infrastructure/ai/adapters/deepseek.adapter'

interface CapturedCall {
  url: string
  init: RequestInit
}

function createAdapter(options: {
  response: Response | (() => Response)
  apiKey?: string | undefined
  baseUrl?: string
  defaultModel?: string
}) {
  const calls: CapturedCall[] = []
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return typeof options.response === 'function' ? options.response() : options.response
  })

  const adapter = new DeepSeekAdapter({
    apiKey: 'apiKey' in options ? options.apiKey : 'test-key',
    baseUrl: options.baseUrl,
    defaultModel: options.defaultModel,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  return { adapter, calls, fetchImpl }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const completion = {
  model: 'deepseek-chat',
  choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
}

describe('DeepSeekAdapter — 默认值', () => {
  it('未提供 baseUrl / model 时使用 DeepSeek 默认值', () => {
    const { adapter } = createAdapter({ response: jsonResponse(completion) })
    expect(adapter.provider).toBe('deepseek')
    expect(adapter.defaultModel).toBe(DEEPSEEK_DEFAULT_MODEL)
  })
})

describe('DeepSeekAdapter — 请求翻译', () => {
  it('翻译为 /v1/chat/completions POST，带 Bearer 认证与 OpenAI 兼容 body', async () => {
    const { adapter, calls } = createAdapter({ response: jsonResponse(completion) })

    await adapter.chat(
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'prev' },
        ],
        temperature: 0.7,
        maxTokens: 1024,
      },
      new AbortController().signal,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${DEEPSEEK_DEFAULT_BASE_URL}/v1/chat/completions`)
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    })
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'prev' },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    })
  })

  it('jsonObject=true 时附加 response_format', async () => {
    const { adapter, calls } = createAdapter({ response: jsonResponse(completion) })

    await adapter.chat(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], jsonObject: true },
      new AbortController().signal,
    )

    expect(JSON.parse(String(calls[0].init.body)).response_format).toEqual({ type: 'json_object' })
  })

  it('未提供的可选参数不会被写入请求体', async () => {
    const { adapter, calls } = createAdapter({ response: jsonResponse(completion) })

    await adapter.chat(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
      new AbortController().signal,
    )

    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['messages', 'model'])
  })

  it('自定义 baseUrl 会被使用', async () => {
    const { adapter, calls } = createAdapter({
      response: jsonResponse(completion),
      baseUrl: 'https://example.test',
    })

    await adapter.chat(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
      new AbortController().signal,
    )

    expect(calls[0].url).toBe('https://example.test/v1/chat/completions')
  })
})

describe('DeepSeekAdapter — 响应翻译', () => {
  it('提取 content / model / finishReason / token usage', async () => {
    const { adapter } = createAdapter({ response: jsonResponse(completion) })

    const result = await adapter.chat(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
      new AbortController().signal,
    )

    expect(result).toEqual({
      content: 'hello',
      model: 'deepseek-chat',
      finishReason: 'stop',
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
    })
  })

  it('缺少 usage 时返回 undefined 而不是伪造数字', async () => {
    const { adapter } = createAdapter({
      response: jsonResponse({ model: 'deepseek-chat', choices: [{ message: { content: 'x' } }] }),
    })

    const result = await adapter.chat(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
      new AbortController().signal,
    )

    expect(result.usage).toBeUndefined()
    expect(result.finishReason).toBeUndefined()
  })

  it('空 choices / 空 content 翻译为空字符串', async () => {
    const { adapter } = createAdapter({ response: jsonResponse({ choices: [] }) })

    const result = await adapter.chat(
      { model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] },
      new AbortController().signal,
    )

    expect(result.content).toBe('')
    expect(result.model).toBe('deepseek-chat')
  })

  it('HTTP 200 但响应体不是 JSON → invalid_response（不可重试，且不算网络失败）', async () => {
    const bodies = ['this is not json', '']

    for (const body of bodies) {
      const { adapter } = createAdapter({ response: new Response(body, { status: 200 }) })

      const error = (await adapter
        .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }, new AbortController().signal)
        .catch((e: unknown) => e)) as AIError

      expect(error).toBeInstanceOf(AIError)
      expect(error).toMatchObject({
        code: 'invalid_response',
        retryable: false,
        provider: 'deepseek',
        status: 200,
      })
      // 原始解析错误保留为 cause，但响应体内容不回显到 message
      expect(error.cause).toBeInstanceOf(Error)
      expect(error.message).not.toContain('this is not json')
    }
  })
})

describe('DeepSeekAdapter — 错误映射', () => {
  const cases: Array<{ status: number; code: AIErrorCode; retryable: boolean }> = [
    { status: 400, code: 'invalid_request', retryable: false },
    { status: 401, code: 'auth_error', retryable: false },
    { status: 403, code: 'auth_error', retryable: false },
    { status: 408, code: 'timeout', retryable: true },
    { status: 422, code: 'invalid_request', retryable: false },
    { status: 429, code: 'rate_limited', retryable: true },
    { status: 500, code: 'provider_error', retryable: true },
    { status: 503, code: 'provider_error', retryable: true },
    { status: 418, code: 'unknown', retryable: false },
  ]

  for (const { status, code, retryable } of cases) {
    it(`HTTP ${status} → ${code} (retryable=${retryable})`, async () => {
      const { adapter } = createAdapter({ response: jsonResponse({ error: 'nope' }, status) })

      const error = await adapter
        .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }, new AbortController().signal)
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AIError)
      expect(error).toMatchObject({ code, retryable, status, provider: 'deepseek' })
    })
  }

  it('错误信息保留 provider 文案（与迁移前格式一致）并截断超长错误体', async () => {
    const { adapter } = createAdapter({ response: new Response('x'.repeat(1000), { status: 500 }) })

    const error = (await adapter
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }, new AbortController().signal)
      .catch((e: unknown) => e)) as AIError

    expect(error.message.startsWith('DeepSeek HTTP 500: ')).toBe(true)
    expect(error.message.length).toBe('DeepSeek HTTP 500: '.length + 200)
  })

  it('网络层异常被归一化为 network_error 且信息保留', async () => {
    const { adapter } = createAdapter({
      response: () => {
        throw new TypeError('fetch failed')
      },
    })

    const error = (await adapter
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }, new AbortController().signal)
      .catch((e: unknown) => e)) as AIError

    expect(error).toMatchObject({ code: 'network_error', retryable: true, provider: 'deepseek' })
    expect(error.message).toBe('fetch failed')
  })

  it('未配置 API Key 时仍按现状发出请求（由 provider 返回 401）', async () => {
    const { adapter, calls } = createAdapter({ response: jsonResponse({}, 401), apiKey: undefined })

    const error = (await adapter
      .chat({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }, new AbortController().signal)
      .catch((e: unknown) => e)) as AIError

    expect(calls).toHaveLength(1)
    expect(error.code).toBe('auth_error')
  })
})
