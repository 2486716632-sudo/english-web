// @layer Infrastructure — AI error mapping (provider → normalized)

import { AIError, type AIErrorCode } from '@/application/ports/ai-client'

/**
 * provider HTTP status → 归一化错误码。
 *
 * 只有真正的「服务器/限流/超时」类错误才标记为可网络重试；
 * 认证、配置与确定性请求错误一律不重试。
 */
export function mapHttpStatusToAIErrorCode(status: number): AIErrorCode {
  if (status === 401 || status === 403) return 'auth_error'
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate_limited'
  if (status === 400 || status === 422) return 'invalid_request'
  if (status >= 500) return 'provider_error'
  return 'unknown'
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return name === 'AbortError' || name === 'TimeoutError'
}

/**
 * 把任意底层错误归一化为 `AIError`。
 *
 * - 已经是 `AIError` 时原样返回（adapter 已做过 provider 级映射）
 * - 取消/中断 → `timeout`
 * - 网络层 `TypeError`（undici 的 `fetch failed` 等）→ `network_error`
 * - 其它 → `unknown`
 */
export function normalizeUnknownAIError(error: unknown, context: { provider?: string } = {}): AIError {
  if (error instanceof AIError) return error

  if (isAbortError(error)) {
    return new AIError('timeout', 'AI request was aborted', { provider: context.provider, cause: error })
  }

  if (error instanceof TypeError) {
    return new AIError('network_error', error.message || 'Network request failed', {
      provider: context.provider,
      cause: error,
    })
  }

  const message = error instanceof Error ? error.message : String(error)
  return new AIError('unknown', message, { provider: context.provider, cause: error })
}
