// @layer Infrastructure — unified AI client (implements the Application AIClientPort)

import {
  AIError,
  type AIChatRequest,
  type AIChatResult,
  type AIClientPort,
  type AICallMeta,
  type AIStructuredOptions,
  type AIStructuredResult,
  type AIStructuredSchema,
} from '@/application/ports/ai-client'
import type { AIProviderAdapter, ProviderChatRequest, ProviderChatResponse } from './adapters/types'
import { normalizeUnknownAIError } from './errors'
import { resolveRetryPolicy, runWithRetry, type ResolvedRetryPolicy } from './retry'
import { buildRepairMessages, DEFAULT_MAX_REPAIR_ATTEMPTS, parseStructured } from './structured-output'

/** 单次尝试的默认超时。 */
export const DEFAULT_AI_TIMEOUT_MS = 30_000
/** 整次逻辑调用的默认总预算（含重试与退避），保证用户可见等待有上界。 */
export const DEFAULT_AI_TOTAL_BUDGET_MS = 30_000

export interface AIClientOptions {
  adapter: AIProviderAdapter
  defaultTimeoutMs?: number
  defaultTotalBudgetMs?: number
  retryPolicy?: ResolvedRetryPolicy
  /** 可注入的时间/随机源，便于确定性测试。 */
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  defaultMaxRepairAttempts?: number
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 统一 AI Client。
 *
 * 拥有：provider/model 选择、请求执行、超时、有界重试、归一化错误、延迟与 token metadata、
 * 结构化输出边界、依赖注入可测性。
 * 不拥有：Prompt 语义、英语学习业务编排、降级策略决策。
 */
export class AIClient implements AIClientPort {
  private readonly adapter: AIProviderAdapter
  private readonly defaultTimeoutMs: number
  private readonly defaultTotalBudgetMs: number
  private readonly retryPolicy: ResolvedRetryPolicy
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number
  private readonly defaultMaxRepairAttempts: number

  constructor(options: AIClientOptions) {
    this.adapter = options.adapter
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_AI_TIMEOUT_MS
    this.defaultTotalBudgetMs = options.defaultTotalBudgetMs ?? DEFAULT_AI_TOTAL_BUDGET_MS
    this.retryPolicy = resolveRetryPolicy(options.retryPolicy)
    this.now = options.now ?? (() => performance.now())
    this.sleep = options.sleep ?? defaultSleep
    this.random = options.random ?? Math.random
    this.defaultMaxRepairAttempts = options.defaultMaxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS
  }

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    const startedAt = this.now()
    const deadlineAt = startedAt + this.resolveTotalBudgetMs(request)

    const { response, attempts } = await this.runChat(request, deadlineAt)

    return { content: response.content, meta: this.buildMeta(response, attempts, startedAt) }
  }

  async chatStructured<T>(
    request: AIChatRequest,
    schema: AIStructuredSchema<T>,
    options: AIStructuredOptions = {},
  ): Promise<AIStructuredResult<T>> {
    const maxRepairAttempts = Math.max(0, options.maxRepairAttempts ?? this.defaultMaxRepairAttempts)
    const startedAt = this.now()
    // 关键点：**整次结构化调用只建立一个 deadline**。
    // 网络重试与解析修复都消耗同一份剩余预算，不存在"每次修复重新计时"的路径。
    const deadlineAt = startedAt + this.resolveTotalBudgetMs(request)

    let messages = request.messages
    let attempts = 0
    let lastReason = 'unknown reason'

    for (let repair = 0; repair <= maxRepairAttempts; repair += 1) {
      // 预算已耗尽时不再发起任何 provider 请求，按 timeout 归一化失败。
      if (repair > 0 && this.now() >= deadlineAt) {
        throw new AIError(
          'timeout',
          `Structured output budget of ${this.resolveTotalBudgetMs(request)}ms was exhausted before repair attempt ${repair} (${this.adapter.provider})`,
          { provider: this.adapter.provider },
        )
      }

      const { response, attempts: callAttempts } = await this.runChat(
        { ...request, messages, responseFormat: 'json_object' },
        deadlineAt,
      )
      attempts += callAttempts

      const parsed = parseStructured(response.content, schema)
      if (parsed.ok) {
        return { data: parsed.data, meta: this.buildMeta(response, attempts, startedAt) }
      }

      lastReason = parsed.reason
      // 解析恢复：把失败反馈给模型重新生成（不计入网络重试预算）。
      messages = [...request.messages, ...buildRepairMessages(response.content, schema.name, parsed.reason)]
    }

    throw new AIError(
      'invalid_response',
      `Structured output for "${schema.name}" failed validation after ${maxRepairAttempts + 1} attempt(s): ${lastReason}`,
      { provider: this.adapter.provider },
    )
  }

  private resolveTotalBudgetMs(request: AIChatRequest): number {
    return Math.max(1, request.totalBudgetMs ?? this.defaultTotalBudgetMs)
  }

  /** 在**给定** deadline 下执行一次逻辑调用（含网络重试）。 */
  private async runChat(
    request: AIChatRequest,
    deadlineAt: number,
  ): Promise<{ response: ProviderChatResponse; attempts: number }> {
    const { value, attempts } = await runWithRetry(
      (attempt) => this.executeChat(request, attempt, deadlineAt),
      {
        policy: resolveRetryPolicy(request.retry ?? this.retryPolicy),
        deadlineAt,
        now: this.now,
        sleep: this.sleep,
        random: this.random,
      },
    )
    return { response: value, attempts }
  }

  private buildMeta(response: ProviderChatResponse, attempts: number, startedAt: number): AICallMeta {
    return {
      provider: this.adapter.provider,
      model: response.model,
      latencyMs: Math.max(0, this.now() - startedAt),
      attempts,
      usage: response.usage,
      finishReason: response.finishReason,
    }
  }

  private async executeChat(
    request: AIChatRequest,
    attempt: number,
    deadlineAt: number,
  ): Promise<ProviderChatResponse> {
    const remainingMs = deadlineAt - this.now()
    if (remainingMs <= 0) {
      throw new AIError(
        'timeout',
        `AI request budget was exhausted before attempt ${attempt} (${this.adapter.provider})`,
        { provider: this.adapter.provider },
      )
    }

    const configuredTimeout = Math.max(1, request.timeoutMs ?? this.defaultTimeoutMs)
    const attemptTimeoutMs = Math.min(configuredTimeout, remainingMs)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), attemptTimeoutMs)

    try {
      const providerRequest: ProviderChatRequest = {
        model: request.model ?? this.adapter.defaultModel,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        jsonObject: request.responseFormat === 'json_object',
      }
      return await this.adapter.chat(providerRequest, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AIError(
          'timeout',
          `AI request timed out after ${attemptTimeoutMs}ms (${this.adapter.provider})`,
          { provider: this.adapter.provider, cause: error },
        )
      }
      throw normalizeUnknownAIError(error, { provider: this.adapter.provider })
    } finally {
      clearTimeout(timer)
    }
  }
}
