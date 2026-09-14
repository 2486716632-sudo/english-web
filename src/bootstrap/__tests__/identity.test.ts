import { describe, it, expect } from 'vitest'
import { DEFAULT_USER_ID, resolveCurrentUserId } from '@/bootstrap/identity'
import { normalizeUserId } from '@/domain/user/identity-rules'

/**
 * 过渡期身份解析（Phase 6 任务文档 Part 2 / Part 17 第 13 项）。
 *
 * 关键不变式：解析必须是**确定性的**，且结果必须是一个合法的 `UserId`
 * —— 应用因此不再有"没有身份"的执行路径，同时也不假设"永远只有一个用户"。
 */
describe('resolveCurrentUserId（过渡期默认用户）', () => {
  it('确定性返回同一个默认逻辑用户', () => {
    expect(resolveCurrentUserId()).toBe(DEFAULT_USER_ID)
    expect(resolveCurrentUserId({ headers: { get: () => null } })).toBe(DEFAULT_USER_ID)
    expect(DEFAULT_USER_ID).toBe('local-default-user')
  })

  it('默认用户本身必须通过 Domain 的身份校验', () => {
    expect(normalizeUserId(DEFAULT_USER_ID)).toEqual({ ok: true, value: DEFAULT_USER_ID })
  })

  it('过渡期不解析任何请求头（不伪造认证）', () => {
    const request = {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer fake' : null),
      },
    }
    expect(resolveCurrentUserId(request)).toBe(DEFAULT_USER_ID)
  })
})
