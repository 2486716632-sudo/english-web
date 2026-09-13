/**
 * AI 输出内容基础质量测试
 *
 * 这些测试验证 AI 输出的内容质量基础保障。
 * 不调用真实模型，使用 synthetic fixture。
 *
 * 覆盖：
 * - 英语学习内容中的目标词汇检测（富化后的词应在例句中出现）
 * - 明显的格式错误检测
 * - 基础语言质量（非空、非纯标点）
 * - 音标格式检查
 *
 * 限制：
 * - 无法评估语义正确性（需要真实模型）
 * - 无法评估教学适当性（需要领域专家）
 * - 无法检测高级幻觉（如看似合理但错误的定义）
 *
 * 本阶段建立框架和基线，不要求完整质量评估。
 */

import { describe, it, expect } from 'vitest'
import {
  validEnrichWordResponse,
  validAssistantResponse,
  emptyAssistantResponse,
  punctuationOnlyResponse,
  hallucinatedPhoneticResponse,
  validSceneResponse,
  validC1NarrativeResponse,
} from './fixtures/ai-responses'

// ============ 质量检查辅助函数 ============

/**
 * 检查例句中是否包含目标词汇
 */
function exampleContainsWord(examples: Array<{ sentence: string; translation: string }>, word: string): boolean {
  const lowerWord = word.toLowerCase()
  return examples.some(ex => ex.sentence.toLowerCase().includes(lowerWord))
}

/**
 * 检查 IPA 音标格式是否基本有效
 * 格式：以 / 开头和结尾，包含至少一个音标字符
 */
function isValidPhonetic(phonetic: string): boolean {
  return phonetic.length >= 3 && phonetic.startsWith('/') && phonetic.endsWith('/')
}

/**
 * 检查文本是否具有基础语言质量
 */
function hasBasicQuality(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  // 排除纯标点
  if (/^[.,!?;:\-…\s]+$/.test(text.trim())) return false
  return true
}

// ============ 测试用例 ============

describe('内容质量 — enrichWord 词汇富化', () => {
  it('例句应包含被富化的目标词汇', () => {
    const word = 'example'
    const contains = exampleContainsWord(validEnrichWordResponse.exampleSentences, word)
    expect(contains).toBe(true)
  })

  it('音标格式应基本有效', () => {
    expect(isValidPhonetic(validEnrichWordResponse.phonetic)).toBe(true)
  })

  it('collocations 可以是空数组', () => {
    // 这是合理的情况：新词可能没有常用搭配
    expect(Array.isArray(hallucinatedPhoneticResponse.collocations)).toBe(true)
  })

  it('错误音标检测（音标与单词明显不匹配时，格式仍然有效）', () => {
    // 格式检查只能验证格式，无法验证音标与单词是否匹配
    // 验证匹配需要真实模型或权威词典数据
    expect(isValidPhonetic(hallucinatedPhoneticResponse.phonetic)).toBe(true)
  })
})

describe('内容质量 — AI Assistant', () => {
  it('有效回复应具有基础质量', () => {
    expect(hasBasicQuality(validAssistantResponse)).toBe(true)
  })

  it('空回复应被认为无质量', () => {
    expect(hasBasicQuality(emptyAssistantResponse)).toBe(false)
  })

  it('纯标点回复应被认为无质量', () => {
    expect(hasBasicQuality(punctuationOnlyResponse)).toBe(false)
  })
})

describe('内容质量 — 听力场景生成', () => {
  it('对话行应有英文原文和中文翻译', () => {
    for (const line of validSceneResponse.lines) {
      expect(line.english).toBeTruthy()
      expect(line.chinese).toBeTruthy()
      expect(hasBasicQuality(line.english)).toBe(true)
      expect(hasBasicQuality(line.chinese)).toBe(true)
    }
  })

  it('对话标题应有基础质量', () => {
    expect(hasBasicQuality(validSceneResponse.title)).toBe(true)
    expect(hasBasicQuality(validSceneResponse.titleZh ?? '')).toBe(true)
  })

  it('C1 叙述的每行应有 English 和 Chinese', () => {
    for (const line of validC1NarrativeResponse.lines) {
      expect(line.english).toBeTruthy()
      expect(line.chinese).toBeTruthy()
      expect(hasBasicQuality(line.english)).toBe(true)
    }
  })
})

describe('内容质量 — 通用检查', () => {
  it('非空字符串 utf-8 编码正常', () => {
    const text = JSON.stringify(validEnrichWordResponse)
    const encoded = new TextEncoder().encode(text)
    const decoded = new TextDecoder().decode(encoded)
    expect(JSON.parse(decoded)).toEqual(validEnrichWordResponse)
  })

  it('返回结果的字段命名应一致', () => {
    // 检查字段命名使用 camelCase（当前项目约定）
    const keys = Object.keys(validEnrichWordResponse)
    const allCamelCase = keys.every(k => /^[a-z][a-zA-Z0-9]*$/.test(k))
    expect(allCamelCase).toBe(true)
  })
})
