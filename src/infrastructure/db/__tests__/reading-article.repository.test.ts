import { describe, it, expect } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'
import type { NewReadingArticle } from '@/application/ports/reading-article-repository'
import { PrismaReadingArticleRepository } from '@/infrastructure/db/reading-article.repository'

/**
 * Repository Adapter 行为测试（不连真实数据库）。
 * 用一个记录调用的 stub 冒充 PrismaClient —— 适配器只使用少数几个方法。
 */

interface StubCalls {
  articleFindMany: unknown[]
  articleCreate: unknown[]
  articleCount: number
  articleVocabDeleteMany: unknown[]
  articleDeleteMany: unknown[]
}

function createStubClient(overrides: {
  urls?: Array<{ url: string | null }>
  titles?: Array<{ title: string }>
  createdId?: number
  count?: number
  oldestIds?: Array<{ id: number }>
}) {
  const calls: StubCalls = {
    articleFindMany: [],
    articleCreate: [],
    articleCount: 0,
    articleVocabDeleteMany: [],
    articleDeleteMany: [],
  }

  const client = {
    article: {
      findMany: async (args: unknown) => {
        calls.articleFindMany.push(args)
        const a = args as { select?: { url?: boolean; title?: boolean; id?: boolean } }
        if (a.select?.id) return overrides.oldestIds ?? []
        if (a.select?.url) return overrides.urls ?? []
        return overrides.titles ?? []
      },
      create: async (args: unknown) => {
        calls.articleCreate.push(args)
        return { id: overrides.createdId ?? 42 }
      },
      count: async () => {
        calls.articleCount += 1
        return overrides.count ?? 0
      },
      deleteMany: async (args: unknown) => {
        calls.articleDeleteMany.push(args)
        return { count: 0 }
      },
    },
    articleVocab: {
      deleteMany: async (args: unknown) => {
        calls.articleVocabDeleteMany.push(args)
        return { count: 0 }
      },
    },
  }

  return { client: client as unknown as PrismaClient, calls }
}

const sampleArticle: NewReadingArticle = {
  title: 'Sample',
  titleZh: '样例',
  url: 'https://example.com/a',
  imageUrl: 'https://example.com/a.jpg',
  publishedAt: new Date('2026-01-02T03:04:05Z'),
  source: 'The Conversation',
  sourceEmoji: '📰',
  content: 'content',
  summary: '摘要',
  summaryEn: 'excerpt',
  difficulty: 3,
  tags: 'tech,health',
  vocabItems: [
    {
      word: 'give up',
      type: 'phrase',
      partOfSpeech: 'verb',
      phonetic: null,
      definition: '放弃',
      contextSentence: 'He gave up.',
    },
  ],
}

describe('PrismaReadingArticleRepository', () => {
  it('listExistingUrls 过滤 null 并只 select url', async () => {
    const { client, calls } = createStubClient({
      urls: [{ url: 'https://a' }, { url: null }, { url: 'https://b' }],
    })
    const repo = new PrismaReadingArticleRepository(client)

    expect(await repo.listExistingUrls()).toEqual(['https://a', 'https://b'])
    expect(calls.articleFindMany[0]).toEqual({
      select: { url: true },
      where: { url: { not: null } },
    })
  })

  it('listExistingTitles 返回原始标题（大小写归一化由 Application 负责）', async () => {
    const { client } = createStubClient({ titles: [{ title: 'Mixed Case' }] })
    const repo = new PrismaReadingArticleRepository(client)

    expect(await repo.listExistingTitles()).toEqual(['Mixed Case'])
  })

  it('createArticle 传递全部字段与嵌套词汇（phonetic 保持 null）', async () => {
    const { client, calls } = createStubClient({ createdId: 7 })
    const repo = new PrismaReadingArticleRepository(client)

    expect(await repo.createArticle(sampleArticle)).toEqual({ id: 7 })
    expect(calls.articleCreate[0]).toEqual({
      data: {
        title: 'Sample',
        titleZh: '样例',
        url: 'https://example.com/a',
        imageUrl: 'https://example.com/a.jpg',
        publishedAt: sampleArticle.publishedAt,
        source: 'The Conversation',
        sourceEmoji: '📰',
        content: 'content',
        summary: '摘要',
        summaryEn: 'excerpt',
        difficulty: 3,
        tags: 'tech,health',
        vocabItems: {
          create: [
            {
              word: 'give up',
              type: 'phrase',
              partOfSpeech: 'verb',
              phonetic: null,
              definition: '放弃',
              contextSentence: 'He gave up.',
            },
          ],
        },
      },
    })
  })

  it('countArticles / findOldestArticleIds 使用 createdAt asc', async () => {
    const { client, calls } = createStubClient({ count: 52, oldestIds: [{ id: 1 }, { id: 2 }] })
    const repo = new PrismaReadingArticleRepository(client)

    expect(await repo.countArticles()).toBe(52)
    expect(await repo.findOldestArticleIds(2)).toEqual([1, 2])
    expect(calls.articleFindMany[0]).toEqual({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 2,
    })
  })

  it('deleteArticlesWithVocab 先删词汇再删文章（与迁移前顺序一致）', async () => {
    const { client, calls } = createStubClient({})
    const repo = new PrismaReadingArticleRepository(client)

    await repo.deleteArticlesWithVocab([5, 6])

    expect(calls.articleVocabDeleteMany).toEqual([{ where: { articleId: { in: [5, 6] } } }])
    expect(calls.articleDeleteMany).toEqual([{ where: { id: { in: [5, 6] } } }])
  })

  it('空数组时不触发任何删除', async () => {
    const { client, calls } = createStubClient({})
    const repo = new PrismaReadingArticleRepository(client)

    await repo.deleteArticlesWithVocab([])

    expect(calls.articleVocabDeleteMany).toHaveLength(0)
    expect(calls.articleDeleteMany).toHaveLength(0)
  })
})
