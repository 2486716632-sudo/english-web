// @layer Composition Root — Reading 内容摄取管线装配
//
// 与 `src/bootstrap/index.ts`（assistant 交付面）分开，原因有二：
//  1. 避免把 CLI 专用基础设施（rss-parser / jsdom / node-postgres）拉进 Next 服务端打包；
//  2. 避免 CLI 加载 `@/lib/prisma` 单例（那会在模块加载时建立 Neon 连接并 warmup）。
// 两个文件都属于 Composition Root 层（见 docs/refactor/CONTENT_PIPELINE_DESIGN.md §composition）。

import { IngestReadingArticlesUseCase } from '@/application/use-cases/reading/ingest-reading-articles.use-case'
import {
  ReadingPipelineWorkflow,
  type ReadingPipelineEvent,
} from '@/application/workflows/reading-pipeline.workflow'
import { AIClient } from '@/infrastructure/ai/ai-client'
import { DeepSeekAdapter } from '@/infrastructure/ai/adapters/deepseek.adapter'
import { ReadabilityArticleExtractor } from '@/infrastructure/article-extraction/readability-article-extractor'
import { PrismaReadingArticleRepository } from '@/infrastructure/db/reading-article.repository'
import { createStandalonePrismaClient } from '@/infrastructure/db/standalone-prisma'
import { RssFeedSource } from '@/infrastructure/rss/rss-feed-source'

export interface ReadingCompositionOptions {
  /** 步骤事件回调：交付层用它生成操作员日志（Phase 5 在此挂 Trace）。 */
  onEvent?: (event: ReadingPipelineEvent) => void
  /** 覆盖数据库连接串（默认读取 `DATABASE_URL`），便于测试/脚本化调用。 */
  databaseUrl?: string
}

export interface ReadingIngestComposition {
  useCase: IngestReadingArticlesUseCase
  /** 释放数据库连接（CLI 在 finally 中调用）。 */
  disconnect: () => Promise<void>
}

/**
 * 装配 Reading 摄取管线：Ports → Adapters → Workflow → Use Case。
 * 复用 Phase 3 已批准的 `AIClient` + `DeepSeekAdapter`，不绕过 `AIClientPort`。
 */
export function createReadingIngestComposition(
  options: ReadingCompositionOptions = {},
): ReadingIngestComposition {
  const { client, disconnect } = createStandalonePrismaClient(options.databaseUrl)

  const adapter = new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
  })

  const workflow = new ReadingPipelineWorkflow(
    {
      feedSource: new RssFeedSource(),
      extractor: new ReadabilityArticleExtractor(),
      repository: new PrismaReadingArticleRepository(client),
      aiClient: new AIClient({ adapter }),
    },
    { onEvent: options.onEvent },
  )

  return { useCase: new IngestReadingArticlesUseCase(workflow), disconnect }
}
