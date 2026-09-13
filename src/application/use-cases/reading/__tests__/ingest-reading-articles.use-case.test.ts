import { describe, it, expect, vi } from 'vitest'
import { ApplicationError } from '@/application/errors'
import type {
  AIChatResult,
  AIClientPort,
  AIStructuredResult,
} from '@/application/ports/ai-client'
import type {
  ArticleExtractorPort,
  ExtractedArticleContent,
} from '@/application/ports/article-extractor'
import type { FeedEntry, FeedSourcePort } from '@/application/ports/feed-source'
import type {
  NewReadingArticle,
  ReadingArticleRepositoryPort,
} from '@/application/ports/reading-article-repository'
import {
  IngestReadingArticlesUseCase,
  type IngestReadingArticlesInput,
} from '@/application/use-cases/reading/ingest-reading-articles.use-case'
import {
  ReadingPipelineWorkflow,
  type ReadingPipelineConfig,
  type ReadingPipelineResult,
} from '@/application/workflows/reading-pipeline.workflow'
import type { ArticleProcessingResult } from '@/domain/reading/types'

const FEEDS = [{ url: 'https://feed.test/tech', tag: 'tech' }]

const validInput: IngestReadingArticlesInput = { feeds: FEEDS, maxPerRun: 8, maxArticles: 50 }

// ---------------------------------------------------------------
// Use Case 入口契约（stub workflow）
// ---------------------------------------------------------------

function useCaseWithWorkflowStub() {
  const run = vi.fn<(config: ReadingPipelineConfig) => Promise<ReadingPipelineResult>>()
  const stub = { run } as unknown as ReadingPipelineWorkflow
  return { useCase: new IngestReadingArticlesUseCase(stub), run }
}

const okResult: ReadingPipelineResult = {
  earlyExit: null,
  pushed: 1,
  skipped: 0,
  failed: 0,
  degraded: 0,
  deleted: 0,
  totalArticles: 1,
  candidateCount: 1,
  newCandidateCount: 1,
  selectedCount: 1,
  articles: [{ id: 1, title: 'A', url: 'https://site.test/a' }],
}

describe('IngestReadingArticlesUseCase — 入口契约', () => {
  it('把校验后的配置交给 Workflow 并返回其结果', async () => {
    const { useCase, run } = useCaseWithWorkflowStub()
    run.mockResolvedValue(okResult)

    const result = await useCase.execute(validInput)

    expect(result).toBe(okResult)
    expect(run).toHaveBeenCalledWith(
      {
        feeds: FEEDS,
        maxPerRun: 8,
        maxArticles: 50,
        minContentChars: undefined,
        maxVocabItems: undefined,
        interArticleDelayMs: undefined,
        source: undefined,
      },
      // Phase 5：第二个参数是显式 ExecutionContext；未提供 trace 时转发 Null Object（不是 undefined）。
      { trace: expect.objectContaining({ traceId: 'noop' }) },
    )
  })

  it('可选配置透传给 Workflow', async () => {
    const { useCase, run } = useCaseWithWorkflowStub()
    run.mockResolvedValue(okResult)

    await useCase.execute({
      ...validInput,
      minContentChars: 200,
      maxVocabItems: 5,
      interArticleDelayMs: 0,
      source: { name: 'Custom', emoji: '🧪' },
    })

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        minContentChars: 200,
        maxVocabItems: 5,
        interArticleDelayMs: 0,
        source: { name: 'Custom', emoji: '🧪' },
      }),
      // Phase 5：第二个参数是显式 ExecutionContext（未提供 trace 时为 Null Object）。
      { trace: expect.objectContaining({ traceId: 'noop' }) },
    )
  })

  const invalidCases: Array<[string, IngestReadingArticlesInput]> = [
    ['feeds 为空', { ...validInput, feeds: [] }],
    ['feed url 为空', { ...validInput, feeds: [{ url: '', tag: 'tech' }] }],
    ['feed tag 为空', { ...validInput, feeds: [{ url: 'https://feed.test/x', tag: '' }] }],
    ['maxPerRun 为 0', { ...validInput, maxPerRun: 0 }],
    ['maxPerRun 非整数', { ...validInput, maxPerRun: 1.5 }],
    ['maxArticles 为 0', { ...validInput, maxArticles: 0 }],
    ['minContentChars 为负', { ...validInput, minContentChars: -1 }],
    ['maxVocabItems 为负', { ...validInput, maxVocabItems: -1 }],
    ['interArticleDelayMs 为负', { ...validInput, interArticleDelayMs: -1 }],
  ]

  it.each(invalidCases)('%s → invalid_input，且不调用 Workflow', async (_label, input) => {
    const { useCase, run } = useCaseWithWorkflowStub()

    await expect(useCase.execute(input)).rejects.toMatchObject({
      name: 'ApplicationError',
      code: 'invalid_input',
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('Workflow 抛出的 ApplicationError 原样向上传递', async () => {
    const { useCase, run } = useCaseWithWorkflowStub()
    run.mockRejectedValue(new ApplicationError('feed_unavailable', 'Get feed failed'))

    await expect(useCase.execute(validInput)).rejects.toMatchObject({
      code: 'feed_unavailable',
      message: 'Get feed failed',
    })
  })

  it('未归类的意外失败被包装为 unexpected 并保留 cause', async () => {
    const { useCase, run } = useCaseWithWorkflowStub()
    const original = new TypeError('boom')
    run.mockRejectedValue(original)

    const error = (await useCase.execute(validInput).catch((e: unknown) => e)) as ApplicationError

    expect(error).toBeInstanceOf(ApplicationError)
    expect(error.code).toBe('unexpected')
    expect(error.message).toBe('boom')
    expect(error.cause).toBe(original)
  })
})

// ---------------------------------------------------------------
// 真实 Workflow + fake Ports（不访问网络 / 不调用真实 AI / 不连数据库）
// ---------------------------------------------------------------

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

class StubAIClient implements AIClientPort {
  async chat(): Promise<AIChatResult> {
    throw new Error('chat() is not used by the Reading pipeline')
  }
  async chatStructured<T>(): Promise<AIStructuredResult<T>> {
    const data: ArticleProcessingResult = {
      titleZh: '标题',
      summaryZh: '摘要',
      vocabItems: [],
    }
    return {
      data: data as T,
      meta: { provider: 'stub', model: 'stub-model', latencyMs: 1, attempts: 1 },
    }
  }
}

describe('IngestReadingArticlesUseCase — 与真实 Workflow 组合（fake Ports）', () => {
  it('完整跑通一条管线并返回可观测结果', async () => {
    const repository = new StubRepository()
    const workflow = new ReadingPipelineWorkflow(
      {
        feedSource: new StubFeedSource([
          { title: 'Article', link: 'https://site.test/a', content: '<html/>' },
        ]),
        extractor: new StubExtractor({
          textContent: 'w '.repeat(200),
          htmlContent: '<article/>',
          imageUrl: null,
        }),
        repository,
        aiClient: new StubAIClient(),
      },
      { sleep: async () => {}, random: () => 0.5 },
    )
    const useCase = new IngestReadingArticlesUseCase(workflow)

    const result = await useCase.execute(validInput)

    expect(result.earlyExit).toBeNull()
    expect(result.pushed).toBe(1)
    expect(result.totalArticles).toBe(1)
    expect(repository.created[0].titleZh).toBe('标题')
    expect(repository.created[0].summary).toBe('摘要')
    // 难度由正文长度推导（'w '.repeat(200) = 400 字符 → 2）
    expect(repository.created[0].difficulty).toBe(2)
  })
})

// 说明：本文件所有端口均为 stub/fake，不存在对真实 DeepSeek 或 TTS 的调用。
