import { describe, it, expect } from 'vitest'
import {
  MEMORY_CONTENT_MAX_CHARS,
  MEMORY_KEY_MAX_CHARS,
  MEMORY_SELECTION_LIMIT,
  MEMORY_SELECTION_MAX_LIMIT,
  RESERVED_CANONICAL_MEMORY_KEYS,
  clampMemoryLimit,
  isMemoryKind,
  isMemorySource,
  isReservedCanonicalMemoryKey,
  normalizeMemoryContent,
  normalizeMemoryKey,
  normalizeMemoryKinds,
  validateNewMemoryInput,
} from '@/domain/memory/memory-rules'

/** 写入 payload **不含** userId（B-01）；归属身份由 Application 从 ExecutionContext 注入。 */
const validInput = {
  kind: 'preference',
  key: 'example_order',
  content: 'prefers short answers with examples first',
  source: 'explicit_user',
}

const OWNER = 'user-a'

describe('memory 闭集', () => {
  it('kind / source 只接受闭集取值', () => {
    expect(isMemoryKind('preference')).toBe(true)
    expect(isMemoryKind('goal')).toBe(true)
    expect(isMemoryKind('weakness')).toBe(true)
    expect(isMemoryKind('milestone')).toBe(true)
    expect(isMemoryKind('embedding')).toBe(false)
    expect(isMemorySource('explicit_user')).toBe(true)
    expect(isMemorySource('deterministic')).toBe(true)
    expect(isMemorySource('chat_history')).toBe(false)
  })
})

describe('normalizeMemoryKey（去重身份）', () => {
  it('大小写 / 空白 / 连字符 / 冒号变体收敛到同一个键', () => {
    const expected = 'explanation_language'
    for (const raw of [
      'Explanation Language',
      'explanation language',
      'explanation-language',
      'explanation:language',
      '  EXPLANATION   LANGUAGE  ',
    ]) {
      expect(normalizeMemoryKey(raw)).toBe(expected)
    }
  })

  it('折叠重复分隔符并去掉首尾分隔符', () => {
    expect(normalizeMemoryKey('weakness::articles')).toBe('weakness_articles')
    expect(normalizeMemoryKey('__goal__')).toBe('goal')
  })
})

describe('normalizeMemoryContent', () => {
  it('折叠所有空白（含换行）为单个空格', () => {
    expect(normalizeMemoryContent('  needs\n\nshort   answers\tfirst ')).toBe(
      'needs short answers first',
    )
  })
})

describe('clampMemoryLimit（有界选择）', () => {
  it('非法输入回落到默认值，越界收敛到 [1, 硬上限]', () => {
    expect(clampMemoryLimit(undefined)).toBe(MEMORY_SELECTION_LIMIT)
    expect(clampMemoryLimit('3')).toBe(MEMORY_SELECTION_LIMIT)
    expect(clampMemoryLimit(Number.NaN)).toBe(MEMORY_SELECTION_LIMIT)
    expect(clampMemoryLimit(0)).toBe(1)
    expect(clampMemoryLimit(-5)).toBe(1)
    expect(clampMemoryLimit(3.7)).toBe(3)
    expect(clampMemoryLimit(999)).toBe(MEMORY_SELECTION_MAX_LIMIT)
  })
})

describe('normalizeMemoryKinds', () => {
  it('省略 / null → 有意不按 kind 过滤（value = undefined）', () => {
    expect(normalizeMemoryKinds(undefined)).toEqual({ ok: true, value: undefined })
    expect(normalizeMemoryKinds(null)).toEqual({ ok: true, value: undefined })
  })

  it('合法数组（可混合非法项）→ 使用合法子集并去重（保持入参顺序）', () => {
    expect(normalizeMemoryKinds(['goal', 'goal', 'nope', 'preference'])).toEqual({
      ok: true,
      value: ['goal', 'preference'],
    })
  })

  it('B-03：非数组 → invalid（绝不退化为 select-all）', () => {
    const result = normalizeMemoryKinds('goal')
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ ok: false })
  })

  it('B-03：空数组 / 全部非法 → invalid（绝不退化为 select-all）', () => {
    expect(normalizeMemoryKinds([])).toMatchObject({ ok: false })
    expect(normalizeMemoryKinds(['nope', 'embedding', 42])).toMatchObject({ ok: false })
  })
})

describe('B-02 — canonical User State 保留语义键', () => {
  it('reserved 集合覆盖 english_level / explanation_language 的归一化变体', () => {
    for (const raw of [
      'english_level',
      'englishLevel',
      'English Level',
      'explanation_language',
      'explanationLanguage',
      'Explanation Language',
      'explanation-language',
    ]) {
      expect(isReservedCanonicalMemoryKey(normalizeMemoryKey(raw))).toBe(true)
    }
    expect(isReservedCanonicalMemoryKey(normalizeMemoryKey('example_order'))).toBe(false)
    expect([...RESERVED_CANONICAL_MEMORY_KEYS]).toContain('explanation_language')
  })
})

describe('validateNewMemoryInput', () => {
  it('接受合法输入并归一化 key / content', () => {
    const result = validateNewMemoryInput(
      {
        ...validInput,
        key: '  Example  Order ',
        content: '  prefers\nshort answers ',
      },
      OWNER,
    )
    expect(result).toEqual({
      ok: true,
      value: {
        userId: 'user-a',
        kind: 'preference',
        key: 'example_order',
        content: 'prefers short answers',
        source: 'explicit_user',
      },
    })
  })

  it('B-01：归属身份由第二个参数注入；非法归属身份被拒绝', () => {
    expect(validateNewMemoryInput(validInput, '')).toMatchObject({ ok: false })
    expect(validateNewMemoryInput(validInput, null)).toMatchObject({ ok: false })
    expect(validateNewMemoryInput(validInput, 42)).toMatchObject({ ok: false })
  })

  it('B-02：reserved canonical 语义键 → 拒绝（不得写入冲突的 Memory）', () => {
    for (const key of ['explanation_language', 'Explanation Language', 'englishLevel']) {
      const result = validateNewMemoryInput({ ...validInput, key }, OWNER)
      expect(result).toMatchObject({ ok: false })
      if (!result.ok) expect(result.reason).toMatch(/reserved canonical User State/)
    }
  })

  it('B-02：非 canonical 的 preference 仍可写入', () => {
    const result = validateNewMemoryInput(
      { ...validInput, kind: 'preference', key: 'example_order', content: 'prefers examples first' },
      OWNER,
    )
    expect(result).toMatchObject({ ok: true })
  })

  it('拒绝闭集外的 kind / source', () => {
    expect(validateNewMemoryInput({ ...validInput, kind: 'raw_chat' }, OWNER)).toMatchObject({
      ok: false,
    })
    expect(validateNewMemoryInput({ ...validInput, source: 'chat_history' }, OWNER)).toMatchObject(
      { ok: false },
    )
  })

  it('拒绝空 key / 空内容', () => {
    expect(validateNewMemoryInput({ ...validInput, key: '   ' }, OWNER)).toMatchObject({
      ok: false,
    })
    expect(validateNewMemoryInput({ ...validInput, content: '  \n ' }, OWNER)).toMatchObject({
      ok: false,
    })
  })

  it('拒绝超长 key / 超长内容（拒绝而不是截断）', () => {
    expect(
      validateNewMemoryInput({ ...validInput, key: 'k'.repeat(MEMORY_KEY_MAX_CHARS + 1) }, OWNER),
    ).toMatchObject({ ok: false })
    expect(
      validateNewMemoryInput(
        { ...validInput, content: 'c'.repeat(MEMORY_CONTENT_MAX_CHARS + 1) },
        OWNER,
      ),
    ).toMatchObject({ ok: false })

    const atLimit = 'c'.repeat(MEMORY_CONTENT_MAX_CHARS)
    expect(validateNewMemoryInput({ ...validInput, content: atLimit }, OWNER)).toMatchObject({
      ok: true,
    })
  })

  it('拒绝非字符串的 key / content', () => {
    expect(validateNewMemoryInput({ ...validInput, key: 1 }, OWNER)).toMatchObject({ ok: false })
    expect(validateNewMemoryInput({ ...validInput, content: { text: 'x' } }, OWNER)).toMatchObject({
      ok: false,
    })
  })
})
