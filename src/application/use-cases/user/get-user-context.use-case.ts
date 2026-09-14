// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Use Case（有界读取用户上下文：canonical profile + 选中的 memory）

import { ApplicationError } from '@/application/errors'
import type { MemoryRepositoryPort } from '@/application/ports/memory-repository'
import type { UserRepositoryPort } from '@/application/ports/user-repository'
import { resolveTraceScope, type ExecutionContext } from '@/application/observability/execution-context'
import { runInSpan } from '@/application/observability/trace-helpers'
import {
  MEMORY_SELECTION_LIMIT,
  clampMemoryLimit,
  normalizeMemoryKinds,
} from '@/domain/memory/memory-rules'
import type { MemoryKind, MemorySource } from '@/domain/memory/types'
import { countProfileFields } from '@/domain/user/profile-rules'
import type { UserId, UserLearningProfile } from '@/domain/user/types'
import { requireOwnershipUserId } from '@/application/use-cases/user/ownership'

/**
 * GetUserContextUseCase — 读取"本次执行可用的用户上下文"。
 *
 * 它是 Phase 6 参考集成的读取入口：`userId` → canonical profile + **有界**选中的 memory。
 * 它**只**读取，不写库；它**不**决定记忆语义（归一化与边界在 Domain），
 * 也**不**构造任何 prompt（prompt 由 `application/prompts/` 负责）。
 *
 * 行为保真决策（任务文档 Part 10）——**读失败 = 优雅降级**：
 * profile 或 memory 读取失败时，本次请求继续（空上下文），并把降级如实记录在 trace 上。
 * 理由：个性化是附加价值，不应让一次可用的问答因记忆库抖动而失败。
 * （写入路径相反：显式写入失败必须报错，见 UpdateLearningProfile / RememberUserFact。）
 */

export interface SelectedMemory {
  id: string
  kind: MemoryKind
  content: string
  source: MemorySource
  updatedAt: Date
}

export interface UserContext {
  userId: UserId
  profile: UserLearningProfile | null
  memory: SelectedMemory[]
  /** 本次使用的条数上限（已收敛到 `[1, MEMORY_SELECTION_MAX_LIMIT]`）。 */
  selectionLimit: number
  /** 是否发生了优雅降级（有一次读失败）。 */
  degraded: boolean
}

export interface GetUserContextInput {
  /** 期望的条数上限；非法值回落到默认值，超过硬上限被收敛。 */
  memoryLimit?: unknown
  /**
   * 可选 kind 过滤（B-03）：
   *  - 省略 → 有意不按 kind 过滤
   *  - 合法数组（可混合非法项）→ 使用合法子集
   *  - 非数组 / 空数组 / 全部非法 → `invalid_input`（**绝不**变成 select-all）
   */
  memoryKinds?: unknown
}

export interface GetUserContextDeps {
  users: UserRepositoryPort
  memory: MemoryRepositoryPort
}

export class GetUserContextUseCase {
  constructor(private readonly deps: GetUserContextDeps) {}

  async execute(input: GetUserContextInput = {}, context: ExecutionContext = {}): Promise<UserContext> {
    // B-01：归属身份只来自 ExecutionContext；缺失/非法显式失败（不在此处回落默认用户）。
    const userId = requireOwnershipUserId(context)

    const selectionLimit = clampMemoryLimit(input.memoryLimit ?? MEMORY_SELECTION_LIMIT)
    const kinds = normalizeMemoryKinds(input.memoryKinds)
    if (!kinds.ok) {
      // B-03：非法收窄请求必须显式失败，绝不能退化为"无过滤 → 全量"。
      throw new ApplicationError('invalid_input', kinds.reason)
    }
    const trace = resolveTraceScope(context)

    return runInSpan(
      trace,
      'user.context',
      {
        category: 'persistence',
        metadata: {
          'userContext.requested': true,
          'memory.selectionLimit': selectionLimit,
        },
      },
      async (span) => {
        let degraded = false

        let profile: UserLearningProfile | null = null
        try {
          profile = await this.deps.users.getProfile(userId)
        } catch {
          degraded = true
          // 只记录"哪个来源降级"，**不**记录底层错误消息（可能含连接串等敏感信息）。
          span.recordEvent('user.context.degraded', { metadata: { 'user.context.source': 'profile' } })
        }

        let memory: SelectedMemory[] = []
        try {
          const rows = await this.deps.memory.listMemory({
            userId,
            kinds: kinds.value,
            limit: selectionLimit,
          })
          memory = rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            content: row.content,
            source: row.source,
            updatedAt: row.updatedAt,
          }))
        } catch {
          degraded = true
          span.recordEvent('user.context.degraded', { metadata: { 'user.context.source': 'memory' } })
        }

        // metadata-first：只有计数与布尔值，**没有** memory 内容 / profile 自由文本 / 用户消息。
        span.addMetadata({
          'userContext.loaded': !degraded,
          'userContext.degraded': degraded,
          'userContext.profileFields': profile ? countProfileFields(profile) : 0,
          'memory.selectedCount': memory.length,
          'memory.kindCount': new Set(memory.map((item) => item.kind)).size,
        })
        span.end(degraded ? 'degraded' : 'ok')

        return {
          userId,
          profile,
          memory,
          selectionLimit,
          degraded,
        }
      },
    )
  }
}
