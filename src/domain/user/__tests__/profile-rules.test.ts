import { describe, it, expect } from 'vitest'
import {
  countProfileFields,
  isProfileEmpty,
  toEnglishLevelOrNull,
  toExplanationLanguageOrNull,
  validateLearningProfilePatch,
} from '@/domain/user/profile-rules'

describe('validateLearningProfilePatch', () => {
  it('接受闭集取值并归一化大小写与分隔符', () => {
    expect(validateLearningProfilePatch({ englishLevel: 'Upper-Intermediate' })).toEqual({
      ok: true,
      value: { englishLevel: 'upper_intermediate' },
    })
    expect(validateLearningProfilePatch({ explanationLanguage: ' ZH ' })).toEqual({
      ok: true,
      value: { explanationLanguage: 'zh' },
    })
  })

  it('同时接受多个已支持字段', () => {
    expect(
      validateLearningProfilePatch({ englishLevel: 'advanced', explanationLanguage: 'bilingual' }),
    ).toEqual({
      ok: true,
      value: { englishLevel: 'advanced', explanationLanguage: 'bilingual' },
    })
  })

  it('null 或空字符串表示显式清空该字段', () => {
    expect(validateLearningProfilePatch({ englishLevel: null })).toEqual({
      ok: true,
      value: { englishLevel: null },
    })
    expect(validateLearningProfilePatch({ explanationLanguage: '' })).toEqual({
      ok: true,
      value: { explanationLanguage: null },
    })
  })

  it('拒绝非法取值（不做静默丢弃）', () => {
    expect(validateLearningProfilePatch({ englishLevel: 'godlike' })).toMatchObject({ ok: false })
    expect(validateLearningProfilePatch({ englishLevel: 3 })).toMatchObject({ ok: false })
    expect(validateLearningProfilePatch({ explanationLanguage: 'fr' })).toMatchObject({ ok: false })
  })

  it('拒绝非对象、未支持字段与空 patch', () => {
    expect(validateLearningProfilePatch(null)).toMatchObject({
      ok: false,
      reason: 'profile patch must be an object',
    })
    expect(validateLearningProfilePatch([1, 2])).toMatchObject({ ok: false })
    expect(validateLearningProfilePatch({ preferredTopics: 'tech' })).toMatchObject({
      ok: false,
      reason: 'unsupported profile field(s): preferredTopics',
    })
    expect(validateLearningProfilePatch({})).toMatchObject({
      ok: false,
      reason: 'no supported profile fields provided',
    })
  })
})

describe('profile 读取收敛（DB 值 → 闭集）', () => {
  it('无法识别的值收敛为 null，不把未校验字符串送进应用上下文', () => {
    expect(toEnglishLevelOrNull('intermediate')).toBe('intermediate')
    expect(toEnglishLevelOrNull('C2')).toBeNull()
    expect(toEnglishLevelOrNull(null)).toBeNull()
    expect(toEnglishLevelOrNull(7)).toBeNull()
    expect(toExplanationLanguageOrNull('bilingual')).toBe('bilingual')
    expect(toExplanationLanguageOrNull('klingon')).toBeNull()
  })
})

describe('档案字段计数', () => {
  it('只统计已设置的字段数量（不暴露值）', () => {
    expect(countProfileFields({ englishLevel: null, explanationLanguage: null })).toBe(0)
    expect(countProfileFields({ englishLevel: 'advanced', explanationLanguage: null })).toBe(1)
    expect(countProfileFields({ englishLevel: 'advanced', explanationLanguage: 'zh' })).toBe(2)
  })

  it('isProfileEmpty 对 null / 全空档案返回 true', () => {
    expect(isProfileEmpty(null)).toBe(true)
    expect(isProfileEmpty({ englishLevel: null, explanationLanguage: null })).toBe(true)
    expect(isProfileEmpty({ englishLevel: 'beginner', explanationLanguage: null })).toBe(false)
  })
})
