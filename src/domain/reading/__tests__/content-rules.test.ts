import { describe, it, expect } from 'vitest'
import {
  DIFFICULTY_HIGH_CONTENT_CHARS,
  DIFFICULTY_MEDIUM_CONTENT_CHARS,
  MAX_EXCERPT_CHARS,
  MAX_VOCAB_ITEMS,
  MIN_ARTICLE_CONTENT_CHARS,
  buildExcerpt,
  difficultyFromContentLength,
  hasSufficientContent,
  limitVocabItems,
} from '@/domain/reading/content-rules'

describe('domain/reading — 长度阈值', () => {
  it('阈值与迁移前实现一致', () => {
    expect(MIN_ARTICLE_CONTENT_CHARS).toBe(100)
    expect(MAX_VOCAB_ITEMS).toBe(10)
    expect(MAX_EXCERPT_CHARS).toBe(300)
    expect(DIFFICULTY_MEDIUM_CONTENT_CHARS).toBe(1500)
    expect(DIFFICULTY_HIGH_CONTENT_CHARS).toBe(3000)
  })

  it('hasSufficientContent：< 100 字符判为不足，=100 判为足够', () => {
    expect(hasSufficientContent('a'.repeat(99))).toBe(false)
    expect(hasSufficientContent('a'.repeat(100))).toBe(true)
    expect(hasSufficientContent('')).toBe(false)
  })

  it('hasSufficientContent 支持自定义阈值', () => {
    expect(hasSufficientContent('a'.repeat(50), 50)).toBe(true)
    expect(hasSufficientContent('a'.repeat(49), 50)).toBe(false)
  })
})

describe('domain/reading — 难度启发式', () => {
  it('边界值与迁移前一致（>3000→4，>1500→3，否则 2）', () => {
    expect(difficultyFromContentLength(0)).toBe(2)
    expect(difficultyFromContentLength(1500)).toBe(2)
    expect(difficultyFromContentLength(1501)).toBe(3)
    expect(difficultyFromContentLength(3000)).toBe(3)
    expect(difficultyFromContentLength(3001)).toBe(4)
    expect(difficultyFromContentLength(10000)).toBe(4)
  })
})

describe('domain/reading — excerpt', () => {
  it('截断到 300 字符', () => {
    const long = 'a'.repeat(500)
    expect(buildExcerpt(long)).toHaveLength(300)
  })

  it('折叠连续空白并 trim（与迁移前 replace(/\\s+/g, " ").trim() 等价）', () => {
    expect(buildExcerpt('  hello   world \n\n next  ')).toBe('hello world next')
  })

  it('先截断后折叠空白（保持既有顺序）', () => {
    const text = `${'x'.repeat(299)}   y`
    const excerpt = buildExcerpt(text)
    // slice(0,300) 留下末尾空格，折叠空白后再 trim → 299 个 x
    expect(excerpt).toBe('x'.repeat(299))
  })

  it('短文本原样返回（仅做空白归一化）', () => {
    expect(buildExcerpt('short text')).toBe('short text')
  })
})

describe('domain/reading — 词汇条数上限', () => {
  it('最多保留 10 条（保持既有 slice(0, 10)）', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      word: `w${i}`,
      type: 'word',
      definition: 'd',
      contextSentence: 'c',
    }))
    expect(limitVocabItems(items)).toHaveLength(10)
    expect(limitVocabItems(items)[9].word).toBe('w9')
  })

  it('少于上限时原样返回', () => {
    expect(limitVocabItems([])).toEqual([])
  })
})
