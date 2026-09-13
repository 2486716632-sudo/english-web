// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port (trace 抽象；只有接口与类型，无实现，无 console / provider 依赖)

/**
 * TracePort — 应用级可观测性抽象。
 *
 * 设计边界（见 docs/refactor/TRACE_DESIGN.md）：
 *   ✅ 定义一次逻辑执行的 trace / span / event 契约
 *   ✅ 定义归一化状态与错误摘要模型
 *   ❌ 不依赖 console / 文件系统 / Prisma / Next.js / DeepSeek
 *   ❌ 不负责持久化（Phase 5 不做 trace 存储）
 *   ❌ 不定义 metric 平台语义
 *
 * Trace / Log / Metric 的区分见 docs/refactor/TRACE_DESIGN.md §3：
 *  - Trace  = 一次逻辑执行的完整记录（本文件）
 *  - Log    = 单条诊断记录（可属于某个 trace；由交付层 / adapter 决定输出）
 *  - Metric = 跨执行的聚合数值（本阶段只产出 metric-ready 数据，不做平台）
 */

// ============================================================
// 状态与分类
// ============================================================

/**
 * 归一化状态。刻意只保留三态：
 *
 * | status     | 含义                                                                 |
 * |------------|----------------------------------------------------------------------|
 * | `ok`       | 操作按预期完成                                                        |
 * | `degraded` | 操作完成，但存在**已兜底 / 已隔离**的失败（例如 AI 降级后文章仍入库） |
 * | `error`    | 操作自身失败（抛错，或无法完成其职责）                                |
 *
 * 状态**不会自动向上冒泡**：一次 Reading 运行中出现单篇失败时，单篇 span 为 `error`，
 * 而整轮 trace 由应用入口按运行结果判定为 `degraded`（见 TRACE_DESIGN.md §7）。
 */
export type TraceStatus = 'ok' | 'degraded' | 'error'

/** span 分类。候选集合见 Phase 5 任务文档 Part 3。 */
export type SpanCategory =
  | 'http'
  | 'use_case'
  | 'workflow'
  | 'workflow_step'
  | 'ai'
  | 'persistence'
  | 'external_io'
  | 'validation'

/** metadata 只接受可安全序列化的原始值；对象 / 数组 / 函数一律由 adapter 丢弃。 */
export type TraceMetadataValue = string | number | boolean | null | undefined
export type TraceMetadata = Record<string, TraceMetadataValue>

// ============================================================
// 记录模型（provider-independent、机器可读）
// ============================================================

/** 归一化错误摘要。**不含** stack trace / 原始请求 / 凭据（见 TRACE_DESIGN.md §10）。 */
export interface TraceErrorInfo {
  /** 归一化错误码（例如 AIError / ApplicationError 的 `code`）。 */
  code?: string
  /** 错误类名（例如 `AIError`）。 */
  name?: string
  /** 安全化后的消息（不含密钥、连接串、请求头）。 */
  message: string
  /** 失败操作名（Application 视角）。 */
  operation?: string
  /** `AIError.retryable` 之类的可重试标记（可用时）。 */
  retryable?: boolean
  /** provider 标识（`AIError.provider`，可用时）。 */
  provider?: string
  /** provider HTTP status（可用时）。 */
  status?: number
}

export interface TraceEventRecord {
  traceId: string
  spanId: string
  /** 事件名（例如 `article.degraded`、`run.early_exit`）。 */
  name: string
  /** 事件发生时刻（epoch ms）。 */
  timestampMs: number
  metadata: TraceMetadata
}

export interface SpanRecord {
  traceId: string
  spanId: string
  parentSpanId: string | null
  name: string
  category: SpanCategory
  status: TraceStatus
  /** epoch ms。 */
  startedAt: number
  /** epoch ms；未结束时为 `null`。 */
  endedAt: number | null
  durationMs: number | null
  metadata: TraceMetadata
  error: TraceErrorInfo | null
}

/**
 * 一次完整执行（root span + 后代 span + 事件）。
 *
 * `spans[0]` 始终是 root span；`name` / `category` / `status` / `startedAt` / `endedAt` /
 * `durationMs` / `metadata` / `error` 是 root span 的镜像，便于消费者直接读取。
 */
export interface TraceRecord {
  traceId: string
  name: string
  category: SpanCategory
  status: TraceStatus
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  metadata: TraceMetadata
  error: TraceErrorInfo | null
  /** 全部 span，按开始顺序；第一个是 root span。 */
  spans: SpanRecord[]
  /** 全部事件，按发生顺序。 */
  events: TraceEventRecord[]
}

// ============================================================
// 句柄（explicit context propagation）
// ============================================================

export interface SpanStartOptions {
  /** 默认 `'workflow_step'`。 */
  category?: SpanCategory
  metadata?: TraceMetadata
}

export interface RecordEventOptions {
  metadata?: TraceMetadata
}

export interface RecordErrorOptions {
  /** 归一化错误码；缺省时尝试从 `error.code` 读取。 */
  code?: string
  /** 失败操作名（Application 视角）。 */
  operation?: string
  retryable?: boolean
  provider?: string
  status?: number
  /** 覆盖不安全的消息文本（默认使用 `error.message`，再由 adapter 清洗）。 */
  safeMessage?: string
}

export interface EndScopeOptions {
  metadata?: TraceMetadata
}

/**
 * 一次 trace 中的 scope 句柄（root span 与子 span 共用同一接口）。
 *
 * 生命周期契约（见 TRACE_DESIGN.md §8）：
 *  - 每个已 started 的 scope **必须** `end()`，即使抛异常（用 try/finally）
 *  - `end()` **幂等**：只有第一次调用生效，后续调用被忽略
 *  - `end()` 之后 `startSpan` / `recordEvent` / `addMetadata` / `recordError` 均为 no-op
 *    （防御无序埋点，避免"结束后仍在写"的静默错乱）
 *  - **trace 终结不变式**：*一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。*
 *    若 root 在仍有存活后代时被 `end()`，实现**不得**伪造子 span 的结束，
 *    而必须把该 trace 终结为显式的生命周期违规状态（`status = 'error'` +
 *    `error.code = 'lifecycle_violation'`），并且**不**把它当作正常完成的 trace 归档。
 *    生产埋点通过 `runInTrace` / `runInSpan` 保证"先结束子 span，再结束父 span"。
 */
export interface TraceScope {
  readonly traceId: string
  readonly spanId: string
  readonly name: string
  readonly category: SpanCategory
  /** 开启子 span（父 = 当前 scope）。 */
  startSpan(name: string, options?: SpanStartOptions): TraceScope
  /** 在当前 scope 上记录一个事件（Log 级记录，归属于本 trace）。 */
  recordEvent(name: string, options?: RecordEventOptions): void
  /** 追加 metadata（同名 key 覆盖）。 */
  addMetadata(metadata: TraceMetadata): void
  /** 记录归一化错误摘要（不改变状态；状态由 `end` 决定）。 */
  recordError(error: unknown, options?: RecordErrorOptions): void
  /** 到达终态；幂等。 */
  end(status?: TraceStatus, options?: EndScopeOptions): void
  /** 是否已到达终态。 */
  isEnded(): boolean
}

export interface TraceStartOptions {
  /** 默认 `'use_case'`。 */
  category?: SpanCategory
  metadata?: TraceMetadata
}

/**
 * Trace 工厂。
 *
 * 只提供"开始一次 trace"这一个能力：其余操作通过返回的 `TraceScope` 完成，
 * 从而保证 context 是**显式传递**的（不使用 AsyncLocalStorage，见 TRACE_DESIGN.md §5）。
 */
export interface TracePort {
  startTrace(name: string, options?: TraceStartOptions): TraceScope
}

// ============================================================
// Null Object（未启用 tracing 时的安全默认值）
// ============================================================

export const NOOP_TRACE_ID = 'noop'

/** 什么都不做的 scope：让调用方无需判空，也保证生产路径零开销。 */
export const NOOP_TRACE_SCOPE: TraceScope = {
  traceId: NOOP_TRACE_ID,
  spanId: NOOP_TRACE_ID,
  name: 'noop',
  category: 'use_case',
  startSpan: () => NOOP_TRACE_SCOPE,
  recordEvent: () => {},
  addMetadata: () => {},
  recordError: () => {},
  end: () => {},
  isEnded: () => false,
}

/** 什么都不做的 TracePort。 */
export const NOOP_TRACE_PORT: TracePort = {
  startTrace: () => NOOP_TRACE_SCOPE,
}

/** 判断某个 scope 是否是 no-op 实现（用于测试与短路判断）。 */
export function isNoopTraceScope(scope: TraceScope): boolean {
  return scope.traceId === NOOP_TRACE_ID
}
