/**
 * Reading 内容摄取管线 — CLI 交付层。
 *
 * 这个文件现在**只负责**：读取运行配置 → 调用应用入口（Use Case）→ 打印操作员日志 / 退出码。
 * 抓取、抽取、Prompt、AI 调用、校验、持久化的实现都在已批准的架构层内：
 *   Use Case  : src/application/use-cases/reading/ingest-reading-articles.use-case.ts
 *   Workflow  : src/application/workflows/reading-pipeline.workflow.ts
 *   Ports     : src/application/ports/{feed-source,article-extractor,reading-article-repository}.ts
 *   Adapters  : src/infrastructure/{rss,article-extraction,db}/
 *   AI Client : src/infrastructure/ai/（Phase 3 已批准的 AIClient + DeepSeekAdapter）
 *
 * 用法：npm run push:reading
 */
import 'dotenv/config'
import type { ReadingPipelineEvent } from '../src/application/workflows/reading-pipeline.workflow'
import { createReadingIngestComposition } from '../src/bootstrap/reading-composition'

const MAX_ARTICLES = 50
const MAX_PER_RUN = parseInt(process.env.MAX_PER_RUN || '8', 10)

const FEEDS: { url: string; tag: string }[] = [
  { url: 'https://theconversation.com/us/technology/articles.atom', tag: 'tech' },
  { url: 'https://theconversation.com/us/environment/articles.atom', tag: 'environment' },
  { url: 'https://theconversation.com/us/health/articles.atom', tag: 'health' },
  { url: 'https://theconversation.com/us/business/articles.atom', tag: 'business' },
  { url: 'https://theconversation.com/us/arts/articles.atom', tag: 'society' },
]

/**
 * 把 Workflow 的步骤事件翻译为操作员日志。
 * 文案与迁移前的脚本输出保持一致（操作员可见行为不变）。
 */
function reportEvent(event: ReadingPipelineEvent): void {
  switch (event.type) {
    case 'feed:start':
      console.log(`[reading-push] Fetching feed: ${event.feedUrl}`)
      break
    case 'feed:loaded':
      console.log(`[reading-push]   ${event.itemCount} items from "${event.tag}" feed`)
      break
    case 'candidates:collected':
      console.log(`[reading-push] ${event.count} unique articles after dedup`)
      break
    case 'candidates:selected':
      console.log(
        `[reading-push] ${event.newCount} are new (${event.existingCount} already in DB)`,
      )
      break
    case 'run:earlyExit':
      console.log(
        event.reason === 'no_candidates'
          ? '[reading-push] No matching articles found. Exiting.'
          : '[reading-push] No new articles to push. Exiting.',
      )
      break
    case 'article:start':
      console.log(`\n[reading-push] [${event.index}/${event.total}] Processing: "${event.title}"`)
      break
    case 'article:skipped':
      console.log(
        `[reading-push]   ⚠ Content too short (${event.contentLength} chars), skipping`,
      )
      break
    case 'article:extracted':
      console.log(
        `[reading-push]   Content: ${event.contentLength} chars, image: ${event.hasImage ? 'yes' : 'no'}`,
      )
      break
    case 'article:ai':
      if (event.degraded) {
        console.log(`[reading-push]   ⚠ DeepSeek failed: ${event.errorMessage ?? 'unknown error'}`)
      } else {
        console.log(
          `[reading-push]   DeepSeek: titleZh="${event.titleZh.slice(0, 30)}...", ${event.vocabCount} vocab items`,
        )
      }
      break
    case 'article:persisted':
      console.log(
        `[reading-push]   ✓ Pushed as article #${event.articleId} | Tags: ${event.tags} | Difficulty: ${event.difficulty}`,
      )
      break
    case 'article:failed':
      console.log(`[reading-push]   ✗ Failed: ${event.message}`)
      break
    case 'trim:checked':
      console.log(`\n[reading-push] DB now has ${event.total} articles (max ${event.limit})`)
      break
    case 'trim:deleted':
      console.log(`[reading-push] Deleted ${event.count} oldest articles to stay under limit`)
      break
  }
}

async function main() {
  console.log(`[reading-push] Starting...`)
  console.log(`[reading-push] Max articles: ${MAX_ARTICLES}, Per run: ${MAX_PER_RUN}`)

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('[reading-push] ERROR: DEEPSEEK_API_KEY not set')
    process.exit(1)
  }

  const { useCase, disconnect } = createReadingIngestComposition({ onEvent: reportEvent })

  try {
    const result = await useCase.execute({
      feeds: FEEDS,
      maxPerRun: MAX_PER_RUN,
      maxArticles: MAX_ARTICLES,
    })

    if (result.earlyExit) return

    console.log(`\n[reading-push] ✅ Done: ${result.pushed} articles pushed, ${result.failed} failed`)
    console.log(`[reading-push] DB: ${result.totalArticles}/${MAX_ARTICLES} articles`)
  } finally {
    await disconnect()
  }
}

main().catch((err) => {
  console.error('[reading-push] Fatal error:', err)
  process.exit(1)
})
