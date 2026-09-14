// @layer Domain — Memory 领域类型（无外部依赖、无 Prisma / Next.js / Trace / AI）

import type { UserId } from '@/domain/user/types'

/**
 * 记忆类别闭集（刻意保持最小，不做本体）。
 *
 * | kind         | 语义                        | key 语义            | 写入语义 |
 * |--------------|-----------------------------|---------------------|---------|
 * | `preference` | 学习偏好（非 canonical）    | 稳定含义键          | 单槽（覆盖） |
 * | `goal`       | 学习目标                    | 稳定含义键          | 单槽（覆盖） |
 * | `weakness`   | 已确定的反复弱点            | 稳定含义键          | 单槽（覆盖） |
 * | `milestone`  | 确定性学习里程碑            | 每次事件不同的键    | 追加（同键幂等） |
 */
export const MEMORY_KINDS = ['preference', 'goal', 'weakness', 'milestone'] as const

export type MemoryKind = (typeof MEMORY_KINDS)[number]

/**
 * 允许的记忆来源闭集（Phase 6：写入必须是显式或确定性的）。
 *
 * **禁止**的来源（永不写入）：每条消息 / 每次模型回复 / 原始 prompt / 临时 UI 状态 /
 * 临时错误 / 密钥与凭据 / 与学习无关的任意隐私内容 / LLM 自主决定的"该记住什么"。
 */
export const MEMORY_SOURCES = ['explicit_user', 'deterministic'] as const

export type MemorySource = (typeof MEMORY_SOURCES)[number]

/** 待写入（**已校验**）的记忆记录。 */
export interface NewMemoryRecord {
  userId: UserId
  kind: MemoryKind
  /** 已归一化的稳定"含义键"（去重身份的一半）。 */
  key: string
  content: string
  source: MemorySource
}

/** 已持久化的记忆记录。 */
export interface StoredMemoryRecord extends NewMemoryRecord {
  id: string
  createdAt: Date
  updatedAt: Date
}

/** 有界选取查询（应用需求：本次要用到的记忆，不是"全表扫描"）。 */
export interface MemoryQuery {
  userId: UserId
  /**
   * 可选类别过滤。语义（B-05，所有适配器必须一致）：
   *  - `undefined` → 有意不按 kind 过滤
   *  - 非空数组 → 只返回这些 kind
   *  - `[]` → 返回零条（显式空收窄绝不变成 select-all）
   */
  kinds?: readonly MemoryKind[]
  /** 条数上限（调用方传入前必须经 `clampMemoryLimit` 收敛）。 */
  limit: number
}

/**
 * **未校验**的记忆写入输入（**不含归属身份**）。
 *
 * 字段刻意声明为 `unknown`：这些值来自用户/派生逻辑，必须先经 `validateNewMemoryInput` 校验。
 *
 * B-01：归属身份**不在此结构内**。受信任的 `userId` 由 Application 从
 * `ExecutionContext.userId` 解析后作为**独立参数**注入 `validateNewMemoryInput`，
 * 因此写入 payload 无法选择另一个用户。
 */
export interface RawMemoryWriteInput {
  kind: unknown
  key: unknown
  content: unknown
  source: unknown
}
