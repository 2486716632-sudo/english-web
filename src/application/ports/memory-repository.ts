// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port

import type { MemoryQuery, NewMemoryRecord, StoredMemoryRecord } from '@/domain/memory/types'

/**
 * MemoryRepositoryPort — durable Memory 的**最小**读写契约。
 *
 * 刻意保持最小（**不做**通用 CRUD）：
 *  - `saveMemory` 承载应用语义"按含义键 create-or-update"（去重策略的落点）
 *  - `listMemory` 承载应用语义"**有界**选取"（选择策略的落点），
 *    由适配器实现 `userId` 过滤 + 可选 kind 过滤 + `updatedAt` 降序 + `take limit`
 *
 * 契约：
 *  - 所有操作必须按 `userId` 归属（用户 A 的查询**永远**取不到用户 B 的记录）
 *  - `limit` 由调用方经 `clampMemoryLimit()` 收敛后传入
 *  - **kind 选择语义（B-05，Port 级不变式，所有实现必须一致）**：
 *      - `kinds === undefined` → **有意不做 kind 限制**（返回该用户的所有 kind）
 *      - `kinds.length > 0`   → 只返回这些 kind
 *      - `kinds.length === 0` → **返回零条**（显式空收窄**绝不**变成 select-all）
 *    注意：Application 边界（`GetUserContextUseCase`）已把非法/空过滤映射为 `invalid_input`；
 *    本 Port 契约是第二道防线，保证未来任何调用方误传 `[]` 也不会扩大读取范围。
 *  - 失败如实抛错，由 Application 决定降级还是失败
 */

export interface MemoryRepositoryPort {
  /** 按 `(userId, kind, key)` create-or-update 一条记忆。 */
  saveMemory(record: NewMemoryRecord): Promise<StoredMemoryRecord>
  /** 有界列出该用户的记忆（按 `updatedAt` 降序）。 */
  listMemory(query: MemoryQuery): Promise<StoredMemoryRecord[]>
}
