import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AIError } from '@/application/ports/ai-client'
import type { ExecutionContext } from '@/application/observability/execution-context'
import type { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * `POST /api/assistant` 的 trace 行为（Phase 5 任务文档 Part 9）。
 *
 * 与既有的 Phase 3 Route 测试互补：这里**不**改那个文件，而是单独验证
 * trace 生命周期、`X-Trace-Id` 响应头，以及"失败时 trace 标记失败但响应体不变"。
 * 两个 Composition Root 模块都被替换为假实现 → 不调用真实 DeepSeek、不连数据库。
 */

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}))

vi.mock('@/bootstrap', () => ({
  getAssistantReplyUseCase: () => ({ execute: mocks.execute }),
}))

vi.mock('@/bootstrap/trace-composition', async () => {
  const { InMemoryTraceRecorder } = await import('@/infrastructure/telemetry/in-memory-trace-recorder')
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  return { getTraceRecorder: () => recorder, __testRecorder: recorder }
})

const traceModule = (await import('@/bootstrap/trace-composition')) as unknown as {
  __testRecorder: InMemoryTraceRecorder
}
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

function postRaw(raw: string): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    }),
  ) as unknown as Promise<Response>
}

describe('POST /api/assistant — trace', () => {
  beforeEach(() => {
    mocks.execute.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('成功：响应头回传 traceId，trace 以 ok 结束，执行上下文与 traceId 一致', async () => {
    mocks.execute.mockResolvedValue({ reply: 'hi', wordData: null })

    const response = await post({ query: 'disorder' })
    const record = traceModule.__testRecorder.getLastTrace()
    const traceId = response.headers.get('X-Trace-Id')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ reply: 'hi', wordData: null })
    expect(traceId).toBeTruthy()
    expect(record?.traceId).toBe(traceId)
    expect(record).toMatchObject({
      name: 'http.assistant',
      category: 'http',
      status: 'ok',
      metadata: { 'http.method': 'POST', 'http.route': '/api/assistant', 'http.status': 200 },
    })

    // Route 把同一个 trace 通过 ExecutionContext 交给 Use Case
    const context = mocks.execute.mock.calls[0][1] as ExecutionContext
    expect(context.trace?.traceId).toBe(traceId)
    expect(traceModule.__testRecorder.activeTraceCount()).toBe(0)
    expect(traceModule.__testRecorder.activeSpanCount()).toBe(0)
    expect(traceModule.__testRecorder.getLifecycleViolations()).toEqual([])
  })

  it('AI 失败：用户可见行为不变（200 + 友好文案），但 trace 记录为失败', async () => {
    mocks.execute.mockRejectedValue(new AIError('provider_error', 'DeepSeek HTTP 500: boom'))

    const response = await post({ query: 'disorder' })
    const record = traceModule.__testRecorder.getLastTrace()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      reply: 'Sorry, I got an error: DeepSeek HTTP 500: boom',
      wordData: null,
    })
    expect(response.headers.get('X-Trace-Id')).toBe(record?.traceId)
    expect(record).toMatchObject({
      status: 'error',
      error: { code: 'provider_error', message: 'DeepSeek HTTP 500: boom' },
      metadata: { 'http.status': 200, 'http.outcome': 'friendly_fallback' },
    })
    expect(record?.events.map((event) => event.name)).toEqual(['assistant.fallback'])
  })

  it('空请求体 → 400；trace 记录 invalid_request，且不调用 Use Case', async () => {
    const response = await post({})
    const record = traceModule.__testRecorder.getLastTrace()

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No query provided' })
    expect(response.headers.get('X-Trace-Id')).toBe(record?.traceId)
    expect(record).toMatchObject({
      status: 'error',
      error: { code: 'invalid_request', message: 'No query provided' },
      metadata: { 'http.status': 400 },
    })
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('请求体不是合法 JSON：异常照旧向上抛（行为不变），但 trace 仍然到达终态', async () => {
    await expect(postRaw('{not json')).rejects.toThrow()

    const record = traceModule.__testRecorder.getLastTrace()
    expect(record?.status).toBe('error')
    expect(record?.endedAt).not.toBeNull()
    expect(traceModule.__testRecorder.activeTraceCount()).toBe(0)
  })
})
