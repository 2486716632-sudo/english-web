// @layer Infrastructure — FeedSourcePort implementation (rss-parser)

import Parser from 'rss-parser'
import type { FeedEntry, FeedSourcePort } from '@/application/ports/feed-source'

interface ParsedFeedItem {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  guid?: string
  categories?: string[]
  creator?: string
}

interface ParsedFeed {
  title?: string
  items: ParsedFeedItem[]
}

/**
 * `FeedSourcePort` 的 rss-parser 实现。
 *
 * 迁移前后使用同一个库与同一套解析调用（`parser.parseURL`），
 * 只把结果裁剪为管线真正使用的字段。
 */
export class RssFeedSource implements FeedSourcePort {
  private readonly parser: Parser<ParsedFeed, ParsedFeedItem>

  constructor(parser?: Parser<ParsedFeed, ParsedFeedItem>) {
    this.parser = parser ?? new Parser<ParsedFeed, ParsedFeedItem>()
  }

  async fetchFeed(feedUrl: string): Promise<FeedEntry[]> {
    const feed = await this.parser.parseURL(feedUrl)

    return feed.items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      content: item.content,
    }))
  }
}
