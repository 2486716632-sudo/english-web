import type { MemoryRepositoryPort } from '@/application/ports/memory-repository'
import type { UserRepositoryPort } from '@/application/ports/user-repository'
import type {
  MemoryKind,
  MemoryQuery,
  NewMemoryRecord,
  StoredMemoryRecord,
} from '@/domain/memory/types'
import type {
  LearningProfilePatch,
  UserId,
  UserLearningProfile,
} from '@/domain/user/types'

/**
 * Application 层测试用的 fake repositories（Phase 6 任务文档 Part 17 / Part 18）。
 *
 * 它们**不**连数据库、**不**调用真实 Prisma；只实现 Port 契约，
 * 并按 `userId` 归属存储，从而可验证"用户 A 取不到用户 B 的记忆"。
 */

export const FIXED_NOW = new Date('2026-09-13T00:00:00.000Z')

export function memoryRowKey(userId: string, kind: string, key: string): string {
  return `${userId}::${kind}::${key}`
}

export class FakeUserRepository implements UserRepositoryPort {
  readonly profiles = new Map<UserId, UserLearningProfile>()
  readonly getCalls: string[] = []
  readonly updateCalls: Array<{ userId: string; patch: LearningProfilePatch }> = []
  failGet: Error | undefined
  failUpdate: Error | undefined

  constructor(seed: UserLearningProfile[] = []) {
    for (const profile of seed) this.profiles.set(profile.userId, profile)
  }

  async getProfile(userId: UserId): Promise<UserLearningProfile | null> {
    this.getCalls.push(userId)
    if (this.failGet) throw this.failGet
    return this.profiles.get(userId) ?? null
  }

  async updateProfile(
    userId: UserId,
    patch: LearningProfilePatch,
  ): Promise<UserLearningProfile> {
    this.updateCalls.push({ userId, patch })
    if (this.failUpdate) throw this.failUpdate

    const existing = this.profiles.get(userId)
    const next: UserLearningProfile = {
      userId,
      englishLevel:
        patch.englishLevel !== undefined ? patch.englishLevel : (existing?.englishLevel ?? null),
      explanationLanguage:
        patch.explanationLanguage !== undefined
          ? patch.explanationLanguage
          : (existing?.explanationLanguage ?? null),
      createdAt: existing?.createdAt ?? FIXED_NOW,
      updatedAt: FIXED_NOW,
    }
    this.profiles.set(userId, next)
    return next
  }
}

export class FakeMemoryRepository implements MemoryRepositoryPort {
  private readonly rows = new Map<string, StoredMemoryRecord>()
  readonly listQueries: MemoryQuery[] = []
  readonly saveCalls: NewMemoryRecord[] = []
  failList: Error | undefined
  failSave: Error | undefined
  private sequence = 0

  constructor(seed: StoredMemoryRecord[] = []) {
    for (const row of seed) this.rows.set(memoryRowKey(row.userId, row.kind, row.key), row)
  }

  async saveMemory(record: NewMemoryRecord): Promise<StoredMemoryRecord> {
    this.saveCalls.push(record)
    if (this.failSave) throw this.failSave

    const id = memoryRowKey(record.userId, record.kind, record.key)
    const existing = this.rows.get(id)
    const stored: StoredMemoryRecord = {
      ...record,
      id: existing?.id ?? `mem-${(this.sequence += 1)}`,
      createdAt: existing?.createdAt ?? FIXED_NOW,
      updatedAt: FIXED_NOW,
    }
    this.rows.set(id, stored)
    return stored
  }

  async listMemory(query: MemoryQuery): Promise<StoredMemoryRecord[]> {
    this.listQueries.push(query)
    if (this.failList) throw this.failList

    return [...this.rows.values()]
      .filter((row) => row.userId === query.userId)
      .filter((row) => !query.kinds || query.kinds.includes(row.kind))
      .sort((a, b) => {
        const byTime = b.updatedAt.getTime() - a.updatedAt.getTime()
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id)
      })
      .slice(0, query.limit)
  }
}

interface StoredMemorySeed {
  userId: UserId
  kind: MemoryKind
  key: string
  content: string
  updatedAt?: Date
}

/** 构造一条已持久化记忆（测试种子数据）。 */
export function storedMemory(seed: StoredMemorySeed): StoredMemoryRecord {
  return {
    id: `seed-${memoryRowKey(seed.userId, seed.kind, seed.key)}`,
    userId: seed.userId,
    kind: seed.kind,
    key: seed.key,
    content: seed.content,
    source: 'explicit_user',
    createdAt: FIXED_NOW,
    updatedAt: seed.updatedAt ?? FIXED_NOW,
  }
}
