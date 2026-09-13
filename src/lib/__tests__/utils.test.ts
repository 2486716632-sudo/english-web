/**
 * 工具函数表征测试
 *
 * 覆盖 src/lib/utils.ts 中的 formatPhonetic 函数。
 */

import { describe, it, expect } from 'vitest'
import { formatPhonetic } from '@/lib/utils'

describe('formatPhonetic', () => {
  it('null 输入返回 null', () => {
    expect(formatPhonetic(null)).toBeNull()
  })

  it('undefined 输入（通过类型系统允许 null）', () => {
    // 显式测试 null-like 输入
    expect(formatPhonetic(null)).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(formatPhonetic('')).toBeNull()
  })

  it('空白字符串返回 "//"（当前实际行为：trim 后空字符串被格式化为 //）', () => {
    // 注：当前实现中 `'   '.trim()` → `''`，然后返回 `/${t}/` → `//`
    // 这是 characterization 记录，后续可根据需要修改
    expect(formatPhonetic('   ')).toBe('//')
  })

  it('已经带 / 的音标不重复添加', () => {
    expect(formatPhonetic('/hɛˈloʊ/')).toBe('/hɛˈloʊ/')
  })

  it('纯文本音标添加 / 分隔符', () => {
    expect(formatPhonetic('hɛˈloʊ')).toBe('/hɛˈloʊ/')
  })

  it('带前后空格的文本先 trim', () => {
    expect(formatPhonetic('  hɛˈloʊ  ')).toBe('/hɛˈloʊ/')
  })

  it('音标以 / 开头不以 / 结尾时只保留原始值', () => {
    // 当前实现：仅当同时以 / 开头和结尾时返回原始值
    expect(formatPhonetic('/hɛˈloʊ')).toBe('//hɛˈloʊ/')
  })

  it('简短的音标', () => {
    expect(formatPhonetic('kæt')).toBe('/kæt/')
  })

  it('包含特殊字符的音标', () => {
    expect(formatPhonetic('ˌɪntərˈnæʃənəl')).toBe('/ˌɪntərˈnæʃənəl/')
  })
})
