// @layer Infrastructure — ArticleExtractorPort implementation (JSDOM + Readability)

// @ts-expect-error jsdom has no bundled types
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import type {
  ArticleExtractorPort,
  ExtractArticleInput,
  ExtractedArticleContent,
} from '@/application/ports/article-extractor'

/** 与迁移前一致的抓取 UA。 */
export const ARTICLE_FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; EnglishLearningBot/1.0)'

/** 从 HTML 中提取主图（优先 og:image，其次首个 img）。 */
export function extractImageFromHtml(html: string): string | null {
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
  if (match) return match[1]
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i)
  if (imgMatch) return imgMatch[1]
  return null
}

export interface ReadabilityArticleExtractorOptions {
  /** 便于测试注入；默认使用全局 `fetch`。 */
  fetchImpl?: typeof fetch
}

/**
 * `ArticleExtractorPort` 实现：
 *  - Feed 自带 HTML 时直接使用（不发第二次 HTTP 请求，与迁移前一致）
 *  - 否则以固定 UA 抓取页面，非 2xx 抛出 `HTTP {status} for {url}`（文案保持）
 *  - 抽取不到正文时抛出 `Readability failed to parse content`（文案保持）
 */
export class ReadabilityArticleExtractor implements ArticleExtractorPort {
  private readonly fetchImpl: typeof fetch

  constructor(options: ReadabilityArticleExtractorOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  }

  async extract(input: ExtractArticleInput): Promise<ExtractedArticleContent> {
    const html = input.html ? input.html : await this.fetchHtml(input.url)
    const imageUrl = extractImageFromHtml(html)

    const dom = new JSDOM(html, { url: input.url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article || !article.textContent) {
      throw new Error('Readability failed to parse content')
    }

    return {
      textContent: article.textContent.trim(),
      htmlContent: (article.content || '').trim(),
      imageUrl,
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await this.fetchImpl(url, {
      headers: { 'User-Agent': ARTICLE_FETCH_USER_AGENT },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }
    return response.text()
  }
}
