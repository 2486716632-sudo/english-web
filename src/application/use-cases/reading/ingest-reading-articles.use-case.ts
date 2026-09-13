// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Use Case（Reading 管线的应用入口）

import { ApplicationError } from '@/application/errors'
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

  async execute(input: IngestReadingArticlesInput): Promise<ReadingPipelineResult> {
    const config = this.validate(input)

    try {
      return await this.workflow.run(config)
    } catch (error) {
      // Workflow 已经归一化的应用级错误直接向上传递；
      // 其余意外失败包装为 unexpected，保留原始文案与 cause。
      if (error instanceof ApplicationError) throw error
      throw new ApplicationError(
        'unexpected',
        error instanceof Error ? error.message : String(error),
        { cause: error },
      )
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
