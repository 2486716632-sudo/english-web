import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AIError } from '@/application/ports/ai-client'

/**
 * `POST /api/assistant` Route 级测试。
 *
 * Phase 2 明确把该 Route 的自动化测试推迟到 Phase 3，原因正是缺少可注入的 AI Client 接缝。
 * 这里通过 mock Composition Root 注入假 Use Case，因此**不会调用真实 DeepSeek**。
 */

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('@/bootstrap', () => ({
  getAssistantReplyUseCase: () => ({ execute: mocks.execute }),
}))

const { POST } = await import('@/app/api/assistant/route')

function post(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  ) as unknown as Promise<Response>
}

describe('POST /api/assistant (Route)', () => {
  beforeEach(() => {
    mocks.execute.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('空请求体 → 400 No query provided，且不触发 Use Case', async () => {
    const response = await post({})

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No query provided' })
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('messages 为空数组且无 query → 400', async () => {
    const response = await post({ messages: [] })

    expect(response.status).toBe(400)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('成功路径 → 200 + { reply, wordData }', async () => {
    const wordData = { word: 'disorder', definition: '混乱' }
    mocks.execute.mockResolvedValue({ reply: 'hello there', wordData })

    const response = await post({ query: 'disorder' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ reply: 'hello there', wordData })
  })

  it('把请求体原样传给 Application Use Case', async () => {
    mocks.execute.mockResolvedValue({ reply: 'ok', wordData: null })
    const messages = [
      { role: 'ai', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]

    await post({ messages, query: 'q2' })

    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.execute.mock.calls[0][0]).toEqual({ messages, query: 'q2' })
  })

  it('AI 失败 → 仍返回 200 + 友好错误文案（保持既有行为）', async () => {
    mocks.execute.mockRejectedValue(new AIError('provider_error', 'DeepSeek HTTP 500: boom'))

    const response = await post({ query: 'disorder' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      reply: 'Sorry, I got an error: DeepSeek HTTP 500: boom',
      wordData: null,
    })
  })

  it('超时失败 → 友好错误文案同样回退为 200', async () => {
    mocks.execute.mockRejectedValue(new AIError('timeout', 'AI request timed out after 30000ms (deepseek)'))

    const response = await post({ query: 'disorder' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      reply: 'Sorry, I got an error: AI request timed out after 30000ms (deepseek)',
      wordData: null,
    })
  })
})
