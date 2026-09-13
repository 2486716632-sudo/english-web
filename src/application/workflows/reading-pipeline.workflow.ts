// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Workflow（确定性多步编排）

import { ApplicationError } from '@/application/errors'
import { AIError, type AICallMeta, type AIClientPort } from '@/application/ports/ai-client'
import type { ArticleExtractorPort } from '@/application/ports/article-extractor'
import type { FeedEntry, FeedSourcePort } from '@/application/ports/feed-source'
import type { TraceScope } from '@/application/ports/trace'
import type {
  NewReadingArticle,
  ReadingArticleRepositoryPort,
} from '@/application/ports/reading-article-repository'
import { resolveTraceScope, type ExecutionContext } from '@/application/observability/execution-context'
import { runInSpan } from '@/application/observability/trace-helpers'
import { withAITracing } from '@/application/observability/traced-ai-client'
import {
  buildProcessArticlePrompt,
  articleProcessingPayloadSchema,
} from '@/application/prompts/reading/process-article.prompt'
import { normalizeArticleProcessingPayload } from '@/domain/reading/ai-response-rules'
import {
  buildExcerpt,
  difficultyFromContentLength,
  hasSufficientContent,
  limitVocabItems,
  MAX_VOCAB_ITEMS,
  MIN_ARTICLE_CONTENT_CHARS,
} from '@/domain/reading/content-rules'
import type { ArticleProcessingResult } from '@/domain/reading/types'

/**
 * ReadingPipelineWorkflow — Reading 内容摄取管线的显式步骤编排。
 *
 * 它**只**做编排：不持有 provider 细节、不接触 Prisma、不包含 Prompt 文案。
 * Prompt 来自 `application/prompts/reading/`，AI 调用经 `AIClientPort`，
 * 持久化经 `ReadingArticleRepositoryPort`，纯规则来自 `domain/reading/`。
 *
 * 步骤边界（Phase 5 的 Trace hook 将挂在这些边界上，本阶段只暴露事件）：
 *   step 1 collectCandidates  — 读取 feeds、跨 feed 去重并合并 tag
 *   step 2 selectNewArticles  — 与数据库去重、洗牌后取前 N 条
 *   step 3 processArticles    — 逐条：抽取 → 长度校验 → AI 结构化输出 → 持久化（每条独立容错）
 *   step 4 trimToLimit        — 超出上限时删除最旧文章
 *
 * Phase 5 在同一批**真实**步骤边界上挂 trace（不发明新步骤）：
 *  - 一次 `run()` = 一个 trace 下的 `reading.pipeline` workflow span
 *  - 4 个步骤各有一个 `workflow_step` span；per-feed / per-article 操作是它们的子 span
 *  - `onEvent` 操作员事件流**未改动**（保持 Phase 4 已批准的日志行为）；
 *    结构化的 trace 事件记录在 span 上（`recordEvent`），两者互不影响
 */

// ---------------------------------------------------------------
// 配置与默认值（默认值与迁移前脚本中的常量一致）
// ---------------------------------------------------------------

export const DEFAULT_MAX_ARTICLES = 50
export const DEFAULT_MAX_PER_RUN = 8
export const DEFAULT_INTER_ARTICLE_DELAY_MS = 1500
export const PIPELINE_SOURCE = { name: 'The Conversation', emoji: '📰' } as const

/**
 * 本管线的 AI 调用参数。
 *
 * 行为保持（见任务文档 §2.4）：
 *  - `retry: { maxAttempts: 1 }` —— 迁移前只发一次请求，显式不启用网络重试
 *  - `maxRepairAttempts: 0` —— 迁移前解析失败即降级，不启用解析修复
 *  - 超时是**有意新增**的有界约束（Phase 3 的 AIClientPort 不存在无超时路径），取值宽裕
 */
export const READING_AI_TEMPERATURE = 0.3
export const READING_AI_TIMEOUT_MS = 120_000
export const READING_AI_TOTAL_BUDGET_MS = 120_000
export const READING_AI_RETRY_POLICY = { maxAttempts: 1 } as const
export const READING_AI_MAX_REPAIR_ATTEMPTS = 0

export interface ReadingFeedDefinition {
  url: string
  tag: string
}

export interface ReadingPipelineConfig {
  feeds: ReadingFeedDefinition[]
  /** 单次运行最多处理的文章数（迁移前为 `MAX_PER_RUN`，默认 8）。 */
  maxPerRun: number
  /** 数据库中保留的文章总数上限（迁移前为 `MAX_ARTICLES` = 50）。 */
  maxArticles: number
  /** 正文最小长度（默认 100）。 */
  minContentChars?: number
  /** 每篇文章最多入库的词汇条数（默认 10）。 */
  maxVocabItems?: number
  /** 每篇文章之间的限速间隔（默认 1500ms）。 */
  interArticleDelayMs?: number
  /** 写入 `Article.source` / `Article.sourceEmoji` 的值。 */
  source?: { name: string; emoji: string }
}

/** 一次运行的早期退出原因（迁移前对应的 "Exiting." 分支）。 */
export type ReadingPipelineEarlyExit = 'no_candidates' | 'no_new_articles' | null

export interface ReadingPipelineResult {
  earlyExit: ReadingPipelineEarlyExit
  /** 成功入库的文章数。 */
  pushed: number
  /** 因正文过短被跳过的文章数（不计失败）。 */
  skipped: number
  /** 抽取或写库失败的文章数。 */
  failed: number
  /** AI 失败并降级（文章仍入库）的文章数。 */
  degraded: number
  /** 本次删除的最旧文章数（裁剪）。 */
  deleted: number
  /** 运行结束时数据库中的文章总数。 */
  totalArticles: number
  /** 跨 feed 去重后的候选数（供诊断/Phase 5 观测）。 */
  candidateCount: number
  /** 与数据库去重后剩余的新文章数。 */
  newCandidateCount: number
  /** 本次实际处理的文章数。 */
  selectedCount: number
  /** 成功入库的文章摘要（id/标题/链接）。 */
  articles: Array<{ id: number; title: string; url: string }>
}

/**
 * 步骤事件流。交付层用它生成操作员可见日志；
 * Phase 5 将在这里挂接 Trace/指标，而无需改动编排逻辑。
 */
export type ReadingPipelineEvent =
  | { type: 'feed:start'; feedUrl: string }
  | { type: 'feed:loaded'; feedUrl: string; tag: string; itemCount: number }
  | { type: 'candidates:collected'; count: number }
  | { type: 'candidates:selected'; selected: number; newCount: number; existingCount: number }
  | { type: 'run:earlyExit'; reason: Exclude<ReadingPipelineEarlyExit, null>; candidateCount: number }
  | { type: 'article:start'; index: number; total: number; title: string }
  | { type: 'article:skipped'; index: number; total: number; title: string; contentLength: number }
  | {
      type: 'article:extracted'
      index: number
      total: number
      title: string
      contentLength: number
      hasImage: boolean
    }
  | {
      type: 'article:ai'
      index: number
      total: number
      title: string
      degraded: boolean
      titleZh: string
      vocabCount: number
      errorMessage?: string
      meta?: AICallMeta
    }
  | {
      type: 'article:persisted'
      index: number
      total: number
      title: string
      articleId: number
      tags: string
      difficulty: number
    }
  | { type: 'article:failed'; index: number; total: number; title: string; message: string }
  | { type: 'trim:checked'; total: number; limit: number }
  | { type: 'trim:deleted'; count: number }

export interface ReadingPipelineDeps {
  feedSource: FeedSourcePort
  extractor: ArticleExtractorPort
  repository: ReadingArticleRepositoryPort
  aiClient: AIClientPort
}

export interface ReadingPipelineOptions {
  /** 步骤事件回调（交付层日志 / 未来 Trace）。 */
  onEvent?: (event: ReadingPipelineEvent) => void
  /** 限速 sleep，测试可注入。 */
  sleep?: (ms: number) => Promise<void>
  /** 洗牌随机源，测试可注入。 */
  random?: () => number
}

interface ArticleCandidate {
  entry: FeedEntry
  tags: string[]
}

/**
 * AI 步骤的三种结果，对应迁移前管线的三种真实走向：
 *  - `ok`       —— 正常拿到 AI 数据（可能经过字段级兜底，例如 titleZh 缺失 → ''）
 *  - `degraded` —— 请求失败 / 响应不是可解析 JSON → 空结果，**文章仍然入库**（迁移前行为）
 *  - `failed`   —— JSON 可解析但负载无法安全用于持久化（例如非法嵌套词汇条目）
 *                  → 迁移前会在写库阶段抛错，**该条计为失败且不入库**
 */
type SummarizeOutcome =
  | { status: 'ok'; result: ArticleProcessingResult; meta: AICallMeta }
  | {
      status: 'degraded'
      result: ArticleProcessingResult
      errorMessage: string
      /** 归一化 AI 错误码（`AIError.code`），可用时记录到 trace。 */
      errorCode?: string
      errorName?: string
    }
  | { status: 'failed'; errorMessage: string }

const EMPTY_AI_RESULT: ArticleProcessingResult = { titleZh: '', summaryZh: '', vocabItems: [] }

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ReadingPipelineWorkflow {
  private readonly deps: ReadingPipelineDeps
  private readonly onEvent: (event: ReadingPipelineEvent) => void
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number

  constructor(deps: ReadingPipelineDeps, options: ReadingPipelineOptions = {}) {
    this.deps = deps
    this.onEvent = options.onEvent ?? (() => {})
    this.sleep = options.sleep ?? defaultSleep
    this.random = options.random ?? Math.random
  }

  /**
   * 执行完整管线：收集 → 选取 → 逐条处理 → 裁剪。
   *
   * `context.trace` 由交付层（CLI）创建并显式传入；缺省时使用 Null Object，
   * 业务行为完全不变（trace 是纯增量）。
   */
  async run(
    config: ReadingPipelineConfig,
    context: ExecutionContext = {},
  ): Promise<ReadingPipelineResult> {
    const trace = resolveTraceScope(context)

    return runInSpan(
      trace,
      'reading.pipeline',
      {
        category: 'workflow',
        metadata: {
          'reading.maxPerRun': config.maxPerRun,
          'reading.maxArticles': config.maxArticles,
          'reading.feedCount': config.feeds.length,
        },
      },
      async (workflowSpan) => {
        const candidates = await this.collectCandidates(config.feeds, workflowSpan)

        if (candidates.length === 0) {
          workflowSpan.recordEvent('run.early_exit', { metadata: { reason: 'no_candidates' } })
          workflowSpan.addMetadata({ 'reading.candidateCount': 0 })
          this.onEvent({ type: 'run:earlyExit', reason: 'no_candidates', candidateCount: 0 })
          return this.emptyResult('no_candidates')
        }

        const { selected, newCandidateCount } = await this.selectNewArticles(
          candidates,
          config.maxPerRun,
          workflowSpan,
        )

        if (newCandidateCount === 0) {
          workflowSpan.recordEvent('run.early_exit', {
            metadata: { reason: 'no_new_articles', candidateCount: candidates.length },
          })
          workflowSpan.addMetadata({
            'reading.candidateCount': candidates.length,
            'reading.newCandidateCount': 0,
          })
          this.onEvent({
            type: 'run:earlyExit',
            reason: 'no_new_articles',
            candidateCount: candidates.length,
          })
          return this.emptyResult('no_new_articles', candidates.length)
        }

        const processed = await this.processArticles(selected, config, workflowSpan)
        const trim = await this.trimToLimit(config.maxArticles, workflowSpan)
        // 与迁移前一致：裁剪后再取一次总数（既有实现同样在结尾再 count 一次）。
        const totalArticles = await this.withPersistence(() => this.deps.repository.countArticles())

        // 单篇失败 / AI 降级**不**判定为整轮失败：整轮仍在完成，
        // 但状态为 `degraded`，与"完全成功"区分开（Phase 5 任务文档 Part 8）。
        const outcome =
          processed.failed > 0 || processed.degraded > 0
            ? ('degraded' as const)
            : ('ok' as const)

        workflowSpan.addMetadata({
          'reading.candidateCount': candidates.length,
          'reading.newCandidateCount': newCandidateCount,
          'reading.selectedCount': selected.length,
          'reading.pushed': processed.pushed,
          'reading.skipped': processed.skipped,
          'reading.failed': processed.failed,
          'reading.degraded': processed.degraded,
          'reading.deleted': trim.deleted,
          'reading.totalArticles': totalArticles,
          'reading.outcome': outcome,
        })
        workflowSpan.end(outcome)

        return {
          earlyExit: null,
          pushed: processed.pushed,
          skipped: processed.skipped,
          failed: processed.failed,
          degraded: processed.degraded,
          deleted: trim.deleted,
          totalArticles,
          candidateCount: candidates.length,
          newCandidateCount,
          selectedCount: selected.length,
          articles: processed.articles,
        }
      },
    )
  }

  // -------------------------------------------------------------
  // step 1：读取 feeds，按 link 跨 feed 去重并合并 tag
  // -------------------------------------------------------------
  private async collectCandidates(
    feeds: ReadingFeedDefinition[],
    parent: TraceScope,
  ): Promise<ArticleCandidate[]> {
    return runInSpan(
      parent,
      'reading.collect_candidates',
      { category: 'workflow_step', metadata: { 'reading.feedCount': feeds.length } },
      async (stepSpan) => {
        const byLink = new Map<string, ArticleCandidate>()

        for (const feed of feeds) {
          this.onEvent({ type: 'feed:start', feedUrl: feed.url })
          let entries: FeedEntry[]
          try {
            entries = await runInSpan(
              stepSpan,
              'reading.feed_fetch',
              { category: 'external_io', metadata: { 'feed.tag': feed.tag } },
              async (feedSpan) => {
                const result = await this.deps.feedSource.fetchFeed(feed.url)
                feedSpan.addMetadata({ 'feed.itemCount': result.length })
                return result
              },
            )
          } catch (error) {
            // 内容源不可用 → 整轮中止（保持迁移前"feed 失败即致命"的行为），
            // 并归一化为应用级错误码；原始文案保留在 message 中。
            throw new ApplicationError(
              'feed_unavailable',
              error instanceof Error ? error.message : String(error),
              { cause: error },
            )
          }
          this.onEvent({
            type: 'feed:loaded',
            feedUrl: feed.url,
            tag: feed.tag,
            itemCount: entries.length,
          })

          for (const entry of entries) {
            const link = entry.link || ''
            if (!link) continue

            const existing = byLink.get(link)
            if (existing) {
              if (!existing.tags.includes(feed.tag)) existing.tags.push(feed.tag)
            } else {
              byLink.set(link, { entry, tags: [feed.tag] })
            }
          }
        }

        const candidates = [...byLink.values()]
        stepSpan.addMetadata({ 'reading.candidateCount': candidates.length })
        this.onEvent({ type: 'candidates:collected', count: candidates.length })
        return candidates
      },
    )
  }

  // -------------------------------------------------------------
  // step 2：洗牌 + 与数据库去重 + 取前 N 条
  // -------------------------------------------------------------
  private async selectNewArticles(
    candidates: ArticleCandidate[],
    maxPerRun: number,
    parent: TraceScope,
  ): Promise<{ selected: ArticleCandidate[]; newCandidateCount: number }> {
    return runInSpan(
      parent,
      'reading.select_new_articles',
      { category: 'workflow_step', metadata: { 'reading.candidateCount': candidates.length } },
      async (stepSpan) => {
        this.shuffle(candidates)

        // 去重所需的两次只读查询（既有顺序：先 url 后 title）。
        const existing = await runInSpan(
          stepSpan,
          'reading.load_existing_index',
          { category: 'persistence' },
          async (indexSpan) => {
            const urls = await this.withPersistence(() => this.deps.repository.listExistingUrls())
            const titles = await this.withPersistence(() => this.deps.repository.listExistingTitles())
            indexSpan.addMetadata({
              'reading.existingUrlCount': urls.length,
              'reading.existingTitleCount': titles.length,
            })
            return { urls, titles }
          },
        )

        const existingUrls = new Set(existing.urls)
        const existingTitles = new Set(existing.titles.map((title) => title.toLowerCase().trim()))

        // 与既有实现一致：候选链接先小写化再与数据库原始 url 比较（保留该不对称行为）。
        const newCandidates = candidates.filter((candidate) => {
          const link = candidate.entry.link?.toLowerCase().trim() || ''
          if (existingUrls.has(link)) return false
          const title = candidate.entry.title?.toLowerCase().trim() || ''
          if (existingTitles.has(title)) return false
          return true
        })

        const selected = newCandidates.slice(0, maxPerRun)
        stepSpan.addMetadata({
          'reading.newCandidateCount': newCandidates.length,
          'reading.existingCount': candidates.length - newCandidates.length,
          'reading.selectedCount': selected.length,
        })
        this.onEvent({
          type: 'candidates:selected',
          selected: selected.length,
          newCount: newCandidates.length,
          existingCount: candidates.length - newCandidates.length,
        })

        return { selected, newCandidateCount: newCandidates.length }
      },
    )
  }

  // -------------------------------------------------------------
  // step 3：逐条处理（每条独立容错）
  // -------------------------------------------------------------
  private async processArticles(
    selected: ArticleCandidate[],
    config: ReadingPipelineConfig,
    parent: TraceScope,
  ): Promise<{
    pushed: number
    skipped: number
    failed: number
    degraded: number
    articles: Array<{ id: number; title: string; url: string }>
  }> {
    const minContentChars = config.minContentChars ?? MIN_ARTICLE_CONTENT_CHARS
    const maxVocabItems = config.maxVocabItems ?? MAX_VOCAB_ITEMS
    const interArticleDelayMs = config.interArticleDelayMs ?? DEFAULT_INTER_ARTICLE_DELAY_MS
    const source = config.source ?? PIPELINE_SOURCE

    return runInSpan(
      parent,
      'reading.process_articles',
      { category: 'workflow_step', metadata: { 'reading.selectedCount': selected.length } },
      async (stepSpan) => {
        let pushed = 0
        let skipped = 0
        let failed = 0
        let degraded = 0
        const articles: Array<{ id: number; title: string; url: string }> = []

        for (let index = 0; index < selected.length; index += 1) {
          const { entry, tags } = selected[index]
          const title = entry.title || 'Untitled'
          const link = entry.link || ''
          const publishedAt = entry.pubDate ? new Date(entry.pubDate) : null
          const position = index + 1

          this.onEvent({ type: 'article:start', index: position, total: selected.length, title })

          try {
            // 单篇的完整操作在自己的 span 下：父 span 可关联到本轮运行，
            // 且单篇失败只把**该 span** 标记为失败，不改变整轮控制流。
            await runInSpan(
              stepSpan,
              'reading.process_article',
              {
                category: 'workflow_step',
                metadata: { 'article.index': position, 'article.total': selected.length },
              },
              async (articleSpan) => {
                // --- 抽取 ---
                const extracted = await runInSpan(
                  articleSpan,
                  'reading.extract_article',
                  { category: 'external_io', metadata: { 'article.index': position } },
                  async (extractSpan) => {
                    const result = await this.deps.extractor.extract({
                      url: link,
                      html: entry.content || undefined,
                    })
                    extractSpan.addMetadata({
                      'article.contentLength': result.textContent.length,
                      'article.hasImage': Boolean(result.imageUrl),
                    })
                    return result
                  },
                )
                const contentText = extracted.textContent

                if (!hasSufficientContent(contentText, minContentChars)) {
                  skipped += 1
                  articleSpan.addMetadata({
                    outcome: 'skipped',
                    'article.contentLength': contentText.length,
                  })
                  articleSpan.recordEvent('article.skipped', {
                    metadata: {
                      'article.index': position,
                      'article.contentLength': contentText.length,
                    },
                  })
                  this.onEvent({
                    type: 'article:skipped',
                    index: position,
                    total: selected.length,
                    title,
                    contentLength: contentText.length,
                  })
                  return
                }

                this.onEvent({
                  type: 'article:extracted',
                  index: position,
                  total: selected.length,
                  title,
                  contentLength: contentText.length,
                  hasImage: Boolean(extracted.imageUrl),
                })

                // --- AI（请求失败降级；负载不可安全恢复则视为该条失败） ---
                const outcome = await this.summarizeArticle(
                  title,
                  contentText,
                  maxVocabItems,
                  articleSpan,
                  position,
                )

                if (outcome.status === 'failed') {
                  // 迁移前：这类负载会在写库阶段抛错 → 该条计失败、不入库。
                  // 这里用同样的 message 抛出，由外层 catch 记账（控制流与文案保持一致）。
                  articleSpan.addMetadata({ outcome: 'failed' })
                  throw new Error(outcome.errorMessage)
                }

                if (outcome.status === 'degraded') {
                  degraded += 1
                  articleSpan.recordEvent('article.degraded', {
                    metadata: {
                      'article.index': position,
                      'ai.errorCode': outcome.errorCode,
                      'ai.errorName': outcome.errorName,
                    },
                  })
                }

                this.onEvent({
                  type: 'article:ai',
                  index: position,
                  total: selected.length,
                  title,
                  degraded: outcome.status === 'degraded',
                  titleZh: outcome.result.titleZh,
                  vocabCount: outcome.result.vocabItems.length,
                  errorMessage: outcome.status === 'degraded' ? outcome.errorMessage : undefined,
                  meta: outcome.status === 'ok' ? outcome.meta : undefined,
                })

                // --- 持久化 ---
                const excerpt = buildExcerpt(contentText)
                const difficulty = difficultyFromContentLength(contentText.length)

                const article = await runInSpan(
                  articleSpan,
                  'reading.persist_article',
                  {
                    category: 'persistence',
                    metadata: {
                      'article.index': position,
                      'article.difficulty': difficulty,
                      'article.vocabCount': outcome.result.vocabItems.length,
                    },
                  },
                  () =>
                    this.deps.repository.createArticle({
                      title,
                      titleZh: outcome.result.titleZh || null,
                      url: link,
                      imageUrl: extracted.imageUrl || null,
                      publishedAt,
                      source: source.name,
                      sourceEmoji: source.emoji,
                      content: contentText,
                      summary: outcome.result.summaryZh || excerpt,
                      summaryEn: excerpt,
                      difficulty,
                      tags: tags.join(','),
                      vocabItems: outcome.result.vocabItems.map((item) => ({
                        word: item.word,
                        type: item.type || 'word',
                        partOfSpeech: item.partOfSpeech || null,
                        phonetic: null,
                        definition: item.definition,
                        contextSentence: item.contextSentence,
                      })),
                    } satisfies NewReadingArticle),
                )

                pushed += 1
                articles.push({ id: article.id, title, url: link })
                articleSpan.addMetadata({
                  outcome: outcome.status === 'degraded' ? 'degraded' : 'persisted',
                  'article.id': article.id,
                })

                this.onEvent({
                  type: 'article:persisted',
                  index: position,
                  total: selected.length,
                  title,
                  articleId: article.id,
                  tags: tags.join(', '),
                  difficulty,
                })

                // 限速：与既有实现一致，仅在成功入库后等待
                await this.sleep(interArticleDelayMs)

                // AI 降级但文章仍然入库：该次运行不是"完全成功"，标记为 degraded。
                if (outcome.status === 'degraded') articleSpan.end('degraded')
              },
            )
          } catch (error) {
            failed += 1
            this.onEvent({
              type: 'article:failed',
              index: position,
              total: selected.length,
              title,
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }

        stepSpan.addMetadata({
          'reading.pushed': pushed,
          'reading.skipped': skipped,
          'reading.failed': failed,
          'reading.degraded': degraded,
        })

        return { pushed, skipped, failed, degraded, articles }
      },
    )
  }

  // -------------------------------------------------------------
  // step 4：裁剪到文章总数上限
  // -------------------------------------------------------------
  private async trimToLimit(
    maxArticles: number,
    parent: TraceScope,
  ): Promise<{ beforeCount: number; deleted: number }> {
    return runInSpan(
      parent,
      'reading.trim_to_limit',
      { category: 'workflow_step', metadata: { 'reading.maxArticles': maxArticles } },
      async (stepSpan) => {
        const beforeCount = await this.withPersistence(() => this.deps.repository.countArticles())
        stepSpan.addMetadata({ 'reading.trim.beforeCount': beforeCount })
        this.onEvent({ type: 'trim:checked', total: beforeCount, limit: maxArticles })

        if (beforeCount <= maxArticles) {
          stepSpan.addMetadata({ 'reading.trim.deleted': 0 })
          return { beforeCount, deleted: 0 }
        }

        const ids = await this.withPersistence(() =>
          this.deps.repository.findOldestArticleIds(beforeCount - maxArticles),
        )
        await this.withPersistence(() => this.deps.repository.deleteArticlesWithVocab(ids))
        stepSpan.addMetadata({ 'reading.trim.deleted': ids.length })
        this.onEvent({ type: 'trim:deleted', count: ids.length })

        return { beforeCount, deleted: ids.length }
      },
    )
  }

  // -------------------------------------------------------------
  // AI 步骤：任何失败都降级（保持迁移前语义）
  // -------------------------------------------------------------
  private async summarizeArticle(
    title: string,
    content: string,
    maxVocabItems: number,
    parent: TraceScope,
    position: number,
  ): Promise<SummarizeOutcome> {
    // AI 调用经装饰器：provider / model / latency / attempts / usage / 错误码写入 `ai.chat_structured` span，
    // 且 prompt 与模型输出**不进入** trace（metadata-first）。
    const aiClient = withAITracing(this.deps.aiClient, parent)
    let payload: unknown
    let meta: AICallMeta

    try {
      const prompt = buildProcessArticlePrompt({ title, content })
      const response = await aiClient.chatStructured(
        {
          messages: [{ role: 'system', content: prompt.system }, ...prompt.messages],
          temperature: READING_AI_TEMPERATURE,
          timeoutMs: READING_AI_TIMEOUT_MS,
          totalBudgetMs: READING_AI_TOTAL_BUDGET_MS,
          retry: READING_AI_RETRY_POLICY,
          metadata: {
            useCase: 'reading.ingest',
            step: 'process-article',
            promptVersion: '1.0',
          },
        },
        articleProcessingPayloadSchema,
        { maxRepairAttempts: READING_AI_MAX_REPAIR_ATTEMPTS },
      )
      payload = response.data
      meta = response.meta
    } catch (error) {
      // 既有语义：AI 失败（HTTP / 超时 / 空内容 / 结构非法）→ 降级为空结果，文章仍然入库。
      return {
        status: 'degraded',
        result: EMPTY_AI_RESULT,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof AIError ? error.code : undefined,
        errorName: error instanceof Error ? error.name : undefined,
      }
    }

    // 归一化（迁移前的字段级兜底）。无法安全恢复的负载 → 该条失败，不静默降级。
    const normalized = await runInSpan(
      parent,
      'reading.normalize_payload',
      { category: 'validation', metadata: { 'article.index': position } },
      async (validationSpan) => {
        const result = normalizeArticleProcessingPayload(payload)
        validationSpan.addMetadata({
          'reading.payload.ok': result.ok,
          'reading.payload.vocabCount': result.ok ? result.value.vocabItems.length : 0,
        })
        if (!result.ok) {
          // 旧实现会在写库阶段失败；新实现在归一化边界确定性判定失败（结果一致，仅文案不同）。
          validationSpan.recordError(new Error(result.reason), {
            code: 'invalid_ai_payload',
            operation: 'reading.normalize_payload',
          })
          validationSpan.end('error')
        }
        return result
      },
    )
    if (!normalized.ok) {
      return { status: 'failed', errorMessage: normalized.reason }
    }

    return {
      status: 'ok',
      result: {
        titleZh: normalized.value.titleZh,
        summaryZh: normalized.value.summaryZh,
        vocabItems: limitVocabItems(normalized.value.vocabItems, maxVocabItems),
      },
      meta,
    }
  }

  private shuffle(items: ArticleCandidate[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1))
      const tmp = items[i]
      items[i] = items[j]
      items[j] = tmp
    }
  }

  /**
   * 运行级（致命）持久化操作的错误包装。
   *
   * 只用于"失败即中止整轮"的仓储操作（去重查询 / 统计 / 裁剪）。
   * 单条文章的 `createArticle()` **不经过**这里 —— 它的失败按既有语义隔离为
   * 该条失败，不中止整轮运行。
   */
  private async withPersistence<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      throw new ApplicationError(
        'persistence_failed',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
    }
  }

  private emptyResult(
    earlyExit: Exclude<ReadingPipelineEarlyExit, null>,
    candidateCount = 0,
  ): ReadingPipelineResult {
    return {
      earlyExit,
      pushed: 0,
      skipped: 0,
      failed: 0,
      degraded: 0,
      deleted: 0,
      totalArticles: 0,
      candidateCount,
      newCandidateCount: 0,
      selectedCount: 0,
      articles: [],
    }
  }
}
