import { describe, it, expect, vi } from 'vitest'
import { ApplicationError } from '@/application/errors'
import {
  AIError,
  type AIChatRequest,
  type AIChatResult,
  type AIClientPort,
  type AIStructuredOptions,
  type AIStructuredResult,
  type AIStructuredSchema,
} from '@/application/ports/ai-client'
import type {
  ArticleExtractorPort,
  ExtractArticleInput,
  ExtractedArticleContent,
} from '@/application/ports/article-extractor'
import type { FeedEntry, FeedSourcePort } from '@/application/ports/feed-source'
import type {
  NewReadingArticle,
  ReadingArticleRepositoryPort,
} from '@/application/ports/reading-article-repository'
import {
  DEFAULT_INTER_ARTICLE_DELAY_MS,
  READING_AI_RETRY_POLICY,
  READING_AI_TEMPERATURE,
  READING_AI_TIMEOUT_MS,
  ReadingPipelineWorkflow,
  type ReadingPipelineEvent,
  type ReadingPipelineOptions,
} from '@/application/workflows/reading-pipeline.workflow'
import type { ArticleProcessingResult } from '@/domain/reading/types'

// ---------------------------------------------------------------
// Fakes（全部离线：不访问网络、不调用真实 AI、不连数据库）
// ---------------------------------------------------------------

class FakeFeedSource implements FeedSourcePort {
  readonly calls: string[] = []

  constructor(private readonly feeds: Record<string, FeedEntry[]>) {}

  async fetchFeed(feedUrl: string): Promise<FeedEntry[]> {
    this.calls.push(feedUrl)
    const entries = this.feeds[feedUrl]
    if (!entries) throw new Error(`Get ${feedUrl} failed`)
    return entries
  }
}

class FakeExtractor implements ArticleExtractorPort {
  readonly calls: ExtractArticleInput[] = []

  constructor(
    private readonly results: Record<string, ExtractedArticleContent | Error>,
    private readonly order?: string[],
  ) {}

  async extract(input: ExtractArticleInput): Promise<ExtractedArticleContent> {
    this.calls.push(input)
    this.order?.push(`extract:${input.url}`)
    const result = this.results[input.url]
    if (!result) throw new Error(`No extraction result configured for ${input.url}`)
    if (result instanceof Error) throw result
    return result
  }
}

class FakeRepository implements ReadingArticleRepositoryPort {
  readonly created: NewReadingArticle[] = []
  readonly deletedIdBatches: number[][] = []
  countCalls = 0
  private deletedTotal = 0

  constructor(
    private readonly state: {
      urls?: string[]
      titles?: string[]
      count?: number
      oldestIds?: number[]
      failCreateForUrls?: string[]
      failUrlsQuery?: Error
      failTitlesQuery?: Error
      failCount?: Error
      failFindOldest?: Error
      failDelete?: Error
    } = {},
    private readonly order?: string[],
  ) {}

  async listExistingUrls(): Promise<string[]> {
    if (this.state.failUrlsQuery) throw this.state.failUrlsQuery
    return this.state.urls ?? []
  }

  async listExistingTitles(): Promise<string[]> {
    if (this.state.failTitlesQuery) throw this.state.failTitlesQuery
    return this.state.titles ?? []
  }

  async createArticle(article: NewReadingArticle): Promise<{ id: number }> {
    if ((this.state.failCreateForUrls ?? []).includes(article.url)) {
      throw new Error(`DB write failed for ${article.url}`)
    }
    this.created.push(article)
    this.order?.push(`persist:${article.url}`)
    return { id: 100 + this.created.length }
  }

  async countArticles(): Promise<number> {
    this.countCalls += 1
    if (this.state.failCount) throw this.state.failCount
    return (this.state.count ?? this.created.length) - this.deletedTotal
  }

  async findOldestArticleIds(count: number): Promise<number[]> {
    if (this.state.failFindOldest) throw this.state.failFindOldest
    return (this.state.oldestIds ?? []).slice(0, count)
  }

  async deleteArticlesWithVocab(articleIds: number[]): Promise<void> {
    if (this.state.failDelete) throw this.state.failDelete
    this.deletedIdBatches.push(articleIds)
    this.deletedTotal += articleIds.length
  }
}

class FakeAIClient implements AIClientPort {
  readonly requests: AIChatRequest[] = []
  readonly repairOptions: Array<AIStructuredOptions | undefined> = []

  constructor(
    private readonly behavior: (
      request: AIChatRequest,
      callIndex: number,
    ) => unknown | Error,
    private readonly order?: string[],
  ) {}

  async chat(): Promise<AIChatResult> {
    throw new Error('chat() is not used by the Reading pipeline')
  }

  async chatStructured<T>(
    request: AIChatRequest,
    _schema: AIStructuredSchema<T>,
    options?: AIStructuredOptions,
  ): Promise<AIStructuredResult<T>> {
    const callIndex = this.requests.length
    this.requests.push(request)
    this.repairOptions.push(options)
    this.order?.push(`ai:${callIndex}`)

    const result = this.behavior(request, callIndex)
    if (result instanceof Error) throw result
    return {
      data: result as T,
      meta: { provider: 'fake', model: 'fake-model', latencyMs: 5, attempts: 1 },
    }
  }
}

// ---------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------

const FEEDS = [{ url: 'https://feed.test/tech', tag: 'tech' }]

const aiPayload = (
  overrides: Partial<ArticleProcessingResult> = {},
): ArticleProcessingResult => ({
  titleZh: '中文标题',
  summaryZh: '中文摘要',
  vocabItems: [
    { word: 'give up', type: 'phrase', partOfSpeech: 'verb', definition: '放弃', contextSentence: 'He gave up.' },
  ],
  ...overrides,
})

const extracted = (
  textLength: number,
  imageUrl: string | null = 'https://cdn.test/img.jpg',
): ExtractedArticleContent => ({
  textContent: `Header. ${'word '.repeat(Math.ceil(textLength / 5))}`.slice(0, textLength),
  htmlContent: '<article>...</article>',
  imageUrl,
})

function harness(input: {
  feeds: Record<string, FeedEntry[]>
  extractions: Record<string, ExtractedArticleContent | Error>
  ai: (request: AIChatRequest, callIndex: number) => unknown | Error
  repo?: ConstructorParameters<typeof FakeRepository>[0]
  options?: ReadingPipelineOptions
}) {
  const order: string[] = []
  const events: ReadingPipelineEvent[] = []
  const feedSource = new FakeFeedSource(input.feeds)
  const extractor = new FakeExtractor(input.extractions, order)
  const repository = new FakeRepository(input.repo ?? {}, order)
  const aiClient = new FakeAIClient(input.ai, order)
  const sleep = vi.fn(async () => {})

  const workflow = new ReadingPipelineWorkflow(
    { feedSource, extractor, repository, aiClient },
    { onEvent: (event) => events.push(event), sleep, random: () => 0.5, ...input.options },
  )

  return { workflow, feedSource, extractor, repository, aiClient, sleep, events, order }
}

// ---------------------------------------------------------------
// 测试
// ---------------------------------------------------------------

describe('ReadingPipelineWorkflow — 完整成功流程', () => {
  it('抽取 → AI → 入库，顺序与持久化内容均正确', async () => {
    const { workflow, repository, sleep, order, events } = harness({
      feeds: {
        'https://feed.test/tech': [
          { title: 'Article A', link: 'https://site.test/a', pubDate: '2026-02-01T00:00:00Z', content: '<html>A</html>' },
          { title: 'Article B', link: 'https://site.test/b', content: '<html>B</html>' },
        ],
      },
      extractions: {
        'https://site.test/a': extracted(2000),
        'https://site.test/b': extracted(4000, null),
      },
      ai: () => aiPayload(),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result.earlyExit).toBeNull()
    expect(result).toMatchObject({
      pushed: 2,
      skipped: 0,
      failed: 0,
      degraded: 0,
      deleted: 0,
      candidateCount: 2,
      newCandidateCount: 2,
      selectedCount: 2,
    })
    expect(result.articles).toEqual([
      { id: 101, title: 'Article A', url: 'https://site.test/a' },
      { id: 102, title: 'Article B', url: 'https://site.test/b' },
    ])

    // 步骤顺序：每篇都是 extract → ai → persist
    expect(order).toEqual([
      'extract:https://site.test/a',
      'ai:0',
      'persist:https://site.test/a',
      'extract:https://site.test/b',
      'ai:1',
      'persist:https://site.test/b',
    ])

    // 入库字段（含难度、摘要兜底、source、tags、phonetic null）
    expect(repository.created[0]).toEqual({
      title: 'Article A',
      titleZh: '中文标题',
      url: 'https://site.test/a',
      imageUrl: 'https://cdn.test/img.jpg',
      publishedAt: new Date('2026-02-01T00:00:00Z'),
      source: 'The Conversation',
      sourceEmoji: '📰',
      content: extracted(2000).textContent,
      summary: '中文摘要',
      summaryEn: extracted(2000).textContent.slice(0, 300).replace(/\s+/g, ' ').trim(),
      difficulty: 3,
      tags: 'tech',
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
    })
    expect(repository.created[1].difficulty).toBe(4)
    expect(repository.created[1].imageUrl).toBeNull()
    expect(repository.created[1].publishedAt).toBeNull()

    // 限速：仅在成功入库后 sleep，默认 1500ms
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(DEFAULT_INTER_ARTICLE_DELAY_MS)

    // 事件流覆盖了各步骤边界（Phase 5 Trace 的挂点）
    expect(events.map((e) => e.type)).toEqual([
      'feed:start',
      'feed:loaded',
      'candidates:collected',
      'candidates:selected',
      'article:start',
      'article:extracted',
      'article:ai',
      'article:persisted',
      'article:start',
      'article:extracted',
      'article:ai',
      'article:persisted',
      'trim:checked',
    ])

    // 与迁移前一致：运行结束时再统计一次总数（裁剪前 + 结尾各一次）
    expect(repository.countCalls).toBe(2)
    expect(result.totalArticles).toBe(2)
  })

  it('跨 feed 去重并合并 tag；候选为空时早期退出', async () => {
    const { workflow } = harness({
      feeds: {
        'https://feed.test/tech': [{ title: 'Shared', link: 'https://site.test/shared' }],
        'https://feed.test/health': [
          { title: 'Shared', link: 'https://site.test/shared' },
          { title: 'Only health', link: 'https://site.test/health' },
        ],
      },
      extractions: {
        'https://site.test/shared': extracted(500),
        'https://site.test/health': extracted(500),
      },
      ai: () => aiPayload(),
    })

    const result = await workflow.run({
      feeds: [
        { url: 'https://feed.test/tech', tag: 'tech' },
        { url: 'https://feed.test/health', tag: 'health' },
      ],
      maxPerRun: 8,
      maxArticles: 50,
    })

    expect(result.candidateCount).toBe(2)
    expect(result.pushed).toBe(2)
  })

  it('没有任何候选文章时早期退出，且不查询/不裁剪数据库', async () => {
    const { workflow, repository, events } = harness({
      feeds: { 'https://feed.test/tech': [] },
      extractions: {},
      ai: () => aiPayload(),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result.earlyExit).toBe('no_candidates')
    expect(result.pushed).toBe(0)
    expect(repository.countCalls).toBe(0)
    expect(repository.deletedIdBatches).toHaveLength(0)
    expect(events.some((e) => e.type === 'run:earlyExit')).toBe(true)
  })

  it('候选全部已存在时早期退出，且不裁剪', async () => {
    const { workflow, repository } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'Old', link: 'https://site.test/old' }] },
      extractions: {},
      ai: () => aiPayload(),
      repo: { urls: ['https://site.test/old'], count: 99 },
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result.earlyExit).toBe('no_new_articles')
    expect(repository.countCalls).toBe(0)
    expect(repository.deletedIdBatches).toHaveLength(0)
  })
})

describe('ReadingPipelineWorkflow — 内容长度与 AI 降级', () => {
  it('正文过短：跳过、不调用 AI、不写库', async () => {
    const { workflow, repository, aiClient, sleep, events } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'Tiny', link: 'https://site.test/tiny' }] },
      extractions: { 'https://site.test/tiny': extracted(99) },
      ai: () => aiPayload(),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ skipped: 1, pushed: 0, failed: 0 })
    expect(aiClient.requests).toHaveLength(0)
    expect(repository.created).toHaveLength(0)
    expect(sleep).not.toHaveBeenCalled()
    expect(events.some((e) => e.type === 'article:skipped')).toBe(true)
  })

  it('AI provider 失败：降级为空结果但文章仍然入库', async () => {
    const { workflow, repository, events } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => new AIError('provider_error', 'DeepSeek HTTP 500: boom'),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, degraded: 1, failed: 0 })
    expect(repository.created[0].titleZh).toBeNull()
    expect(repository.created[0].vocabItems).toEqual([])
    expect(repository.created[0].summary).toBe(
      extracted(1200).textContent.slice(0, 300).replace(/\s+/g, ' ').trim(),
    )
    const aiEvent = events.find((e) => e.type === 'article:ai')
    expect(aiEvent).toMatchObject({ degraded: true, errorMessage: 'DeepSeek HTTP 500: boom' })
  })

  it('结构化校验失败（invalid_response）同样走降级路径', async () => {
    const { workflow, repository } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => new AIError('invalid_response', 'Structured output failed validation'),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, degraded: 1, failed: 0 })
    expect(repository.created[0].titleZh).toBeNull()
  })

  it('响应无法解析为 JSON（chatStructured 抛错）→ 降级为空结果，文章仍入库', async () => {
    const { workflow, repository, events } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => new AIError('invalid_response', 'response did not contain parseable JSON'),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, degraded: 1, failed: 0 })
    expect(repository.created[0].vocabItems).toEqual([])
    expect(events.some((e) => e.type === 'article:ai' && e.degraded)).toBe(true)
  })

  it('负载缺少 titleZh → 字段级兜底，summaryZh 与词汇保留（不降级、不失败）', async () => {
    const { workflow, repository } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => ({
        summaryZh: '摘要',
        vocabItems: [
          { word: 'give up', definition: '放弃', contextSentence: 'He gave up.' },
        ],
      }),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, degraded: 0, failed: 0 })
    expect(repository.created[0].titleZh).toBeNull()
    expect(repository.created[0].summary).toBe('摘要')
    expect(repository.created[0].vocabItems).toHaveLength(1)
    // 归一化保证 type 为具体字符串
    expect(repository.created[0].vocabItems[0].type).toBe('word')
  })

  it('负载缺少 vocabItems → 标题/摘要保留，词汇为空（不降级、不失败）', async () => {
    const { workflow, repository } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => ({ titleZh: '标题', summaryZh: '摘要' }),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, degraded: 0, failed: 0 })
    expect(repository.created[0].titleZh).toBe('标题')
    expect(repository.created[0].summary).toBe('摘要')
    expect(repository.created[0].vocabItems).toEqual([])
  })

  it('非法嵌套词汇条目 → 该条计失败且不入库（与迁移前写库失败一致），后续条目继续', async () => {
    const { workflow, repository, events } = harness({
      feeds: {
        'https://feed.test/tech': [
          { title: 'Bad AI', link: 'https://site.test/bad-ai' },
          { title: 'Good', link: 'https://site.test/good' },
        ],
      },
      extractions: {
        'https://site.test/bad-ai': extracted(1200),
        'https://site.test/good': extracted(1200),
      },
      ai: (_request, callIndex) =>
        callIndex === 0
          ? { titleZh: 't', summaryZh: 's', vocabItems: [{ word: 'x', definition: 'd' }] }
          : aiPayload(),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    // 迁移前：这类负载会在写库阶段抛错 → failed++ 且不入库（不是 degraded）
    expect(result).toMatchObject({ pushed: 1, failed: 1, degraded: 0 })
    expect(repository.created).toHaveLength(1)
    expect(repository.created[0].url).toBe('https://site.test/good')
    const failedEvent = events.find((e) => e.type === 'article:failed')
    expect(failedEvent).toMatchObject({ message: 'vocabItems[0].contextSentence must be a string' })
  })

  it('词汇条数超过上限时截断到 10 条', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      word: `w${i}`,
      type: 'word',
      definition: 'd',
      contextSentence: 'c',
    }))
    const { workflow, repository } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => aiPayload({ vocabItems: many }),
    })

    await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(repository.created[0].vocabItems).toHaveLength(10)
    expect(repository.created[0].vocabItems[9].word).toBe('w9')
  })
})

describe('ReadingPipelineWorkflow — 失败隔离与幂等', () => {
  it('抽取失败：该条计失败、不调用 AI、不写库，后续条目继续', async () => {
    const { workflow, repository, aiClient, order } = harness({
      feeds: {
        'https://feed.test/tech': [
          { title: 'Bad', link: 'https://site.test/bad' },
          { title: 'Good', link: 'https://site.test/good' },
        ],
      },
      extractions: {
        'https://site.test/bad': new Error('Readability failed to parse content'),
        'https://site.test/good': extracted(800),
      },
      ai: () => aiPayload(),
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, failed: 1, skipped: 0 })
    expect(aiClient.requests).toHaveLength(1)
    expect(repository.created).toHaveLength(1)
    expect(repository.created[0].url).toBe('https://site.test/good')
    // 失败条目没有 AI / 持久化步骤
    expect(order).toEqual([
      'extract:https://site.test/bad',
      'extract:https://site.test/good',
      'ai:0',
      'persist:https://site.test/good',
    ])
  })

  it('写库失败：该条计失败，不 sleep，后续条目继续', async () => {
    const { workflow, repository, sleep } = harness({
      feeds: {
        'https://feed.test/tech': [
          { title: 'A', link: 'https://site.test/a' },
          { title: 'B', link: 'https://site.test/b' },
        ],
      },
      extractions: {
        'https://site.test/a': extracted(800),
        'https://site.test/b': extracted(800),
      },
      ai: () => aiPayload(),
      repo: { failCreateForUrls: ['https://site.test/a'] },
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, failed: 1 })
    expect(repository.created).toHaveLength(1)
    expect(repository.created[0].url).toBe('https://site.test/b')
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('feed 取回失败：抛出应用级 feed_unavailable，且不发生任何持久化', async () => {
    const { workflow, repository } = harness({
      feeds: {},
      extractions: {},
      ai: () => aiPayload(),
    })

    const error = await workflow
      .run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApplicationError)
    expect(error).toMatchObject({ code: 'feed_unavailable', message: 'Get https://feed.test/tech failed' })
    expect(repository.created).toHaveLength(0)
    expect(repository.countCalls).toBe(0)
  })
})

describe('ReadingPipelineWorkflow — 运行级持久化失败（persistence_failed）', () => {
  const oneCandidate = {
    feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
    extractions: { 'https://site.test/a': extracted(800) },
    ai: () => aiPayload(),
  }

  async function runWith(workflow: ReadingPipelineWorkflow) {
    return workflow
      .run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })
      .catch((error: unknown) => error)
  }

  it('A. 去重查询（listExistingUrls）失败 → ApplicationError(persistence_failed)', async () => {
    const { workflow } = harness({
      ...oneCandidate,
      repo: { failUrlsQuery: new Error('connection terminated') },
    })

    const error = (await runWith(workflow)) as ApplicationError

    expect(error).toBeInstanceOf(ApplicationError)
    expect(error).toMatchObject({ code: 'persistence_failed', message: 'connection terminated' })
    expect(error.cause).toBeInstanceOf(Error)
  })

  it('A2. 去重查询（listExistingTitles）失败 → persistence_failed', async () => {
    const { workflow } = harness({
      ...oneCandidate,
      repo: { failTitlesQuery: new Error('title query failed') },
    })

    await expect(runWith(workflow)).resolves.toMatchObject({
      code: 'persistence_failed',
      message: 'title query failed',
    })
  })

  it('B. countArticles 失败 → persistence_failed', async () => {
    const { workflow } = harness({ ...oneCandidate, repo: { failCount: new Error('count failed') } })

    await expect(runWith(workflow)).resolves.toMatchObject({
      code: 'persistence_failed',
      message: 'count failed',
    })
  })

  it('B2. findOldestArticleIds 失败 → persistence_failed', async () => {
    const { workflow } = harness({
      ...oneCandidate,
      repo: { count: 52, oldestIds: [1, 2], failFindOldest: new Error('oldest query failed') },
    })

    await expect(runWith(workflow)).resolves.toMatchObject({
      code: 'persistence_failed',
      message: 'oldest query failed',
    })
  })

  it('B3. deleteArticlesWithVocab 失败 → persistence_failed', async () => {
    const { workflow } = harness({
      ...oneCandidate,
      repo: { count: 52, oldestIds: [1, 2], failDelete: new Error('delete failed') },
    })

    await expect(runWith(workflow)).resolves.toMatchObject({
      code: 'persistence_failed',
      message: 'delete failed',
    })
  })

  it('C. createArticle 失败仍然只影响该条，不中止整轮、不变成 persistence_failed', async () => {
    const { workflow, repository } = harness({
      feeds: {
        'https://feed.test/tech': [
          { title: 'A', link: 'https://site.test/a' },
          { title: 'B', link: 'https://site.test/b' },
        ],
      },
      extractions: {
        'https://site.test/a': extracted(800),
        'https://site.test/b': extracted(800),
      },
      ai: () => aiPayload(),
      repo: { failCreateForUrls: ['https://site.test/a'] },
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result).toMatchObject({ pushed: 1, failed: 1 })
    expect(repository.created).toHaveLength(1)
    expect(repository.created[0].url).toBe('https://site.test/b')
  })
})

describe('ReadingPipelineWorkflow — 裁剪与 AI 请求形状', () => {
  it('超出上限时删除最旧文章（先词汇后文章），裁剪发生在持久化之后', async () => {
    const { workflow, repository, order } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(800) },
      ai: () => aiPayload(),
      repo: { count: 52, oldestIds: [1, 2] },
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result.deleted).toBe(2)
    expect(repository.deletedIdBatches).toEqual([[1, 2]])
    expect(order.indexOf('persist:https://site.test/a')).toBeLessThan(order.length)
    expect(repository.countCalls).toBe(2)
    expect(result.totalArticles).toBe(50)
  })

  it('未超出上限时不删除', async () => {
    const { workflow, repository } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(800) },
      ai: () => aiPayload(),
      repo: { count: 10 },
    })

    const result = await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    expect(result.deleted).toBe(0)
    expect(repository.deletedIdBatches).toHaveLength(0)
  })

  it('AI 请求：单次尝试、无解析修复、显式超时、prompt 截断到 4000 字符', async () => {
    const longContent = 'x'.repeat(6000)
    const { workflow, aiClient } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'Long', link: 'https://site.test/long' }] },
      extractions: {
        'https://site.test/long': { textContent: longContent, htmlContent: '<p/>', imageUrl: null },
      },
      ai: () => aiPayload(),
    })

    await workflow.run({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 })

    const request = aiClient.requests[0]
    expect(request.temperature).toBe(READING_AI_TEMPERATURE)
    expect(request.retry).toEqual(READING_AI_RETRY_POLICY)
    expect(request.timeoutMs).toBe(READING_AI_TIMEOUT_MS)
    expect(request.metadata).toMatchObject({
      useCase: 'reading.ingest',
      step: 'process-article',
      promptVersion: '1.0',
    })
    expect(aiClient.repairOptions[0]).toEqual({ maxRepairAttempts: 0 })

    const userMessage = request.messages[1]
    expect(userMessage.role).toBe('user')
    expect(userMessage.content.startsWith('Title: Long\n\nArticle:\n')).toBe(true)
    // 4000 字符正文 + '...' + 'Title: Long\n\nArticle:\n' 前缀
    expect(userMessage.content).toBe(`Title: Long\n\nArticle:\n${'x'.repeat(4000)}...`)
  })
})
