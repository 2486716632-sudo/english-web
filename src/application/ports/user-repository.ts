// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port

import type { LearningProfilePatch, UserId, UserLearningProfile } from '@/domain/user/types'

/**
 * UserRepositoryPort — canonical 用户状态的**最小**读写契约（`docs/refactor/MEMORY_DESIGN.md`）。
 *
 * 刻意保持最小：只有参考集成与 Phase 6 写入路径真正需要的两个操作，
 * **不是**通用 CRUD（没有 `findAll` / `deleteById` / `updateAny`）。
 *
 * 归属：两个方法都**必须**接受 `userId`（Memory/State 永远是用户所有的）。
 * 惰性供给：`updateProfile` 允许在目标逻辑用户尚不存在时幂等创建它
 * （过渡期默认用户策略，见任务文档 Part 14）—— 只读路径**不**写库。
 */

export interface UserRepositoryPort {
  /** 读取 canonical 学习档案；不存在时返回 `null`（**不**抛异常表示"不存在"）。 */
  getProfile(userId: UserId): Promise<UserLearningProfile | null>
  /**
   * 更新（或首次创建）学习档案的**指定字段**。
   *
   * 语义：只写入 patch 中显式出现的键；缺省的键保持不变；`null` 表示清空该字段。
   * 失败时如实抛错，由 Application 决定语义。
   */
  updateProfile(userId: UserId, patch: LearningProfilePatch): Promise<UserLearningProfile>
}
