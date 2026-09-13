import { describe, it, expect } from 'vitest'
import {
  MAX_RAW_VOCAB_ITEMS,
  normalizeArticleProcessingPayload,
} from '@/domain/reading/ai-response-rules'
import type { ReadingVocabItem } from '@/domain/reading/types'

/**
 * Characterization tests —— 逐条对齐**迁移前** `scripts/reading-push.ts` 的真实语义。
 *
 * 迁移前的**内层**实现（`processWithDeepSeek` 的返回值构造）逐字为：
 *   const parsed = JSON.parse(raw)
 *   return {
 *     titleZh: parsed.titleZh || '',
 *     summaryZh: parsed.summaryZh || '',
 *     vocabItems: Array.isArray(parsed.vocabItems) ? parsed.vocabItems.slice(0, 10) : [],
 *   }
 *
 * 迁移前的**外层**（调用方）把 AI 调用与操作员日志放在同一个 try/catch 中：
 *   try {
 *     dsResult = await processWithDeepSeek(title, contentText)
 *     console.log(`... titleZh="${dsResult.titleZh.slice(0, 30)}..." ...`)
 *   } catch (err) {
 *     console.log(`... ⚠ DeepSeek failed ...`)
 *     dsResult = { titleZh: '', summaryZh: '', vocabItems: [] }   // ← 降级
 *   }
 * 因此**任何**异常（内层抛错、或日志里的 `.slice()` 抛错）都会变成
 * "空 AI 结果 + 文章仍然入库"；随后 `vocabItems.map(...)` 直接交给 Prisma ——
 * **非法嵌套条目**仍会在写库阶段抛错，该条文章计入 failed 且不入库。
 *
 * 这正是 C6（JSON `null`）= 行为保持、C7（畸形 truthy 非字符串 `titleZh`）= 有意变更的原因。
 */

/** 迁移前实现的等价复刻（用于对照断言）。`'throws'` 表示旧代码会抛异常。 */
function legacyNormalize(
  raw: unknown,
): { titleZh: string; summaryZh: string; vocabItems: unknown[] } | 'throws' {
  try {
    const parsed = raw as { titleZh?: unknown; summaryZh?: unknown; vocabItems?: unknown }
    return {
      titleZh: (parsed.titleZh as string) || '',
      summaryZh: (parsed.summaryZh as string) || '',
      vocabItems: Array.isArray(parsed.vocabItems) ? parsed.vocabItems.slice(0, 10) : [],
    }
  } catch {
    return 'throws'
  }
}

/** 旧实现"AI 步骤"的完整结果（含外层 catch 的降级语义）。 */
function legacyAiStepOutcome(raw: unknown):
  | { degraded: true; titleZh: ''; summaryZh: ''; vocabItems: [] }
  | { degraded: false; titleZh: unknown; summaryZh: string; vocabItems: unknown[] } {
  try {
    const normalized = legacyNormalize(raw)
    if (normalized === 'throws') throw new TypeError('legacy inner normalization threw')

    // 旧实现的**操作员日志**：`dsResult.titleZh.slice(0, 30)`（位于同一个 try 内）
    const titleZh: unknown = normalized.titleZh
    const sliceable = titleZh as { slice?: unknown } | null | undefined
    if (typeof sliceable?.slice !== 'function') {
      throw new TypeError('titleZh.slice is not a function')
    }

    return {
      degraded: false,
      titleZh,
      summaryZh: normalized.summaryZh,
      vocabItems: normalized.vocabItems,
    }
  } catch {
    // 外层 catch：任何异常 → 空 AI 结果（文章仍然入库）
    return { degraded: true, titleZh: '', summaryZh: '', vocabItems: [] }
  }
}

const validItem: ReadingVocabItem = {
  word: 'give up',
  type: 'phrase',
  partOfSpeech: 'verb',
  definition: '放弃',
  contextSentence: 'He decided to give up smoking.',
}

describe('normalizeArticleProcessingPayload — 迁移前语义对照 (A–F)', () => {
  it('A. 缺少 vocabItems + 合法 titleZh/summaryZh → 保留标题摘要，词汇为空', () => {
    const raw = { titleZh: '标题', summaryZh: '摘要' }
    const legacy = legacyNormalize(raw)

    const result = normalizeArticleProcessingPayload(raw)

    expect(legacy).toEqual({ titleZh: '标题', summaryZh: '摘要', vocabItems: [] })
    expect(result).toEqual({
      ok: true,
      value: { titleZh: '标题', summaryZh: '摘要', vocabItems: [] },
    })
  })

  it('B. vocabItems 非数组 + 合法 titleZh/summaryZh → 保留标题摘要，词汇为空', () => {
    for (const vocabItems of ['nope', 42, {}, null]) {
      const raw = { titleZh: '标题', summaryZh: '摘要', vocabItems }
      const legacy = legacyNormalize(raw)

      const result = normalizeArticleProcessingPayload(raw)

      expect(legacy).toEqual({ titleZh: '标题', summaryZh: '摘要', vocabItems: [] })
      expect(result).toEqual({
        ok: true,
        value: { titleZh: '标题', summaryZh: '摘要', vocabItems: [] },
      })
    }
  })

  it('C. 缺少 titleZh + 其余合法 → titleZh 归一化为空串，摘要与词汇保留', () => {
    const raw = { summaryZh: '摘要', vocabItems: [validItem] }
    const legacy = legacyNormalize(raw)

    const result = normalizeArticleProcessingPayload(raw)

    expect(legacy).toMatchObject({ titleZh: '', summaryZh: '摘要' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.titleZh).toBe('')
      expect(result.value.summaryZh).toBe('摘要')
      expect(result.value.vocabItems).toHaveLength(1)
    }
  })

  it('D. 缺少 summaryZh + 其余合法 → summaryZh 归一化为空串，标题与词汇保留', () => {
    const raw = { titleZh: '标题', vocabItems: [validItem] }
    const legacy = legacyNormalize(raw)

    const result = normalizeArticleProcessingPayload(raw)

    expect(legacy).toMatchObject({ titleZh: '标题', summaryZh: '' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.summaryZh).toBe('')
      expect(result.value.titleZh).toBe('标题')
      expect(result.value.vocabItems).toHaveLength(1)
    }
  })

  it('E. 非法嵌套词汇条目 → 迁移前会在写库阶段失败（该条 failed、不入库）', () => {
    // 旧实现不会校验嵌套条目，而是把它直接交给 Prisma → definition/contextSentence 缺失
    // 会被数据库拒绝 → article.create 抛错 → 该条计入 failed 且不落库。
    const malformedItems = [
      { word: 'x', definition: 'd' }, // 缺 contextSentence
      { word: 'x', contextSentence: 'c' }, // 缺 definition
      { definition: 'd', contextSentence: 'c' }, // 缺 word
      'not-an-object',
      null,
      { word: 5, definition: 'd', contextSentence: 'c' }, // 类型不符
      { word: 'x', definition: 'd', contextSentence: 'c', type: 5 }, // type 类型不符
      { word: 'x', definition: 'd', contextSentence: 'c', partOfSpeech: 5 },
    ]

    for (const item of malformedItems) {
      const raw = { titleZh: '标题', summaryZh: '摘要', vocabItems: [item] }
      // 旧实现的"逐字段兜底"本身不会抛错，失败发生在后续写库阶段
      expect(legacyNormalize(raw)).not.toBe('throws')

      const result = normalizeArticleProcessingPayload(raw)
      expect(result.ok, `expected failure for ${JSON.stringify(item)}`).toBe(false)
    }
  })

  it('F. 完全合法负载 → 全部字段保留', () => {
    const raw = { titleZh: '标题', summaryZh: '摘要', vocabItems: [validItem] }
    const legacy = legacyNormalize(raw)

    const result = normalizeArticleProcessingPayload(raw)

    expect(legacy).toMatchObject({ titleZh: '标题', summaryZh: '摘要' })
    expect(result).toEqual({
      ok: true,
      value: { titleZh: '标题', summaryZh: '摘要', vocabItems: [validItem] },
    })
  })
})

describe('normalizeArticleProcessingPayload — 与旧代码对齐的边界', () => {
  it('falsy 的 titleZh / summaryZh（""、0、null）→ 归一化为空串（旧实现 `|| ""`）', () => {
    for (const falsy of ['', 0, null, false]) {
      const result = normalizeArticleProcessingPayload({ titleZh: falsy, summaryZh: falsy })
      expect(result).toEqual({ ok: true, value: { titleZh: '', summaryZh: '', vocabItems: [] } })
    }
  })

  it('truthy 但非字符串的 titleZh / summaryZh → 领域归一化判为失败', () => {
    expect(normalizeArticleProcessingPayload({ titleZh: 5, summaryZh: '摘要' }).ok).toBe(false)
    expect(normalizeArticleProcessingPayload({ titleZh: '标题', summaryZh: {} }).ok).toBe(false)
  })

  it('C7：畸形 truthy 非字符串 titleZh —— 旧实现的最终结果是"降级 + 文章入库"（源自日志副作用）', () => {
    for (const malformed of [5, true, {}, 3.14]) {
      // 旧内层归一化不抛错（`parsed.titleZh || ''` 会保留 truthy 值）
      expect(legacyNormalize({ titleZh: malformed, summaryZh: '摘要' })).not.toBe('throws')
      // 但外层日志 `titleZh.slice(0, 30)` 抛错 → 被外层 catch 转成降级（文章仍然入库）
      expect(legacyAiStepOutcome({ titleZh: malformed, summaryZh: '摘要' })).toMatchObject({
        degraded: true,
        titleZh: '',
      })
    }

    // 新实现：确定性地判为无效负载（该条 failed、不入库）—— 这是**有意**的行为变更
    for (const malformed of [5, true, {}, 3.14]) {
      expect(normalizeArticleProcessingPayload({ titleZh: malformed }).ok).toBe(false)
    }
  })

  it('C7 附注：数组 titleZh 在旧实现中带 `.slice`，不会触发日志异常，最终在写库阶段失败', () => {
    // 旧实现：日志可执行（Array.prototype.slice 存在）→ 继续走到持久化 → Prisma 拒绝数组
    expect(legacyAiStepOutcome({ titleZh: ['a'], summaryZh: '摘要' })).toMatchObject({
      degraded: false,
    })
    // 新实现同样把该条判为失败（不入库）—— 结果一致
    expect(normalizeArticleProcessingPayload({ titleZh: ['a'] }).ok).toBe(false)
  })

  it('C6：根为 JSON null —— 旧整条链路最终也是"降级 + 文章入库"', () => {
    expect(legacyNormalize(null)).toBe('throws') // 内层抛 TypeError
    expect(legacyAiStepOutcome(null)).toEqual({
      degraded: true,
      titleZh: '',
      summaryZh: '',
      vocabItems: [],
    }) // 外层 catch 转成降级
  })

  it('C6 对照：合法负载在旧实现中不会降级（证明上述 helper 不是恒真）', () => {
    expect(legacyAiStepOutcome({ titleZh: '标题', summaryZh: '摘要' })).toMatchObject({
      degraded: false,
      titleZh: '标题',
      summaryZh: '摘要',
    })
  })

  it('根为 null → 领域归一化判为失败；但旧**整条链路**最终是"降级 + 文章入库"（C6 行为保持）', () => {
    // 旧实现的**内层** processWithDeepSeek 会在 `parsed.titleZh` 上抛 TypeError
    expect(legacyNormalize(null)).toBe('throws')
    // 但该异常被旧实现的**外层 AI try/catch** 捕获 → 空结果 → 文章仍然入库
    expect(legacyAiStepOutcome(null)).toMatchObject({ degraded: true, titleZh: '' })
    // 领域归一化是防御性判定（真实链路上 Phase 3 边界不会把 null 交到这里）
    expect(normalizeArticleProcessingPayload(null).ok).toBe(false)
  })

  it('根为数组/字符串/数字 → 空结果（旧实现读取属性均为 undefined）', () => {
    for (const root of [[1, 2], 'text', 42, true]) {
      expect(legacyNormalize(root)).toEqual({ titleZh: '', summaryZh: '', vocabItems: [] })
      expect(normalizeArticleProcessingPayload(root)).toEqual({
        ok: true,
        value: { titleZh: '', summaryZh: '', vocabItems: [] },
      })
    }
  })

  it('先 slice(0, 10) 再校验：第 11 条起即使非法也不影响该条（旧实现只把前 10 条交给数据库）', () => {
    const items = Array.from({ length: MAX_RAW_VOCAB_ITEMS }, (_, i) => ({
      ...validItem,
      word: `w${i}`,
    }))
    items.push({ word: 'malformed' } as unknown as ReadingVocabItem)

    const result = normalizeArticleProcessingPayload({ vocabItems: items })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.vocabItems).toHaveLength(MAX_RAW_VOCAB_ITEMS)
  })

  it('超过 10 条时截断到 10 条（旧实现 `slice(0, 10)`）', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ ...validItem, word: `w${i}` }))
    const result = normalizeArticleProcessingPayload({ vocabItems: items })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.vocabItems).toHaveLength(10)
      expect(result.value.vocabItems[9].word).toBe('w9')
    }
  })

  it('忽略未知字段（旧实现只读取已知字段）', () => {
    const result = normalizeArticleProcessingPayload({
      titleZh: 't',
      summaryZh: 's',
      extra: 'ignored',
      vocabItems: [{ ...validItem, extra: 'ignored' }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.vocabItems[0]).toEqual(validItem)
  })
})

describe('归一化后的数据模型（blocking issue #2）', () => {
  it('原始条目可以省略 type（旧实现允许，`v.type || "word"` 兜底）', () => {
    const result = normalizeArticleProcessingPayload({
      vocabItems: [{ word: 'x', definition: 'd', contextSentence: 'c' }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.vocabItems[0].type).toBe('word')
  })

  it('falsy 的 type 也归一化为 "word"（旧实现 `|| *` 语义）', () => {
    for (const falsyType of ['', undefined]) {
      const result = normalizeArticleProcessingPayload({
        vocabItems: [{ word: 'x', definition: 'd', contextSentence: 'c', type: falsyType }],
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value.vocabItems[0].type).toBe('word')
    }
  })

  it('归一化结果满足声明的 TypeScript 形状（无需类型断言）', () => {
    const result = normalizeArticleProcessingPayload({
      titleZh: 't',
      summaryZh: 's',
      vocabItems: [{ word: 'x', definition: 'd', contextSentence: 'c' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // 以下赋值在编译期即验证形状：若类型不真实（例如 type 可能为 undefined）会直接报错
    const titleZh: string = result.value.titleZh
    const summaryZh: string = result.value.summaryZh
    const items: ReadingVocabItem[] = result.value.vocabItems

    expect(typeof titleZh).toBe('string')
    expect(typeof summaryZh).toBe('string')
    expect(items).toHaveLength(1)
    for (const item of items) {
      expect(typeof item.word).toBe('string')
      expect(typeof item.type).toBe('string')
      expect(typeof item.definition).toBe('string')
      expect(typeof item.contextSentence).toBe('string')
    }
  })
})

/**
 * v2 审核（Minor Changes Requested）第 1 项：
 * 旧实现的持久化映射为 `type: v.type || 'word'`、`partOfSpeech: v.partOfSpeech || null`，
 * 因此 **falsy 值**（undefined / "" / null / false / 0）都必须走兜底，
 * 而不是被判为类型错误。
 */
describe('type / partOfSpeech 的 falsy 兜底（对齐旧实现 `||` 语义）', () => {
  /** 旧实现映射的等价复刻（未类型化的 JS）。 */
  function legacyMapFields(raw: { type?: unknown; partOfSpeech?: unknown }): {
    type: string
    partOfSpeech: string | null
  } {
    return {
      type: (raw.type as string) || 'word',
      partOfSpeech: (raw.partOfSpeech as string) || null,
    }
  }

  const falsyValues: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['""', ''],
    ['null', null],
    ['false', false],
    ['0', 0],
  ]

  function normalizeWith(overrides: { type?: unknown; partOfSpeech?: unknown }) {
    return normalizeArticleProcessingPayload({
      vocabItems: [
        { word: 'x', definition: 'd', contextSentence: 'c', ...overrides },
      ],
    })
  }

  it.each(falsyValues)('type = %s → "word"（与旧实现一致）', (_label, falsyType) => {
    const legacy = legacyMapFields({ type: falsyType })
    const result = normalizeWith({ type: falsyType })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.vocabItems[0].type).toBe(legacy.type)
      expect(result.value.vocabItems[0].type).toBe('word')
    }
  })

  it.each(falsyValues)('partOfSpeech = %s → null（与旧实现一致）', (_label, falsyPos) => {
    const legacy = legacyMapFields({ partOfSpeech: falsyPos })
    const result = normalizeWith({ partOfSpeech: falsyPos })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // 归一化用 undefined 表示"空"，持久化映射会落到 null（与旧实现一致）
      const persisted = result.value.vocabItems[0].partOfSpeech ?? null
      expect(persisted).toBe(legacy.partOfSpeech)
      expect(persisted).toBeNull()
    }
  })

  const truthyNonStrings: Array<[string, unknown]> = [
    ['5', 5],
    ['{}', {}],
    ['[]', []],
    ['true', true],
  ]

  it.each(truthyNonStrings)('truthy 非字符串 type = %s → 失败（旧实现会在写库阶段失败）', (_label, truthyType) => {
    expect(normalizeWith({ type: truthyType }).ok).toBe(false)
  })

  it.each(truthyNonStrings)(
    'truthy 非字符串 partOfSpeech = %s → 失败（旧实现会在写库阶段失败）',
    (_label, truthyPos) => {
      expect(normalizeWith({ partOfSpeech: truthyPos }).ok).toBe(false)
    },
  )

  it('truthy 字符串保持原值（type / partOfSpeech 均不改写）', () => {
    const result = normalizeWith({ type: 'phrase', partOfSpeech: 'verb' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.vocabItems[0].type).toBe('phrase')
      expect(result.value.vocabItems[0].partOfSpeech).toBe('verb')
    }
  })

  it('word / definition / contextSentence 的校验未被放宽（空串可以，非字符串失败）', () => {
    // 空串在旧实现中也是合法字符串（Prisma 接受），因此不失败
    const emptyStrings = normalizeWith({})
    expect(emptyStrings.ok).toBe(true)

    for (const field of ['word', 'definition', 'contextSentence'] as const) {
      const result = normalizeArticleProcessingPayload({
        vocabItems: [{ word: 'x', definition: 'd', contextSentence: 'c', [field]: 5 }],
      })
      expect(result.ok, `${field} 非字符串应失败`).toBe(false)
    }
  })
})
