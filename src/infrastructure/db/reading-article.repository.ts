// @layer Infrastructure — ReadingArticleRepositoryPort implementation (Prisma)

import type { PrismaClient } from '@/generated/prisma/client'
import type {
  NewReadingArticle,
  ReadingArticleRepositoryPort,
} from '@/application/ports/reading-article-repository'

/**
 * `ReadingArticleRepositoryPort` 的 Prisma 实现。
 *
 * 保持迁移前的持久化行为：
 *  - url / title 查询返回原始值（大小写归一化由 Application 层负责）
 *  - 写入使用嵌套 create（Article + ArticleVocab）
 *  - 裁剪：先删 ArticleVocab 再删 Article，**不使用事务**（与现状一致）
 */
export class PrismaReadingArticleRepository implements ReadingArticleRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async listExistingUrls(): Promise<string[]> {
    const rows = await this.client.article.findMany({
      select: { url: true },
      where: { url: { not: null } },
    })
    return rows.map((row) => row.url).filter((url): url is string => Boolean(url))
  }

  async listExistingTitles(): Promise<string[]> {
    const rows = await this.client.article.findMany({ select: { title: true } })
    return rows.map((row) => row.title)
  }

  async createArticle(article: NewReadingArticle): Promise<{ id: number }> {
    const created = await this.client.article.create({
      data: {
        title: article.title,
        titleZh: article.titleZh,
        url: article.url,
        imageUrl: article.imageUrl,
        publishedAt: article.publishedAt,
        source: article.source,
        sourceEmoji: article.sourceEmoji,
        content: article.content,
        summary: article.summary,
        summaryEn: article.summaryEn,
        difficulty: article.difficulty,
        tags: article.tags,
        vocabItems: {
          create: article.vocabItems.map((item) => ({
            word: item.word,
            type: item.type,
            partOfSpeech: item.partOfSpeech,
            phonetic: item.phonetic,
            definition: item.definition,
            contextSentence: item.contextSentence,
          })),
        },
      },
    })
    return { id: created.id }
  }

  async countArticles(): Promise<number> {
    return this.client.article.count()
  }

  async findOldestArticleIds(count: number): Promise<number[]> {
    const rows = await this.client.article.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: count,
    })
    return rows.map((row) => row.id)
  }

  async deleteArticlesWithVocab(articleIds: number[]): Promise<void> {
    if (articleIds.length === 0) return

    await this.client.articleVocab.deleteMany({
      where: { articleId: { in: articleIds } },
    })
    await this.client.article.deleteMany({
      where: { id: { in: articleIds } },
    })
  }
}
