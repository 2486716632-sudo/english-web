// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — TracePort 的共享实现（计时、ID、生命周期、清洗）

import type { ClockPort } from '@/application/ports/clock'
import type {
  EndScopeOptions,
  RecordErrorOptions,
  RecordEventOptions,
  SpanCategory,
  SpanRecord,
  SpanStartOptions,
  TraceEventRecord,
  TraceMetadata,
  TracePort,
  TraceRecord,
  TraceScope,
  TraceStartOptions,
  TraceStatus,
} from '@/application/ports/trace'
import { systemClock } from '@/infrastructure/time/system-clock'
import { sanitizeMetadata, toTraceErrorInfo } from '@/infrastructure/telemetry/sanitize'

/**
 * Trace recorder 的共享骨架。
 *
 * 它拥有：traceId / spanId 生成、时钟、span 生命周期、metadata 清洗、trace 组装。
 * 它不拥有：输出方式（内存 / console / 未来的远端 adapter 由子类或钩子决定）。
 *
 * 生命周期保证（Phase 5 任务文档 Part 12；不变式见 TRACE_DESIGN.md §8）：
 *  - `end()` 幂等；已结束的 scope 上的任何写入都被忽略
 *  - trace 结束后不再接受新的子 span（返回 inert scope），避免"已关闭 trace 又被写"
 *  - **单个不变式**：*一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。*
 *    若 root `end()` 时仍有存活后代：
 *      · **不**伪造任何子 span 的结束时间戳；
 *      · 该 trace 被终结为**显式的生命周期违规状态**（`status = 'error'` +
 *        `error.code = 'lifecycle_violation'` + `trace.lifecycleViolation` metadata）；
 *      · 由 `onTraceEnded(trace, violation)` 告知 adapter，**不**进入"正常完成的 trace"集合。
 *    生产埋点（`runInTrace` / `runInSpan`）在任何路径下都先结束子 span 再结束父 span，
 *    因此正常运行不会产生违规（有测试）。
 *  - **ACTIVE state 生命周期**（Phase 5 外部审核 v2 阻断问题 B-03）：
 *    recorder 只在 trace **执行期间**保留可变 TraceState。root 到达终态、adapter 收到终态快照之后，
 *    该 state 会在 `finally` 中被**释放**（从 `states` 中移除并断开重引用）。
 *    因此进程级单例（`getTraceRecorder()`）不会随请求数无限增长；归档由 adapter 自己负责。
 *  - **fail-open 输出边界**（Phase 5 外部审核 v2 阻断问题 B-04）：
 *    adapter hook（`onEventRecorded` / `onSpanEnded` / `onTraceEnded`）的失败**绝不**逃逸到
 *    业务控制流 —— 遥测记录可能丢失，但业务结果与原错误保持不变。
 */

export interface TraceRecorderOptions {
  /** 时间源；测试注入假时钟。缺省 = 真实墙钟。 */
  clock?: ClockPort
  /** ID 生成器；测试注入确定性序列。缺省 = 应用级唯一 ID。 */
  createId?: () => string
}

/** 应用级 trace / span 标识：内部生成、不含密钥或用户内容、足够用于关联。 */
export function createTraceId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export interface TraceState {
  record: TraceRecord
  closed: boolean
  endedSpanIds: Set<string>
}

/**
 * 生命周期违规：root trace 在有存活后代 span 的情况下被终结。
 *
 * 这是**埋点缺陷**的显式信号（不是业务失败）：可能出现于手工 instrumentation 忘记 `end()`，
 * 或把 root 的 `end()` 放在了子 span 结束之前。
 */
export interface TraceLifecycleViolation {
  code: 'lifecycle_violation'
  /** 被终结时仍未结束的后代 span 数量（不含 root）。 */
  openSpanCount: number
  /** 被终结时仍未结束的后代 span 名称（有界，最多 5 个，用于快速定位）。 */
  openSpanNames: string[]
}

/** 记录在 trace metadata 上的违规标记键。 */
export const LIFECYCLE_VIOLATION_METADATA_KEY = 'trace.lifecycleViolation'
export const LIFECYCLE_OPEN_SPAN_COUNT_METADATA_KEY = 'trace.openSpanCount'
const MAX_REPORTED_OPEN_SPAN_NAMES = 5

/** 完全惰性的 scope：用于"已结束 trace 仍被写入"的防御路径。 */
export function createInertScope(
  traceId: string,
  spanId: string,
  name: string,
  category: SpanCategory,
): TraceScope {
  const inert: TraceScope = {
    traceId,
    spanId,
    name,
    category,
    startSpan: (childName, childOptions) =>
      createInertScope(traceId, spanId, childName, childOptions?.category ?? 'workflow_step'),
    recordEvent: () => {},
    addMetadata: () => {},
    recordError: () => {},
    end: () => {},
    isEnded: () => true,
  }
  return inert
}

function snapshotSpan(span: SpanRecord): SpanRecord {
  return { ...span, metadata: { ...span.metadata }, error: span.error ? { ...span.error } : null }
}

function snapshotTrace(state: TraceState): TraceRecord {
  const record = state.record
  return {
    ...record,
    metadata: { ...record.metadata },
    error: record.error ? { ...record.error } : null,
    spans: record.spans.map(snapshotSpan),
    events: record.events.map((event) => ({ ...event, metadata: { ...event.metadata } })),
  }
}

export abstract class BaseTraceRecorder implements TracePort {
  private readonly clock: ClockPort
  private readonly createId: () => string
  private readonly states = new Map<string, TraceState>()
  private emissionFailureCount = 0

  protected constructor(options: TraceRecorderOptions = {}) {
    this.clock = options.clock ?? systemClock
    this.createId = options.createId ?? createTraceId
  }

  startTrace(name: string, options: TraceStartOptions = {}): TraceScope {
    const traceId = this.createId()
    const spanId = this.createId()
    const startedAt = this.clock.now()
    const category = options.category ?? 'use_case'
    // root span 与 trace record 共享同一个 metadata 对象：对 root 的追加即对 trace 的追加。
    const metadata = sanitizeMetadata(options.metadata)

    const record: TraceRecord = {
      traceId,
      name,
      category,
      status: 'ok',
      startedAt,
      endedAt: null,
      durationMs: null,
      metadata,
      error: null,
      spans: [],
      events: [],
    }

    const rootSpan: SpanRecord = {
      traceId,
      spanId,
      parentSpanId: null,
      name,
      category,
      status: 'ok',
      startedAt,
      endedAt: null,
      durationMs: null,
      metadata,
      error: null,
    }

    const state: TraceState = { record, closed: false, endedSpanIds: new Set() }
    record.spans.push(rootSpan)
    this.states.set(traceId, state)

    return this.createScope(state, rootSpan)
  }

  /**
   * **ACTIVE** recorder state 中已开始但未结束的 span 数量。
   *
   * B-03 之后 `states` 只包含**正在执行**的 trace，因此该值表示"仍在飞行中的 span"；
   * 已终结的 trace（含生命周期违规）不在其中（其证据由 adapter 归档的快照保存）。
   * 该方法是内部诊断 helper，**不属于** `TracePort`。
   */
  activeSpanCount(): number {
    let open = 0
    for (const state of this.states.values()) {
      for (const span of state.record.spans) {
        if (!state.endedSpanIds.has(span.spanId)) open += 1
      }
    }
    return open
  }

  /**
   * **ACTIVE**（仍在执行、尚未释放）的 trace 数量。
   *
   * 生产断言用它证明"没有把已完成的 trace 留在 recorder 里"：任何已终结的 trace 都应使该值为 0。
   */
  activeTraceCount(): number {
    return this.states.size
  }

  /** 被 fail-open 输出边界吞掉的 adapter 输出失败次数（仅计数，不含任何 trace 内容）。 */
  emissionFailures(): number {
    return this.emissionFailureCount
  }

  // -------------------------------------------------------------
  // 子类钩子
  // -------------------------------------------------------------

  /** span 到达终态时触发（传入快照，子类不得依赖内部可变对象）。 */
  protected abstract onSpanEnded(span: SpanRecord): void

  /** 事件被记录时触发。 */
  protected abstract onEventRecorded(event: TraceEventRecord): void

  /**
   * root span 到达终态、trace 关闭时触发。
   *
   * `violation` 非 null 表示这是**生命周期违规终结**：adapter 必须把它与正常完成的 trace 区分开
   * （例如内存实现不归档进"已完成"集合，console 实现输出不同的 record 类型）。
   */
  protected abstract onTraceEnded(
    trace: TraceRecord,
    violation: TraceLifecycleViolation | null,
  ): void

  // -------------------------------------------------------------
  // 内部实现
  // -------------------------------------------------------------

  protected getState(traceId: string): TraceState | undefined {
    return this.states.get(traceId)
  }

  protected listStates(): TraceState[] {
    return [...this.states.values()]
  }

  protected buildSnapshot(traceId: string): TraceRecord | undefined {
    const state = this.states.get(traceId)
    return state ? snapshotTrace(state) : undefined
  }

  /**
   * 遥测输出边界（B-04，fail-open）：adapter hook 的失败**不得**逃逸到业务控制流。
   *
   * 明确不做的事：
   *  - 不重新抛出（否则 `scope.end()` 会把"日志坏了"变成"业务失败"）
   *  - 不递归追踪遥测失败（避免失败风暴）
   *  - 不把 TraceRecord 内容当作 fallback 打印（可能含敏感内容）
   *  - 不引入外部日志依赖
   * 只做：计数（无内容）+ 继续执行。
   */
  private emitSafely(emit: () => void): void {
    try {
      emit()
    } catch {
      this.emissionFailureCount += 1
    }
  }

  /**
   * 释放 ACTIVE state（B-03）。
   *
   * 前置条件：终态快照**已经**交付给 adapter（否则 adapter 会失去这次 trace 的证据）。
   * 释放后：
   *  - `states` 不再持有该 trace（进程级单例不会无限增长）
   *  - 旧 `TraceScope` 的后续写入仍然是 no-op（`state.closed === true`，`end()` 仍幂等）
   *  - 断开 record 上的重引用，避免"被外部保留的旧 scope"继续持有整棵 trace 图
   */
  private releaseState(state: TraceState): void {
    this.states.delete(state.record.traceId)
    state.record.spans.length = 0
    state.record.events.length = 0
    state.record.metadata = {}
    state.record.error = null
  }

  private createScope(state: TraceState, span: SpanRecord): TraceScope {
    const scope: TraceScope = {
      traceId: span.traceId,
      spanId: span.spanId,
      name: span.name,
      category: span.category,
      startSpan: (name, options = {}) => this.openChild(state, span, name, options),
      recordEvent: (name, options = {}) => this.appendEvent(state, span, name, options),
      addMetadata: (metadata) => this.mergeMetadata(state, span, metadata),
      recordError: (error, options) => this.setError(state, span, error, options),
      end: (status, options) => this.endSpan(state, span, status, options),
      isEnded: () => state.endedSpanIds.has(span.spanId),
    }
    return scope
  }

  private isOpen(state: TraceState, span: SpanRecord): boolean {
    if (state.endedSpanIds.has(span.spanId)) return false
    // 只有 root span 可以在 trace 关闭时结束；子 span 在 root 结束后一律不可写。
    return !state.closed
  }

  private openChild(
    state: TraceState,
    parent: SpanRecord,
    name: string,
    options: SpanStartOptions,
  ): TraceScope {
    const category = options.category ?? 'workflow_step'
    if (!this.isOpen(state, parent)) {
      return createInertScope(state.record.traceId, parent.spanId, name, category)
    }

    const span: SpanRecord = {
      traceId: state.record.traceId,
      spanId: this.createId(),
      parentSpanId: parent.spanId,
      name,
      category,
      status: 'ok',
      startedAt: this.clock.now(),
      endedAt: null,
      durationMs: null,
      metadata: sanitizeMetadata(options.metadata),
      error: null,
    }
    state.record.spans.push(span)
    return this.createScope(state, span)
  }

  private appendEvent(
    state: TraceState,
    span: SpanRecord,
    name: string,
    options: RecordEventOptions,
  ): void {
    if (!this.isOpen(state, span)) return
    const event: TraceEventRecord = {
      traceId: state.record.traceId,
      spanId: span.spanId,
      name,
      timestampMs: this.clock.now(),
      metadata: sanitizeMetadata(options.metadata),
    }
    state.record.events.push(event)
    const snapshot: TraceEventRecord = { ...event, metadata: { ...event.metadata } }
    this.emitSafely(() => this.onEventRecorded(snapshot))
  }

  private mergeMetadata(state: TraceState, span: SpanRecord, metadata: TraceMetadata): void {
    if (!this.isOpen(state, span)) return
    Object.assign(span.metadata, sanitizeMetadata(metadata))
  }

  private setError(
    state: TraceState,
    span: SpanRecord,
    error: unknown,
    options?: RecordErrorOptions,
  ): void {
    if (!this.isOpen(state, span)) return
    span.error = toTraceErrorInfo(error, options)
  }

  private endSpan(
    state: TraceState,
    span: SpanRecord,
    status: TraceStatus | undefined,
    options?: EndScopeOptions,
  ): void {
    const isRoot = span.parentSpanId === null
    if (state.endedSpanIds.has(span.spanId)) return
    if (state.closed && !isRoot) return

    const endedAt = this.clock.now()
    state.endedSpanIds.add(span.spanId)
    span.status = status ?? 'ok'
    span.endedAt = endedAt
    span.durationMs = Math.max(0, endedAt - span.startedAt)
    if (options?.metadata) Object.assign(span.metadata, sanitizeMetadata(options.metadata))

    if (!isRoot) {
      this.emitSafely(() => this.onSpanEnded(snapshotSpan(span)))
      return
    }

    // root：先决定终态（含不变式违规），再发出 hook —— 这样 span 行与 trace 行一致。
    state.closed = true
    const record = state.record

    // 不变式：root 不能在仍有存活后代时被终结为"正常完成"。
    const liveDescendants = record.spans.filter(
      (candidate) => candidate.parentSpanId !== null && !state.endedSpanIds.has(candidate.spanId),
    )
    const violation: TraceLifecycleViolation | null =
      liveDescendants.length > 0
        ? {
            code: 'lifecycle_violation',
            openSpanCount: liveDescendants.length,
            openSpanNames: liveDescendants
              .slice(0, MAX_REPORTED_OPEN_SPAN_NAMES)
              .map((candidate) => candidate.name),
          }
        : null

    if (violation) {
      const priorErrorCode = span.error?.code
      // 显式错误状态：不伪造子 span 的完成时间，也不把它们从记录里抹掉。
      span.status = 'error'
      span.error = toTraceErrorInfo(
        new Error(
          `Trace "${record.name}" was finalized with ${violation.openSpanCount} live child span(s): ${violation.openSpanNames.join(', ')}`,
        ),
        { code: 'lifecycle_violation', operation: 'trace.lifecycle' },
      )
      record.metadata[LIFECYCLE_VIOLATION_METADATA_KEY] = true
      record.metadata[LIFECYCLE_OPEN_SPAN_COUNT_METADATA_KEY] = violation.openSpanCount
      if (priorErrorCode) record.metadata['trace.priorErrorCode'] = priorErrorCode
    }

    record.status = span.status
    record.endedAt = span.endedAt
    record.durationMs = span.durationMs
    record.error = span.error ? { ...span.error } : null

    // 顺序（B-03）：1) 构建终态快照 → 2) 交付 adapter → 3) 在 finally 中释放可变 state。
    // 任何一步的输出失败都不得逃逸（B-04），释放仍然一定发生。
    try {
      this.emitSafely(() => this.onSpanEnded(snapshotSpan(span)))
      const terminalSnapshot = snapshotTrace(state)
      this.emitSafely(() => this.onTraceEnded(terminalSnapshot, violation))
    } finally {
      this.releaseState(state)
    }
  }
}
