// @layer Domain — Reading 内容规则（纯函数，无 AI / 无 Prisma / 无 IO）

import type { ArticleDifficulty, ReadingVocabItem } from './types'

/** 正文最小长度：低于此值的内容直接跳过（保持既有阈值）。 */
export const MIN_ARTICLE_CONTENT_CHARS = 100

/** 单篇文章入库的词汇条数上限（保持既有上限）。 */
export const MAX_VOCAB_ITEMS = 10

/** 摘要 excerpt 的最大字符数（保持既有长度）。 */
export const MAX_EXCERPT_CHARS = 300

/** 难度阈值（保持既有启发式）。 */
export const DIFFICULTY_HIGH_CONTENT_CHARS = 3000
export const DIFFICULTY_MEDIUM_CONTENT_CHARS = 1500

/** 正文是否足够长到值得处理。 */
export function hasSufficientContent(
  text: string,
  minChars: number = MIN_ARTICLE_CONTENT_CHARS,
): boolean {
  return text.length >= minChars
}

/**
 * 由正文长度推导难度。
 * 值与既有实现完全一致：>3000 → 4；>1500 → 3；否则 2。
 */
export function difficultyFromContentLength(contentLength: number): ArticleDifficulty {
  if (contentLength > DIFFICULTY_HIGH_CONTENT_CHARS) return 4
  if (contentLength > DIFFICULTY_MEDIUM_CONTENT_CHARS) return 3
  return 2
}

/**
 * 生成摘要用 excerpt：截断到 300 字符 → 折叠连续空白 → trim。
 * 与既有实现 `text.slice(0, 300).replace(/\s+/g, ' ').trim()` 等价。
 */
export function buildExcerpt(text: string, maxChars: number = MAX_EXCERPT_CHARS): string {
  return text.slice(0, maxChars).replace(/\s+/g, ' ').trim()
}

/** 词汇条数截断（保持既有 `slice(0, 10)` 行为）。 */
export function limitVocabItems(
  items: readonly ReadingVocabItem[],
  maxItems: number = MAX_VOCAB_ITEMS,
): ReadingVocabItem[] {
  return items.slice(0, maxItems)
}
