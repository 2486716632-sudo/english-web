// @layer Infrastructure — DeepSeek provider adapter

import { AIError } from '@/application/ports/ai-client'
import { mapHttpStatusToAIErrorCode, normalizeUnknownAIError } from '../errors'
import type { AIProviderAdapter, ProviderChatRequest, ProviderChatResponse } from './types'

export const DEEPSEEK_PROVIDER = 'deepseek'
export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com'
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat'

/** provider 错误响应体在错误信息中保留的最大长度（与迁移前实现一致）。 */
const MAX_ERROR_BODY_CHARS = 200

/** DeepSeek `/v1/chat/completions` 响应中我们实际使用的字段。 */
interface DeepSeekChatCompletion {
  model?: string
  choices?: Array<{
    message?: { content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export interface DeepSeekAdapterOptions {
  /**
   * API Key。
   *
   * 保持 `string | undefined`：未配置时行为与迁移前一致 —— 照常发出请求，
   * 由 provider 返回 401（归一化为 `auth_error`）。
   * pre-flight 配置校验属于 Phase 9 的安全边界加固，不在 Phase 3 改变错误面。
   */
  apiKey: string | undefined
  baseUrl?: string
  defaultModel?: string
  /** 便于测试注入；默认使用全局 `fetch`。 */
  fetchImpl?: typeof fetch
}

export class DeepSeekAdapter implements AIProviderAdapter {
  readonly provider = DEEPSEEK_PROVIDER
  readonly defaultModel: string
  private readonly apiKey: string | undefined
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: DeepSeekAdapterOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl || DEEPSEEK_DEFAULT_BASE_URL
    this.defaultModel = options.defaultModel || DEEPSEEK_DEFAULT_MODEL
    this.fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  }

  async chat(request: ProviderChatRequest, signal: AbortSignal): Promise<ProviderChatResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
    }
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (request.jsonObject) body.response_format = { type: 'json_object' }

    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })
    } catch (error) {
      throw normalizeUnknownAIError(error, { provider: this.provider })
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new AIError(
        mapHttpStatusToAIErrorCode(response.status),
        `DeepSeek HTTP ${response.status}: ${errorBody.slice(0, MAX_ERROR_BODY_CHARS)}`,
        { status: response.status, provider: this.provider },
      )
    }

    let data: DeepSeekChatCompletion
    try {
      data = (await response.json()) as DeepSeekChatCompletion
    } catch (error) {
      // HTTP 成功但响应体不是 provider 约定的 JSON → 这是**无效响应**，不是网络失败。
      // 不可重试（同输入大概率仍失败）；原始解析错误作为 cause 保留，且不回显响应体内容。
      throw new AIError(
        'invalid_response',
        `DeepSeek returned a response body that is not valid JSON (HTTP ${response.status})`,
        { status: response.status, provider: this.provider, cause: error },
      )
    }

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model ?? request.model,
      finishReason: data.choices?.[0]?.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  }
}
