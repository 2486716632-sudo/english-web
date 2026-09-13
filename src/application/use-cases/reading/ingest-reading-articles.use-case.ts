// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Use Case（Reading 管线的应用入口）

import { ApplicationError } from '@/application/errors'
import { resolveTraceScope, type ExecutionContext } from '@/application/observability/execution-context'
import {
  ReadingPipelineWorkflow,
  type ReadingFeedDefinition,
  type ReadingPipelineConfig,
  type ReadingPipelineResult,
} from '@/application/workflows/reading-pipeline.workflow'

/**
 * IngestReadingArticlesUseCase — `npm run push:reading` 对应的应用动作入口。
 *
 * 职责：
 *  - 校验运行配置（传输/配置级校验）
 *  - 调用 Workflow 完成多步编排
 *  - 把结果与失败翻译为应用级 DTO / ApplicationError
 *  - 按**运行结果**决定该次 trace 的终态（完全成功 / 有降级或单篇失败 / 致命失败）
 *
 * 不负责：HTTP 语义、provider 细节、Prisma、Prompt 文案、纯业务规则。
 */

export interface IngestReadingArticlesInput {
  feeds: ReadingFeedDefinition[]
  maxPerRun: number
  maxArticles: number
  minContentChars?: number
  maxVocabItems?: number
  interArticleDelayMs?: number
  source?: { name: string; emoji: string }
}

export class IngestReadingArticlesUseCase {
  constructor(private readonly workflow: ReadingPipelineWorkflow) {}

  /**
   * `context.trace` 由交付层创建并显式传入（一次 Reading 运行 = 一个 traceId）。
   * 未提供 trace 时行为与迁移前完全一致。
   */
  async execute(
    input: IngestReadingArticlesInput,
    context: ExecutionContext = {},
  ): Promise<ReadingPipelineResult> {
    const trace = resolveTraceScope(context)

    let config: ReadingPipelineConfig
    try {
      config = this.validate(input)
    } catch (error) {
      trace.recordError(error, { operation: 'reading.ingest.validate' })
      trace.end('error', { metadata: { 'reading.outcome': 'invalid_input' } })
      throw error
    }

    trace.addMetadata({
      'reading.maxPerRun': config.maxPerRun,
      'reading.maxArticles': config.maxArticles,
      'reading.feedCount': config.feeds.length,
    })

    try {
      const result = await this.workflow.run(config, { trace })

      // 致命失败 → error；单篇失败 / AI 降级 → degraded；其余 → ok。
      const outcome = result.failed > 0 || result.degraded > 0 ? ('degraded' as const) : ('ok' as const)
      trace.addMetadata({
        'reading.pushed': result.pushed,
        'reading.skipped': result.skipped,
        'reading.failed': result.failed,
        'reading.degraded': result.degraded,
        'reading.deleted': result.deleted,
        'reading.totalArticles': result.totalArticles,
        'reading.earlyExit': result.earlyExit ?? 'none',
        'reading.outcome': outcome,
      })
      trace.end(outcome)
      return result
    } catch (error) {
      // Workflow 已经归一化的应用级错误直接向上传递；
      // 其余意外失败包装为 unexpected，保留原始文案与 cause。
      const failure =
        error instanceof ApplicationError
          ? error
          : new ApplicationError(
              'unexpected',
              error instanceof Error ? error.message : String(error),
              { cause: error },
            )

      trace.recordError(failure, { code: failure.code, operation: 'reading.ingest' })
      trace.end('error', { metadata: { 'reading.outcome': failure.code } })
      throw failure
    }
  }

  private validate(input: IngestReadingArticlesInput): ReadingPipelineConfig {
    if (!Array.isArray(input.feeds) || input.feeds.length === 0) {
      throw new ApplicationError('invalid_input', 'At least one feed must be configured')
    }
    for (const feed of input.feeds) {
      if (!feed || typeof feed.url !== 'string' || feed.url.length === 0) {
        throw new ApplicationError('invalid_input', 'Each feed must have a non-empty url')
      }
      if (typeof feed.tag !== 'string' || feed.tag.length === 0) {
        throw new ApplicationError('invalid_input', `Feed ${feed.url} must have a non-empty tag`)
      }
    }
    if (!Number.isInteger(input.maxPerRun) || input.maxPerRun < 1) {
      throw new ApplicationError('invalid_input', 'maxPerRun must be an integer >= 1')
    }
    if (!Number.isInteger(input.maxArticles) || input.maxArticles < 1) {
      throw new ApplicationError('invalid_input', 'maxArticles must be an integer >= 1')
    }
    if (input.minContentChars !== undefined && input.minContentChars < 0) {
      throw new ApplicationError('invalid_input', 'minContentChars must be >= 0')
    }
    if (input.maxVocabItems !== undefined && input.maxVocabItems < 0) {
      throw new ApplicationError('invalid_input', 'maxVocabItems must be >= 0')
    }
    if (input.interArticleDelayMs !== undefined && input.interArticleDelayMs < 0) {
      throw new ApplicationError('invalid_input', 'interArticleDelayMs must be >= 0')
    }

    return {
      feeds: input.feeds,
      maxPerRun: input.maxPerRun,
      maxArticles: input.maxArticles,
      minContentChars: input.minContentChars,
      maxVocabItems: input.maxVocabItems,
      interArticleDelayMs: input.interArticleDelayMs,
      source: input.source,
    }
  }
}
