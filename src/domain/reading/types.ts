// @layer Domain — Reading 领域类型（无外部依赖）

/** 文章难度：与现有管线一致的三档取值。 */
export type ArticleDifficulty = 2 | 3 | 4

/**
 * **归一化后**的词汇条目：字段保证可用于持久化。
 * `type` 是具体字符串（缺失时归一化为 "word"）。
 */
export interface ReadingVocabItem {
  word: string
  /** "word" | "phrase" | "expression" —— 保持字符串以兼容历史数据。 */
  type: string
  partOfSpeech?: string
  definition: string
  contextSentence: string
}

/**
 * AI 返回的**原始**词汇条目形状（JSON 解析后的值）。
 *
 * 与归一化后的 `ReadingVocabItem` 的区别：
 *  - `type` 可缺失（历史实现用 `v.type || 'word'` 兜底）
 *  - 运行时的实际输入是 `unknown`，因此这里只是"期望形状"的声明，
 *    真正的校验由 `normalizeArticleProcessingPayload()` 逐字段完成
 */
export interface RawReadingVocabItem {
  word: string
  type?: string
  partOfSpeech?: string
  definition: string
  contextSentence: string
}

/** AI 返回的**原始**文章处理负载形状（声明用；运行时为 `unknown`）。 */
export interface RawArticleProcessingPayload {
  titleZh?: string
  summaryZh?: string
  vocabItems?: RawReadingVocabItem[]
}

/**
 * **归一化后**的文章处理结果，也是持久化使用的形状。
 * 属于领域内容契约，不属于任何 provider。
 */
export interface ArticleProcessingResult {
  titleZh: string
  summaryZh: string
  vocabItems: ReadingVocabItem[]
}
