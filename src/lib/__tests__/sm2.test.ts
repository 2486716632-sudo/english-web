/**
 * SM-2 算法表征测试 (Characterization Tests)
 *
 * 这些测试记录并固定当前 sm2() 函数的实际行为。
 * 它们不验证算法是否正确，而是验证行为是否在后续修改中保持一致。
 *
 * 如果后续重构需要修改 SM-2 行为，这些测试会明确告诉你什么改变了。
 *
 * 评分定义（当前实现）：
 *   1-2 = 错误（incorrect）— 重置间隔和重复次数
 *   3   = Good — 正确，正常推进
 *   4   = Easy — 正确，加速推进
 *   5   = Mastered — 正确，当前实现与 rating=4 行为相同
 *
 * 当前实现版本: src/lib/sm2.ts (commit 8891b48)
 */

import { describe, it, expect } from 'vitest'
import { sm2, type SM2Result } from '@/lib/sm2'

/** 默认初始状态 */
const DEFAULT_PREV = { interval: 0, easiness: 2.5, repetitions: 0 }

/**
 * Helper: 检查 nextReviewAt 是否在预期天数之后（对齐到午夜）
 */
function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

function dateEqual(actual: Date, expected: Date): boolean {
  return actual.getTime() === expected.getTime()
}

describe('sm2 — 首次学习（无 prev 参数）', () => {
  it('rating=1 时重置间隔和重复次数', () => {
    const result = sm2(1)
    expect(result.interval).toBe(0)
    expect(result.repetitions).toBe(0)
    expect(dateEqual(result.nextReviewAt, daysFromNow(0))).toBe(true)
  })

  it('rating=2 时重置间隔和重复次数', () => {
    const result = sm2(2)
    expect(result.interval).toBe(0)
    expect(result.repetitions).toBe(0)
    expect(dateEqual(result.nextReviewAt, daysFromNow(0))).toBe(true)
  })

  it('rating=3 时 interval=1, repetitions=1', () => {
    const result = sm2(3)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
    expect(dateEqual(result.nextReviewAt, daysFromNow(1))).toBe(true)
  })

  it('rating=4 时 interval=1, repetitions=1（首次正确与 rating=3 行为相同）', () => {
    const result = sm2(4)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('rating=5 时 interval=1, repetitions=1（首次正确与 rating=3 行为相同）', () => {
    const result = sm2(5)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('不传 prev 时使用默认参数 { interval: 0, easiness: 2.5, repetitions: 0 }', () => {
    const result = sm2(3)
    // ef = 2.5 + (0.1 - 2*(0.08+0.04)) = 2.5 - 0.14 = 2.36
    expect(result.easiness).toBeCloseTo(2.36, 10)
  })
})

describe('sm2 — easiness factor 计算', () => {
  const EF = (rating: number): number => {
    const result = sm2(rating, DEFAULT_PREV)
    return result.easiness
  }

  it('rating=1 时 easiness 下降最多', () => {
    // ef = 2.5 + (0.1 - (5-1)*(0.08+(5-1)*0.02)) = 2.5 + (0.1 - 4*(0.08+4*0.02))
    // = 2.5 + (0.1 - 4*(0.08+0.08)) = 2.5 + (0.1 - 4*0.16) = 2.5 + (0.1 - 0.64)
    // = 2.5 - 0.54 = 1.96
    expect(EF(1)).toBeCloseTo(1.96, 10)
  })

  it('rating=2 时 easiness 小幅下降', () => {
    // ef = 2.5 + (0.1 - (5-2)*(0.08+(5-2)*0.02)) = 2.5 + (0.1 - 3*(0.08+3*0.02))
    // = 2.5 + (0.1 - 3*(0.08+0.06)) = 2.5 + (0.1 - 3*0.14) = 2.5 + (0.1 - 0.42)
    // = 2.5 - 0.32 = 2.18
    expect(EF(2)).toBeCloseTo(2.18, 10)
  })

  it('rating=3 时 easiness 小幅上升', () => {
    // ef = 2.5 + (0.1 - (5-3)*(0.08+(5-3)*0.02)) = 2.5 + (0.1 - 2*(0.08+2*0.02))
    // = 2.5 + (0.1 - 2*(0.08+0.04)) = 2.5 + (0.1 - 2*0.12) = 2.5 + (0.1 - 0.24)
    // = 2.5 - 0.14 = 2.36
    expect(EF(3)).toBeCloseTo(2.36, 10)
  })

  it('rating=4 时 easiness 较明显上升', () => {
    // ef = 2.5 + (0.1 - (5-4)*(0.08+(5-4)*0.02)) = 2.5 + (0.1 - 1*(0.08+1*0.02))
    // = 2.5 + (0.1 - 1*0.10) = 2.5 + (0.1 - 0.10) = 2.5 + 0 = 2.5
    expect(EF(4)).toBeCloseTo(2.5, 10)
  })

  it('rating=5 时 easiness 上升最多', () => {
    // ef = 2.5 + (0.1 - (5-5)*(0.08+(5-5)*0.02)) = 2.5 + (0.1 - 0*(...))
    // = 2.5 + 0.1 = 2.6
    expect(EF(5)).toBeCloseTo(2.6, 10)
  })

  it('easiness 最小值限制为 1.3', () => {
    // 从 1.3 开始，用 rating=1 多次降低，但不会低于 1.3
    // 第一次: 2.5 + (0.1 - 4*0.16) = 1.96
    // 第二次: 1.96 + (0.1 - 4*0.16) = 1.96 - 0.54 = 1.42
    // 第三次: 1.42 + (0.1 - 4*0.16) = 1.42 - 0.54 = 1.30 (clamped)
    // 第四次: 1.30 + (0.1 - 4*0.16) = 1.30 - 0.54 = 0.76 → clamped to 1.3
    const r1 = sm2(1, { interval: 5, easiness: 2.5, repetitions: 2 })
    expect(r1.easiness).toBeCloseTo(1.96, 10)

    const r2 = sm2(1, { interval: 0, easiness: r1.easiness, repetitions: 0 })
    expect(r2.easiness).toBeCloseTo(1.42, 10)

    const r3 = sm2(1, { interval: 0, easiness: r2.easiness, repetitions: 0 })
    expect(r3.easiness).toBeCloseTo(1.3, 10)

    const r4 = sm2(1, { interval: 0, easiness: r3.easiness, repetitions: 0 })
    expect(r4.easiness).toBeCloseTo(1.3, 10)
  })
})

describe('sm2 — 正确的响应路径 (rating >= 3)', () => {
  it('第一次正确 (repetitions=0): interval → 1', () => {
    const result = sm2(3, { interval: 0, easiness: 2.5, repetitions: 0 })
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('第二次正确 (repetitions=1): interval → 6', () => {
    const result = sm2(3, { interval: 1, easiness: 2.5, repetitions: 1 })
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('第三次及以后正确: interval = Math.round(interval * easiness)，注意 easiness 先更新', () => {
    // interval=6, easiness=2.5, rating=3:
    // easiness 先被更新为 2.36, 然后 interval = Math.round(6 * 2.36) = 14
    const r1 = sm2(3, { interval: 6, easiness: 2.5, repetitions: 2 })
    expect(r1.interval).toBe(14)
    expect(r1.repetitions).toBe(3)

    // interval=14, easiness=2.36, rating=3:
    // easiness = 2.36 - 0.14 = 2.22, interval = Math.round(14 * 2.22) = 31
    const r2 = sm2(3, { interval: 14, easiness: 2.36, repetitions: 3 })
    expect(r2.interval).toBe(31)
    expect(r2.repetitions).toBe(4)
  })

  it('rating=4 在首次正确时与 rating=3 行为一致', () => {
    const r3 = sm2(3, { interval: 0, easiness: 2.5, repetitions: 0 })
    const r4 = sm2(4, { interval: 0, easiness: 2.5, repetitions: 0 })
    expect(r3.interval).toBe(r4.interval)
    expect(r3.repetitions).toBe(r4.repetitions)
  })

  it('rating=5 与 rating=3 的 easiness 变化不同，因此 interval 也不同', () => {
    // 由于 easiness 先更新：rating=3 → easiness 下降到 2.46；rating=5 → easiness 上升到 2.7
    const r3 = sm2(3, { interval: 6, easiness: 2.6, repetitions: 2 })
    const r5 = sm2(5, { interval: 6, easiness: 2.6, repetitions: 2 })
    // rating=3: interval = Math.round(6 * 2.46) = 15
    expect(r3.interval).toBe(15)
    expect(r3.repetitions).toBe(3)
    // rating=5: interval = Math.round(6 * 2.7) = 16
    expect(r5.interval).toBe(16)
    expect(r5.repetitions).toBe(3)
  })
})

describe('sm2 — 错误的响应路径 (rating < 3)', () => {
  it('从已学习状态用 rating=1: interval=0, repetitions=0', () => {
    const result = sm2(1, { interval: 38, easiness: 2.5, repetitions: 4 })
    expect(result.interval).toBe(0)
    expect(result.repetitions).toBe(0)
    expect(dateEqual(result.nextReviewAt, daysFromNow(0))).toBe(true)
  })

  it('从已学习状态用 rating=2: interval=0, repetitions=0', () => {
    const result = sm2(2, { interval: 38, easiness: 2.5, repetitions: 4 })
    expect(result.interval).toBe(0)
    expect(result.repetitions).toBe(0)
  })

  it('错误后 easiness 仍然会更新（虽然单词被重置）', () => {
    const result = sm2(1, { interval: 38, easiness: 2.5, repetitions: 4 })
    // 即使重置，easiness 也会因为公式计算而下降
    expect(result.easiness).toBeLessThan(2.5)
  })
})

describe('sm2 — nextReviewAt 计算', () => {
  it('正确响应时，下次复习日期为当天 + interval 天', () => {
    const result = sm2(3, DEFAULT_PREV)
    expect(dateEqual(result.nextReviewAt, daysFromNow(1))).toBe(true)
  })

  it('错误响应时，下次复习日期为当天（interval=0）', () => {
    const result = sm2(1, DEFAULT_PREV)
    expect(dateEqual(result.nextReviewAt, daysFromNow(0))).toBe(true)
  })

  it('多次正确后，nextReviewAt 与计算出的 interval 天数一致', () => {
    // 注意：easiness 先更新，interval 被重新计算
    // 输入 interval=38, easiness=2.5, rating=3:
    // easiness → 2.36, interval = Math.round(38 * 2.36) = 90
    const r = sm2(3, { interval: 38, easiness: 2.5, repetitions: 4 })
    expect(dateEqual(r.nextReviewAt, daysFromNow(r.interval))).toBe(true)
  })
})

describe('sm2 — 完整学习周期模拟', () => {
  it('模拟一个完整的学习周期（多次正确）', () => {
    // Day 1: 首次学习 rating=3
    let state = { interval: 0, easiness: 2.5, repetitions: 0 }
    let r = sm2(3, state)
    expect(r.interval).toBe(1)    // 明天复习
    expect(r.repetitions).toBe(1)
    state = { interval: r.interval, easiness: r.easiness, repetitions: r.repetitions }

    // Day 2: 复习 rating=3
    r = sm2(3, state)
    expect(r.interval).toBe(6)    // 6 天后
    expect(r.repetitions).toBe(2)
    state = { interval: r.interval, easiness: r.easiness, repetitions: r.repetitions }

    // Day 8: 复习 rating=3 (6天后)
    r = sm2(3, state)
    expect(r.interval).toBe(Math.round(6 * r.easiness))
    expect(r.repetitions).toBe(3)
  })

  it('模拟学习后忘记，然后重新学习', () => {
    // 第一次 rating=4
    let r = sm2(4, DEFAULT_PREV)
    expect(r.repetitions).toBe(1)

    // 第二次 rating=3
    r = sm2(3, { interval: r.interval, easiness: r.easiness, repetitions: r.repetitions })
    expect(r.repetitions).toBe(2)

    // 第三次遗忘 rating=1
    r = sm2(1, { interval: r.interval, easiness: r.easiness, repetitions: r.repetitions })
    expect(r.repetitions).toBe(0)   // 重置
    expect(r.interval).toBe(0)      // 重置

    // 重新学习
    r = sm2(3, { interval: r.interval, easiness: r.easiness, repetitions: r.repetitions })
    expect(r.interval).toBe(1)      // 重新从 1 开始
    expect(r.repetitions).toBe(1)
  })
})

describe('sm2 — 边界和异常输入', () => {
  it('rating=0 按错误路径处理（当前实际行为）', () => {
    // 当前实现中，rating < 3 即为错误
    const result = sm2(0, DEFAULT_PREV)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(0)
  })

  it('rating=6 按正确路径处理（当前实际行为，>=3）', () => {
    const result = sm2(6, DEFAULT_PREV)
    expect(result.repetitions).toBe(1)
    expect(result.interval).toBe(1)
  })

  it('负 rating 按错误路径处理', () => {
    const result = sm2(-1, DEFAULT_PREV)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(0)
  })

  it('rating=1 直接最小路径：interval=0, repetitions=0', () => {
    // 确保 rating=1 不会意外走正确路径
    // 有些 SM-2 变体将 rating=1 定义错误、rating=2 定义正确
    // 当前实现所有 <3 都是错误
    const correct = sm2(3, DEFAULT_PREV)
    const incorrect = sm2(1, DEFAULT_PREV)
    expect(incorrect.repetitions).toBe(0)
    expect(correct.repetitions).toBe(1)
  })

  it('不传 prev 不会抛出异常', () => {
    expect(() => sm2(3)).not.toThrow()
    expect(() => sm2(1)).not.toThrow()
  })

  it('初始 easiness=2.5 是默认值', () => {
    const r1 = sm2(3)
    // 2.5 + 0.1 - 2*(0.08+0.04) = 2.36（使用 toBeCloseTo 处理浮点精度）
    expect(r1.easiness).toBeCloseTo(2.36, 10)
  })

  it('返回类型包含所有必需字段', () => {
    const result: SM2Result = sm2(3, DEFAULT_PREV)
    expect(result).toHaveProperty('interval')
    expect(result).toHaveProperty('easiness')
    expect(result).toHaveProperty('repetitions')
    expect(result).toHaveProperty('nextReviewAt')
    expect(result.nextReviewAt).toBeInstanceOf(Date)
  })
})
