// @version 1.0
// @last-reviewed 2026-09-12
// @layer Application — Use Case（参考迁移）

import type { AIClientPort, AIMessage } from '@/application/ports/ai-client'
import type { WordCard, WordLookupPort } from '@/application/ports/word-lookup'
import {
  resolveTraceScope,
  resolveUserId,
  type ExecutionContext,
} from '@/application/observability/execution-context'
import { runInSpan } from '@/application/observability/trace-helpers'
import { withAITracing } from '@/application/observability/traced-ai-client'
import { buildAssistantQaPrompt, type AssistantQaTurn } from '@/application/prompts/assistant/qa.prompt'
import {
  applyLearnerContextSystemPolicy,
  buildAssistantLearnerContext,
  type LearnerContextBlock,
} from '@/application/prompts/assistant/personal-context.prompt'
import type { TraceScope } from '@/application/ports/trace'
import type { GetUserContextUseCase } from '@/application/use-cases/user/get-user-context.use-case'
import { MEMORY_SELECTION_LIMIT } from '@/domain/memory/memory-rules'

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
 * Phase 5 追加（纯增量）：把本次执行挂在调用方提供的 trace 下 ——
 * `assistant.reply`（use_case）→ `assistant.word_lookup`（persistence，可选）→ `ai.chat`（ai）。
 * 只记录计数 / 尺寸 / 归一化元数据，不记录用户文本与 prompt 内容。
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
  /**
   * 可选：用户上下文读取（Phase 6 参考集成）。
   *
   * 未提供 → **完全不做个性化**，system prompt 与消息数组与迁移前逐字节一致
   * （因此 Phase 3 既有测试无需修改即仍然通过）。
   * 生产路径由 Composition Root 始终提供（见 `bootstrap/index.ts`）。
   */
  getUserContext?: GetUserContextUseCase
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

  /**
   * `context.trace` 由交付层（HTTP Route）创建并显式传入；缺省时使用 Null Object，
   * 行为与迁移前完全一致（tracing 是纯增量）。
   */
  async execute(
    input: AssistantQueryInput,
    context: ExecutionContext = {},
  ): Promise<AssistantReplyResult> {
    const trace = resolveTraceScope(context)

    return runInSpan(trace, 'assistant.reply', { category: 'use_case' }, async (span) => {
      const lookupKey = deriveWordLookupKey(input)

      // 词卡是可选的增强：WordLookupPort 契约保证不抛异常，失败即降级为 null。
      // 只记录"是否命中"与键长度 —— 查询词本身属于用户输入，默认不入 trace。
      const wordData =
        lookupKey.length > 0
          ? await runInSpan(
              span,
              'assistant.word_lookup',
              {
                category: 'persistence',
                metadata: { 'assistant.lookupKeyLength': lookupKey.length },
              },
              async (lookupSpan) => {
                const card = await this.deps.wordLookup.findByWord(lookupKey)
                lookupSpan.addMetadata({ 'assistant.wordFound': card !== null })
                return card
              },
            )
          : null

      // Phase 6：有界 learner context（附加数据，不是 Assistant 工作的必要条件）。
      const learnerContext = await this.loadLearnerContext(context, span)

      const prompt = buildAssistantQaPrompt({ turns: input.messages, wordCard: wordData })

      // B-04：仅当存在 learner context 时，把**静态处理策略**放到 system 权威；
      // 真实 profile / memory 内容仍然只在下面的 user 数据消息里。
      // 没有 learner context 时 system prompt 与 Phase 3 完全一致（逐字节）。
      const systemContent = applyLearnerContextSystemPolicy(
        prompt.system,
        learnerContext !== null,
      )

      const messages: AIMessage[] = [{ role: 'system', content: systemContent }]
      if (learnerContext) {
        // 作为**独立 user 数据消息**注入（不是 system 权威），并在 trace 上只记录计数。
        messages.push({ role: 'user', content: learnerContext.text })
        span.addMetadata({
          'memory.includedCount': learnerContext.includedCount,
          'memory.truncated': learnerContext.truncated,
        })
      }
      messages.push(...prompt.messages)

      // AI span 由装饰器产生：provider / model / attempts / usage / finishReason / 错误码。
      const aiClient = withAITracing(this.deps.aiClient, span)

      const result = await aiClient.chat({
        messages,
        temperature: ASSISTANT_AI_TEMPERATURE,
        maxTokens: ASSISTANT_AI_MAX_TOKENS,
        timeoutMs: ASSISTANT_AI_TIMEOUT_MS,
        totalBudgetMs: ASSISTANT_AI_TOTAL_BUDGET_MS,
        retry: ASSISTANT_AI_RETRY_POLICY,
        metadata: { useCase: 'assistant.qa', promptVersion: '1.0' },
      })

      span.addMetadata({ 'assistant.wordFound': wordData !== null })

      return { reply: result.content, wordData }
    })
  }

  /**
   * 读取有界 learner context 并渲染成数据段。
   *
   * 行为保真（任务文档 Part 10）：没有依赖、没有 `userId`、或没有任何可用上下文时，
   * 返回 `null`，调用方不注入任何内容 —— 与迁移前完全一致。
   * 读取失败已在 `GetUserContextUseCase` 内部降级为"空上下文"（不抛出）。
   */
  private async loadLearnerContext(
    context: ExecutionContext,
    span: TraceScope,
  ): Promise<LearnerContextBlock | null> {
    const getUserContext = this.deps.getUserContext
    if (!getUserContext) return null

    const userId = resolveUserId(context)
    if (!userId) return null

    const userContext = await getUserContext.execute(
      { memoryLimit: MEMORY_SELECTION_LIMIT },
      { trace: span, userId },
    )

    return buildAssistantLearnerContext({
      profile: userContext.profile,
      memory: userContext.memory.map((item) => ({ kind: item.kind, content: item.content })),
    })
  }
}
