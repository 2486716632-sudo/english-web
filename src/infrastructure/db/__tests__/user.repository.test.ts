import { describe, it, expect } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import { PrismaUserRepository, mapUserProfileRow } from '@/infrastructure/db/user.repository'

/**
 * Repository Adapter 行为测试（不连真实数据库；任务文档 Part 18）。
 *
 * 用记录调用的 stub client 冒充 PrismaClient —— 适配器只使用少数几个方法。
 * 目的：验证 where 传播（含 `userId` 归属）、惰性供给顺序、只写显式字段，以及行 → 领域对象映射。
 */

interface StubCalls {
  userUpsert: unknown[]
  profileFindUnique: unknown[]
  profileUpsert: unknown[]
}

function createStubClient(overrides: { profileRow?: unknown } = {}) {
  const calls: StubCalls = { userUpsert: [], profileFindUnique: [], profileUpsert: [] }

  const client = {
    user: {
      upsert: async (args: unknown) => {
        calls.userUpsert.push(args)
        return { id: 'x' }
      },
    },
    userProfile: {
      findUnique: async (args: unknown) => {
        calls.profileFindUnique.push(args)
        return overrides.profileRow ?? null
      },
      upsert: async (args: unknown) => {
        calls.profileUpsert.push(args)
        return (
          overrides.profileRow ?? {
            userId: 'user-a',
            englishLevel: 'intermediate',
            explanationLanguage: null,
            createdAt: new Date('2026-09-13T00:00:00.000Z'),
            updatedAt: new Date('2026-09-13T00:00:00.000Z'),
          }
        )
      },
    },
  }

  return { client: client as unknown as PrismaClient, calls }
}

describe('mapUserProfileRow', () => {
  it('命中闭集的值原样映射', () => {
    const at = new Date('2026-09-13T00:00:00.000Z')
    expect(
      mapUserProfileRow({
        userId: 'user-a',
        englishLevel: 'upper_intermediate',
        explanationLanguage: 'zh',
        createdAt: at,
        updatedAt: at,
      }),
    ).toEqual({
      userId: 'user-a',
      englishLevel: 'upper_intermediate',
      explanationLanguage: 'zh',
      createdAt: at,
      updatedAt: at,
    })
  })

  it('闭集外的值收敛为 null（不把未校验字符串送进应用上下文）', () => {
    const at = new Date('2026-09-13T00:00:00.000Z')
    const mapped = mapUserProfileRow({
      userId: 'user-a',
      englishLevel: 'native',
      explanationLanguage: 'fr',
      createdAt: at,
      updatedAt: at,
    })
    expect(mapped.englishLevel).toBeNull()
    expect(mapped.explanationLanguage).toBeNull()
  })
})

describe('PrismaUserRepository', () => {
  it('getProfile 按 userId 查询，不存在时返回 null', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaUserRepository(client)

    expect(await repo.getProfile('user-a')).toBeNull()
    expect(calls.profileFindUnique[0]).toEqual({ where: { userId: 'user-a' } })
  })

  it('updateProfile 先幂等创建逻辑用户，再 upsert 档案（惰性供给）', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaUserRepository(client)

    await repo.updateProfile('user-a', { englishLevel: 'advanced' })

    expect(calls.userUpsert[0]).toEqual({
      where: { id: 'user-a' },
      create: { id: 'user-a' },
      update: {},
    })
    expect(calls.profileUpsert[0]).toEqual({
      where: { userId: 'user-a' },
      create: { userId: 'user-a', englishLevel: 'advanced' },
      update: { englishLevel: 'advanced' },
    })
  })

  it('只写显式提供的字段（缺省字段不进入 create/update）', async () => {
    const { client, calls } = createStubClient()
    const repo = new PrismaUserRepository(client)

    await repo.updateProfile('user-a', { explanationLanguage: null })

    expect(calls.profileUpsert[0]).toEqual({
      where: { userId: 'user-a' },
      create: { userId: 'user-a', explanationLanguage: null },
      update: { explanationLanguage: null },
    })
  })

  it('返回映射后的领域对象', async () => {
    const { client } = createStubClient({
      profileRow: {
        userId: 'user-a',
        englishLevel: 'intermediate',
        explanationLanguage: null,
        createdAt: new Date('2026-09-13T00:00:00.000Z'),
        updatedAt: new Date('2026-09-13T00:00:00.000Z'),
      },
    })
    const repo = new PrismaUserRepository(client)

    expect(await repo.updateProfile('user-a', { englishLevel: 'intermediate' })).toMatchObject({
      userId: 'user-a',
      englishLevel: 'intermediate',
      explanationLanguage: null,
    })
  })
})
