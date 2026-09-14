// @layer Domain — 学习档案校验纯规则（无外部依赖）

import {
  ENGLISH_LEVELS,
  EXPLANATION_LANGUAGES,
  type EnglishLevel,
  type ExplanationLanguage,
  type LearningProfilePatch,
  type UserLearningProfile,
} from '@/domain/user/types'

/** 允许出现在档案更新中的键（其他键一律拒绝，避免拼写错误静默失效）。 */
export const PROFILE_PATCH_KEYS = ['englishLevel', 'explanationLanguage'] as const

export type ProfilePatchResult =
  | { ok: true; value: LearningProfilePatch }
  | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 归一化闭集字符串：小写、`-`/空白 → `_`。 */
function normalizeClosedSetValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function parseClosedSet<T extends string>(
  field: string,
  allowed: readonly T[],
  raw: unknown,
): { ok: true; value: T | null } | { ok: false; reason: string } {
  if (raw === null) return { ok: true, value: null }
  if (typeof raw !== 'string') {
    return { ok: false, reason: `${field} must be a string or null` }
  }

  const trimmed = raw.trim()
  // 显式空字符串 = 显式清空该字段（与 `null` 等价）。
  if (trimmed.length === 0) return { ok: true, value: null }

  const normalized = normalizeClosedSetValue(trimmed)
  const match = allowed.find((candidate) => candidate === normalized)
  if (!match) {
    return { ok: false, reason: `${field} must be one of: ${allowed.join(', ')}` }
  }
  return { ok: true, value: match }
}

/** 把读取到的档案值收敛到闭集；无法识别的值视为不存在（不把未校验字符串送进 prompt）。 */
export function toEnglishLevelOrNull(value: unknown): EnglishLevel | null {
  const parsed = parseClosedSet('englishLevel', ENGLISH_LEVELS, value)
  return parsed.ok ? parsed.value : null
}

export function toExplanationLanguageOrNull(value: unknown): ExplanationLanguage | null {
  const parsed = parseClosedSet('explanationLanguage', EXPLANATION_LANGUAGES, value)
  return parsed.ok ? parsed.value : null
}

/**
 * 校验并归一化**未校验**的档案局部更新（例如来自未来 HTTP body 的值）。
 *
 * 拒绝语义（确定性，不静默丢弃）：
 *  - 输入不是普通对象 → 拒绝
 *  - 出现未支持的键 → 拒绝
 *  - 字段值非法 → 拒绝（`null` / 空字符串 = 显式清空）
 *  - 一个字段都没提供 → 拒绝（无意义的更新）
 */
export function validateLearningProfilePatch(input: unknown): ProfilePatchResult {
  if (!isRecord(input)) {
    return { ok: false, reason: 'profile patch must be an object' }
  }

  const unsupported = Object.keys(input).filter(
    (key) => !(PROFILE_PATCH_KEYS as readonly string[]).includes(key),
  )
  if (unsupported.length > 0) {
    return {
      ok: false,
      reason: `unsupported profile field(s): ${unsupported.join(', ')}`,
    }
  }

  const value: LearningProfilePatch = {}
  let provided = 0

  if ('englishLevel' in input) {
    const parsed = parseClosedSet('englishLevel', ENGLISH_LEVELS, input.englishLevel)
    if (!parsed.ok) return parsed
    value.englishLevel = parsed.value
    provided += 1
  }

  if ('explanationLanguage' in input) {
    const parsed = parseClosedSet(
      'explanationLanguage',
      EXPLANATION_LANGUAGES,
      input.explanationLanguage,
    )
    if (!parsed.ok) return parsed
    value.explanationLanguage = parsed.value
    provided += 1
  }

  if (provided === 0) {
    return { ok: false, reason: 'no supported profile fields provided' }
  }

  return { ok: true, value }
}

/** 已设置字段的数量（供 Trace 元数据使用，**不**暴露字段值）。 */
export function countProfileFields(
  profile: Pick<UserLearningProfile, 'englishLevel' | 'explanationLanguage'>,
): number {
  let count = 0
  if (profile.englishLevel !== null) count += 1
  if (profile.explanationLanguage !== null) count += 1
  return count
}

/** 档案是否完全没有可用信息（决定参考集成是否注入 learner context）。 */
export function isProfileEmpty(
  profile: Pick<UserLearningProfile, 'englishLevel' | 'explanationLanguage'> | null,
): boolean {
  if (!profile) return true
  return countProfileFields(profile) === 0
}
