// @layer Infrastructure — structured output boundary (extraction + validation + bounded repair)

import type { AIMessage, AIStructuredSchema } from '@/application/ports/ai-client'

/** 解析修复默认上限：1 次（即最多 2 次 provider 调用）。 */
export const DEFAULT_MAX_REPAIR_ATTEMPTS = 1

/** 修复指令中回带的原始响应上限，避免 prompt 被超长垃圾内容污染。 */
const MAX_ECHOED_RESPONSE_CHARS = 2_000

/** 去掉 markdown code fence（```json / ```）。 */
export function stripCodeFences(raw: string): string {
  return raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * 从模型输出中提取可解析的 JSON 片段。
 *
 * 支持（与 Phase 2 离线评估 fixture 的格式集合一致）：
 *  1. 干净 JSON
 *  2. markdown fence 包裹的 JSON
 *  3. 前后夹带自然语言的 JSON
 *  4. JSON 对象（`{}`）与 JSON 数组（`[]`）两种根结构
 *
 * 失败返回 `null`（不抛异常）。
 */
export function extractJsonCandidate(raw: string): unknown | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed.length === 0) return null

  const unfenced = stripCodeFences(trimmed)
  const direct = tryParse(unfenced)
  if (direct !== undefined) return direct

  const objectStart = unfenced.indexOf('{')
  const objectEnd = unfenced.lastIndexOf('}')
  const arrayStart = unfenced.indexOf('[')
  const arrayEnd = unfenced.lastIndexOf(']')

  const useObject = objectStart !== -1 && objectEnd > objectStart
  const useArray = arrayStart !== -1 && arrayEnd > arrayStart

  // 取更靠前的根结构，避免 `[{"a":1}]` 被当成对象切片。
  if (useObject && (!useArray || objectStart < arrayStart)) {
    const sliced = tryParse(unfenced.slice(objectStart, objectEnd + 1))
    if (sliced !== undefined) return sliced
  }
  if (useArray) {
    const sliced = tryParse(unfenced.slice(arrayStart, arrayEnd + 1))
    if (sliced !== undefined) return sliced
  }
  if (useObject) {
    const sliced = tryParse(unfenced.slice(objectStart, objectEnd + 1))
    if (sliced !== undefined) return sliced
  }

  return null
}

export type StructuredParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string }

/** 提取 + schema 校验。任何失败都以 `reason` 返回，不抛异常。 */
export function parseStructured<T>(raw: string, schema: AIStructuredSchema<T>): StructuredParseResult<T> {
  const candidate = extractJsonCandidate(raw)
  if (candidate === null || candidate === undefined) {
    return { ok: false, reason: 'response did not contain parseable JSON' }
  }
  if (!schema.validate(candidate)) {
    return { ok: false, reason: `JSON did not satisfy schema "${schema.name}"` }
  }
  return { ok: true, data: candidate }
}

/**
 * 解析修复指令：把一次失败的结构化响应反馈给模型，要求重新输出。
 * 这是**解析恢复**，与网络重试是两套机制（ARCHITECTURE_RULES SO-003）。
 */
export function buildRepairMessages(previousRaw: string, schemaName: string, reason: string): AIMessage[] {
  const echoed = previousRaw.slice(0, MAX_ECHOED_RESPONSE_CHARS)
  return [
    {
      role: 'user',
      content: `Your previous response could not be used: ${reason}.

Return ONLY valid JSON that satisfies the "${schemaName}" schema. No markdown fences, no commentary, no explanation.

Previous response:
${echoed}`,
    },
  ]
}
