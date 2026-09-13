import { describe, it, expect, vi } from 'vitest'
import { RssFeedSource } from '@/infrastructure/rss/rss-feed-source'

/**
 * `RssFeedSource` 单元测试（不访问网络）。
 *
 * 通过注入 parser stub 覆盖「rss-parser 结果 → FeedEntry 映射」与「parser 失败向上传播」，
 * 这是 Phase 4 未对真实 RSS 执行端到端运行时唯一被跳过的适配器行为。
 */

type ParserStub = ConstructorParameters<typeof RssFeedSource>[0]

function sourceWith(parseURL: (url: string) => Promise<unknown>): RssFeedSource {
  return new RssFeedSource({ parseURL } as unknown as ParserStub)
}

describe('RssFeedSource', () => {
  it('把 parser 结果映射为 FeedEntry，只保留管线使用的字段', async () => {
    const parseURL = vi.fn(async () => ({
      title: 'Tech feed',
      items: [
        {
          title: 'Article A',
          link: 'https://site.test/a',
          pubDate: '2026-02-01T00:00:00Z',
          content: '<p>html</p>',
          // 以下字段管线不使用，应被丢弃
          contentSnippet: 'snippet',
          guid: 'guid-1',
          categories: ['tech'],
          creator: 'Author',
        },
      ],
    }))

    const entries = await sourceWith(parseURL).fetchFeed('https://feed.test/tech')

    expect(parseURL).toHaveBeenCalledWith('https://feed.test/tech')
    expect(entries).toEqual([
      {
        title: 'Article A',
        link: 'https://site.test/a',
        pubDate: '2026-02-01T00:00:00Z',
        content: '<p>html</p>',
      },
    ])
    expect(Object.keys(entries[0]).sort()).toEqual(['content', 'link', 'pubDate', 'title'])
  })

  it('缺失字段映射为 undefined（由上层决定跳过或回退）', async () => {
    const entries = await sourceWith(async () => ({ items: [{ title: 'Only title' }] })).fetchFeed(
      'https://feed.test/tech',
    )

    expect(entries).toEqual([
      { title: 'Only title', link: undefined, pubDate: undefined, content: undefined },
    ])
  })

  it('空 feed 返回空数组', async () => {
    await expect(sourceWith(async () => ({ items: [] })).fetchFeed('https://feed.test/tech')).resolves.toEqual([])
  })

  it('parser 失败向上传播（由 Workflow 归一化为 feed_unavailable）', async () => {
    const source = sourceWith(async () => {
      throw new Error('Get https://feed.test/tech failed')
    })

    await expect(source.fetchFeed('https://feed.test/tech')).rejects.toThrow(
      'Get https://feed.test/tech failed',
    )
  })
})
