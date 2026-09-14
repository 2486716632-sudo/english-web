// @version 1.0
// @last-reviewed 2026-09-14
// @layer Application — 用户归属身份解析（B-01）

import { ApplicationError } from '@/application/errors'
import {
  resolveUserId,
  type ExecutionContext,
} from '@/application/observability/execution-context'
import { normalizeUserId } from '@/domain/user/identity-rules'
import type { UserId } from '@/domain/user/types'

/**
 * 解析受用户归属约束的 Application 操作的**权威**归属身份（Phase 6 v1 外部复核 B-01）。
 *
 * 不变式：
 *  - 归属身份**只能**来自 `ExecutionContext.userId`（由 Delivery / Composition 边界解析）
 *  - 操作 payload **不得**携带 userId 选择归属
 *  - `ExecutionContext.userId` 缺失或非法 → **显式失败**（`invalid_input`）
 *  - 此处**不**回落到默认用户：过渡期默认用户解析只属于 Delivery / Composition 边界
 *
 * 这样 `context.userId = "user-a"` + payload 试图指向 `user-b` 在结构上不可能发生。
 */
export function requireOwnershipUserId(context: ExecutionContext | undefined): UserId {
  const raw = resolveUserId(context)
  if (raw === undefined) {
    throw new ApplicationError(
      'invalid_input',
      'ExecutionContext.userId is required for user-scoped operations',
    )
  }

  const normalized = normalizeUserId(raw)
  if (!normalized.ok) {
    throw new ApplicationError('invalid_input', `ExecutionContext.userId: ${normalized.reason}`)
  }
  return normalized.value
}
