// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — AI 调用可观测性（AIClientPort 装饰器）

import {
  AIError,
  type AIChatRequest,
  type AIChatResult,
  type AICallMeta,
  type AIClientPort,
  type AIStructuredOptions,
  type AIStructuredResult,
  type AIStructuredSchema,
} from '@/application/ports/ai-client'
import type { RecordErrorOptions, TraceMetadata, TraceScope } from '@/application/ports/trace'
import { runInSpan } from '@/application/observability/trace-helpers'

/**
 * AI 调用可观测性装饰器（Phase 5 任务文档 Part 7）。
 *
 * 为什么用装饰器而不是改 AI Client：
 *  - Phase 3 的 `AIClient` 已经通过 provider-neutral 的 `AICallMeta` 暴露了
 *    provider / model / latency / attempts / usage / finishReason，**契约已经够用**
 *  - 因此 Phase 5 **不修改** 已批准的 AI Client，只在 Application 层包一层：`AIClientPort` → `AIClientPort`
 *  - provider 细节（HTTP、认证头、原始响应）仍然完全留在 Infrastructure，不上浮
 *
 * **metadata-first**：只记录元数据、计数与尺寸，**不记录** prompt 内容、模型输出、
 * 用户消息、API Key、authorization header（见 TRACE_DESIGN.md §10）。
 */

export const AI_CHAT_SPAN_NAME = 'ai.chat'
export const AI_CHAT_STRUCTURED_SPAN_NAME = 'ai.chat_structured'

/**
 * 允许进入 trace 的 provider-neutral 调用标签（**显式 allowlist**）。
 *
 * 为什么是 allowlist 而不是"过滤后全量搬运"（Phase 5 外部审核 v1 阻断问题 B-01）：
 * `AIChatRequest.metadata` 的类型是自由的 `Record<string, string>`，调用方可以放任意键值。
 * 若按"键名安全就搬运"处理，`{ prompt: '…' }` 会被复制成 `label.prompt`，
 * 而 Infrastructure 的整体键名匹配看到的是 `labelprompt`（前缀改变了规范化键），
 * 内容型键就此**绕过**禁用集合进入 trace。因此这里改为白名单：
 * 只有**明确批准**的标签才会被复制，其余一律在源头丢弃（Infrastructure 的 sanitize 是第二道防线）。
 *
 * 需要新增标签时：这是一个显式契约变更，必须在 `TRACE_DESIGN.md` §6.3 记录并接受审核
 * —— 标签名必须与"内容"无关（例如版本号、用例名、步骤名），不得承载提示词、模型输出或用户文本。
 */
export const AI_TRACE_LABEL_ALLOWLIST = ['useCase', 'step', 'promptVersion'] as const

const ALLOWED_LABELS: ReadonlyMap<string, string> = new Map(
  AI_TRACE_LABEL_ALLOWLIST.map((label) => [label.toLowerCase(), label]),
)

/** 返回允许使用的规范标签名；未批准的键返回 undefined（调用方必须丢弃）。 */
export function resolveApprovedTraceLabel(key: string): string | undefined {
  return ALLOWED_LABELS.get(key.trim().toLowerCase())
}

/** 把 `AIError` 归一化为 trace 的错误摘要；非 AIError 返回 undefined（由包装器默认推断）。 */
function describeAIError(error: unknown): RecordErrorOptions | undefined {
  if (!(error instanceof AIError)) return undefined
  return {
    code: error.code,
    operation: 'ai.call',
    retryable: error.retryable,
    provider: error.provider,
    status: error.status,
  }
}

/** 请求侧 metadata：只有标签、计数与尺寸，没有消息内容。 */
function requestMetadata(request: AIChatRequest): TraceMetadata {
  const metadata: TraceMetadata = {
    'ai.request.model': request.model ?? undefined,
    'ai.request.temperature': request.temperature,
    'ai.request.maxTokens': request.maxTokens,
    'ai.request.responseFormat': request.responseFormat,
    'ai.request.messageCount': request.messages.length,
    'ai.request.promptChars': request.messages.reduce((total, message) => total + message.content.length, 0),
    'ai.request.retryMaxAttempts': request.retry?.maxAttempts,
    'ai.request.timeoutMs': request.timeoutMs,
    'ai.request.totalBudgetMs': request.totalBudgetMs,
  }

  // provider-neutral 调用标签（Phase 3 契约：不会发送给 provider）。
  // 只搬运**明确批准**的标签；未批准的键在源头丢弃（Infrastructure 的 sanitize 是第二道防线）。
  for (const [key, value] of Object.entries(request.metadata ?? {})) {
    const approved = resolveApprovedTraceLabel(key)
    if (!approved) continue
    metadata[`label.${approved}`] = value
  }

  return metadata
}

/** 响应侧 metadata：provider 未暴露的字段保持缺失，不伪造 0。 */
function responseMetadata(meta: AICallMeta, structured: boolean, options?: AIStructuredOptions): TraceMetadata {
  return {
    'ai.provider': meta.provider,
    'ai.model': meta.model,
    'ai.latencyMs': meta.latencyMs,
    'ai.attempts': meta.attempts,
    'ai.usage.promptTokens': meta.usage?.promptTokens,
    'ai.usage.completionTokens': meta.usage?.completionTokens,
    'ai.usage.totalTokens': meta.usage?.totalTokens,
    'ai.finishReason': meta.finishReason,
    // 结构化调用的解析修复策略。注意：Phase 3 的 `attempts` 把网络重试与解析修复合并计数，
    // Phase 5 不伪造拆分后的计数（见 docs/refactor/TRACE_DESIGN.md §6.3）。
    'ai.repairAllowed': structured ? (options?.maxRepairAttempts ?? undefined) : undefined,
  }
}

export class TracedAIClient implements AIClientPort {
  constructor(
    private readonly inner: AIClientPort,
    /** 本次执行中 AI span 的父 scope（显式传播，无全局状态）。 */
    private readonly scope: TraceScope,
  ) {}

  async chat(request: AIChatRequest): Promise<AIChatResult> {
    return runInSpan(
      this.scope,
      AI_CHAT_SPAN_NAME,
      {
        category: 'ai',
        metadata: { 'ai.operation': 'chat', ...requestMetadata(request) },
        describeError: describeAIError,
      },
      async (span) => {
        const result = await this.inner.chat(request)
        span.addMetadata({
          ...responseMetadata(result.meta, false),
          'ai.response.chars': result.content.length,
        })
        return result
      },
    )
  }

  async chatStructured<T>(
    request: AIChatRequest,
    schema: AIStructuredSchema<T>,
    options?: AIStructuredOptions,
  ): Promise<AIStructuredResult<T>> {
    return runInSpan(
      this.scope,
      AI_CHAT_STRUCTURED_SPAN_NAME,
      {
        category: 'ai',
        metadata: {
          'ai.operation': 'chatStructured',
          'ai.schema': schema.name,
          ...requestMetadata(request),
        },
        describeError: describeAIError,
      },
      async (span) => {
        const result = await this.inner.chatStructured(request, schema, options)
        span.addMetadata(responseMetadata(result.meta, true, options))
        return result
      },
    )
  }
}

/** 用一次执行的 trace scope 包住 AI Client（每个 scope 一份轻量装饰器）。 */
export function withAITracing(inner: AIClientPort, scope: TraceScope): AIClientPort {
  return new TracedAIClient(inner, scope)
}
