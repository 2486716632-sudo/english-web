// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — lifecycle-safe trace helpers

import type {
  RecordErrorOptions,
  SpanCategory,
  TraceMetadata,
  TracePort,
  TraceScope,
} from '@/application/ports/trace'

/**
 * 生命周期安全的 trace / span 包装器（Phase 5 任务文档 Part 12）。
 *
 * 契约：
 *  - 回调抛异常时，先在当前 scope 上记录归一化错误，再以 `'error'` 结束，然后**原样重抛**
 *    （错误语义不被 tracing 改变）
 *  - 回调正常返回时，若回调自己还没有 `end()`，则以 `'ok'` 结束
 *  - 因此包装器路径下**不存在孤儿 scope**：无论成功、失败还是提前 return，scope 都会到达终态，
 *    且总是"先结束子 span 再结束父 span"（满足 TRACE_DESIGN.md §8 的 trace 终结不变式）
 *  - `end()` 幂等：回调内可以自行 `end('degraded')` 表达更精确的结果，包装器不会覆盖它
 */

export interface TraceRunOptions {
  /** trace 缺省 `'use_case'`；span 缺省 `'workflow_step'`。 */
  category?: SpanCategory
  metadata?: TraceMetadata
  /**
   * 把底层错误补充为归一化错误摘要（例如 `AIError` 的 code / provider / retryable）。
   * 返回 `undefined` 时使用默认推断。
   */
  describeError?: (error: unknown) => RecordErrorOptions | undefined
}

async function runScope<T>(
  scope: TraceScope,
  run: (scope: TraceScope) => T | Promise<T>,
  describeError?: (error: unknown) => RecordErrorOptions | undefined,
): Promise<T> {
  try {
    const result = await run(scope)
    if (!scope.isEnded()) scope.end('ok')
    return result
  } catch (error) {
    if (!scope.isEnded()) {
      scope.recordError(error, describeError?.(error))
      scope.end('error')
    }
    throw error
  }
}

/** 开始一次 trace，并保证其到达终态。 */
export function runInTrace<T>(
  tracer: TracePort,
  name: string,
  options: TraceRunOptions,
  run: (trace: TraceScope) => T | Promise<T>,
): Promise<T> {
  const trace = tracer.startTrace(name, {
    category: options.category,
    metadata: options.metadata,
  })
  return runScope(trace, run, options.describeError)
}

/** 在父 scope 下开启一个子 span，并保证其到达终态。 */
export function runInSpan<T>(
  parent: TraceScope,
  name: string,
  options: TraceRunOptions,
  run: (span: TraceScope) => T | Promise<T>,
): Promise<T> {
  const span = parent.startSpan(name, {
    category: options.category,
    metadata: options.metadata,
  })
  return runScope(span, run, options.describeError)
}
