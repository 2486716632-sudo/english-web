// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — 结构化内存 Trace recorder（测试 / 检查用）

import type { TraceRecord } from '@/application/ports/trace'
import {
  BaseTraceRecorder,
  type TraceLifecycleViolation,
  type TraceRecorderOptions,
} from '@/infrastructure/telemetry/base-trace-recorder'

/**
 * 内存 Trace recorder。
 *
 * 用途：自动化测试断言（trace / span / event / metadata / 状态 / 计时），
 * 以及需要在执行期检视 trace 的场景。**不落库、不写盘**（Phase 5 明确不做持久化）。
 *
 * 生命周期不变式（见 TRACE_DESIGN.md §8）：
 *  - `getTraces()` 只返回**正常终结**的 trace（全部 span 都已结束）
 *  - 在仍有存活子 span 的情况下被终结的 trace **不进入**该集合，而是进入
 *    `getLifecycleViolations()`，并以 `status = 'error'` + `error.code = 'lifecycle_violation'` 记录
 *
 * 与 ACTIVE state 的关系（外部审核 v2 的 B-03）：
 *  - base recorder 在交付终态快照后释放其可变 TraceState；本类归档的是**快照**
 *    （独立的 TraceRecord 副本），因此 `getTraces()` / `getLifecycleViolations()` / `getTrace(id)`
 *    在清理之后仍然可用，且不再依赖 base recorder 保留任何已终结状态
 */
export class InMemoryTraceRecorder extends BaseTraceRecorder {
  private readonly completed: TraceRecord[] = []
  private readonly lifecycleViolations: TraceRecord[] = []

  constructor(options: TraceRecorderOptions = {}) {
    super(options)
  }

  /** 正常终结的 trace（按结束顺序）；不含生命周期违规的 trace。 */
  getTraces(): TraceRecord[] {
    return this.completed.map((trace) => this.cloneTrace(trace))
  }

  /** 在仍有存活子 span 时被终结的 trace（埋点缺陷的显式信号）。 */
  getLifecycleViolations(): TraceRecord[] {
    return this.lifecycleViolations.map((trace) => this.cloneTrace(trace))
  }

  /** 按 id 取 trace 快照（**未结束**的 trace 也能取到，便于诊断孤儿 span）。 */
  getTrace(traceId: string): TraceRecord | undefined {
    const live = this.buildSnapshot(traceId)
    if (live) return live
    const done = this.completed.find((trace) => trace.traceId === traceId)
    if (done) return this.cloneTrace(done)
    const violated = this.lifecycleViolations.find((trace) => trace.traceId === traceId)
    return violated ? this.cloneTrace(violated) : undefined
  }

  /** 取最后一个已结束的 trace（测试便利方法）。 */
  getLastTrace(): TraceRecord | undefined {
    const last = this.completed.at(-1)
    return last ? this.cloneTrace(last) : undefined
  }

  protected onSpanEnded(): void {
    // 内存实现不需要逐 span 钩子：完整 trace 在 onTraceEnded 中归档。
  }

  protected onEventRecorded(): void {
    // 同上。
  }

  protected onTraceEnded(trace: TraceRecord, violation: TraceLifecycleViolation | null): void {
    if (violation) {
      this.lifecycleViolations.push(trace)
      return
    }
    this.completed.push(trace)
  }

  private cloneTrace(trace: TraceRecord): TraceRecord {
    return {
      ...trace,
      metadata: { ...trace.metadata },
      error: trace.error ? { ...trace.error } : null,
      spans: trace.spans.map((span) => ({
        ...span,
        metadata: { ...span.metadata },
        error: span.error ? { ...span.error } : null,
      })),
      events: trace.events.map((event) => ({ ...event, metadata: { ...event.metadata } })),
    }
  }
}
