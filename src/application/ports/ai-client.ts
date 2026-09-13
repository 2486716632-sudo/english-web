// @version 1.0
// @last-reviewed 2026-09-12
// @layer Application — Output Port (interface + provider-independent contract only, no implementation)

/**
 * AIClientPort — provider-independent AI 调用契约。
 *
 * 职责边界（见 docs/refactor/AI_CLIENT_DESIGN.md）：
 *   ✅ 定义调用契约（消息、参数、超时、重试、元数据）
 *   ✅ 定义归一化错误模型
 *   ❌ 不包含 Prompt 内容（Prompt 属于 Application 层各用例）
 *   ❌ 不包含任何 provider HTTP 细节（由 Infrastructure adapter 实现）
 *   ❌ 不包含英语学习业务规则
 */

// ============================================================
// 错误模型（provider-independent）
// ============================================================

/**
 * 归一化错误码。刻意保持精简，只区分对调用方有实际决策意义的类别。
 *
 * | code              | 含义                          | 可网络重试 |
 * |-------------------|-------------------------------|-----------|
 * | timeout           | 超时（含整体预算耗尽）        | ✅ |
 * | rate_limited      | 限流（HTTP 429）              | ✅ |
 * | provider_error    | provider 5xx                  | ✅ |
 * | network_error     | 网络/连接层失败               | ✅ |
 * | auth_error        | 认证/配置失败（401/403 等）   | ❌ |
 * | invalid_request   | 请求被 provider 判定非法(4xx) | ❌ |
 * | invalid_response  | 结构化输出解析/校验失败       | ❌（走解析修复，不走网络重试） |
 * | unknown           | 其它未分类失败                | ❌ |
 */
export type AIErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'provider_error'
  | 'network_error'
  | 'auth_error'
  | 'invalid_request'
  | 'invalid_response'
  | 'unknown'

/** 允许进行**传输层/网络层**重试的错误码。 */
const RETRYABLE_AI_ERROR_CODES: readonly AIErrorCode[] = [
  'timeout',
  'rate_limited',
  'provider_error',
  'network_error',
]

export function isRetryableAIErrorCode(code: AIErrorCode): boolean {
  return RETRYABLE_AI_ERROR_CODES.includes(code)
}

export interface AIErrorOptions {
  /** provider 返回的 HTTP status（若适用）。 */
  status?: number
  /** provider 标识（如 `deepseek`）。 */
  provider?: string
  /** 显式覆盖由 code 推导出的可重试性。 */
  retryable?: boolean
  /** 原始底层错误。 */
  cause?: unknown
}

/**
 * 归一化的 AI 错误。所有 Infrastructure 层失败都以此类型暴露给 Application 层，
 * 调用方不需要了解 provider 的 HTTP 语义。
 */
export class AIError extends Error {
  readonly code: AIErrorCode
  readonly retryable: boolean
  readonly status?: number
  readonly provider?: string
  readonly cause?: unknown

  constructor(code: AIErrorCode, message: string, options: AIErrorOptions = {}) {
    super(message)
    this.name = 'AIError'
    this.code = code
    this.retryable = options.retryable ?? isRetryableAIErrorCode(code)
    this.status = options.status
    this.provider = options.provider
    this.cause = options.cause
  }
}

// ============================================================
// 请求 / 响应类型
// ============================================================

export type AIRole = 'system' | 'user' | 'assistant'

export interface AIMessage {
  role: AIRole
  content: string
}

/**
 * 结构化输出模式：
 * - `text`        纯文本回复（默认）
 * - `json_object` 请求 provider 直接返回 JSON 对象
 */
export type AIResponseFormat = 'text' | 'json_object'

/** 有界重试策略。未提供的字段使用 Infrastructure 默认值。 */
export interface AIRetryPolicy {
  /** 总尝试次数（含首次），必须 ≥ 1。 */
  maxAttempts?: number
  /** 指数退避基数（毫秒）。 */
  baseDelayMs?: number
  /** 单次退避上限（毫秒）。 */
  maxDelayMs?: number
  /** jitter 比例（0–1），防止重试风暴。 */
  jitterRatio?: number
}

export interface AIChatRequest {
  messages: AIMessage[]
  /** 逻辑模型名。省略时使用 adapter 的默认模型。 */
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: AIResponseFormat
  /** 单次尝试的超时（毫秒）。省略时使用 Infrastructure 默认值。 */
  timeoutMs?: number
  /** 整次逻辑调用的总时间预算（毫秒），包含所有重试。省略时使用默认值。 */
  totalBudgetMs?: number
  retry?: AIRetryPolicy
  /** provider-neutral 标签（供后续 Trace 使用），不会发送给 provider。 */
  metadata?: Record<string, string>
}

export interface AITokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AICallMeta {
  provider: string
  model: string
  /** 整次逻辑调用的墙钟耗时（含重试与退避）。 */
  latencyMs: number
  /** 实际发出的 provider 请求次数。 */
  attempts: number
  /** provider 暴露 usage 时才会出现。 */
  usage?: AITokenUsage
  finishReason?: string
}

export interface AIChatResult {
  content: string
  meta: AICallMeta
}

/**
 * 结构化输出契约。由 Application 层（或是未来的 Domain 校验）提供，
 * Infrastructure 只负责「提取 JSON → 交给 validate → 失败时按有界上限修复」。
 */
export interface AIStructuredSchema<T> {
  /** 用于错误信息与修复指令的 schema 名称。 */
  name: string
  /** 纯校验，不得抛异常；不是类型断言时返回 false。 */
  validate(value: unknown): value is T
}

export interface AIStructuredOptions {
  /**
   * 解析失败后允许的**修复重试**次数（与网络重试不同）。
   * 默认 1（即最多 2 次 provider 调用）。
   */
  maxRepairAttempts?: number
}

export interface AIStructuredResult<T> {
  data: T
  meta: AICallMeta
}

export interface AIClientPort {
  /** 执行一次自由文本 AI 调用。 */
  chat(request: AIChatRequest): Promise<AIChatResult>
  /** 执行一次结构化输出 AI 调用（内含 JSON 提取 + 校验 + 有界解析修复）。 */
  chatStructured<T>(
    request: AIChatRequest,
    schema: AIStructuredSchema<T>,
    options?: AIStructuredOptions,
  ): Promise<AIStructuredResult<T>>
}
