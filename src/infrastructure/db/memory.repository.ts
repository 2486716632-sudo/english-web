// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — MemoryRepositoryPort implementation (Prisma)

import type { PrismaClient } from '@/generated/prisma/client'
import type { MemoryRepositoryPort } from '@/application/ports/memory-repository'
import { isMemoryKind, isMemorySource } from '@/domain/memory/memory-rules'
import type { MemoryQuery, NewMemoryRecord, StoredMemoryRecord } from '@/domain/memory/types'

/**
 * `MemoryRepositoryPort` 的 Prisma 实现。
 *
 * 拥有（且只拥有）两件基础设施职责：
 *  1. **按 `(userId, kind, key)` create-or-update**（去重/覆盖策略的落点）
 *  2. **有界、确定性选取**（`userId` 过滤 + 可选 kind 过滤 + `updatedAt desc, id asc` + `take`）
 *
 * 不拥有：记忆语义、归一化、边界校验（Domain）、选择策略上限（Domain 常量 + Application）。
 */

export interface UserMemoryRow {
  id: string
  userId: string
  kind: string
  key: string
  content: string
  source: string
  createdAt: Date
  updatedAt: Date
}

/**
 * 行 → 领域对象的纯映射（可独立测试）。
 *
 * 返回 `null` 表示该行**无法安全解释**（kind / source 不在闭集内，例如人工写入或被未来版本写入的数据）。
 * 读取路径丢弃这类行（不让未校验数据进入应用上下文）；写入路径把它视为不变式违反（见 `saveMemory`）。
 */
export function mapUserMemoryRow(row: UserMemoryRow): StoredMemoryRecord | null {
  if (!isMemoryKind(row.kind) || !isMemorySource(row.source)) return null
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    key: row.key,
    content: row.content,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class PrismaMemoryRepository implements MemoryRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async saveMemory(record: NewMemoryRecord): Promise<StoredMemoryRecord> {
    // 幂等保证逻辑用户存在（外键前置条件；`User` 表本身不承载记忆语义）。
    await this.client.user.upsert({
      where: { id: record.userId },
      create: { id: record.userId },
      update: {},
    })

    const row = await this.client.userMemory.upsert({
      where: {
        userId_kind_key: {
          userId: record.userId,
          kind: record.kind,
          key: record.key,
        },
      },
      create: {
        userId: record.userId,
        kind: record.kind,
        key: record.key,
        content: record.content,
        source: record.source,
      },
      // 更新只改内容与来源，`createdAt` 保持不变（历史起点不漂移）。
      update: {
        content: record.content,
        source: record.source,
      },
    })

    const mapped = mapUserMemoryRow(row)
    if (!mapped) {
      // 写入路径上出现不可解释的行 = 不变式违反（Domain 已校验过 kind/source）。
      throw new Error(
        `Stored memory row ${row.id} has an unsupported kind or source and cannot be mapped`,
      )
    }
    return mapped
  }

  async listMemory(query: MemoryQuery): Promise<StoredMemoryRecord[]> {
    // B-05：显式空收窄 = 零结果，绝不退化为"无过滤 → 全部 kind"。
    // 同时在执行任何 DB 查询前短路返回，避免无谓的 findMany。
    if (query.kinds && query.kinds.length === 0) return []

    const kindFilter =
      query.kinds && query.kinds.length > 0 ? { kind: { in: [...query.kinds] } } : {}

    const rows = await this.client.userMemory.findMany({
      where: { userId: query.userId, ...kindFilter },
      // 确定性：最近更新优先；同一时间戳按 id 升序，避免并列时顺序不稳定。
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: query.limit,
    })

    return rows
      .map(mapUserMemoryRow)
      .filter((row): row is StoredMemoryRecord => row !== null)
  }
}
