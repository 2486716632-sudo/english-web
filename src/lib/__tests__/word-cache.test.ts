/**
 * word-cache 模块表征测试
 *
 * 覆盖 src/lib/word-cache.ts 中的缓存管理函数。
 * 注意：模块级缓存是全局可变的，测试顺序可能影响结果。
 * 每个测试独立验证缓存操作，不依赖其他测试的状态。
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { listWordCache, studyWordCache, clearWordCaches } from '@/lib/word-cache'
import type { WordData } from '@/lib/types'

/** 创建一个模拟的 WordData 对象 */
function mockWord(overrides: Partial<WordData> = {}): WordData {
  return {
    id: 1,
    word: 'hello',
    phonetic: '/həˈloʊ/',
    partOfSpeech: 'interjection',
    definition: 'used as a greeting',
    collocations: null,
    example: null,
    exampleZh: null,
    imageUrl: null,
    theme: null,
    difficulty: 'beginner',
    review: null,
    ...overrides,
  }
}

describe('word-cache — listWordCache', () => {
  beforeEach(() => {
    // 清除所有缓存
    Object.keys(listWordCache).forEach(k => delete listWordCache[k])
    Object.keys(studyWordCache).forEach(k => delete studyWordCache[k])
  })

  it('初始状态为空对象', () => {
    expect(listWordCache).toEqual({})
    expect(studyWordCache).toEqual({})
  })

  it('写入并读取 listWordCache', () => {
    const words = [mockWord({ id: 1, word: 'hello' })]
    listWordCache['test-theme'] = words
    expect(listWordCache['test-theme']).toBe(words)
    expect(listWordCache['test-theme']).toHaveLength(1)
  })

  it('写入并读取 studyWordCache', () => {
    const words = [mockWord({ id: 2, word: 'world' })]
    studyWordCache['review'] = words
    expect(studyWordCache['review']).toBe(words)
    expect(studyWordCache['review']).toHaveLength(1)
  })

  it('clearWordCaches 清除指定主题的缓存', () => {
    listWordCache['kitchen'] = [mockWord({ id: 1 })]
    studyWordCache['kitchen'] = [mockWord({ id: 2 })]
    listWordCache['office'] = [mockWord({ id: 3 })]

    clearWordCaches('kitchen')

    expect(listWordCache['kitchen']).toBeUndefined()
    expect(studyWordCache['kitchen']).toBeUndefined()
    // 其他主题不受影响
    expect(listWordCache['office']).toBeDefined()
  })

  it('clearWordCaches 对不存在的 key 无影响', () => {
    listWordCache['existing'] = [mockWord()]
    clearWordCaches('non-existent')
    expect(listWordCache['existing']).toBeDefined()
  })

  it('listWordCache 和 studyWordCache 是独立的', () => {
    listWordCache['test'] = [mockWord({ id: 1 })]
    expect(studyWordCache['test']).toBeUndefined()
  })
})
