// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Prompt builder + structured-output contract

import type { AIMessage, AIStructuredSchema } from '@/application/ports/ai-client'

/**
 * Reading 文章处理 Prompt。
 *
 * 说明：Phase 4 为**行为保持一致**的迁移，因此 Prompt 文本与迁移前
 * `scripts/reading-push.ts` 中的内联 system prompt 逐字一致；
 * user 内容的截断长度（4000 字符 + `...`）也与原实现一致。
 */

export const PROCESS_ARTICLE_PROMPT_VERSION = '1.0'

/** 送入 Prompt 的正文最大字符数（既有实现为 4000）。 */
export const MAX_PROMPT_CONTENT_CHARS = 4000

const SYSTEM_PROMPT = `You are an English learning assistant. Given an English news article, extract content for Chinese-speaking IELTS learners.

A word's meaning often depends on the phrase it appears in (e.g. "give up" vs "give in", "look after" vs "look into"). Phrases, phrasal verbs, and collocations are just as important as individual words — they show how words are actually used in context.

Return JSON with:
- titleZh: Chinese translation of the title
- summaryZh: One-paragraph Chinese summary (catchy, like a digest)
- vocabItems: Array of key vocabulary items useful for IELTS learners

Each vocabItem has:
- word: the word/phrase
- type: "word" | "phrase" | "expression"
- partOfSpeech: "noun" | "verb" | "adj." | "adv." etc (only for type=word)
- definition: Chinese definition
- contextSentence: The exact sentence from the article where this word appears (keep original English)

Guidelines:
- Words and phrases are NOT mutually exclusive. A word can appear both as a standalone word (type="word") AND as part of a phrase (type="phrase") — they serve different learning purposes
- Focus on phrases where the meaning cannot be inferred from individual words: phrasal verbs ("give up", "carry out"), idioms, and strong collocations ("heavy rain", "make a decision")
- If the article uses a word in both a literal and a phrasal sense, include both`

export interface ProcessArticlePromptInput {
  title: string
  content: string
  maxContentChars?: number
}

export interface ProcessArticlePrompt {
  system: string
  messages: AIMessage[]
  /** 送入 Prompt 的正文长度（供 metadata / 诊断使用）。 */
  truncatedContentLength: number
}

/** 与既有实现等价的截断：超出上限时截断并追加 `...`。 */
export function truncateForPrompt(content: string, maxChars: number = MAX_PROMPT_CONTENT_CHARS): string {
  return content.length > maxChars ? content.slice(0, maxChars) + '...' : content
}

export function buildProcessArticlePrompt(input: ProcessArticlePromptInput): ProcessArticlePrompt {
  const truncated = truncateForPrompt(input.content, input.maxContentChars)

  return {
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Title: ${input.title}\n\nArticle:\n${truncated}` }],
    truncatedContentLength: truncated.length,
  }
}

/**
 * 结构化输出契约（Reading 管线专用）。
 *
 * 与 Phase 3 通用 AI Client 的关系：
 *  - JSON **提取**仍由已批准的 `chatStructured()` / `structured-output.ts` 负责（fence 剥离、括号切片等）
 *  - 本管线的历史语义是「只要 provider 返回了可解析 JSON，就**逐字段兜底**」，
 *    而不是「整包不合法就全部丢弃」。因此这里的 schema 只表达"已成功解析出 JSON"，
 *    字段级归一化与"不可恢复负载 = 该条失败"的判定交给 Domain 的
 *    `normalizeArticleProcessingPayload()`（见 CONTENT_PIPELINE_DESIGN §structured-output）。
 *
 * 注意：这**不**改变 Phase 3 的通用 AI Client —— 该 schema 只在 Reading 管线内使用。
 */
export const articleProcessingPayloadSchema: AIStructuredSchema<unknown> = {
  name: 'reading.processArticle.payload',
  validate: (value: unknown): value is unknown => value !== undefined,
}
