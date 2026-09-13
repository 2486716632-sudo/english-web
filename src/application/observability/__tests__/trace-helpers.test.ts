import { describe, it, expect } from 'vitest'
import { AIError } from '@/application/ports/ai-client'
import { NOOP_TRACE_PORT, NOOP_TRACE_SCOPE, isNoopTraceScope } from '@/application/ports/trace'
import { runInSpan, runInTrace } from '@/application/observability/trace-helpers'
import { resolveTraceScope } from '@/application/observability/execution-context'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * 生命周期安全（Phase 5 任务文档 Part 12 / Part 13 第 13 项）。
 * 关键断言：**任何路径**下 scope 都到达终态，且没有孤儿 span。
 */

function recorder(): InMemoryTraceRecorder {
  let sequence = 0
  const clockValue = 0
  return new InMemoryTraceRecorder({
    clock: { now: () => clockValue },
    createId: () => `id-${(sequence += 1)}`,
  })
}

describe('runInTrace', () => {
  it('成功路径：自动以 ok 结束并归档 trace', async () => {
    const traces = recorder()

    const result = await runInTrace(traces, 'reading.ingest', { category: 'use_case' }, async (trace) => {
      expect(trace.traceId).not.toBe('noop')
      return 'done'
    })

    expect(result).toBe('done')
    const record = traces.getLastTrace()
    expect(record?.status).toBe('ok')
    expect(record?.endedAt).not.toBeNull()
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.activeSpanCount()).toBe(0)
    expect(traces.getLifecycleViolations()).toEqual([])
  })

  it('异常路径：记录错误、以 error 结束、原样重抛，且无孤儿 span', async () => {
    const traces = recorder()
    const failure = new Error('boom')

    const thrown = await runInTrace(traces, 'reading.ingest', { category: 'use_case' }, async () => {
      throw failure
    }).catch((error: unknown) => error)

    expect(thrown).toBe(failure)
    const record = traces.getLastTrace()
    expect(record?.status).toBe('error')
    expect(record?.error?.message).toBe('boom')
    expect(record?.endedAt).not.toBeNull()
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.getLifecycleViolations()).toEqual([])
  })

  it('回调自行结束时，包装器不覆盖其状态', async () => {
    const traces = recorder()

    await runInTrace(traces, 'reading.ingest', { category: 'use_case' }, async (trace) => {
      trace.end('degraded')
      return 1
    })

    expect(traces.getLastTrace()?.status).toBe('degraded')
  })

  it('describeError 把底层错误补充为归一化错误摘要', async () => {
    const traces = recorder()

    await runInTrace(
      traces,
      'reading.ingest',
      {
        category: 'use_case',
        describeError: (error) =>
          error instanceof AIError
            ? { code: error.code, provider: error.provider, retryable: error.retryable }
            : undefined,
      },
      async () => {
        throw new AIError('rate_limited', 'DeepSeek HTTP 429', { status: 429, provider: 'deepseek' })
      },
    ).catch(() => undefined)

    expect(traces.getLastTrace()?.error).toMatchObject({
      code: 'rate_limited',
      provider: 'deepseek',
      retryable: true,
      status: 429,
    })
  })
})

describe('runInSpan', () => {
  it('嵌套 span 的父子关系正确，异常向上传播时两层都标记失败', async () => {
    const traces = recorder()

    await runInTrace(traces, 'reading.ingest', { category: 'use_case' }, async (trace) => {
      await runInSpan(trace, 'reading.pipeline', { category: 'workflow' }, async (workflowSpan) => {
        await runInSpan(
          workflowSpan,
          'reading.collect_candidates',
          { category: 'workflow_step' },
          async () => {
            throw new Error('feed down')
          },
        )
      })
    }).catch(() => undefined)

    const record = traces.getLastTrace()
    expect(record?.status).toBe('error')
    expect(record?.spans.map((span) => [span.name, span.status, span.parentSpanId])).toEqual([
      ['reading.ingest', 'error', null],
      ['reading.pipeline', 'error', record?.spans[0].spanId],
      ['reading.collect_candidates', 'error', record?.spans[1].spanId],
    ])
    expect(record?.spans[2].error?.message).toBe('feed down')
    // B-03：终结后 ACTIVE state 被释放（没有把已完成 trace 留在 recorder 里）
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.activeSpanCount()).toBe(0)
    // 包装器保证"先结束子 span，再结束父 span" → 不产生生命周期违规
    expect(traces.getLifecycleViolations()).toEqual([])
  })

  it('提前 return 的 span 也会被结束（无孤儿）', async () => {
    const traces = recorder()

    await runInTrace(traces, 'reading.ingest', { category: 'use_case' }, async (trace) => {
      await runInSpan(trace, 'reading.select_new_articles', { category: 'workflow_step' }, async () => {
        return 'early'
      })
      return 'ok'
    })

    const record = traces.getLastTrace()
    expect(record?.spans[1].status).toBe('ok')
    expect(record?.spans[1].endedAt).not.toBeNull()
    expect(traces.activeTraceCount()).toBe(0)
    expect(traces.getLifecycleViolations()).toEqual([])
  })
})

describe('Null Object（未启用 tracing）', () => {
  it('缺省 ExecutionContext 解析为 no-op scope，执行结果不受影响', async () => {
    const scope = resolveTraceScope()
    expect(isNoopTraceScope(scope)).toBe(true)

    const result = await runInSpan(scope, 'assistant.reply', { category: 'use_case' }, async (span) => {
      span.addMetadata({ anything: true })
      span.recordEvent('noop.event')
      return 'unchanged'
    })

    expect(result).toBe('unchanged')
    expect(NOOP_TRACE_PORT.startTrace('x')).toBe(NOOP_TRACE_SCOPE)
  })

  it('自定义 ExecutionContext 中的 trace 被原样使用', () => {
    const traces = recorder()
    const trace = traces.startTrace('http.assistant', { category: 'http' })

    expect(resolveTraceScope({ trace })).toBe(trace)
  })
})
