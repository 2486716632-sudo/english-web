// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Use Case（更新 canonical 学习档案）

import { ApplicationError } from '@/application/errors'
import type { UserRepositoryPort } from '@/application/ports/user-repository'
import { resolveTraceScope, type ExecutionContext } from '@/application/observability/execution-context'
import { runInSpan } from '@/application/observability/trace-helpers'
import { countProfileFields, validateLearningProfilePatch } from '@/domain/user/profile-rules'
import type { UserLearningProfile } from '@/domain/user/types'
import { requireOwnershipUserId } from '@/application/use-cases/user/ownership'

/**
 * UpdateLearningProfileUseCase — 显式更新 canonical 用户状态（user state）。
 *
 * 与 Memory 的区别：这是"当前为真"的事实（可覆盖），不是历史记忆。
 *
 * 失败语义（任务文档 Part 10）：显式写入失败**必须**报错。
 * 用户明确要求更新档案却静默丢弃，是数据完整性问题，不是可降级的个性化。
 *
 * 注意：本阶段**不**新增 HTTP Route（不扩张产品面）。该用例是 Application 行为契约，
 * 由 Composition Root 装配，供测试与 Phase 7 使用。
 */

export interface UpdateLearningProfileInput {
  /** 未校验的局部更新（只写显式出现的键）。 */
  patch: unknown
}

export class UpdateLearningProfileUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(
    input: UpdateLearningProfileInput,
    context: ExecutionContext = {},
  ): Promise<UserLearningProfile> {
    // B-01：canonical profile 的归属身份只来自 ExecutionContext；payload 不能选择用户。
    const userId = requireOwnershipUserId(context)

    const patch = validateLearningProfilePatch(input.patch)
    if (!patch.ok) throw new ApplicationError('invalid_input', patch.reason)

    const trace = resolveTraceScope(context)

    return runInSpan(
      trace,
      'user.profile.update',
      {
        category: 'persistence',
        metadata: { 'user.profile.updatedFields': Object.keys(patch.value).length },
      },
      async (span) => {
        let profile: UserLearningProfile
        try {
          profile = await this.users.updateProfile(userId, patch.value)
        } catch (error) {
          throw new ApplicationError(
            'persistence_failed',
            error instanceof Error ? error.message : String(error),
            { cause: error },
          )
        }

        // 只记录字段数量，不记录字段值（隐私 / 数据最小化）。
        span.addMetadata({ 'user.profile.fields': countProfileFields(profile) })
        return profile
      },
    )
  }
}
