// @layer Composition Root
//
// 唯一允许 import Infrastructure 具体实现的地方。
// Application / Domain / API Route 只依赖接口与装配后的 Use Case。

import { ReplyToAssistantQueryUseCase } from '@/application/use-cases/assistant/reply-to-assistant-query.use-case'
import { AIClient } from '@/infrastructure/ai/ai-client'
import { DeepSeekAdapter } from '@/infrastructure/ai/adapters/deepseek.adapter'
import { PrismaWordLookup } from '@/infrastructure/db/word-lookup'
import { prisma } from '@/lib/prisma'
import { getUserContextUseCase } from '@/bootstrap/user-state-composition'

/**
 * 装配 `POST /api/assistant` 所需的应用入口。
 * 只使用手动构造，不引入 DI 框架（TARGET_ARCHITECTURE §17.3）。
 */
export function createAssistantReplyUseCase(): ReplyToAssistantQueryUseCase {
  const adapter = new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
  })

  const aiClient = new AIClient({ adapter })
  const wordLookup = new PrismaWordLookup(prisma)

  // Phase 6：参考集成始终装配用户上下文读取（有界 profile + memory）。
  // 若目标用户没有任何 profile/memory，注入内容为空 → prompt 与迁移前逐字节一致。
  return new ReplyToAssistantQueryUseCase({
    aiClient,
    wordLookup,
    getUserContext: getUserContextUseCase(),
  })
}

let assistantReplyUseCase: ReplyToAssistantQueryUseCase | undefined

/** Route 使用的应用入口（进程内惰性单例）。 */
export function getAssistantReplyUseCase(): ReplyToAssistantQueryUseCase {
  if (!assistantReplyUseCase) {
    assistantReplyUseCase = createAssistantReplyUseCase()
  }
  return assistantReplyUseCase
}
