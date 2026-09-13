import { describe, it, expect } from 'vitest'
import type { AIStructuredSchema } from '@/application/ports/ai-client'
import {
  buildRepairMessages,
  extractJsonCandidate,
  parseStructured,
  stripCodeFences,
} from '@/infrastructure/ai/structured-output'
import * as fixtures from '../../../../tests/eval/fixtures/ai-responses'

// ---- 本地示例 schema（生产边界由调用方提供 schema，这里只验证边界本身） ----

interface SceneLine {
  speaker?: string
  english?: string
  chinese?: string
}

interface SceneLike {
  title: string
  lines: SceneLine[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

const sceneDialogueSchema: AIStructuredSchema<SceneLike> = {
  name: 'generateScene.dialogue',
  validate(value: unknown): value is SceneLike {
    if (!value || typeof value !== 'object') return false
    const scene = value as Record<string, unknown>
    if (!isNonEmptyString(scene.title)) return false
    if (!Array.isArray(scene.lines) || scene.lines.length < 2) return false
    return scene.lines.every((line) => {
      if (!line || typeof line !== 'object') return false
      const l = line as Record<string, unknown>
      return isNonEmptyString(l.english) && isNonEmptyString(l.chinese)
    })
  },
}

const themeWordListSchema: AIStructuredSchema<{ theme: string; words: Array<{ word: string }> }> = {
  name: 'word.theme.list',
  validate(value: unknown): value is { theme: string; words: Array<{ word: string }> } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const list = value as Record<string, unknown>
    if (!isNonEmptyString(list.theme)) return false
    if (!Array.isArray(list.words) || list.words.length < 1) return false
    return list.words.every((w) => !!w && typeof w === 'object' && isNonEmptyString((w as Record<string, unknown>).word))
  },
}

// ---- 提取 ----

describe('structured output — JSON 安全提取', () => {
  it('干净 JSON 对象原样解析', () => {
    expect(extractJsonCandidate('{"a":1}')).toEqual({ a: 1 })
  })

  it('markdown fence 包裹的 JSON 可解析', () => {
    expect(extractJsonCandidate('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('前后夹带自然语言的 JSON 可解析', () => {
    expect(extractJsonCandidate(fixtures.jsonWithSurroundingText)).toEqual({ data: 'value' })
  })

  it('根结构为数组时可解析（主题词表）', () => {
    expect(
      extractJsonCandidate('[{"word":"colander","definition":"a bowl with holes"}]'),
    ).toEqual([{ word: 'colander', definition: 'a bowl with holes' }])
  })

  it('对象数组混合时取更靠前的根结构', () => {
    expect(extractJsonCandidate('[{"a":1}]')).toEqual([{ a: 1 }])
  })

  it('非法 JSON / 空字符串 / 纯文本返回 null', () => {
    expect(extractJsonCandidate(fixtures.invalidJson)).toBeNull()
    expect(extractJsonCandidate('')).toBeNull()
    expect(extractJsonCandidate(fixtures.validAssistantResponse)).toBeNull()
    expect(extractJsonCandidate('...')).toBeNull()
  })

  it('stripCodeFences 去掉 json 与裸 fence', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })
})

// ---- Phase 2 fixture 格式兼容性（离线契约基线 → 生产边界） ----

describe('structured output — Phase 2 fixture 格式兼容', () => {
  const objectFixtures = Object.entries(fixtures).filter(
    ([, value]) => value !== null && typeof value === 'object',
  )

  it('Phase 2 的对象型 fixture 全部可被生产提取器解析并保持结构', () => {
    expect(objectFixtures.length).toBeGreaterThan(25)
    for (const [name, value] of objectFixtures) {
      expect(extractJsonCandidate(JSON.stringify(value)), `fixture: ${name}`).toEqual(value)
    }
  })

  const stringFixtureExpectations: Array<[keyof typeof fixtures, unknown]> = [
    ['validEmptyDataJson', {}],
    ['fencedSceneResponse', 'object'],
    ['jsonWithSurroundingText', { data: 'value' }],
    ['invalidJson', null],
    ['emptyAssistantResponse', null],
    ['punctuationOnlyResponse', null],
    ['validAssistantResponse', null],
  ]

  it('Phase 2 的字符串型 fixture 行为符合预期', () => {
    for (const [name, expected] of stringFixtureExpectations) {
      const raw = fixtures[name] as string
      const extracted = extractJsonCandidate(raw)
      if (expected === 'object') {
        expect(typeof extracted, `fixture: ${String(name)}`).toBe('object')
      } else {
        expect(extracted, `fixture: ${String(name)}`).toEqual(expected)
      }
    }
  })

  it('fenced 场景 fixture 可通过场景 schema 校验', () => {
    const parsed = parseStructured(fixtures.fencedSceneResponse, sceneDialogueSchema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.title).toBe('Late Night Chat')
      expect(parsed.data.lines).toHaveLength(2)
    }
  })
})

// ---- 校验 ----

describe('structured output — schema 校验', () => {
  it('合法 JSON 通过校验并返回数据', () => {
    const parsed = parseStructured(JSON.stringify(fixtures.validSceneResponse), sceneDialogueSchema)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.title).toBe('Wrong Order')
  })

  it('JSON 合法但 schema 不满足时报告 schema 失败', () => {
    const parsed = parseStructured(JSON.stringify(fixtures.emptyLinesSceneResponse), sceneDialogueSchema)
    expect(parsed).toEqual({ ok: false, reason: 'JSON did not satisfy schema "generateScene.dialogue"' })
  })

  it('无法解析时报告提取失败', () => {
    const parsed = parseStructured(fixtures.invalidJson, sceneDialogueSchema)
    expect(parsed).toEqual({ ok: false, reason: 'response did not contain parseable JSON' })
  })

  it('主题词表 schema 拒绝缺少 word 的条目', () => {
    const invalid = parseStructured(JSON.stringify(fixtures.invalidThemeWordResponse), themeWordListSchema)
    expect(invalid.ok).toBe(false)

    const valid = parseStructured(JSON.stringify(fixtures.validThemeWordListResponse), themeWordListSchema)
    expect(valid.ok).toBe(true)
  })
})

// ---- 解析修复指令 ----

describe('structured output — 解析修复指令', () => {
  it('包含 schema 名与失败原因，角色为 user', () => {
    const messages = buildRepairMessages('not json', 'demo.schema', 'response did not contain parseable JSON')
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('demo.schema')
    expect(messages[0].content).toContain('response did not contain parseable JSON')
  })

  it('回带的原始响应被截断，避免污染 prompt', () => {
    const messages = buildRepairMessages('x'.repeat(5000), 'demo.schema', 'bad')
    expect(messages[0].content.length).toBeLessThan(5000)
  })
})
