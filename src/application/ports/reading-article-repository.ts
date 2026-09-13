// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port

/**
 * ReadingArticleRepositoryPort — Reading 摄取管线所需的**最小**读写契约。
 *
 * 刻意保持最小：只包含本工作流真正用到的操作，不做通用 Repository 框架。
 * 查询返回值保持与既有实现一致（url 原样返回；title 原样返回，由上层做大小写归一化）。
 */

export interface NewReadingVocabItem {
  word: string
  type: string
  partOfSpeech: string | null
  /** 既有管线显式写入 null（音标由后续 `/api/reading/[id]/vocab` 流程补齐）。 */
  phonetic: string | null
  definition: string
  contextSentence: string
}

export interface NewReadingArticle {
  title: string
  titleZh: string | null
  url: string
  imageUrl: string | null
  publishedAt: Date | null
  source: string
  sourceEmoji: string
  content: string
  summary: string
  summaryEn: string | null
  difficulty: number
  tags: string
  vocabItems: NewReadingVocabItem[]
}

export interface ReadingArticleRepositoryPort {
  /** 已存在文章的 url（**原样返回**，非空）。 */
  listExistingUrls(): Promise<string[]>
  /** 已存在文章的 title（**原样返回**）。 */
  listExistingTitles(): Promise<string[]>
  /** 写入一篇文章（含嵌套词汇条目），返回新文章 id。 */
  createArticle(article: NewReadingArticle): Promise<{ id: number }>
  countArticles(): Promise<number>
  /** 按创建时间升序返回最旧的 n 篇 id。 */
  findOldestArticleIds(count: number): Promise<number[]>
  /** 删除指定文章及其词汇条目（先删词汇再删文章，与既有实现一致，无事务）。 */
  deleteArticlesWithVocab(articleIds: number[]): Promise<void>
}
