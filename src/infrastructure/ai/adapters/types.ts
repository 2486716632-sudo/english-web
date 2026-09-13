// @layer Infrastructure — provider adapter contract

import type { AIMessage, AITokenUsage } from '@/application/ports/ai-client'

/**
 * ProviderAdapter 边界。
 *
 * Adapter 拥有：provider 的 HTTP 细节、请求翻译、响应翻译、provider 级错误映射。
 * Adapter 不拥有：Prompt 语义、超时/重试编排、结构化输出校验、业务规则。
 */

export interface ProviderChatRequest {
  /** 已解析好的具体模型名（adapter 默认值或调用方覆盖）。 */
  model: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  /** true 时请求 provider 原生 JSON 输出。 */
  jsonObject?: boolean
}

export interface ProviderChatResponse {
  content: string
  /** provider 实际使用的模型名（用于 metadata）。 */
  model: string
  finishReason?: string
  usage?: AITokenUsage
}

export interface AIProviderAdapter {
  /** provider 标识，例如 `deepseek`。 */
  readonly provider: string
  /** 调用方未指定 model 时使用的默认模型。 */
  readonly defaultModel: string
  /**
   * 执行一次 provider 调用。失败时应抛出归一化的 `AIError`；
   * 非 HTTP 类失败（网络中断等）至少要能被 `normalizeUnknownAIError` 识别。
   */
  chat(request: ProviderChatRequest, signal: AbortSignal): Promise<ProviderChatResponse>
}
