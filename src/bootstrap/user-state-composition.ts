// @layer Composition Root — Phase 6 用户态（User State + Memory）装配
//
// 唯一决定"用哪个 user/memory adapter"的地方。Application 只看见 Ports。
// 与 `index.ts`（assistant 交付面）/`trace-composition.ts`（trace）/`reading-composition.ts`（CLI）同层。

import { GetUserContextUseCase } from '@/application/use-cases/user/get-user-context.use-case'
import { RememberUserFactUseCase } from '@/application/use-cases/user/remember-user-fact.use-case'
import { UpdateLearningProfileUseCase } from '@/application/use-cases/user/update-learning-profile.use-case'
import type { MemoryRepositoryPort } from '@/application/ports/memory-repository'
import type { UserRepositoryPort } from '@/application/ports/user-repository'
import type { PrismaClient } from '@/generated/prisma/client'
import { PrismaMemoryRepository } from '@/infrastructure/db/memory.repository'
import { PrismaUserRepository } from '@/infrastructure/db/user.repository'
import { prisma } from '@/lib/prisma'

export interface UserStateDependencies {
  users: UserRepositoryPort
  memory: MemoryRepositoryPort
}

/** 组装 Phase 6 的两个 repository adapter（手动构造，不引入 DI 框架）。 */
export function createUserStateDependencies(client: PrismaClient = prisma): UserStateDependencies {
  return {
    users: new PrismaUserRepository(client),
    memory: new PrismaMemoryRepository(client),
  }
}

let dependencies: UserStateDependencies | undefined
let userContextUseCase: GetUserContextUseCase | undefined
let updateLearningProfileUseCase: UpdateLearningProfileUseCase | undefined
let rememberUserFactUseCase: RememberUserFactUseCase | undefined

/** 进程内惰性单例（Route 使用），避免每个请求重建 adapter。 */
export function getUserStateDependencies(): UserStateDependencies {
  if (!dependencies) dependencies = createUserStateDependencies()
  return dependencies
}

/** 读取入口（参考集成使用）。 */
export function getUserContextUseCase(): GetUserContextUseCase {
  if (!userContextUseCase) {
    userContextUseCase = new GetUserContextUseCase(getUserStateDependencies())
  }
  return userContextUseCase
}

/**
 * 显式更新 canonical 档案的入口。
 *
 * Phase 6 **不**为它新增 HTTP Route（不扩张产品面）：它是 Application 行为契约，
 * 供测试与 Phase 7 使用。任何未来的 Route 都必须调用本用例，**不得**直接写 profile。
 */
export function getUpdateLearningProfileUseCase(): UpdateLearningProfileUseCase {
  if (!updateLearningProfileUseCase) {
    updateLearningProfileUseCase = new UpdateLearningProfileUseCase(getUserStateDependencies().users)
  }
  return updateLearningProfileUseCase
}

/**
 * 记忆写入入口（**唯一**允许写 durable memory 的地方）。
 *
 * 同上：Phase 6 不新增 HTTP Route；未来的写入动作必须经过本用例。
 */
export function getRememberUserFactUseCase(): RememberUserFactUseCase {
  if (!rememberUserFactUseCase) {
    rememberUserFactUseCase = new RememberUserFactUseCase(getUserStateDependencies().memory)
  }
  return rememberUserFactUseCase
}
