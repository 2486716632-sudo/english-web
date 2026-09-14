import { describe, it, expect } from 'vitest'
import { USER_ID_MAX_CHARS, normalizeUserId } from '@/domain/user/identity-rules'

describe('normalizeUserId', () => {
  it('接受普通逻辑用户标识并归一化为小写', () => {
    expect(normalizeUserId('Local-Default-User')).toEqual({
      ok: true,
      value: 'local-default-user',
    })
    expect(normalizeUserId('  user_1.2-3  ')).toEqual({ ok: true, value: 'user_1.2-3' })
  })

  it('拒绝非字符串 / 空串 / 超长 / 非法字符', () => {
    expect(normalizeUserId(undefined)).toMatchObject({ ok: false })
    expect(normalizeUserId(null)).toMatchObject({ ok: false })
    expect(normalizeUserId(42)).toMatchObject({ ok: false })
    expect(normalizeUserId('   ')).toMatchObject({ ok: false, reason: 'userId must not be empty' })
    expect(normalizeUserId('a'.repeat(USER_ID_MAX_CHARS + 1))).toMatchObject({ ok: false })
    expect(normalizeUserId('has space')).toMatchObject({ ok: false })
    expect(normalizeUserId('emoji😀')).toMatchObject({ ok: false })
  })

  it('刚好达到长度上限的标识仍然合法', () => {
    const value = 'a'.repeat(USER_ID_MAX_CHARS)
    expect(normalizeUserId(value)).toEqual({ ok: true, value })
  })
})
