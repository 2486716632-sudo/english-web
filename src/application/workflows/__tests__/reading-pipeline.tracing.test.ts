import { describe, it, expect } from 'vitest'
import {
  AIError,
  type AIChatResult,
  type AIClientPort,
  type AIStructuredResult,
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
import type { SpanRecord, TraceRecord, TraceScope } from '@/application/ports/trace'
import { ReadingPipelineWorkflow } from '@/application/workflows/reading-pipeline.workflow'
import { IngestReadingArticlesUseCase } from '@/application/use-cases/reading/ingest-reading-articles.use-case'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * Reading 管线 trace 关联（Phase 5 任务文档 Part 8 / Part 13 第 8–10、12 项）。
 *
 * 走**真实**的 Use Case + Workflow + fakes，只在交付层位置（CLI 的职责）手工创建 root trace。
 * 全程离线：不访问 RSS、不调用真实 AI、不连数据库。
 */

const ARTICLE_BODY_MARKER = 'BODY-MARKER-8c31 that must never appear in a trace'
const FEEDS = [{ url: 'https://feed.test/tech', tag: 'tech' }]

class FakeFeedSource implements FeedSourcePort {
  constructor(
    private readonly feeds: Record<string, FeedEntry[]>,
    private readonly failure?: Error,
  ) {}

  async fetchFeed(feedUrl: string): Promise<FeedEntry[]> {
    if (this.failure) throw this.failure
    return this.feeds[feedUrl] ?? []
  }
}

class FakeExtractor implements ArticleExtractorPort {
  constructor(private readonly results: Record<string, ExtractedArticleContent | Error>) {}

  async extract(input: ExtractArticleInput): Promise<ExtractedArticleContent> {
    const result = this.results[input.url]
    if (!result) throw new Error(`No extraction result configured for ${input.url}`)
    if (result instanceof Error) throw result
    return result
  }
}

class FakeRepository implements ReadingArticleRepositoryPort {
  readonly created: NewReadingArticle[] = []

  constructor(private readonly state: { urls?: string[]; titles?: string[]; count?: number } = {}) {}

  async listExistingUrls(): Promise<string[]> {
    return this.state.urls ?? []
  }

  async listExistingTitles(): Promise<string[]> {
    return this.state.titles ?? []
  }

  async createArticle(article: NewReadingArticle): Promise<{ id: number }> {
    this.created.push(article)
    return { id: 100 + this.created.length }
  }

  async countArticles(): Promise<number> {
    return this.state.count ?? this.created.length
  }

  async findOldestArticleIds(): Promise<number[]> {
    return []
  }

  async deleteArticlesWithVocab(): Promise<void> {}
}

class FakeAIClient implements AIClientPort {
  constructor(private readonly behavior: (callIndex: number) => unknown | Error) {}

  async chat(): Promise<AIChatResult> {
    throw new Error('chat() is not used by the Reading pipeline')
  }

  async chatStructured<T>(
  ): Promise<AIStructuredResult<T>> {
    const result = this.behavior(this.callCount)
    this.callCount += 1
    if (result instanceof Error) throw result
    return {
      data: result as T,
      meta: {
        provider: 'fake-provider',
        model: 'fake-model',
        latencyMs: 12,
        attempts: 1,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      },
    }
  }

  private callCount = 0
}

const aiPayload = () => ({
  titleZh: '中文标题',
  summaryZh: '中文摘要',
  vocabItems: [
    {
      word: 'give up',
      type: 'phrase',
      partOfSpeech: 'verb',
      definition: '放弃',
      contextSentence: 'He gave up.',
    },
  ],
})

const extracted = (textLength: number): ExtractedArticleContent => ({
  textContent: `${ARTICLE_BODY_MARKER} ${'word '.repeat(Math.ceil(textLength / 5))}`.slice(
    0,
    textLength,
  ),
  htmlContent: '<article>…</article>',
  imageUrl: null,
})

function harness(input: {
  feeds: Record<string, FeedEntry[]>
  feedFailure?: Error
  extractions: Record<string, ExtractedArticleContent | Error>
  ai: (callIndex: number) => unknown | Error
  repo?: { urls?: string[]; titles?: string[]; count?: number }
}): {
  recorder: InMemoryTraceRecorder
  trace: TraceScope
  useCase: IngestReadingArticlesUseCase
  repository: FakeRepository
  run: () => ReturnType<IngestReadingArticlesUseCase['execute']>
} {
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  const repository = new FakeRepository(input.repo)
  const workflow = new ReadingPipelineWorkflow(
    {
      feedSource: new FakeFeedSource(input.feeds, input.feedFailure),
      extractor: new FakeExtractor(input.extractions),
      repository,
      aiClient: new FakeAIClient(input.ai),
    },
    { sleep: async () => {}, random: () => 0.5 },
  )
  const useCase = new IngestReadingArticlesUseCase(workflow)
  // 交付层（CLI）负责创建 root trace；这里等价复现。
  const trace = recorder.startTrace('reading.ingest', {
    category: 'use_case',
    metadata: { 'reading.maxPerRun': 8, 'reading.maxArticles': 50, 'reading.feedCount': 1 },
  })

  return {
    recorder,
    trace,
    useCase,
    repository,
    run: () => useCase.execute({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50 }, { trace }),
  }
}

function spansOf(record: TraceRecord | undefined): SpanRecord[] {
  if (!record) throw new Error('trace not recorded')
  return record.spans
}

function findBySuffix(record: TraceRecord | undefined, suffix: string): SpanRecord[] {
  return spansOf(record).filter((span) => span.name === suffix)
}

describe('Reading 管线 trace — 成功运行', () => {
  const successInput = {
    feeds: {
      'https://feed.test/tech': [
        { title: 'Article A', link: 'https://site.test/a' },
        { title: 'Article B', link: 'https://site.test/b' },
      ],
    },
    extractions: {
      'https://site.test/a': extracted(2000),
      'https://site.test/b': extracted(4000),
    },
    ai: () => aiPayload(),
  }

  it('一次运行 = 一个 traceId，且 4 个真实步骤 + 单篇操作都有 span', async () => {
    const { recorder, run } = harness(successInput)

    const result = await run()
    const record = recorder.getLastTrace()

    expect(result).toMatchObject({ pushed: 2, failed: 0, degraded: 0 })
    expect(record?.status).toBe('ok')
    expect(record?.name).toBe('reading.ingest')
    expect(new Set(spansOf(record).map((span) => span.traceId))).toEqual(new Set([record?.traceId]))
    expect(spansOf(record).every((span) => span.status === 'ok')).toBe(true)

    // 真实步骤边界（不发明新步骤）
    expect(spansOf(record).map((span) => span.name)).toEqual([
      'reading.ingest',
      'reading.pipeline',
      'reading.collect_candidates',
      'reading.feed_fetch',
      'reading.select_new_articles',
      'reading.load_existing_index',
      'reading.process_articles',
      'reading.process_article',
      'reading.extract_article',
      'ai.chat_structured',
      'reading.normalize_payload',
      'reading.persist_article',
      'reading.process_article',
      'reading.extract_article',
      'ai.chat_structured',
      'reading.normalize_payload',
      'reading.persist_article',
      'reading.trim_to_limit',
    ])

    // span 分类覆盖用例要求：http / use_case / workflow / workflow_step / ai / persistence / external_io / validation
    const categories = new Set(spansOf(record).map((span) => span.category))
    expect(categories).toEqual(
      new Set(['use_case', 'workflow', 'workflow_step', 'external_io', 'persistence', 'ai', 'validation']),
    )

    // 每篇操作都能关联到本轮运行
    const pipeline = findBySuffix(record, 'reading.pipeline')[0]
    const processArticles = findBySuffix(record, 'reading.process_articles')[0]
    const articles = findBySuffix(record, 'reading.process_article')
    expect(pipeline.parentSpanId).toBe(record?.spans[0].spanId)
    expect(processArticles.parentSpanId).toBe(pipeline.spanId)
    expect(articles.map((span) => span.parentSpanId)).toEqual([
      processArticles.spanId,
      processArticles.spanId,
    ])
    expect(articles.map((span) => span.metadata['article.index'])).toEqual([1, 2])
    expect(articles.map((span) => span.metadata.outcome)).toEqual(['persisted', 'persisted'])

    // AI span 携带 provider / model / token 元数据
    expect(findBySuffix(record, 'ai.chat_structured')[0].metadata).toMatchObject({
      'ai.provider': 'fake-provider',
      'ai.model': 'fake-model',
      'ai.attempts': 1,
      'ai.usage.totalTokens': 15,
      'ai.repairAllowed': 0,
      'label.useCase': 'reading.ingest',
    })

    // 运行级统计进入 trace metadata
    expect(record?.metadata).toMatchObject({
      'reading.pushed': 2,
      'reading.failed': 0,
      'reading.degraded': 0,
      'reading.outcome': 'ok',
    })

    // B-03：运行结束后 ACTIVE state 全部释放
    expect(recorder.activeTraceCount()).toBe(0)
    // 生产埋点路径不得产生任何生命周期违规
    expect(recorder.getLifecycleViolations()).toEqual([])
  })

  it('trace 中不出现文章正文 / prompt 内容（默认不采集内容）', async () => {
    const { recorder, run } = harness(successInput)

    await run()

    const serialized = JSON.stringify(recorder.getLastTrace())
    expect(serialized).not.toContain(ARTICLE_BODY_MARKER)
    expect(serialized).not.toContain('You are an English learning assistant')
    expect(serialized).not.toContain('中文摘要')
  })

  it('候选为空时早期退出：trace 仍结束，并留下 run.early_exit 事件', async () => {
    const { recorder, run } = harness({
      feeds: { 'https://feed.test/tech': [] },
      extractions: {},
      ai: () => aiPayload(),
    })

    const result = await run()
    const record = recorder.getLastTrace()

    expect(result.earlyExit).toBe('no_candidates')
    expect(record?.status).toBe('ok')
    expect(record?.events).toEqual([
      expect.objectContaining({ name: 'run.early_exit', metadata: { reason: 'no_candidates' } }),
    ])
    expect(recorder.activeTraceCount()).toBe(0)
  })
})

describe('Reading 管线 trace — AI 降级与单篇失败', () => {
  it('AI 失败但文章仍入库：AI span 失败、单篇 span 为 degraded、整轮为 degraded', async () => {
    const { recorder, repository, run } = harness({
      feeds: { 'https://feed.test/tech': [{ title: 'A', link: 'https://site.test/a' }] },
      extractions: { 'https://site.test/a': extracted(1200) },
      ai: () => new AIError('provider_error', 'DeepSeek HTTP 500: boom', { provider: 'deepseek' }),
    })

    const result = await run()
    const record = recorder.getLastTrace()

    expect(result).toMatchObject({ pushed: 1, degraded: 1, failed: 0 })
    expect(repository.created).toHaveLength(1)
    expect(record?.status).toBe('degraded')

    const articleSpan = findBySuffix(record, 'reading.process_article')[0]
    expect(articleSpan).toMatchObject({
      status: 'degraded',
      metadata: { outcome: 'degraded' },
    })

    const aiSpan = findBySuffix(record, 'ai.chat_structured')[0]
    expect(aiSpan).toMatchObject({
      status: 'error',
      error: { code: 'provider_error', provider: 'deepseek', retryable: true },
    })

    // 降级与"完全成功"可区分：整轮不是 ok，且留下结构化事件
    expect(record?.events.map((event) => event.name)).toContain('article.degraded')
    expect(record?.events.find((event) => event.name === 'article.degraded')?.metadata).toMatchObject({
      'ai.errorCode': 'provider_error',
    })
  })

  it('单篇负载非法：该篇 span 失败但整轮继续，后续文章仍入库', async () => {
    const { recorder, run } = harness({
      feeds: {
        'https://feed.test/tech': [
          { title: 'Bad', link: 'https://site.test/bad' },
          { title: 'Good', link: 'https://site.test/good' },
        ],
      },
      extractions: {
        'https://site.test/bad': extracted(1200),
        'https://site.test/good': extracted(1200),
      },
      ai: (callIndex) =>
        callIndex === 0
          ? { titleZh: 't', summaryZh: 's', vocabItems: [{ word: 'x', definition: 'd' }] }
          : aiPayload(),
    })

    const result = await run()
    const record = recorder.getLastTrace()

    expect(result).toMatchObject({ pushed: 1, failed: 1, degraded: 0 })
    expect(record?.status).toBe('degraded')

    const articles = findBySuffix(record, 'reading.process_article')
    expect(articles[0]).toMatchObject({
      status: 'error',
      metadata: { outcome: 'failed' },
    })
    expect(articles[0].error?.message).toBe('vocabItems[0].contextSentence must be a string')
    expect(articles[1].status).toBe('ok')

    // 校验失败发生在 validation span 上，且该篇没有持久化 span
    const validationSpans = findBySuffix(record, 'reading.normalize_payload')
    expect(validationSpans[0]).toMatchObject({
      status: 'error',
      error: { code: 'invalid_ai_payload' },
    })
    const persistSpans = findBySuffix(record, 'reading.persist_article')
    expect(persistSpans).toHaveLength(1)
    expect(persistSpans[0].metadata['article.index']).toBe(2)
  })

  it('致命失败（feed 不可用）：整轮 trace 标记为失败，且没有任何持久化 span', async () => {
    const { recorder, repository, run } = harness({
      feeds: {},
      feedFailure: new Error('Get https://feed.test/tech failed'),
      extractions: {},
      ai: () => aiPayload(),
    })

    const thrown = await run().catch((error: unknown) => error)
    const record = recorder.getLastTrace()

    expect(thrown).toMatchObject({ code: 'feed_unavailable' })
    expect(record?.status).toBe('error')
    expect(record?.error).toMatchObject({
      code: 'feed_unavailable',
      message: 'Get https://feed.test/tech failed',
      operation: 'reading.ingest',
    })
    expect(record?.metadata['reading.outcome']).toBe('feed_unavailable')
    expect(findBySuffix(record, 'reading.persist_article')).toHaveLength(0)
    expect(findBySuffix(record, 'reading.process_articles')).toHaveLength(0)
    expect(findBySuffix(record, 'reading.feed_fetch')[0].status).toBe('error')
    expect(repository.created).toHaveLength(0)
    expect(recorder.activeTraceCount()).toBe(0)
    expect(recorder.getLifecycleViolations()).toEqual([])
  })

  it('配置非法：trace 以 error 结束并带 invalid_input 码', async () => {
    const { recorder, trace, useCase } = harness({
      feeds: { 'https://feed.test/tech': [] },
      extractions: {},
      ai: () => aiPayload(),
    })

    await useCase.execute({ feeds: [], maxPerRun: 8, maxArticles: 50 }, { trace }).catch(() => undefined)

    expect(recorder.getLastTrace()).toMatchObject({
      status: 'error',
      error: { code: 'invalid_input' },
      metadata: { 'reading.outcome': 'invalid_input' },
      spans: [expect.objectContaining({ name: 'reading.ingest' })],
    })
    expect(recorder.activeTraceCount()).toBe(0)
  })
})
