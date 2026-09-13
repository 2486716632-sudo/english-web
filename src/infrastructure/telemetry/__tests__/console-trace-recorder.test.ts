import { describe, it, expect } from 'vitest'
import type { ClockPort } from '@/application/ports/clock'
import { ConsoleTraceRecorder } from '@/infrastructure/telemetry/console-trace-recorder'

/**
 * 结构化 JSON 行输出（Phase 5 任务文档 Part 6 / Part 16）。
 * 通过注入 `write` 捕获输出：不污染测试日志，也不需要真实 console。
 */

class FakeClock implements ClockPort {
  private value = 0

  now(): number {
    return this.value
  }

  advance(ms: number): void {
    this.value += ms
  }
}

function harness() {
  const lines: string[] = []
  const clock = new FakeClock()
  let sequence = 0
  const recorder = new ConsoleTraceRecorder({
    clock,
    createId: () => `id-${(sequence += 1)}`,
    write: (line) => lines.push(line),
  })
  return { recorder, lines, clock }
}

describe('ConsoleTraceRecorder — 结构化输出', () => {
  it('每个 span / event / trace 各输出一行可解析的 JSON', () => {
    const { recorder, lines, clock } = harness()

    const trace = recorder.startTrace('reading.ingest', {
      category: 'use_case',
      metadata: { 'reading.feedCount': 5 },
    })
    const step = trace.startSpan('reading.process_articles', {
      category: 'workflow_step',
      metadata: { 'reading.selectedCount': 2 },
    })
    step.recordEvent('article.degraded', { metadata: { 'ai.errorCode': 'provider_error' } })
    clock.advance(30)
    step.end('degraded')
    clock.advance(12)
    trace.end('degraded')

    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>)

    // 顺序 = 实际发生顺序：事件先于它所属 span 的结束行
    expect(records.map((record) => record.record)).toEqual(['event', 'span', 'span', 'trace'])

    expect(records[0]).toMatchObject({
      record: 'event',
      name: 'article.degraded',
      spanId: step.spanId,
      metadata: { 'ai.errorCode': 'provider_error' },
    })

    const stepLine = records[1]
    expect(stepLine).toMatchObject({
      record: 'span',
      traceId: trace.traceId,
      parentSpanId: expect.any(String),
      name: 'reading.process_articles',
      category: 'workflow_step',
      status: 'degraded',
      durationMs: 30,
      metadata: { 'reading.selectedCount': 2 },
      error: null,
    })

    expect(records[2]).toMatchObject({
      record: 'span',
      name: 'reading.ingest',
      parentSpanId: null,
      status: 'degraded',
      durationMs: 42,
    })

    expect(records[3]).toMatchObject({
      record: 'trace',
      traceId: trace.traceId,
      name: 'reading.ingest',
      status: 'degraded',
      durationMs: 42,
      spanCount: 2,
      eventCount: 1,
      metadata: { 'reading.feedCount': 5 },
    })
  })

  it('输出前已经过 redaction：密钥 / 连接串不出现在任何一行', () => {
    const { recorder, lines } = harness()

    const trace = recorder.startTrace('http.assistant', {
      category: 'http',
      metadata: {
        'DEEPSEEK_API_KEY': 'sk-live-0123456789abcdef',
        authorization: 'Bearer abc.def.ghi',
        'http.route': '/api/assistant',
      },
    })
    trace.recordError(new Error('connect ECONNREFUSED postgresql://u:hunter2@host/db'))
    trace.end('error')

    const output = lines.join('\n')
    expect(output).not.toContain('sk-live-0123456789abcdef')
    expect(output).not.toContain('abc.def.ghi')
    expect(output).not.toContain('hunter2')
    expect(output).toContain('[redacted]-connection-string')
    expect(output).toContain('/api/assistant')

    const traceLine = JSON.parse(lines.at(-1) ?? '{}') as Record<string, unknown>
    expect(traceLine).toMatchObject({
      record: 'trace',
      status: 'error',
      error: { message: expect.stringContaining('[redacted]-connection-string') },
    })
  })

  /**
   * 外部审核 v1 阻断问题 B-02：生命周期违规必须用**独立的 record 类型**输出，
   * 否则日志里会看起来像一次"正常完成的 trace"。
   */
  it('生命周期违规输出为 trace.lifecycle_violation（不是普通 trace 汇总行）', () => {
    const { recorder, lines } = harness()

    const trace = recorder.startTrace('reading.ingest', { category: 'use_case' })
    trace.startSpan('reading.process_article', { category: 'workflow_step' })
    trace.end('ok')

    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(records.filter((record) => record.record === 'trace')).toHaveLength(0)

    expect(records.at(-1)).toMatchObject({
      record: 'trace.lifecycle_violation',
      traceId: trace.traceId,
      status: 'error',
      error: { code: 'lifecycle_violation', operation: 'trace.lifecycle' },
      metadata: { 'trace.lifecycleViolation': true, 'trace.openSpanCount': 1 },
      violation: {
        code: 'lifecycle_violation',
        openSpanCount: 1,
        openSpanNames: ['reading.process_article'],
      },
    })
  })

  /**
   * B-03：`ConsoleTraceRecorder` 已经写出结构化记录，**不需要**保留任何已完成的 ACTIVE state
   * —— 进程级单例（`getTraceRecorder()`）因此不会随请求数增长。
   */
  it('正常完成的 trace 不保留 ACTIVE state（只写出记录）', () => {
    const { recorder, lines } = harness()

    const trace = recorder.startTrace('http.assistant', { category: 'http' })
    const span = trace.startSpan('assistant.reply', { category: 'use_case' })
    span.end('ok')
    trace.end('ok')

    expect(recorder.activeTraceCount()).toBe(0)
    expect(recorder.activeSpanCount()).toBe(0)
    // 记录确实已输出（span ×2 + trace 汇总）
    expect(lines.map((line) => JSON.parse(line).record)).toEqual(['span', 'span', 'trace'])
  })

  it('连续多条 trace 不累积 ACTIVE state', () => {
    const { recorder, lines } = harness()

    for (let index = 0; index < 20; index += 1) {
      const trace = recorder.startTrace('http.assistant', { category: 'http' })
      const span = trace.startSpan('assistant.reply', { category: 'use_case' })
      span.end('ok')
      trace.end('ok')
      expect(recorder.activeTraceCount()).toBe(0)
    }

    expect(recorder.activeSpanCount()).toBe(0)
    expect(lines).toHaveLength(20 * 3)
  })

  it('生命周期违规的 trace 也不要求保留 ACTIVE state', () => {
    const { recorder, lines } = harness()

    const trace = recorder.startTrace('reading.ingest', { category: 'use_case' })
    trace.startSpan('reading.process_article', { category: 'workflow_step' })
    trace.end('ok')

    expect(recorder.activeTraceCount()).toBe(0)
    expect(lines.at(-1)).toContain('trace.lifecycle_violation')
  })
})
