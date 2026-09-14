import { describe, it, expect } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { PrismaMemoryRepository, mapUserMemoryRow } from '@/infrastructure/db/memory.repository'
import {
  FakeMemoryRepository,
  storedMemory,
} from '@/application/use-cases/user/__tests__/fakes'

/**
 * Memory Adapter 行为测试（不连真实数据库；任务文档 Part 18）。
 *
 * 验证：upsert 使用 `(userId, kind, key)` 去重键、更新只改 content/source、
 * 列表查询按 `userId` 归属 + 有界 take + 确定性排序，以及行 → 领域对象映射（含丢弃无法解释的行）。
 */

const at = new Date('2026-09-13T00:00:00.000Z')

interface StubCalls {
  userUpsert: unknown[]
  memoryUpsert: unknown[]
  memoryFindMany: unknown[]
}

function memoryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-a',
    kind: 'goal',
    key: 'primary_goal',
    content: 'pass IELTS',
    source: 'explicit_user',
    createdAt: at,
    updatedAt: at,
    ...overrides,
  }
}

function createStubClient(overrides: { upsertRow?: unknown; listRows?: unknown[] } = {}) {
  const calls: StubCalls = { userUpsert: [], memoryUpsert: [], memoryFindMany: [] }

  const client = {
    user: {
      upsert: async (args: unknown) => {
        calls.userUpsert.push(args)
        return { id: 'x' }
      },
    },
    userMemory: {
      upsert: async (args: unknown) => {
        calls.memoryUpsert.push(args)
        return overrides.upsertRow ?? memoryRow()
      },
      findMany: async (args: unknown) => {
        calls.memoryFindMany.push(args)
        return overrides.listRows ?? []
      },
    },
  }

  return { client: client as unknown as PrismaClient, calls }
}

describe('mapUserMemoryRow', () => {
  it('kind / source 命中闭集时映射为领域对象', () => {
    expect(mapUserMemoryRow(memoryRow() as never)).toEqual({
      id: 'mem-1',
      userId: 'user-a',
      kind: 'goal',
      key: 'primary_goal',
      content: 'pass IELTS',
      source: 'explicit_user',
      createdAt: at,
      updatedAt: at,
    })
  })

  it('闭集外的 kind / source 返回 null（读取路径丢弃该行）', () => {
    expect(mapUserMemoryRow(memoryRow({ kind: 'embedding' }) as never)).toBeNull()
    expect(mapUserMemoryRow(memoryRow({ source: 'chat_history' }) as never)).toBeNull()
  })
})

describe('PrismaMemoryRepository.saveMemory', () => {
  it('按 (userId, kind, key) upsert，并只在 update 中改 content/source', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaMemoryRepository(client)

    const stored = await repo.saveMemory({
      userId: 'user-a',
      kind: 'goal',
      key: 'primary_goal',
      content: 'pass IELTS',
      source: 'explicit_user',
    })

    expect(calls.userUpsert[0]).toEqual({
      where: { id: 'user-a' },
      create: { id: 'user-a' },
      update: {},
    })
    expect(calls.memoryUpsert[0]).toEqual({
      where: { userId_kind_key: { userId: 'user-a', kind: 'goal', key: 'primary_goal' } },
      create: {
        userId: 'user-a',
        kind: 'goal',
        key: 'primary_goal',
        content: 'pass IELTS',
        source: 'explicit_user',
      },
      update: { content: 'pass IELTS', source: 'explicit_user' },
    })
    expect(stored.id).toBe('mem-1')
  })

  it('数据库返回无法解释的行 → 写入路径抛错（不变式违反）', async () => {
    const { client } = createStubClient({ upsertRow: memoryRow({ kind: 'embedding' }) })
    const repo = new PrismaMemoryRepository(client)

    await expect(
      repo.saveMemory({
        userId: 'user-a',
        kind: 'goal',
        key: 'g',
        content: 'c',
        source: 'explicit_user',
      }),
    ).rejects.toThrow(/unsupported kind or source/)
  })
})

describe('PrismaMemoryRepository.listMemory', () => {
  it('按 userId 归属 + 有界 take + 确定性排序查询', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaMemoryRepository(client)

    await repo.listMemory({ userId: 'user-a', limit: 5 })

    expect(calls.memoryFindMany[0]).toEqual({
      where: { userId: 'user-a' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 5,
    })
  })

  it('提供 kinds 时加入过滤条件（用户 A 无法越权取到其它用户）', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaMemoryRepository(client)

    await repo.listMemory({ userId: 'user-b', kinds: ['goal', 'weakness'], limit: 3 })

    expect(calls.memoryFindMany[0]).toEqual({
      where: { userId: 'user-b', kind: { in: ['goal', 'weakness'] } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 3,
    })
  })

  it('丢弃无法解释的行，保留合法行', async () => {
    const { client } = createStubClient({
      listRows: [memoryRow({ id: 'ok' }), memoryRow({ id: 'bad', kind: 'embedding' })],
    })
    const repo = new PrismaMemoryRepository(client)

    const rows = await repo.listMemory({ userId: 'user-a', limit: 5 })

    expect(rows.map((row) => row.id)).toEqual(['ok'])
  })
})

describe('PrismaMemoryRepository.listMemory — B-05 空 kinds 语义', () => {
  it('省略 kinds → 有意不做 kind 过滤（query 中不含 kind 条件）', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaMemoryRepository(client)

    await repo.listMemory({ userId: 'user-a', limit: 5 })

    expect(calls.memoryFindMany[0]).toEqual({
      where: { userId: 'user-a' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 5,
    })
  })

  it('kinds: [] → 返回零条，且不调用 findMany（显式空收窄不等于 select-all）', async () => {
    const { client, calls } = createStubClient({
      listRows: [memoryRow({ id: 'goal-1' }), memoryRow({ id: 'weakness-1', kind: 'weakness' })],
    })
    const repo = new PrismaMemoryRepository(client)

    const rows = await repo.listMemory({ userId: 'user-a', kinds: [], limit: 5 })

    expect(rows).toEqual([])
    expect(calls.memoryFindMany).toHaveLength(0)
  })

  it('FakeMemoryRepository 与 PrismaMemoryRepository 在空 kinds 上语义一致', async () => {
    const seeded = storedMemory({
      userId: 'user-a',
      kind: 'goal',
      key: 'primary_goal',
      content: 'pass IELTS',
    })

    const fake = new FakeMemoryRepository([seeded])
    const fakeRows = await fake.listMemory({ userId: 'user-a', kinds: [], limit: 5 })

    const { client, calls } = createStubClient({ listRows: [memoryRow()] })
    const repo = new PrismaMemoryRepository(client)
    const prismaRows = await repo.listMemory({ userId: 'user-a', kinds: [], limit: 5 })

    expect(fakeRows).toEqual([])
    expect(prismaRows).toEqual([])
    expect(calls.memoryFindMany).toHaveLength(0)
  })
})
