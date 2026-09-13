// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port

/**
 * ArticleExtractorPort — 从 HTML（或 URL）中抽取可读正文。
 *
 * 只负责「拿到正文文本 / HTML / 配图」，不做长度判断、不做摘要、不调用 AI。
 */

export interface ExtractedArticleContent {
  /** 纯文本正文（去标签后的可读文本）。 */
  textContent: string
  /** 清洗后的正文 HTML。 */
  htmlContent: string
  imageUrl: string | null
}

export interface ExtractArticleInput {
  url: string
  /** Feed 自带 HTML；提供时不再发起 HTTP 请求。 */
  html?: string
}

export interface ArticleExtractorPort {
  /** 抽取失败应抛出错误（该条计为失败，不影响其余条目）。 */
  extract(input: ExtractArticleInput): Promise<ExtractedArticleContent>
}
