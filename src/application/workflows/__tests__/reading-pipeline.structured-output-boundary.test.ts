import { describe, it, expect } from 'vitest'
import { AIError } from '@/application/ports/ai-client'
import type { ArticleExtractorPort, ExtractedArticleContent } from '@/application/ports/article-extractor'
import type { FeedEntry, FeedSourcePort } from '@/application/ports/feed-source'
import type {
  NewReadingArticle,
  ReadingArticleRepositoryPort,
} from '@/application/ports/reading-article-repository'
import { articleProcessingPayloadSchema } from '@/application/prompts/reading/process-article.prompt'
import { ReadingPipelineWorkflow } from '@/application/workflows/reading-pipeline.workflow'
import { AIClient } from '@/infrastructure/ai/ai-client'
import type {
  AIProviderAdapter,
  ProviderChatRequest,
  ProviderChatResponse,
} from '@/infrastructure/ai/adapters/types'

/**
 * C6 验证（v2 审核 Minor Changes Requested 第 3 项）：
 * 用**真实的** Phase 3 `AIClient` / `chatStructured()` + 内存中的假 provider，
 * 证明「provider 返回 JSON `null`」在真实结构化输出边界下的行为，
 * 而不是用 FakeAIClient 绕过 Phase 3 实现。
 *
 * 无网络、无 DeepSeek、无数据库。
 */

/** 假 provider：只回放固定 content，不访问网络。 */
function providerReturning(content: string): {
  adapter: AIProviderAdapter
  requests: ProviderChatRequest[]
} {
  const requests: ProviderChatRequest[] = []
  const adapter: AIProviderAdapter = {
    provider: 'fake-provider',
    defaultModel: 'fake-model',
    async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
      requests.push(request)
      return { content, model: 'fake-model', finishReason: 'stop' }
    },
  }
  return { adapter, requests }
}

class StubFeedSource implements FeedSourcePort {
  constructor(private readonly entries: FeedEntry[]) {}
  async fetchFeed(): Promise<FeedEntry[]> {
    return this.entries
  }
}

class StubExtractor implements ArticleExtractorPort {
  constructor(private readonly content: ExtractedArticleContent) {}
  async extract(): Promise<ExtractedArticleContent> {
    return this.content
  }
}

class StubRepository implements ReadingArticleRepositoryPort {
  readonly created: NewReadingArticle[] = []
  async listExistingUrls(): Promise<string[]> {
    return []
  }
  async listExistingTitles(): Promise<string[]> {
    return []
  }
  async createArticle(article: NewReadingArticle): Promise<{ id: number }> {
    this.created.push(article)
    return { id: this.created.length }
  }
  async countArticles(): Promise<number> {
    return this.created.length
  }
  async findOldestArticleIds(): Promise<number[]> {
    return []
  }
  async deleteArticlesWithVocab(): Promise<void> {}
}

const extractedContent = (): ExtractedArticleContent => ({
  textContent: 'A short but sufficient English article body. '.repeat(10),
  htmlContent: '<article/>',
  imageUrl: null,
})

describe('C6 — provider 返回 JSON null 时的真实行为（真实 Phase 3 边界）', () => {
  it('真实 chatStructured() 把 "null" 视为未提取到 JSON → AIError(invalid_response)', async () => {
    const { adapter, requests } = providerReturning('null')
    const client = new AIClient({ adapter })

    const error = (await client
      .chatStructured(
        { messages: [{ role: 'user', content: 'irrelevant' }] },
        articleProcessingPayloadSchema,
        { maxRepairAttempts: 0 },
      )
      .catch((e: unknown) => e)) as AIError

    expect(error).toBeInstanceOf(AIError)
    expect(error.code).toBe('invalid_response')
    expect(error.retryable).toBe(false)
    // 只发起一次 provider 请求（maxRepairAttempts = 0，未启用解析修复）
    expect(requests).toHaveLength(1)
  })

  it('Workflow 端到端：JSON null → 降级为空结果，文章仍然入库（C6 文档所述行为）', async () => {
    const { adapter, requests } = providerReturning('null')
    const repository = new StubRepository()
    const events: string[] = []

    const workflow = new ReadingPipelineWorkflow(
      {
        feedSource: new StubFeedSource([{ title: 'Null payload', link: 'https://site.test/n', content: '<html/>' }]),
        extractor: new StubExtractor(extractedContent()),
        repository,
        // 真实的 Phase 3 客户端 + 假 provider（不是 FakeAIClient）
        aiClient: new AIClient({ adapter }),
      },
      { sleep: async () => {}, random: () => 0.5, onEvent: (event) => events.push(event.type) },
    )

    const result = await workflow.run({
      feeds: [{ url: 'https://feed.test/tech', tag: 'tech' }],
      maxPerRun: 8,
      maxArticles: 50,
    })

    // 降级：文章仍然入库，AI 字段为空，摘要回退为 excerpt
    expect(result).toMatchObject({ pushed: 1, degraded: 1, failed: 0, skipped: 0 })
    expect(repository.created).toHaveLength(1)
    expect(repository.created[0].titleZh).toBeNull()
    expect(repository.created[0].vocabItems).toEqual([])
    expect(repository.created[0].summary).toBe(
      extractedContent().textContent.slice(0, 300).replace(/\s+/g, ' ').trim(),
    )

    // 走的是"AI 步骤降级"分支，而不是"该条失败"分支
    expect(events).toContain('article:ai')
    expect(events).toContain('article:persisted')
    expect(events).not.toContain('article:failed')
    expect(requests).toHaveLength(1)
  })

  it('对照：provider 返回合法对象时同一链路正常使用 AI 数据（证明测试链路有效）', async () => {
    const { adapter } = providerReturning(
      JSON.stringify({ titleZh: '标题', summaryZh: '摘要', vocabItems: [] }),
    )
    const repository = new StubRepository()

    const workflow = new ReadingPipelineWorkflow(
      {
        feedSource: new StubFeedSource([{ title: 'Valid payload', link: 'https://site.test/v' }]),
        extractor: new StubExtractor(extractedContent()),
        repository,
        aiClient: new AIClient({ adapter }),
      },
      { sleep: async () => {}, random: () => 0.5 },
    )

    const result = await workflow.run({
      feeds: [{ url: 'https://feed.test/tech', tag: 'tech' }],
      maxPerRun: 8,
      maxArticles: 50,
    })

    expect(result).toMatchObject({ pushed: 1, degraded: 0, failed: 0 })
    expect(repository.created[0].titleZh).toBe('标题')
    expect(repository.created[0].summary).toBe('摘要')
  })

})
