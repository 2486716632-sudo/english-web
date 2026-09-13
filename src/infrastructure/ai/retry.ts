// @layer Infrastructure — bounded retry policy (network/transport retries only)

import { AIError, type AIRetryPolicy } from '@/application/ports/ai-client'
import { normalizeUnknownAIError } from './errors'

export interface ResolvedRetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
}

/** 有界默认策略：最多 3 次尝试（2 次重试），指数退避 + jitter。 */
export const DEFAULT_RETRY_POLICY: ResolvedRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
  jitterRatio: 0.25,
}

/** 规整调用方传入的策略：至少 1 次尝试，避免出现无限重试路径。 */
export function resolveRetryPolicy(policy?: Partial<AIRetryPolicy>): ResolvedRetryPolicy {
  return {
    maxAttempts: Math.max(1, Math.floor(policy?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts)),
    baseDelayMs: Math.max(0, policy?.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs),
    maxDelayMs: Math.max(0, policy?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs),
    jitterRatio: Math.min(1, Math.max(0, policy?.jitterRatio ?? DEFAULT_RETRY_POLICY.jitterRatio)),
  }
}

/** 第 `attempt` 次失败后的退避时长（指数退避 + 对称 jitter，上限 maxDelayMs）。 */
export function backoffDelayMs(
  attempt: number,
  policy: ResolvedRetryPolicy,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1))
  const jitterSpan = exponential * policy.jitterRatio
  const value = exponential - jitterSpan + random() * jitterSpan * 2
  return Math.max(0, Math.round(value))
}

export interface RetryScheduledInfo {
  /** 刚失败的尝试序号（从 1 开始）。 */
  attempt: number
  delayMs: number
  error: AIError
}

export interface RunWithRetryOptions {
  policy: ResolvedRetryPolicy
  /** 绝对 deadline（`now()` 同一时间基准）。超过后不再发起新的尝试。 */
  deadlineAt: number
  now: () => number
  sleep: (ms: number) => Promise<void>
  random: () => number
  /** 是否允许重试该错误，默认使用 `AIError.retryable`。 */
  isRetryable?: (error: AIError) => boolean
  onRetryScheduled?: (info: RetryScheduledInfo) => void
}

/**
 * 有界重试执行器。
 *
 * 终止条件（任一满足即抛出）：
 *  1. 尝试次数达到 `policy.maxAttempts`
 *  2. 错误被判定为不可重试（认证、配置、确定性请求错误、结构化校验失败）
 *  3. 退避后已越过 `deadlineAt`（整体预算耗尽）
 */
export async function runWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RunWithRetryOptions,
): Promise<{ value: T; attempts: number }> {
  const { policy, deadlineAt, now, sleep, random } = options
  const isRetryable = options.isRetryable ?? ((error: AIError) => error.retryable)

  let attempt = 0
  for (;;) {
    attempt += 1

    try {
      const value = await operation(attempt)
      return { value, attempts: attempt }
    } catch (raw) {
      const error = normalizeUnknownAIError(raw)
      const attemptsLeft = attempt < policy.maxAttempts

      if (!attemptsLeft || !isRetryable(error)) throw error

      const delayMs = backoffDelayMs(attempt, policy, random)
      if (now() + delayMs >= deadlineAt) throw error

      options.onRetryScheduled?.({ attempt, delayMs, error })
      await sleep(delayMs)
    }
  }
}
