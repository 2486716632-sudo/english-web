// @layer Domain — Memory 归一化 / 有界校验纯规则（无外部依赖）

import {
  MEMORY_KINDS,
  MEMORY_SOURCES,
  type MemoryKind,
  type MemorySource,
  type NewMemoryRecord,
  type RawMemoryWriteInput,
} from '@/domain/memory/types'
import { normalizeUserId } from '@/domain/user/identity-rules'

/** 单条记忆内容的最大长度（超出**拒绝**而不是截断，避免静默丢信息）。 */
export const MEMORY_CONTENT_MAX_CHARS = 500

/** 记忆含义键的最大长度。 */
export const MEMORY_KEY_MAX_CHARS = 80

/** 默认选取条数。 */
export const MEMORY_SELECTION_LIMIT = 5

/** 选取条数硬上限（调用方无法越过）。 */
export const MEMORY_SELECTION_MAX_LIMIT = 20

/** 单条记忆渲染进 prompt 的最大长度（超出截断并加省略号）。 */
export const MEMORY_RENDER_LINE_MAX_CHARS = 200

/** 整段 learner context 渲染进 prompt 的最大长度。 */
export const MEMORY_CONTEXT_MAX_CHARS = 1500

/**
 * **保留给 canonical User State 的语义键**（Phase 6 v1 外部复核 B-02）。
 *
 * Memory 表示"历史/有用上下文"，User State（`UserProfile`）表示"当前为真的事实"。
 * 同一个语义当前事实只能有一个权威归属：`englishLevel` / `explanationLanguage`
 * 必须通过 `UpdateLearningProfileUseCase` 更新，**不得**再写成 Memory，
 * 否则会出现"profile 说 zh、memory 说 en"的冲突来源。
 *
 * 键比较使用 {@link normalizeMemoryKey} 的结果，因此下列写法都被拦下：
 * `English Level` / `english-level` / `englishLevel` / `english_level` 等。
 * 这里同时列出 snake_case 与 camelCase 归一化后的形式。
 */
export const RESERVED_CANONICAL_MEMORY_KEYS = [
  'english_level',
  'englishlevel',
  'explanation_language',
  'explanationlanguage',
] as const

export function isMemoryKind(value: unknown): value is MemoryKind {
  return typeof value === 'string' && (MEMORY_KINDS as readonly string[]).includes(value)
}

export function isMemorySource(value: unknown): value is MemorySource {
  return typeof value === 'string' && (MEMORY_SOURCES as readonly string[]).includes(value)
}

/** 归一化后的键是否保留给 canonical User State（B-02）。 */
export function isReservedCanonicalMemoryKey(normalizedKey: string): boolean {
  return (RESERVED_CANONICAL_MEMORY_KEYS as readonly string[]).includes(normalizedKey)
}

/**
 * 归一化记忆含义键（**去重身份的核心**）。
 *
 * 规则：首尾裁剪 → 小写 → 空白 / `-` / `:` 折叠为 `_` → 折叠重复 `_` → 去掉首尾 `_`。
 * 因此 `Explanation Language`、`explanation language`、`explanation-language`、
 * `explanation:language` 全部命中同一个去重键 `explanation_language`。
 */
export function normalizeMemoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-:.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** 归一化记忆内容：首尾裁剪 + 折叠所有空白（含换行）为单个空格，保证单行、可安全渲染。 */
export function normalizeMemoryContent(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** 把调用方传入的上限收敛到 `[1, MEMORY_SELECTION_MAX_LIMIT]`；非法输入回落到默认值。 */
export function clampMemoryLimit(limit: unknown): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return MEMORY_SELECTION_LIMIT
  const floored = Math.floor(limit)
  if (floored < 1) return 1
  if (floored > MEMORY_SELECTION_MAX_LIMIT) return MEMORY_SELECTION_MAX_LIMIT
  return floored
}

/**
 * 归一化 kind 过滤请求（Phase 6 v1 外部复核 B-03）。
 *
 * **核心不变式：非法的收窄请求永远不会变成"无过滤"（select-all）。**
 *
 * | 输入 | 语义 |
 * |------|------|
 * | 省略 / `null` | 有意不按 kind 过滤（`value = undefined`） |
 * | 非数组 | `invalid_input`（**不**变成 select-all） |
 * | 空数组 / 全部非法 | `invalid_input`（**不**变成 select-all） |
 * | 含至少一个合法项（可混合非法项） | 使用合法子集（忽略非法项，保持入参顺序） |
 */
export type MemoryKindsNormalization =
  | { ok: true; value: MemoryKind[] | undefined }
  | { ok: false; reason: string }

export function normalizeMemoryKinds(kinds: unknown): MemoryKindsNormalization {
  if (kinds === undefined || kinds === null) return { ok: true, value: undefined }
  if (!Array.isArray(kinds)) {
    return { ok: false, reason: 'memoryKinds must be an array of memory kinds when provided' }
  }

  const out: MemoryKind[] = []
  for (const kind of kinds) {
    if (isMemoryKind(kind) && !out.includes(kind)) out.push(kind)
  }
  if (out.length === 0) {
    return {
      ok: false,
      reason: `memoryKinds must contain at least one valid kind: ${MEMORY_KINDS.join(', ')}`,
    }
  }
  return { ok: true, value: out }
}

export type MemoryWriteValidationResult =
  | { ok: true; value: NewMemoryRecord }
  | { ok: false; reason: string }

/**
 * 校验并归一化未校验的记忆写入输入。
 *
 * 确定性拒绝规则：
 *  - 归属 `ownerUserId`（由 Application 从 `ExecutionContext.userId` 注入）非法 → 拒绝
 *  - `kind` / `source` 不在闭集 → 拒绝（"是什么"与"从哪来"都不可猜）
 *  - `key` 归一化后为空 / 超长 → 拒绝
 *  - `key` 命中 canonical User State 保留语义（B-02）→ 拒绝（唯一权威是 `UserProfile`）
 *  - `content` 归一化后为空 / 超过 {@link MEMORY_CONTENT_MAX_CHARS} → 拒绝
 */
export function validateNewMemoryInput(
  input: RawMemoryWriteInput,
  ownerUserId: unknown,
): MemoryWriteValidationResult {
  const userId = normalizeUserId(ownerUserId)
  if (!userId.ok) return { ok: false, reason: userId.reason }

  if (!isMemoryKind(input.kind)) {
    return { ok: false, reason: `kind must be one of: ${MEMORY_KINDS.join(', ')}` }
  }
  if (!isMemorySource(input.source)) {
    return { ok: false, reason: `source must be one of: ${MEMORY_SOURCES.join(', ')}` }
  }

  if (typeof input.key !== 'string') {
    return { ok: false, reason: 'key must be a string' }
  }
  const key = normalizeMemoryKey(input.key)
  if (key.length === 0) {
    return { ok: false, reason: 'key must not be empty' }
  }
  if (key.length > MEMORY_KEY_MAX_CHARS) {
    return { ok: false, reason: `key must be at most ${MEMORY_KEY_MAX_CHARS} characters` }
  }
  if (isReservedCanonicalMemoryKey(key)) {
    return {
      ok: false,
      reason:
        `key "${key}" is reserved canonical User State semantics; ` +
        'update the learning profile via UpdateLearningProfileUseCase instead of writing Memory',
    }
  }

  if (typeof input.content !== 'string') {
    return { ok: false, reason: 'content must be a string' }
  }
  const content = normalizeMemoryContent(input.content)
  if (content.length === 0) {
    return { ok: false, reason: 'content must not be empty' }
  }
  if (content.length > MEMORY_CONTENT_MAX_CHARS) {
    return {
      ok: false,
      reason: `content must be at most ${MEMORY_CONTENT_MAX_CHARS} characters`,
    }
  }

  return {
    ok: true,
    value: {
      userId: userId.value,
      kind: input.kind,
      key,
      content,
      source: input.source,
    },
  }
}
