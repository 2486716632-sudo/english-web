// @layer Domain — AI 输出**归一化**规则（纯函数）
//
// Phase 4 修正（外部审核 v1 blocking issue #1 / #2）：
//   - 旧 Reading 管线对 AI 负载是**逐字段兜底**（`x || ''`、`Array.isArray(x) ? … : []`），
//     而不是"整包校验失败就全丢"。本文件恢复该语义。
//   - 旧实现里无法安全恢复的负载（非法嵌套词汇条目、truthy 但类型不兼容的字段）
//     最终会在写库阶段抛错 → 该条**计为失败且不入库**。这里在归一化阶段就把它们判为
//     `ok: false`，交由 Workflow 走"该条失败"的分支，而不是静默降级成功。
//
// 类型模型（blocking issue #2）：
//   原始负载（RawArticleProcessingPayload / RawReadingVocabItem，运行时为 unknown）
//     -- normalizeArticleProcessingPayload() -->
//   归一化结果（ArticleProcessingResult / ReadingVocabItem，字段类型确定）

import type { ArticleProcessingResult, ReadingVocabItem } from './types'

/** 历史实现 `vocabItems.slice(0, 10)` 的上限。 */
export const MAX_RAW_VOCAB_ITEMS = 10

export type NormalizeArticlePayloadResult =
  | { ok: true; value: ArticleProcessingResult }
  | { ok: false; reason: string }

type NormalizeVocabItemResult =
  | { ok: true; value: ReadingVocabItem }
  | { ok: false; reason: string }

/** 类型守卫（不是类型断言）：把"对象且非数组"的值收窄为可索引的记录。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 历史实现的字段级兜底：`parsed.titleZh || ''`。
 *
 * - 缺失 / falsy（''、0、null、undefined、NaN）→ `''`
 * - 字符串 → 原样保留
 * - truthy 但非字符串（例如数字、布尔、对象）→ 这里返回失败（确定性）。
 *   注意旧管线在这类 `titleZh` 上其实会先因为操作员日志 `dsResult.titleZh.slice(0, 30)`
 *   抛错、被**外层 AI try/catch** 转成"降级 + 文章入库"（见 C7）——该旧行为依赖日志副作用，
 *   本层刻意不复现，而是确定性地判为无效负载
 */
function normalizeTextField(
  value: unknown,
  fieldName: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (!value) return { ok: true, value: '' }
  if (typeof value === 'string') return { ok: true, value }
  return { ok: false, reason: `${fieldName} must be a string when present (received ${typeof value})` }
}

/**
 * 单个原始词汇条目的归一化，与旧实现的持久化映射逐字对齐：
 *   word / definition / contextSentence → 直接交给数据库（非字符串 → 写库失败 → 该条 failed）
 *   type         → `v.type || 'word'`      （falsy：undefined / "" / null / false / 0 → "word"）
 *   partOfSpeech → `v.partOfSpeech || null`（falsy → null；此处归一化为 undefined，由持久化映射落为 null）
 *
 * 因此：falsy 走兜底；truthy 但非字符串（5 / {} / [] / true）在旧实现中会导致写库失败
 * → 这里返回 `ok: false`。
 *
 * 实现说明：全部使用局部变量 + 控制流收窄，不包含任何类型断言。
 */
function normalizeVocabItem(value: unknown, index: number): NormalizeVocabItemResult {
  if (!isPlainRecord(value)) return { ok: false, reason: `vocabItems[${index}] must be an object` }

  const word = value.word
  if (typeof word !== 'string') {
    return { ok: false, reason: `vocabItems[${index}].word must be a string` }
  }
  const definition = value.definition
  if (typeof definition !== 'string') {
    return { ok: false, reason: `vocabItems[${index}].definition must be a string` }
  }
  const contextSentence = value.contextSentence
  if (typeof contextSentence !== 'string') {
    return { ok: false, reason: `vocabItems[${index}].contextSentence must be a string` }
  }

  // 历史实现 `v.type || 'word'`：falsy 走兜底；truthy 必须是字符串
  const rawType = value.type
  let type: string
  if (!rawType) {
    type = 'word'
  } else if (typeof rawType === 'string') {
    type = rawType
  } else {
    return {
      ok: false,
      reason: `vocabItems[${index}].type must be a string when truthy (received ${typeof rawType})`,
    }
  }

  // 历史实现 `v.partOfSpeech || null`：falsy → null（此处用 undefined 表示，由持久化映射落为 null）
  const rawPartOfSpeech = value.partOfSpeech
  let partOfSpeech: string | undefined
  if (!rawPartOfSpeech) {
    partOfSpeech = undefined
  } else if (typeof rawPartOfSpeech === 'string') {
    partOfSpeech = rawPartOfSpeech
  } else {
    return {
      ok: false,
      reason: `vocabItems[${index}].partOfSpeech must be a string when truthy (received ${typeof rawPartOfSpeech})`,
    }
  }

  return { ok: true, value: { word, definition, contextSentence, type, partOfSpeech } }
}

/**
 * 把 provider 返回的**原始**负载归一化为可用于持久化的 Reading 结果。
 *
 * 与旧管线逐条对齐：
 *  - 根为 `null`/`undefined` → 失败（防御性判定；真实链路上 Phase 3 的结构化输出边界
 *    不会把 `null` 交到这里，见 C6 —— 整条链路的最终行为与旧管线一致，属**行为保持**）
 *  - 根为数组/字符串/数字/布尔 → 三个字段全部走兜底 → 空结果（旧实现属性访问均为 undefined）
 *  - 根为对象 → `titleZh` / `summaryZh` 逐字段兜底；`vocabItems` 非数组则视为 `[]`
 *  - `vocabItems` 先 `slice(0, 10)` 再校验（旧实现同样只把前 10 条交给数据库，
 *    因此第 11 条起即使格式异常也不会导致该条失败）
 *
 * 说明：旧实现把 AI 调用与操作员日志放在**同一个 try/catch** 中，
 * 因此任何异常（包括日志里 `titleZh.slice()` 的 TypeError）都会退化为"空 AI 结果 + 文章入库"。
 * 本函数只负责“负载是否可用于持久化”的确定性判定，不复现日志副作用（见 C6 / C7）。
 *
 * 纯函数：不抛异常，失败以 `{ ok: false, reason }` 返回。
 */
export function normalizeArticleProcessingPayload(raw: unknown): NormalizeArticlePayloadResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: 'AI payload was null' }
  }

  if (!isPlainRecord(raw)) {
    // 数组 / 字符串 / 数字 / 布尔：旧实现读取属性得到 undefined，全部走兜底
    return { ok: true, value: { titleZh: '', summaryZh: '', vocabItems: [] } }
  }
  const record = raw

  const titleZh = normalizeTextField(record.titleZh, 'titleZh')
  if (!titleZh.ok) return titleZh

  const summaryZh = normalizeTextField(record.summaryZh, 'summaryZh')
  if (!summaryZh.ok) return summaryZh

  const rawItems = record.vocabItems
  const items = Array.isArray(rawItems) ? rawItems.slice(0, MAX_RAW_VOCAB_ITEMS) : []

  const vocabItems: ReadingVocabItem[] = []
  for (let index = 0; index < items.length; index += 1) {
    const normalized = normalizeVocabItem(items[index], index)
    if (!normalized.ok) return normalized
    vocabItems.push(normalized.value)
  }

  return { ok: true, value: { titleZh: titleZh.value, summaryZh: summaryZh.value, vocabItems } }
}
