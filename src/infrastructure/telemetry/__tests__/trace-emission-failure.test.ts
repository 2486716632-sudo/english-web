import { describe, it, expect, vi, afterEach } from 'vitest'
import { runInSpan, runInTrace } from '@/application/observability/trace-helpers'
import { ConsoleTraceRecorder } from '@/infrastructure/telemetry/console-trace-recorder'

/**
 * fail-open 遥测输出（Phase 5 外部审核 v2 阻断问题 B-04）。
 *
 * 不变式：**遥测输出失败绝不允许改变业务控制流，也不允许替换原始业务错误。**
 * 用确定的"永远抛错的 write sink"验证 —— 不需要真实 console、不访问任何外部服务。
 */

const SINK_ERROR = 'telemetry sink unavailable'

function throwingRecorder(): ConsoleTraceRecorder {
  let sequence = 0
  return new ConsoleTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
    write: () => {
      throw new Error(SINK_ERROR)
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fail-open 遥测输出（B-04）', () => {
  it('recordEvent / 子 span end / root end 都不抛错，且 ACTIVE state 仍被释放', () => {
    const recorder = throwingRecorder()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const trace = recorder.startTrace('http.assistant', { category: 'http' })
    const span = trace.startSpan('assistant.reply', { category: 'use_case' })

    expect(() => span.recordEvent('assistant.word_lookup')).not.toThrow()
    expect(() => span.end('ok')).not.toThrow()
    expect(() => trace.end('ok')).not.toThrow()

    // B-03 的清理仍然发生（输出失败不影响释放）
    expect(recorder.activeTraceCount()).toBe(0)
    expect(recorder.activeSpanCount()).toBe(0)
    // 失败被计数（仅计数，不含任何 trace 内容）
    expect(recorder.emissionFailures()).toBeGreaterThan(0)
    // 没有任何 fallback 输出（不把 TraceRecord 内容打印出去）
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('runInTrace：业务回调成功时仍然返回结果', async () => {
    const recorder = throwingRecorder()

    const result = await runInTrace(
      recorder,
      'http.assistant',
      { category: 'http' },
      async (trace) => {
        const span = trace.startSpan('assistant.reply', { category: 'use_case' })
        span.recordEvent('assistant.word_lookup')
        span.end('ok')
        return 'business-ok'
      },
    )

    expect(result).toBe('business-ok')
    expect(recorder.activeTraceCount()).toBe(0)
  })

  it('runInSpan：业务回调成功时仍然返回结果', async () => {
    const recorder = throwingRecorder()
    const trace = recorder.startTrace('reading.ingest')

    const value = await runInSpan(trace, 'reading.pipeline', { category: 'workflow' }, async (span) => {
      span.addMetadata({ 'reading.attempt': 1 })
      return 'span-value'
    })
    expect(() => trace.end('ok')).not.toThrow()

    expect(value).toBe('span-value')
    expect(recorder.activeTraceCount()).toBe(0)
  })

  it('业务回调抛错时，调用方收到 BUSINESS_ERROR 而不是遥测错误', async () => {
    const recorder = throwingRecorder()
    const businessError = new Error('BUSINESS_ERROR')

    const thrown = await runInTrace(
      recorder,
      'http.assistant',
      { category: 'http' },
      async (trace) => {
        const span = trace.startSpan('assistant.reply', { category: 'use_case' })
        span.recordEvent('assistant.word_lookup')
        span.end('ok')
        // 不自行 end trace：由包装器的错误路径收尾（这条路径同样会触发输出失败）
        throw businessError
      },
    ).catch((error: unknown) => error)

    expect(thrown).toBe(businessError)
    expect((thrown as Error).message).toBe('BUSINESS_ERROR')
    expect((thrown as Error).message).not.toContain(SINK_ERROR)
    expect(recorder.activeTraceCount()).toBe(0)
  })

  it('业务回调自行 end 后再抛错：原始业务错误同样不被替换', async () => {
    const recorder = throwingRecorder()
    const businessError = new Error('BUSINESS_ERROR')

    const thrown = await runInTrace(
      recorder,
      'reading.ingest',
      { category: 'use_case' },
      async (trace) => {
        trace.end('ok')
        throw businessError
      },
    ).catch((error: unknown) => error)

    expect(thrown).toBe(businessError)
    expect(recorder.activeTraceCount()).toBe(0)
  })

  it('连续多条 trace 在持续输出失败下仍不抛错、不累积 ACTIVE state', () => {
    const recorder = throwingRecorder()

    for (let index = 0; index < 10; index += 1) {
      const trace = recorder.startTrace('http.assistant', { category: 'http' })
      const span = trace.startSpan('assistant.reply', { category: 'use_case' })
      span.recordEvent('event')
      expect(() => span.end('ok')).not.toThrow()
      expect(() => trace.end('ok')).not.toThrow()
      expect(recorder.activeTraceCount()).toBe(0)
    }

    expect(recorder.emissionFailures()).toBeGreaterThanOrEqual(10)
  })
})
