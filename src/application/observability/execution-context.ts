// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — cross-cutting orchestration context

import { NOOP_TRACE_SCOPE, type TraceScope } from '@/application/ports/trace'
import type { UserId } from '@/domain/user/types'

/**
 * ExecutionContext — 一次逻辑执行的显式上下文。
 *
 * 为什么是显式参数而不是 `AsyncLocalStorage`（Phase 5 任务文档 Part 4）：
 *  - 依赖方向清晰：Delivery 创建 trace → 作为参数交给 Application；
 *    Infrastructure 通过 Port 接收 span，Domain 完全不感知 tracing
 *  - 没有隐式全局状态：同一进程内并发执行的多个 trace 不会互相污染
 *  - 可测试：测试可以直接构造 / 替换 scope，无需 mock 全局 API
 *  - 与既有代码风格一致（Phase 3 的 `AIClient` 同样通过显式注入实现可测性）
 *
 * 未提供 trace 时使用 Null Object，调用方无需判空（生产路径零开销）。
 */
export interface ExecutionContext {
  /** 本次执行的 root trace scope。 */
  trace?: TraceScope
  /**
   * 本次执行的**逻辑用户**（Phase 6 追加，纯增量字段）。
   *
   * 由 Delivery 在解析身份后显式传入（`resolveCurrentUserId()`），Application 只消费它：
   *  - Domain 永远不读 cookie / header / session（`ARCHITECTURE_RULES.md` DOM-002）
   *  - 缺失时表示"本次执行没有用户身份" → 参考集成不做任何个性化（行为与迁移前一致）
   *  - 该字段是 Phase 5 `ExecutionContext` 的**加法扩展**，不改变 Trace 契约
   */
  userId?: UserId
}

/** 解析执行上下文中的 trace scope；缺省时返回 Null Object。 */
export function resolveTraceScope(context?: ExecutionContext): TraceScope {
  return context?.trace ?? NOOP_TRACE_SCOPE
}

/** 解析执行上下文中的逻辑用户；缺省时返回 `undefined`（不假设"只有一个用户"）。 */
export function resolveUserId(context?: ExecutionContext): UserId | undefined {
  return context?.userId
}
