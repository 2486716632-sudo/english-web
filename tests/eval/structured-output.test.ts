/**
 * AI 结构化输出合法性测试
 *
 * 这些测试验证 AI 可能返回的 JSON 结构是否符合预期的 Schema。
 * 不调用真实模型，使用 synthetic fixture。
 *
 * ⚠️ 当前 AI Evaluation 是离线契约和评估基线。
 * 它尚未证明现有生产 Route 会执行这些校验。
 * Phase 3 实现 AI Client 后，相关测试必须接入真实解析和
 * Structured Output 处理代码。
 *
 * 场景类型（generateScene）按实际 Prompt 输出契约区分：
 *
 * A1-A5 / B 对话类型（scene-generate Prompt）：
 *   必填: title, speakerA, speakerB, lines (每行 speaker/english/chinese)
 *   speaker 必须属于 speakerA / speakerB（Prompt 用固定 token "A"/"B" 映射显示名）
 *
 * C1 叙述（listening-prompts C1_NARRATIVE）：
 *   必填: title, titleZh, type="narrative", lines (每行 english/chinese)
 *   lines 中不含 speaker（单人叙述）
 *
 * C2 访谈（listening-prompts C2_INTERVIEW）：
 *   必填: title, titleZh, type="interview", host, guest, lines
 *   speaker 必须属于 host / guest（Prompt 用固定 token "host"/"guest"）
 */

import { describe, it, expect } from 'vitest'
import {
  validEnrichWordResponse,
  incompleteEnrichWordResponse,
  wrongTypeEnrichWordResponse,
  emptyCollocationsEnrichWordResponse,
  emptyExampleSentenceResponse,
  validSceneResponse,
  emptyLinesSceneResponse,
  incompleteLineSceneResponse,
  dialogueMissingSpeakerAResponse,
  dialogueMissingSpeakerBResponse,
  dialogueWrongLineSpeakerResponse,
  validC1NarrativeResponse,
  c1MissingTitleZhResponse,
  c1WrongTypeResponse,
  validC2InterviewResponse,
  c2MissingHostResponse,
  c2MissingGuestResponse,
  c2WrongLineSpeakerResponse,
  validCoachAnalysisResponse,
  incompleteCoachAnalysisResponse,
  validThemeWordListResponse,
  invalidThemeWordResponse,
  emptyWordListResponse,
  fencedSceneResponse,
} from './fixtures/ai-responses'

// ============ 安全 JSON 提取 ============

function extractJson(raw: string): string {
  return raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
}

function safeJsonParse<T>(text: string): T | null {
  try { return JSON.parse(text) as T } catch { return null }
}

// ============ 类型定义 ============

interface EnrichWordResult {
  phonetic: string
  partOfSpeech: string
  definition: string
  collocations: string[]
  exampleSentences: Array<{ sentence: string; translation: string }>
}

interface SceneLine {
  speaker?: string
  english?: string
  chinese?: string
}

interface SceneResult {
  title?: string
  titleZh?: string
  speakerA?: string
  speakerB?: string
  type?: string
  host?: string
  guest?: string
  lines: SceneLine[]
}

interface CoachAnalysisResult {
  translation?: string
  nextPrompt?: string
  grammarCorrection?: string | null
  endDialog?: boolean
}

interface ThemeWord { word: string; definition: string }
interface ThemeWordListResult { theme: string; words: ThemeWord[] }

// ============ 校验辅助工具 ============

function isValidArray(arr: unknown, minLength = 0): arr is unknown[] {
  return Array.isArray(arr) && arr.length >= minLength
}
function isValidString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

/**
 * 角色归属校验 — line.speaker 必须指向已声明的两个参与者之一。
 *
 * 依据 src/features/listening/lib/listening-prompts.ts 的 Prompt 契约：
 *   - 对话场景：speaker 固定为 "A" / "B"，分别映射 speakerA / speakerB 的显示名
 *   - C2 访谈：speaker 固定为 "host" / "guest"
 * 因此允许集合 = 标准角色 token ∪ 已声明的显示名；任何第三方角色都判为无效。
 */
function isDeclaredSpeaker(speaker: unknown, roleTokens: string[], declared: unknown[]): boolean {
  if (!isValidString(speaker)) return false
  const allowed = roleTokens.concat(declared.filter((v): v is string => isValidString(v)))
  return allowed.includes(speaker)
}

// ============ enrichWord 校验 ============

function validateEnrichWord(data: unknown): data is EnrichWordResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!isValidString(d.phonetic)) return false
  if (!isValidString(d.partOfSpeech)) return false
  if (!isValidString(d.definition)) return false
  if (!Array.isArray(d.collocations)) return false
  for (const item of d.collocations) {
    if (!isValidString(item)) return false
  }
  if (!isValidArray(d.exampleSentences)) return false
  for (const ex of d.exampleSentences as unknown[]) {
    if (!ex || typeof ex !== 'object') return false
    const e = ex as Record<string, unknown>
    if (!isValidString(e.sentence)) return false
    if (!isValidString(e.translation)) return false
  }
  return true
}

// ============ generateScene — 场景类型特定校验 ============

/**
 * 普通对话场景 (A1-A5, B)
 * 契约: title, speakerA, speakerB, lines (每行 speaker/english/chinese)
 *       speaker 必须属于 speakerA / speakerB
 */
function validateSceneDialogue(data: unknown): data is SceneResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  if (!isValidString(d.title)) return false
  if (!isValidString(d.speakerA)) return false
  if (!isValidString(d.speakerB)) return false

  if (!isValidArray(d.lines, 2)) return false
  for (const line of d.lines as unknown[]) {
    if (!line || typeof line !== 'object') return false
    const l = line as Record<string, unknown>
    if (!isDeclaredSpeaker(l.speaker, ['A', 'B'], [d.speakerA, d.speakerB])) return false
    if (!isValidString(l.english)) return false
    if (!isValidString(l.chinese)) return false
  }
  return true
}

/**
 * C1 知识叙述
 * 契约: title, titleZh, type==="narrative", lines (每行 english/chinese)
 */
function validateSceneC1(data: unknown): data is SceneResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  if (!isValidString(d.title)) return false
  if (!isValidString(d.titleZh)) return false
  if (d.type !== 'narrative') return false

  if (!isValidArray(d.lines, 2)) return false
  for (const line of d.lines as unknown[]) {
    if (!line || typeof line !== 'object') return false
    const l = line as Record<string, unknown>
    if (!isValidString(l.english)) return false
    if (!isValidString(l.chinese)) return false
  }
  return true
}

/**
 * C2 知识访谈
 * 契约: title, titleZh, type==="interview", host, guest, lines
 *       (每行 speaker 必须属于 host / guest, english, chinese)
 */
function validateSceneC2(data: unknown): data is SceneResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  if (!isValidString(d.title)) return false
  if (!isValidString(d.titleZh)) return false
  if (d.type !== 'interview') return false
  if (!isValidString(d.host)) return false
  if (!isValidString(d.guest)) return false

  if (!isValidArray(d.lines, 2)) return false
  for (const line of d.lines as unknown[]) {
    if (!line || typeof line !== 'object') return false
    const l = line as Record<string, unknown>
    if (!isDeclaredSpeaker(l.speaker, ['host', 'guest'], [d.host, d.guest])) return false
    if (!isValidString(l.english)) return false
    if (!isValidString(l.chinese)) return false
  }
  return true
}

// ============ coachAnalysis 校验 ============

function validateCoachAnalysis(data: unknown): data is CoachAnalysisResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    isValidString(d.translation) &&
    isValidString(d.nextPrompt) &&
    (d.grammarCorrection === null || isValidString(d.grammarCorrection)) &&
    typeof d.endDialog === 'boolean'
  )
}

// ============ themeWordList 校验 ============

function validateThemeWordList(data: unknown): data is ThemeWordListResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!isValidString(d.theme)) return false
  if (!isValidArray(d.words, 1)) return false
  for (const w of d.words as unknown[]) {
    if (!w || typeof w !== 'object') return false
    const item = w as Record<string, unknown>
    if (!isValidString(item.word)) return false
    if (!isValidString(item.definition)) return false
  }
  return true
}

// ============ enrichWord 测试 ============

describe('AI 结构化输出 — enrichWord (词汇富化)', () => {
  it('有效响应应通过 schema 校验', () => {
    expect(validateEnrichWord(validEnrichWordResponse)).toBe(true)
  })
  it('缺少必填字段应被校验失败', () => {
    expect(validateEnrichWord(incompleteEnrichWordResponse)).toBe(false)
  })
  it('字段类型错误应被校验失败', () => {
    expect(validateEnrichWord(wrongTypeEnrichWordResponse)).toBe(false)
  })
  it('collocations 包含空字符串应被校验失败', () => {
    expect(validateEnrichWord(emptyCollocationsEnrichWordResponse)).toBe(false)
  })
  it('exampleSentences 中的 sentence 为空字符串应被校验失败', () => {
    expect(validateEnrichWord(emptyExampleSentenceResponse)).toBe(false)
  })
  it('null/undefined 输入应被校验失败', () => {
    expect(validateEnrichWord(null)).toBe(false)
    expect(validateEnrichWord(undefined)).toBe(false)
  })
  it('非对象输入应被校验失败', () => {
    expect(validateEnrichWord('string')).toBe(false)
    expect(validateEnrichWord(123)).toBe(false)
  })
  it('空对象应被校验失败', () => {
    expect(validateEnrichWord({})).toBe(false)
  })
})

// ============ generateScene — 场景类型特定测试 ============

describe('AI 结构化输出 — generateScene (普通对话 A1-A5/B)', () => {
  it('有效 A1 对话应通过校验', () => {
    expect(validateSceneDialogue(validSceneResponse)).toBe(true)
  })
  it('lines 为空数组应被校验失败', () => {
    expect(validateSceneDialogue(emptyLinesSceneResponse)).toBe(false)
  })
  it('line 缺少 english 应被校验失败', () => {
    expect(validateSceneDialogue(incompleteLineSceneResponse)).toBe(false)
  })
  it('缺少 speakerA 应被校验失败', () => {
    expect(validateSceneDialogue(dialogueMissingSpeakerAResponse)).toBe(false)
  })
  it('缺少 speakerB 应被校验失败', () => {
    expect(validateSceneDialogue(dialogueMissingSpeakerBResponse)).toBe(false)
  })
  it('line speaker 不属于 speakerA/speakerB 应被校验失败', () => {
    expect(validateSceneDialogue(dialogueWrongLineSpeakerResponse)).toBe(false)
  })
  it('line speaker 使用已声明的显示名应通过校验', () => {
    expect(validateSceneDialogue({
      title: 'Declared Names',
      speakerA: 'Tom',
      speakerB: 'Lisa',
      lines: [
        { speaker: 'Tom', english: 'Hi there.', chinese: '你好。' },
        { speaker: 'Lisa', english: 'Hey, good to see you.', chinese: '嘿，见到你真好。' },
      ],
    })).toBe(true)
  })
})

describe('AI 结构化输出 — generateScene (C1 知识叙述)', () => {
  it('有效 C1 叙述应通过校验', () => {
    expect(validateSceneC1(validC1NarrativeResponse)).toBe(true)
  })
  it('缺少 titleZh 应被校验失败', () => {
    expect(validateSceneC1(c1MissingTitleZhResponse)).toBe(false)
  })
  it('type 错误应被校验失败', () => {
    expect(validateSceneC1(c1WrongTypeResponse)).toBe(false)
  })
})

describe('AI 结构化输出 — generateScene (C2 知识访谈)', () => {
  it('有效 C2 访谈应通过校验', () => {
    expect(validateSceneC2(validC2InterviewResponse)).toBe(true)
  })
  it('缺少 host 应被校验失败', () => {
    expect(validateSceneC2(c2MissingHostResponse)).toBe(false)
  })
  it('缺少 guest 应被校验失败', () => {
    expect(validateSceneC2(c2MissingGuestResponse)).toBe(false)
  })
  it('line speaker 值无效应被校验失败', () => {
    expect(validateSceneC2(c2WrongLineSpeakerResponse)).toBe(false)
  })
  it('line speaker 使用已声明的 host/guest 显示名应通过校验', () => {
    expect(validateSceneC2({
      title: 'Short Interview',
      titleZh: '简短访谈',
      type: 'interview',
      host: 'Wendy',
      guest: 'Dr. Li',
      lines: [
        { speaker: 'Wendy', english: 'Welcome to the show!', chinese: '欢迎来到我们的节目！' },
        { speaker: 'Dr. Li', english: 'Thanks for having me.', chinese: '谢谢你邀请我。' },
      ],
    })).toBe(true)
  })
})

// ============ Coach 分析测试 ============

describe('AI 结构化输出 — Coach 分析', () => {
  it('有效分析应通过校验', () => {
    expect(validateCoachAnalysis(validCoachAnalysisResponse)).toBe(true)
  })
  it('缺少必填字段应被校验失败', () => {
    expect(validateCoachAnalysis(incompleteCoachAnalysisResponse)).toBe(false)
  })
  it('带 null grammarCorrection 的有效分析应通过', () => {
    expect(validateCoachAnalysis({ translation: '对。', nextPrompt: '还有什么？', grammarCorrection: null, endDialog: true })).toBe(true)
  })
})

// ============ JSON 安全提取测试 ============

describe('AI 结构化输出 — JSON 安全提取', () => {
  it('markdown fence 包裹的 JSON 应能被正确提取', () => {
    const extracted = extractJson(fencedSceneResponse)
    const parsed = safeJsonParse<SceneResult>(extracted)
    expect(parsed).not.toBeNull()
    expect(parsed?.title).toBe('Late Night Chat')
    expect(parsed?.lines).toHaveLength(2)
  })
  it('干净 JSON 提取后应保持原样', () => {
    const jsonStr = JSON.stringify(validSceneResponse)
    expect(safeJsonParse<SceneResult>(extractJson(jsonStr))?.title).toBe(validSceneResponse.title)
  })
  it('非 JSON 文本的 safeJsonParse 应返回 null', () => {
    expect(safeJsonParse('this is not json')).toBeNull()
  })
  it('空字符串 safeJsonParse 应返回 null', () => {
    expect(safeJsonParse('')).toBeNull()
  })
})

// ============ Theme 生成测试 ============

describe('AI 结构化输出 — Theme 生成', () => {
  it('有效主题词表应通过校验函数', () => {
    expect(validateThemeWordList(validThemeWordListResponse)).toBe(true)
  })
  it('缺少 word 字段的主题词应被校验失败', () => {
    expect(validateThemeWordList(invalidThemeWordResponse)).toBe(false)
  })
  it('空 words 数组应被校验失败', () => {
    expect(validateThemeWordList(emptyWordListResponse)).toBe(false)
  })
  it('theme 为空字符串应被校验失败', () => {
    expect(validateThemeWordList({ theme: '', words: [{ word: 'hello', definition: 'a greeting' }] })).toBe(false)
  })
  it('非对象输入应被校验失败', () => {
    expect(validateThemeWordList(null)).toBe(false)
    expect(validateThemeWordList(undefined)).toBe(false)
  })
})
