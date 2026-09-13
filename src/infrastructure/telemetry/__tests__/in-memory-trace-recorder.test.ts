import { describe, it, expect } from 'vitest'
import { AIError } from '@/application/ports/ai-client'
import type { ClockPort } from '@/application/ports/clock'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * Trace / span 生命周期、计时、状态与清洗（Phase 5 任务文档 Part 12 / Part 13）。
 * 全部确定性：注入假时钟与确定性 ID 生成器；不访问任何外部服务。
 */

class FakeClock implements ClockPort {
  private value = 1_000

  now(): number {
    return this.value
  }

  advance(ms: number): void {
    this.value += ms
  }
}

function recorder(clock: FakeClock): InMemoryTraceRecorder {
  let sequence = 0
  return new InMemoryTraceRecorder({
    clock,
    createId: () => `id-${(sequence += 1)}`,
  })
}

describe('InMemoryTraceRecorder — 成功生命周期', () => {
  it('root trace + 子 span + 事件 + 计时 + 状态都被完整记录', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('http.assistant', {
      category: 'http',
      metadata: { 'http.method': 'POST', 'http.route': '/api/assistant', apiKey: 'sk-should-not-be-here' },
    })

    clock.advance(5)
    const useCaseSpan = trace.startSpan('assistant.reply', { category: 'use_case' })

    clock.advance(20)
    const aiSpan = useCaseSpan.startSpan('ai.chat', { category: 'ai' })
    aiSpan.addMetadata({ 'ai.provider': 'deepseek', 'ai.attempts': 1 })
    clock.advance(20)
    aiSpan.end('ok')

    useCaseSpan.recordEvent('assistant.word_lookup', { metadata: { found: false } })
    useCaseSpan.end('ok')

    clock.advance(7)
    trace.end('ok')

    const record = traces.getTrace(trace.traceId)
    expect(record).toBeDefined()
    if (!record) throw new Error('trace not recorded')

    expect(record.name).toBe('http.assistant')
    expect(record.category).toBe('http')
    expect(record.status).toBe('ok')
    expect(record.startedAt).toBe(1_000)
    expect(record.endedAt).toBe(1_052)
    expect(record.durationMs).toBe(52)
    expect(record.metadata).toEqual({
      'http.method': 'POST',
      'http.route': '/api/assistant',
    })

    // spans[0] 是 root，其余按开始顺序
    expect(record.spans.map((span) => span.name)).toEqual([
      'http.assistant',
      'assistant.reply',
      'ai.chat',
    ])
    expect(record.spans[0].parentSpanId).toBeNull()
    expect(record.spans[1].parentSpanId).toBe(record.spans[0].spanId)
    expect(record.spans[2].parentSpanId).toBe(record.spans[1].spanId)
    expect(record.spans[2].metadata).toEqual({ 'ai.provider': 'deepseek', 'ai.attempts': 1 })
    expect(record.spans[2].durationMs).toBe(20)

    expect(record.events).toHaveLength(1)
    expect(record.events[0]).toMatchObject({
      traceId: record.traceId,
      spanId: record.spans[1].spanId,
      name: 'assistant.word_lookup',
      metadata: { found: false },
    })

    // B-03：终结后释放 ACTIVE state，但归档快照仍可检索
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.activeSpanCount()).toBe(0)
    expect(traces.getTraces()).toHaveLength(1)
    expect(traces.getLastTrace()?.traceId).toBe(record.traceId)
    expect(traces.getLifecycleViolations()).toEqual([])
  })

  it('显式结束状态不被覆盖（degraded 表达"完成但有兜底失败"）', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)
    const trace = traces.startTrace('reading.ingest')
    const span = trace.startSpan('reading.process_article', { category: 'workflow_step' })
    span.end('degraded')
    trace.end('ok')

    const record = traces.getLastTrace()
    expect(record?.spans[1].status).toBe('degraded')
    expect(record?.status).toBe('ok')
  })
})

describe('InMemoryTraceRecorder — 失败生命周期', () => {
  it('错误被归一化记录，trace 以 error 结束', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest', { metadata: { 'reading.feedCount': 5 } })
    const span = trace.startSpan('reading.collect_candidates', { category: 'workflow_step' })

    clock.advance(11)
    span.recordError(new AIError('provider_error', 'DeepSeek HTTP 500: boom', { status: 500, provider: 'deepseek' }), {
      code: 'provider_error',
      operation: 'ai.call',
    })
    span.end('error')
    trace.end('error')

    const record = traces.getLastTrace()
    expect(record?.status).toBe('error')
    expect(record?.spans[1].status).toBe('error')
    expect(record?.spans[1].error).toEqual({
      code: 'provider_error',
      name: 'AIError',
      message: 'DeepSeek HTTP 500: boom',
      operation: 'ai.call',
      retryable: true,
      provider: 'deepseek',
      status: 500,
    })
    expect(record?.error).toBeNull()
  })

  it('root span 上记录的错误会被镜像到 trace 记录', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('http.assistant', { category: 'http' })
    trace.recordError(new Error('No query provided'), { code: 'invalid_request' })
    trace.end('error')

    const record = traces.getLastTrace()
    expect(record?.error).toMatchObject({ code: 'invalid_request', message: 'No query provided' })
  })

  /**
   * 外部审核 v1 阻断问题 B-02：不变式 = "root 只有在没有存活后代 span 时，
   * 才能被终结为正常完成的 trace"。违规必须显式可见，且**不得**伪造子 span 的结束。
   */
  it('root 在仍有存活子 span 时被终结 → 显式的生命周期违规，不进入正常完成集合', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest')
    const child = trace.startSpan('reading.process_article', { category: 'workflow_step' })

    expect(traces.activeSpanCount()).toBe(2)
    expect(traces.getTrace(trace.traceId)?.endedAt).toBeNull()

    clock.advance(25)
    trace.end('ok')

    // 违规的 trace 不进入"正常完成"集合
    expect(traces.getTraces()).toHaveLength(0)
    expect(traces.getLastTrace()).toBeUndefined()

    const violations = traces.getLifecycleViolations()
    expect(violations).toHaveLength(1)
    const record = violations[0]
    expect(record).toMatchObject({
      traceId: trace.traceId,
      status: 'error',
      error: {
        code: 'lifecycle_violation',
        operation: 'trace.lifecycle',
        message: expect.stringContaining('live child span'),
      },
      metadata: { 'trace.lifecycleViolation': true, 'trace.openSpanCount': 1 },
    })

    // 子 span 未被伪造为已完成，且仍可通过 id 检视
    expect(record.spans[1]).toMatchObject({
      spanId: child.spanId,
      name: 'reading.process_article',
      endedAt: null,
      durationMs: null,
    })
    // B-03：违规 trace 同样被释放，不要求永久保留 ACTIVE state
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.getLifecycleViolations()).toHaveLength(1)
    expect(traces.getTrace(trace.traceId)?.error?.code).toBe('lifecycle_violation')
  })

  it('更深层的存活后代同样触发违规，并报告有界的 span 名称列表', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest')
    const child = trace.startSpan('reading.pipeline', { category: 'workflow' })
    child.startSpan('reading.process_article', { category: 'workflow_step' })

    trace.end('degraded')

    const violation = traces.getLifecycleViolations()[0]
    expect(violation).toMatchObject({
      status: 'error',
      metadata: { 'trace.openSpanCount': 2 },
    })
    expect(violation.spans.filter((span) => span.endedAt === null).map((span) => span.name)).toEqual([
      'reading.pipeline',
      'reading.process_article',
    ])
    expect(traces.activeTraceCount()).toBe(0)
    // 违规优先于调用方传入的状态：不把埋点缺陷报告成 degraded
    expect(violation.status).toBe('error')
  })

  it('正常路径（子 span 先结束）不产生任何生命周期违规', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest')
    const child = trace.startSpan('reading.pipeline', { category: 'workflow' })
    child.end('ok')
    trace.end('ok')

    expect(traces.getLifecycleViolations()).toEqual([])
    expect(traces.getTraces()).toHaveLength(1)
    expect(traces.activeTraceCount()).toBe(0)
  })
})

describe('InMemoryTraceRecorder — 终态写入保护', () => {
  /**
   * B-03：ACTIVE state 在终结后被释放，归档快照成为唯一数据来源；
   * 旧 scope 的写入仍然必须是 no-op（不能因为 state 被释放而"复活"或抛错）。
   */
  it('ACTIVE state 释放后，归档快照仍可检索，旧 scope 的写入仍是 no-op', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest', { metadata: { 'reading.feedCount': 1 } })
    const span = trace.startSpan('reading.pipeline', { category: 'workflow' })
    span.end('ok')
    trace.end('ok')

    // state 已释放
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.activeSpanCount()).toBe(0)

    // 归档快照仍可检索（不依赖 base recorder 保留可变 state）
    const archived = traces.getTrace(trace.traceId)
    expect(archived).toMatchObject({ traceId: trace.traceId, status: 'ok' })
    expect(archived?.spans.map((item) => item.name)).toEqual(['reading.ingest', 'reading.pipeline'])
    expect(traces.getLastTrace()?.traceId).toBe(trace.traceId)

    // 旧 scope 的晚到写入：全部 no-op，且不抛错
    trace.recordEvent('late.event')
    trace.addMetadata({ 'late.metadata': true })
    trace.recordError(new Error('late error'))
    trace.end('error')
    span.addMetadata({ 'late.span.metadata': true })
    span.recordEvent('late.span.event')
    span.end('error')
    const late = trace.startSpan('late.span', { category: 'workflow_step' })
    expect(late.isEnded()).toBe(true)
    late.recordEvent('late.inert.event')

    // 归档内容不受晚到写入影响
    const after = traces.getTrace(trace.traceId)
    expect(after?.spans).toHaveLength(2)
    expect(after?.events).toEqual([])
    expect(after?.metadata).toEqual({ 'reading.feedCount': 1 })
    expect(after?.status).toBe('ok')
    expect(after?.spans[1].metadata).toEqual({})
    expect(traces.getTraces()).toHaveLength(1)
  })

  it('连续多条 trace 不会累积 ACTIVE state（进程级单例的内存安全）', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    for (let index = 0; index < 25; index += 1) {
      const trace = traces.startTrace('http.assistant', { category: 'http' })
      const span = trace.startSpan('assistant.reply', { category: 'use_case' })
      span.end('ok')
      trace.end('ok')
      expect(traces.activeTraceCount()).toBe(0)
    }

    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.activeSpanCount()).toBe(0)
    expect(traces.getTraces()).toHaveLength(25)
  })

  it('end() 幂等：二次调用不改变计时或状态', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest')
    clock.advance(10)
    trace.end('ok')
    clock.advance(90)
    trace.end('error')

    const record = traces.getLastTrace()
    expect(record?.durationMs).toBe(10)
    expect(record?.status).toBe('ok')
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.getTraces()).toHaveLength(1)
  })

  it('结束后 span / event / metadata / error 写入全部被忽略', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest', { metadata: { 'reading.feedCount': 5 } })
    trace.end('ok')

    // 结束后开始子 span → 惰性 scope，不进入记录
    const late = trace.startSpan('reading.process_article', { category: 'workflow_step' })
    expect(late.isEnded()).toBe(true)
    late.addMetadata({ 'late.write': true })
    late.recordEvent('late.event')
    late.end('ok')

    trace.recordEvent('late.root.event')
    trace.addMetadata({ 'late.root.metadata': true })
    trace.recordError(new Error('late error'))

    const record = traces.getLastTrace()
    expect(record?.spans).toHaveLength(1)
    expect(record?.events).toHaveLength(0)
    expect(record?.metadata).toEqual({ 'reading.feedCount': 5 })
    expect(record?.error).toBeNull()
  })

  it('end 前 metadata 与 event 可用；结束后空 metadata 不产生键', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('reading.ingest')
    const span = trace.startSpan('reading.trim_to_limit', { category: 'workflow_step' })
    span.addMetadata({ 'reading.deleted': 2 })
    span.recordEvent('trim.deleted', { metadata: { count: 2 } })
    span.end()
    trace.end('ok', { metadata: { 'reading.outcome': 'ok' } })

    const record = traces.getLastTrace()
    expect(record?.metadata).toEqual({ 'reading.outcome': 'ok' })
    expect(record?.spans[1].metadata).toEqual({ 'reading.deleted': 2 })
    expect(record?.events[0].metadata).toEqual({ count: 2 })
  })

  /**
   * 外部审核 v1 阻断问题 B-01（第 7 项）端到端：即使绕过装饰器，直接把 `label.*`
   * 命名空间写进通用 trace metadata，内容型 / 凭据型键也必须被丢弃。
   */
  it('label.* 命名空间下的密钥 / 内容键在 recorder 层同样被丢弃', () => {
    const clock = new FakeClock()
    const traces = recorder(clock)

    const trace = traces.startTrace('http.assistant', { category: 'http' })
    const span = trace.startSpan('assistant.reply', { category: 'use_case' })
    span.addMetadata({
      'label.prompt': 'SECRET_PROMPT_TEXT',
      'label.query': 'USER_QUERY_TEXT',
      'label.content': 'USER_CONTENT_TEXT',
      'label.output': 'MODEL_OUTPUT_TEXT',
      'label.apiKey': 'sk-live-0123456789abcdef',
      'label.useCase': 'assistant.qa',
    })
    span.end('ok')
    trace.end('ok')

    const record = traces.getLastTrace()
    expect(record?.spans[1].metadata).toEqual({ 'label.useCase': 'assistant.qa' })

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
  })
})
