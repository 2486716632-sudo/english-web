// @version 1.0
// @last-reviewed 2026-09-12
// @layer Application — Use Case（参考迁移）

import type { AIClientPort } from '@/application/ports/ai-client'
import type { WordCard, WordLookupPort } from '@/application/ports/word-lookup'
import { buildAssistantQaPrompt, type AssistantQaTurn } from '@/application/prompts/assistant/qa.prompt'

/**
 * ReplyToAssistantQueryUseCase — `POST /api/assistant` 的应用入口。
 *
 * 链路：Route → 本 Use Case → AIClientPort / WordLookupPort → Infrastructure adapter。
 *
 * 本 Use Case 负责（Application 职责）：
 *  - 从用户输入推导词卡查询键
 *  - 通过 WordLookupPort 取词卡（可选增强）
 *  - 选择并构建 Prompt
 *  - 通过 AIClientPort 执行 AI 调用
 *  - 返回 DTO
 *
 * 本 Use Case **不**负责：HTTP 语义、provider API Key、fetch、JSON 解析细节、学习业务规则。
 */

/** 与迁移前实现一致的固定参数（行为保持不变）。 */
const ASSISTANT_AI_TIMEOUT_MS = 30_000
const ASSISTANT_AI_TOTAL_BUDGET_MS = 30_000
const ASSISTANT_AI_MAX_TOKENS = 1024
const ASSISTANT_AI_TEMPERATURE = 0.7

/**
 * 迁移前 `/api/assistant` 只发起**一次** provider 请求：任何 429 / 5xx / 网络失败都直接
 * 变成友好错误回复。统一 AI Client 默认提供有界重试（maxAttempts = 3），因此这里
 * **显式退出网络重试**，以保持 Phase 3 参考迁移的既有行为不变。
 *
 * 后续调用点在迁移时若希望获得重试能力，必须由该次迁移显式声明这是有意的行为变更。
 */
const ASSISTANT_AI_RETRY_POLICY = { maxAttempts: 1 } as const

export interface AssistantQueryInput {
  query?: string
  messages?: AssistantQaTurn[]
}

export interface AssistantReplyResult {
  reply: string
  wordData: WordCard | null
}

export interface ReplyToAssistantQueryDeps {
  aiClient: AIClientPort
  wordLookup: WordLookupPort
}

/**
 * 从用户输入推导词卡查询键。
 *
 * 与迁移前 `src/app/api/assistant/route.ts` 的实现逐字等价：
 * 取 `query` 或最后一条消息内容 → 按空白与中英文标点切分 → 取首段 → 仅保留 `[a-zA-Z-]`。
 */
export function deriveWordLookupKey(input: AssistantQueryInput): string {
  const lastQuery = (input.query || input.messages?.[input.messages.length - 1]?.content || '').trim()
  return lastQuery.split(/[\s,，.。!！?？]+/)[0]?.replace(/[^a-zA-Z-]/g, '') || ''
}

export class ReplyToAssistantQueryUseCase {
  constructor(private readonly deps: ReplyToAssistantQueryDeps) {}

  async execute(input: AssistantQueryInput): Promise<AssistantReplyResult> {
    const lookupKey = deriveWordLookupKey(input)

    // 词卡是可选的增强：WordLookupPort 契约保证不抛异常，失败即降级为 null。
    const wordData = lookupKey.length > 0 ? await this.deps.wordLookup.findByWord(lookupKey) : null

    const prompt = buildAssistantQaPrompt({ turns: input.messages, wordCard: wordData })

    const result = await this.deps.aiClient.chat({
      messages: [{ role: 'system', content: prompt.system }, ...prompt.messages],
      temperature: ASSISTANT_AI_TEMPERATURE,
      maxTokens: ASSISTANT_AI_MAX_TOKENS,
      timeoutMs: ASSISTANT_AI_TIMEOUT_MS,
      totalBudgetMs: ASSISTANT_AI_TOTAL_BUDGET_MS,
      retry: ASSISTANT_AI_RETRY_POLICY,
      metadata: { useCase: 'assistant.qa', promptVersion: '1.0' },
    })

    return { reply: result.content, wordData }
  }
}
