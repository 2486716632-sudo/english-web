// @layer Domain — 身份标识纯规则（无外部依赖）

import type { UserId } from '@/domain/user/types'

/** 逻辑用户标识的长度上限（有界，防止把任意长文本当身份写入）。 */
export const USER_ID_MAX_CHARS = 64

/** 允许的字符集：小写字母、数字、`_`、`-`、`.`（足以覆盖 cuid / uuid / 常量身份）。 */
const USER_ID_PATTERN = /^[a-z0-9._-]+$/

export type UserIdResult = { ok: true; value: UserId } | { ok: false; reason: string }

/**
 * 归一化并校验逻辑用户标识。
 *
 * 规则（确定性）：
 *  - 必须是非空字符串；首尾空白裁剪；统一转小写
 *  - 长度 ≤ {@link USER_ID_MAX_CHARS}
 *  - 只允许 `[a-z0-9._-]`
 *
 * 失败返回原因字符串（由 Application 映射为 `invalid_input`），**不抛异常**（保持 Domain 纯函数）。
 */
export function normalizeUserId(value: unknown): UserIdResult {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'userId must be a string' }
  }

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) {
    return { ok: false, reason: 'userId must not be empty' }
  }
  if (normalized.length > USER_ID_MAX_CHARS) {
    return { ok: false, reason: `userId must be at most ${USER_ID_MAX_CHARS} characters` }
  }
  if (!USER_ID_PATTERN.test(normalized)) {
    return { ok: false, reason: 'userId may only contain [a-z0-9._-]' }
  }

  return { ok: true, value: normalized }
}
