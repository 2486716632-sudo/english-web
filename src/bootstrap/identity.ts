// @layer Composition Root — 逻辑用户身份解析（Delivery/Composition 边界）

import type { UserId } from '@/domain/user/types'

/**
 * 过渡期默认逻辑用户 —— **TRANSITIONAL**（见 `docs/refactor/MEMORY_DESIGN.md` §身份策略）。
 *
 * 为什么需要它：产品当前仍是单用户 / 本地形态，**没有**认证系统；
 * 但 Phase 6 引入的 User State + Memory 必须始终有明确的归属主体。
 * 因此用一个**确定性的常量身份**承载 Phase 6 的新状态与记忆。
 *
 * 替换路径（未来做真实认证时）：
 *  external identity（provider subject）→ identity boundary → **可能需要映射** →
 *  internal `UserId`（必须满足 `normalizeUserId` 的字符集 / 长度约束）。
 *  本文件是解析入口，但**不要**假设替换认证只需改这一个文件：provider 的 subject identifier
 *  很可能无法直接作为 internal `UserId`，映射可能需要额外的持久状态与代码。
 *  Application 用例、Ports、Infrastructure 适配器因为按显式 `userId` 参数化，
 *  在内部 `UserId` 确定之后**不需要**改合同。
 *
 * 明确不做（Phase 6 禁止）：Auth.js / Clerk / OAuth / 账号管理 / 登录注册 UI。
 */
export const DEFAULT_USER_ID: UserId = 'local-default-user'

/**
 * 身份解析所需的最小请求形状（**结构化类型**，不 import Next.js 类型）。
 *
 * 这样 Composition Root 不依赖 Delivery 框架，未来读 header/cookie 也不需要改签名。
 */
export interface IdentityRequestLike {
  headers?: { get(name: string): string | null }
}

/**
 * 解析当前逻辑用户。
 *
 * Phase 6（过渡期）：**确定性**返回 {@link DEFAULT_USER_ID}，忽略 request。
 * 这是"临时默认用户解析器"，不是认证；不得据此认为系统只能有一个用户。
 */
export function resolveCurrentUserId(request?: IdentityRequestLike): UserId {
  // Phase 6 过渡期刻意忽略 request：没有认证系统可读。
  // 未来在此完成 external identity → 映射 → internal UserId 的边界解析（映射本身可能更大）。
  void request
  return DEFAULT_USER_ID
}
