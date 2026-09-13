// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — trace 输出安全策略（redaction / 长度上限 / 类型收敛）

import type { RecordErrorOptions, TraceErrorInfo, TraceMetadata, TraceMetadataValue } from '@/application/ports/trace'

/**
 * 敏感数据策略的执行点（Phase 5 任务文档 Part 11）。
 *
 * 为什么放在 Infrastructure：
 *  - Application 侧的 metadata 契约本身已经是 metadata-first（只有计数、尺寸、标识符、标签），
 *    但"数据离开进程"的边界在 adapter 上，所以清洗必须在这里执行（defense in depth）
 *  - 两个 recorder（内存 / console）共用同一份策略，行为一致且可测试
 *
 * 策略：
 *  1. 键名命中禁用集合 → **整条丢弃**（不是脱敏，而是根本不采集）。判定对
 *     「整体键名」（`apiKey` → `apikey`）与「命名空间分段」（`label.prompt` → 段 `prompt`）都生效，
 *     因此给内容型键加前缀无法绕过（外部审核 v1 阻断问题 B-01）
 *  2. 值只允许 string / number / boolean / null；其余（对象、数组、函数、undefined、NaN）丢弃
 *  3. 字符串先做密钥模式替换（Bearer / sk- / 连接串 / password= / api_key= ...），再截断到长度上限
 *  4. 错误摘要只保留归一化字段（code / name / 安全 message / operation / retryable / provider / status），
 *     **绝不**保留 stack trace（见 TRACE_DESIGN.md §10）
 */

export const REDACTED = '[redacted]'
export const MAX_METADATA_STRING_LENGTH = 200
export const MAX_ERROR_MESSAGE_LENGTH = 300

/** 规范化键名：小写并去掉非字母数字字符（`apiKey` / `api_key` / `api-key` → `apikey`）。 */
export function normalizeMetadataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * 拆分命名空间键（`label.prompt` → `['label', 'prompt']`；`payload.api_key` → `['payload', 'apikey']`）。
 *
 * 为什么需要：键名可能是**带命名空间**的（`label.*` / `payload.*` / 任意 `a.b.c`），
 * 而 `normalizeMetadataKey('label.prompt')` = `labelprompt` —— 整体精确匹配不会命中 `prompt`。
 * 因此除"整体键名"外，还要按段独立判定（见 Phase 5 外部审核 v1 阻断问题 B-01）。
 */
export function metadataKeySegments(key: string): string[] {
  return key
    // 只按"真正的命名空间分隔符"切段（点 / 空格 / 斜杠 / 冒号 …）；
    // `_` 与 `-` 视为词内字符（与 camelCase 规范化一致），避免 `lookup_key` 被误拆成 `key`。
    .split(/[^A-Za-z0-9_-]+/)
    .map((segment) => normalizeMetadataKey(segment))
    .filter((segment) => segment.length > 0)
}

/** 精确命中的禁用键（规范化后比较）。 */
const FORBIDDEN_EXACT_KEYS: ReadonlySet<string> = new Set([
  // 凭据
  'apikey',
  'key',
  'secret',
  'secretkey',
  'clientsecret',
  'token',
  'accesstoken',
  'authtoken',
  'refreshtoken',
  'sessiontoken',
  'bearertoken',
  'password',
  'passwd',
  'pwd',
  'credential',
  'credentials',
  // 传输头
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'setcookie',
  'header',
  'headers',
  'requestheaders',
  'responseheaders',
  // 数据库 / 环境
  'databaseurl',
  'dburl',
  'connectionstring',
  'dsn',
  'env',
  'environment',
  'envvars',
  'processenv',
  // 内容（默认不采集）
  'prompt',
  'prompts',
  'systemprompt',
  'message',
  'messages',
  'usermessage',
  'usermessages',
  'content',
  'contents',
  'requestbody',
  'responsebody',
  'body',
  'raw',
  'rawrequest',
  'rawresponse',
  'output',
  'modeloutput',
  'completion',
  'text',
  'usertext',
  'articletext',
  'textcontent',
  'html',
  'htmlcontent',
  'query',
  'reply',
  // 堆栈
  'stack',
  'stacktrace',
  'cause',
])

/** 片段命中的高风险键（覆盖 `DEEPSEEK_API_KEY` 这类组合键名）。 */
const FORBIDDEN_KEY_FRAGMENTS: readonly string[] = [
  'apikey',
  'authorization',
  'authheader',
  'password',
  'passwd',
  'secret',
  'connectionstring',
  'databaseurl',
  'privatekey',
  'sessiontoken',
  'accesstoken',
  'bearertoken',
  'cookie',
]

export function isForbiddenMetadataKey(key: string): boolean {
  const normalized = normalizeMetadataKey(key)
  if (normalized.length === 0) return true
  if (FORBIDDEN_EXACT_KEYS.has(normalized)) return true
  if (FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) return true
  // 命名空间键（如 `label.prompt` / `label.apiKey` / `label.databaseUrl`）逐段判定，
  // 使 `label.prompt` 这类"加前缀绕过"无法逃过禁用集合。
  return metadataKeySegments(key).some((segment) => FORBIDDEN_EXACT_KEYS.has(segment))
}

/** 值层面的密钥模式（顺序重要：先处理最具体的）。 */
const SECRET_VALUE_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, replacement: REDACTED },
  { pattern: /\b(authorization)\s*:\s*[^\s,;]+(\s+[^\s,;]+)?/gi, replacement: '$1: [redacted]' },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, replacement: `Bearer ${REDACTED}` },
  { pattern: /\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, replacement: REDACTED },
  {
    pattern: /\b(postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss):\/\/[^\s"']+/gi,
    replacement: `${REDACTED}-connection-string`,
  },
  {
    pattern: /\b(password|passwd|pwd|api[_-]?key|apikey|token|secret)\s*[:=]\s*[^\s,;"'}&]+/gi,
    replacement: `$1=${REDACTED}`,
  },
]

/** 对文本做密钥模式脱敏（不改变长度以外的语义）。 */
export function redactSecrets(text: string): string {
  let out = text
  for (const { pattern, replacement } of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

/** 折叠空白并截断，保证单行、有界。 */
function compact(text: string, maxLength: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength)}…` : collapsed
}

/** 清洗错误消息：先脱敏，再折叠空白 + 截断。 */
export function sanitizeErrorMessage(message: string): string {
  return compact(redactSecrets(message), MAX_ERROR_MESSAGE_LENGTH)
}

/**
 * 收敛单个 metadata 值。
 * 返回值 `undefined` 表示"丢弃该键"（未定义 / 非法类型 / NaN / Infinity）。
 */
export function sanitizeMetadataValue(value: unknown): TraceMetadataValue | undefined {
  if (value === null) return null
  if (typeof value === 'string') return compact(redactSecrets(value), MAX_METADATA_STRING_LENGTH)
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  return undefined
}

/** 清洗 metadata：丢弃禁用键与非法值。 */
export function sanitizeMetadata(metadata: TraceMetadata | undefined): TraceMetadata {
  if (!metadata) return {}
  const out: TraceMetadata = {}
  for (const [key, rawValue] of Object.entries(metadata)) {
    if (isForbiddenMetadataKey(key)) continue
    const value = sanitizeMetadataValue(rawValue)
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

function readStringField(source: unknown, field: string): string | undefined {
  if (!source || typeof source !== 'object') return undefined
  const value = (source as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

function readNumberField(source: unknown, field: string): number | undefined {
  if (!source || typeof source !== 'object') return undefined
  const value = (source as Record<string, unknown>)[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readBooleanField(source: unknown, field: string): boolean | undefined {
  if (!source || typeof source !== 'object') return undefined
  const value = (source as Record<string, unknown>)[field]
  return typeof value === 'boolean' ? value : undefined
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Error'
  if (typeof error === 'string') return error
  if (typeof error === 'number' || typeof error === 'boolean') return String(error)
  const message = readStringField(error, 'message')
  if (message) return message
  return '[non-error thrown]'
}

/**
 * 把任意抛出物归一化为 trace 错误摘要。
 * **不采集** stack、原始对象、cause 链；只保留安全的归一化字段。
 */
export function toTraceErrorInfo(error: unknown, options: RecordErrorOptions = {}): TraceErrorInfo {
  const name =
    error instanceof Error
      ? error.name || error.constructor.name || 'Error'
      : readStringField(error, 'name')

  const info: TraceErrorInfo = {
    message: sanitizeErrorMessage(options.safeMessage ?? extractErrorMessage(error)),
  }

  const code = options.code ?? readStringField(error, 'code')
  if (code) info.code = compact(redactSecrets(code), 60)
  if (name) info.name = name
  if (options.operation) info.operation = options.operation

  const retryable = options.retryable ?? readBooleanField(error, 'retryable')
  if (retryable !== undefined) info.retryable = retryable

  const provider = options.provider ?? readStringField(error, 'provider')
  if (provider) info.provider = provider

  const status = options.status ?? readNumberField(error, 'status')
  if (status !== undefined) info.status = status

  return info
}
