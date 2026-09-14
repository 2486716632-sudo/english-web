// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — UserRepositoryPort implementation (Prisma)

import type { PrismaClient } from '@/generated/prisma/client'
import type { UserRepositoryPort } from '@/application/ports/user-repository'
import {
  toEnglishLevelOrNull,
  toExplanationLanguageOrNull,
} from '@/domain/user/profile-rules'
import type { LearningProfilePatch, UserLearningProfile } from '@/domain/user/types'

/**
 * `UserRepositoryPort` 的 Prisma 实现。
 *
 * 保持适配器**薄**：只做参数映射与调用 Prisma，不含任何学习/记忆语义
 * （语义在 Application / Domain；见 `docs/refactor/MEMORY_DESIGN.md`）。
 *
 * 惰性供给（过渡期策略，任务文档 Part 14）：
 * `updateProfile` 会先幂等创建 `User` 行，再 upsert `UserProfile`。
 * 因此**不需要**任何数据回填迁移，也**不需要**在生产库预置默认用户；
 * 只读路径（`getProfile`）**不写库**。
 */

export interface UserProfileRow {
  userId: string
  englishLevel: string | null
  explanationLanguage: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 行 → 领域对象的纯映射（可独立测试）。
 *
 * 安全规则：数据库中的值只有在命中 Domain 闭集时才被采信；
 * 无法识别的值收敛为 `null`（不把未校验字符串送进 prompt / 应用上下文）。
 */
export function mapUserProfileRow(row: UserProfileRow): UserLearningProfile {
  return {
    userId: row.userId,
    englishLevel: toEnglishLevelOrNull(row.englishLevel),
    explanationLanguage: toExplanationLanguageOrNull(row.explanationLanguage),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async getProfile(userId: string): Promise<UserLearningProfile | null> {
    const row = await this.client.userProfile.findUnique({ where: { userId } })
    return row ? mapUserProfileRow(row) : null
  }

  async updateProfile(
    userId: string,
    patch: LearningProfilePatch,
  ): Promise<UserLearningProfile> {
    // 1) 幂等保证逻辑用户存在（外键前置条件）
    await this.client.user.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
    })

    // 2) 只写入显式提供的字段（缺省 = 不改变）
    const data: { englishLevel?: string | null; explanationLanguage?: string | null } = {}
    if (patch.englishLevel !== undefined) data.englishLevel = patch.englishLevel
    if (patch.explanationLanguage !== undefined) {
      data.explanationLanguage = patch.explanationLanguage
    }

    const row = await this.client.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
    return mapUserProfileRow(row)
  }
}
