import { describe, it, expect, vi } from 'vitest'
import { AIError } from '@/application/ports/ai-client'
import {
  DEFAULT_RETRY_POLICY,
  backoffDelayMs,
  resolveRetryPolicy,
  runWithRetry,
} from '@/infrastructure/ai/retry'

describe('retry policy — resolution', () => {
  it('未提供策略时使用有界默认值', () => {
    expect(resolveRetryPolicy()).toEqual(DEFAULT_RETRY_POLICY)
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3)
  })

  it('maxAttempts 至少为 1（不存在零次/无限重试路径）', () => {
    expect(resolveRetryPolicy({ maxAttempts: 0 }).maxAttempts).toBe(1)
    expect(resolveRetryPolicy({ maxAttempts: -5 }).maxAttempts).toBe(1)
  })

  it('显式值被保留，jitterRatio 被夹在 [0,1]', () => {
    const policy = resolveRetryPolicy({ maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 20, jitterRatio: 9 })
    expect(policy.maxAttempts).toBe(5)
    expect(policy.baseDelayMs).toBe(10)
    expect(policy.maxDelayMs).toBe(20)
    expect(policy.jitterRatio).toBe(1)
  })
})

describe('retry policy — backoff', () => {
  const policy = resolveRetryPolicy({ maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 4000, jitterRatio: 0.25 })

  it('指数退避：500 → 1000 → 2000', () => {
    const mid = () => 0.5
    expect(backoffDelayMs(1, policy, mid)).toBe(500)
    expect(backoffDelayMs(2, policy, mid)).toBe(1000)
    expect(backoffDelayMs(3, policy, mid)).toBe(2000)
  })

  it('退避不超过 maxDelayMs', () => {
    const capped = resolveRetryPolicy({ baseDelayMs: 1000, maxDelayMs: 1500, jitterRatio: 0 })
    expect(backoffDelayMs(5, capped, () => 0.5)).toBe(1500)
  })

  it('jitter 在 ±ratio 范围内', () => {
    expect(backoffDelayMs(1, policy, () => 0)).toBe(375)
    expect(backoffDelayMs(1, policy, () => 1)).toBe(625)
  })
})

describe('runWithRetry', () => {
  const baseOptions = (overrides: Partial<Parameters<typeof runWithRetry>[1]> = {}) => ({
    policy: resolveRetryPolicy({ maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 4000, jitterRatio: 0.25 }),
    deadlineAt: Number.POSITIVE_INFINITY,
    now: () => 0,
    sleep: vi.fn(async () => {}),
    random: () => 0.5,
    ...overrides,
  })

  it('首次成功 → 仅 1 次尝试，无退避', async () => {
    const sleep = vi.fn(async () => {})
    const result = await runWithRetry(async () => 'ok', baseOptions({ sleep }))

    expect(result).toEqual({ value: 'ok', attempts: 1 })
    expect(sleep).not.toHaveBeenCalled()
  })

  it('可重试失败后成功 → 指数退避，attempts 计数正确', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new AIError('provider_error', 'boom'))
      .mockRejectedValueOnce(new AIError('rate_limited', 'slow down'))
      .mockResolvedValueOnce('ok')

    const result = await runWithRetry(operation, baseOptions({ sleep }))

    expect(result).toEqual({ value: 'ok', attempts: 3 })
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000])
  })

  it('不可重试错误（auth_error）立即抛出，不重试', async () => {
    const sleep = vi.fn(async () => {})
    const operation = vi.fn(async () => {
      throw new AIError('auth_error', 'bad key')
    })

    await expect(runWithRetry(operation, baseOptions({ sleep }))).rejects.toMatchObject({
      code: 'auth_error',
    })
    expect(operation).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('尝试次数有上限，不会无限重试', async () => {
    const sleep = vi.fn(async () => {})
    const operation = vi.fn(async () => {
      throw new AIError('provider_error', 'always 500')
    })

    await expect(runWithRetry(operation, baseOptions({ sleep }))).rejects.toMatchObject({
      code: 'provider_error',
    })
    expect(operation).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('退避会越过 deadline 时不再重试（整体预算优先）', async () => {
    let clock = 0
    const sleep = vi.fn(async (ms: number) => {
      clock += ms
    })
    const operation = vi.fn(async () => {
      throw new AIError('provider_error', 'always 500')
    })

    await expect(
      runWithRetry(operation, baseOptions({ sleep, now: () => clock, deadlineAt: 600 })),
    ).rejects.toMatchObject({ code: 'provider_error' })

    expect(operation).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('非 AIError 的底层异常会被归一化', async () => {
    const operation = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })

    await expect(runWithRetry(operation, baseOptions())).rejects.toMatchObject({
      code: 'network_error',
      retryable: true,
    })
  })

  it('onRetryScheduled 上报重试信息', async () => {
    const onRetryScheduled = vi.fn()
    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new AIError('timeout', 'slow'))
      .mockResolvedValueOnce('ok')

    await runWithRetry(operation, baseOptions({ onRetryScheduled }))

    expect(onRetryScheduled).toHaveBeenCalledTimes(1)
    expect(onRetryScheduled.mock.calls[0][0]).toMatchObject({ attempt: 1, delayMs: 500 })
  })
})
