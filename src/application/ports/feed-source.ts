// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port

/**
 * FeedSourcePort — 读取内容源（RSS/Atom）的最小契约。
 *
 * 只负责「取回条目」，不负责去重、不负责抓取正文、不负责 prompt。
 * 具体实现（rss-parser 等）属于 Infrastructure。
 */

export interface FeedEntry {
  title?: string
  link?: string
  pubDate?: string
  /** Feed 自带的 HTML 正文（存在时优先使用，避免额外 HTTP 抓取）。 */
  content?: string
}

export interface FeedSourcePort {
  /** 读取一个 feed 的条目。取回失败应抛出错误（由上层决定是否中断整轮）。 */
  fetchFeed(feedUrl: string): Promise<FeedEntry[]>
}
