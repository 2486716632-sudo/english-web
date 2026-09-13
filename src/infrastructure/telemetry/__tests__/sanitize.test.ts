import { describe, it, expect } from 'vitest'
import { AIError } from '@/application/ports/ai-client'
import { ApplicationError } from '@/application/errors'
import {
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_METADATA_STRING_LENGTH,
  isForbiddenMetadataKey,
  metadataKeySegments,
  normalizeMetadataKey,
  redactSecrets,
  sanitizeErrorMessage,
  sanitizeMetadata,
  sanitizeMetadataValue,
  toTraceErrorInfo,
} from '@/infrastructure/telemetry/sanitize'

/**
 * 敏感数据策略（Phase 5 任务文档 Part 11 / Part 13 第 11–12 项）。
 * 全部为纯函数测试：不访问网络、不访问文件系统。
 */

describe('sanitize — 键名策略', () => {
  it('规范化键名（大小写 / 下划线 / 连字符 / 点号）', () => {
    expect(normalizeMetadataKey('apiKey')).toBe('apikey')
    expect(normalizeMetadataKey('api_key')).toBe('apikey')
    expect(normalizeMetadataKey('API-KEY')).toBe('apikey')
    expect(normalizeMetadataKey('http.route')).toBe('httproute')
  })

  it('命名空间键被拆分为分段（用于逐段判定）', () => {
    expect(metadataKeySegments('label.prompt')).toEqual(['label', 'prompt'])
    expect(metadataKeySegments('payload.api_key')).toEqual(['payload', 'apikey'])
    expect(metadataKeySegments('ai.request.promptChars')).toEqual([
      'ai',
      'request',
      'promptchars',
    ])
    // 词内 `_` / `-` 不切段：避免 `lookup_key` 被误拆出 `key` 造成误伤
    expect(metadataKeySegments('assistant.lookup_key_length')).toEqual([
      'assistant',
      'lookupkeylength',
    ])
    expect(metadataKeySegments('__')).toEqual([])
  })

  it.each([
    'apiKey',
    'api_key',
    'DEEPSEEK_API_KEY',
    'authorization',
    'Authorization',
    'cookie',
    'set-cookie',
    'databaseUrl',
    'DATABASE_URL',
    'connectionString',
    'password',
    'sessionToken',
    'secret',
    'prompt',
    'systemPrompt',
    'messages',
    'userMessage',
    'content',
    'textContent',
    'rawResponse',
    'output',
    'completion',
    'query',
    'stack',
    'stackTrace',
    'cause',
    'processEnv',
    '',
  ])('禁用键 %s 被判为不可采集', (key) => {
    expect(isForbiddenMetadataKey(key)).toBe(true)
  })

  it.each([
    'useCase',
    'label.promptVersion',
    'ai.request.promptChars',
    'ai.request.messageCount',
    'ai.usage.totalTokens',
    'article.contentLength',
    'article.index',
    'reading.pushed',
    'http.route',
    'http.status',
    'feed.itemCount',
    'outcome',
    'ai.finishReason',
  ])('允许的元数据键 %s 被保留', (key) => {
    expect(isForbiddenMetadataKey(key)).toBe(false)
  })

  /**
   * 外部审核 v1 阻断问题 B-01：给内容型键加 `label.` 命名空间前缀**不能**绕过禁用集合
   * （`normalizeMetadataKey('label.prompt')` = `labelprompt`，整体精确匹配不会命中 `prompt`）。
   */
  it.each([
    'label.prompt',
    'label.query',
    'label.message',
    'label.messages',
    'label.content',
    'label.output',
    'label.completion',
    'label.text',
    'label.userText',
    'label.requestBody',
    'label.responseBody',
    'label.rawResponse',
    'label.apiKey',
    'label.authorization',
    'label.databaseUrl',
    'payload.content',
    'nested.deep.prompt',
    'label.cookie',
    'label.secret',
  ])('命名空间键 %s 仍被判定为不可采集', (key) => {
    expect(isForbiddenMetadataKey(key)).toBe(true)
  })

  it.each([
    'label.useCase',
    'label.step',
    'label.promptVersion',
    'ai.request.promptChars',
    'ai.request.messageCount',
    'ai.response.chars',
    'article.contentLength',
    'article.index',
    'reading.payload.vocabCount',
    'assistant.lookupKeyLength',
    'trace.openSpanCount',
    'reading.feed_count',
    'ai.request.max_tokens',
  ])('安全的命名空间键 %s 不被误伤', (key) => {
    expect(isForbiddenMetadataKey(key)).toBe(false)
  })
})

describe('sanitize — metadata 清洗', () => {
  it('丢弃禁用键，保留可安全序列化的原始值', () => {
    const sanitized = sanitizeMetadata({
      apiKey: 'sk-live-abcdefghijklmnop',
      authorization: 'Bearer abc.def.ghi',
      prompt: 'Ignore previous instructions…',
      content: 'full article text',
      'article.index': 3,
      'article.hasImage': true,
      'http.status': 200,
      'reading.deleted': 0,
    })

    expect(sanitized).toEqual({
      'article.index': 3,
      'article.hasImage': true,
      'http.status': 200,
      'reading.deleted': 0,
    })
  })

  it('丢弃对象 / 数组 / 函数 / undefined / NaN / Infinity', () => {
    const sanitized = sanitizeMetadata({
      object: { a: 1 } as unknown as string,
      array: [1, 2] as unknown as string,
      fn: (() => {}) as unknown as string,
      missing: undefined,
      nan: Number.NaN,
      infinite: Number.POSITIVE_INFINITY,
      nil: null,
    })

    expect(sanitized).toEqual({ nil: null })
    expect(sanitizeMetadataValue({ a: 1 })).toBeUndefined()
    expect(sanitizeMetadataValue(Number.NaN)).toBeUndefined()
    expect(sanitizeMetadataValue(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(sanitizeMetadataValue('ok')).toBe('ok')
    expect(sanitizeMetadataValue(false)).toBe(false)
    expect(sanitizeMetadataValue(null)).toBeNull()
  })

  it('超长字符串被截断到上限', () => {
    const long = 'a'.repeat(MAX_METADATA_STRING_LENGTH + 50)
    const value = sanitizeMetadataValue(long) as string

    expect(value.length).toBeLessThanOrEqual(MAX_METADATA_STRING_LENGTH + 1)
    expect(value.endsWith('…')).toBe(true)
  })

  it('值中的密钥模式被脱敏（即使键名看起来无害）', () => {
    const sanitized = sanitizeMetadata({
      note: 'using postgresql://user:s3cret@db.example.com:5432/app for persistence',
      detail: 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      connection: 'password=hunter2 host=db',
      exported: 'exported key sk-live-0123456789abcdef',
    })

    const serialized = JSON.stringify(sanitized)
    expect(serialized).not.toContain('s3cret')
    expect(serialized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain('sk-live-0123456789abcdef')
    expect(serialized).toContain('[redacted]')
  })

  it('空 metadata 与 undefined 都返回空对象', () => {
    expect(sanitizeMetadata(undefined)).toEqual({})
    expect(sanitizeMetadata({})).toEqual({})
  })

  /**
   * 外部审核 v1 阻断问题 B-01（第 7 项）：即使调用方直接把 `label.*` 命名空间写进
   * 通用 trace metadata，内容型 / 凭据型键也必须被整条丢弃；安全的标签仍然保留。
   */
  it('label.* 命名空间下的内容型 / 凭据型键被丢弃，安全标签保留', () => {
    const sanitized = sanitizeMetadata({
      'label.prompt': 'SECRET_PROMPT_TEXT',
      'label.query': 'USER_QUERY_TEXT',
      'label.message': 'USER_MESSAGE_TEXT',
      'label.content': 'USER_CONTENT_TEXT',
      'label.output': 'MODEL_OUTPUT_TEXT',
      'label.text': 'RAW_TEXT',
      'label.apiKey': 'sk-live-0123456789abcdef',
      'label.authorization': 'Bearer abc.def.ghi',
      'label.databaseUrl': 'postgresql://u:p@h/db',
      'label.useCase': 'reading.ingest',
      'label.step': 'process-article',
      'label.promptVersion': '1.0',
    })

    expect(sanitized).toEqual({
      'label.useCase': 'reading.ingest',
      'label.step': 'process-article',
      'label.promptVersion': '1.0',
    })

    const serialized = JSON.stringify(sanitized)
    for (const marker of [
      'SECRET_PROMPT_TEXT',
      'USER_QUERY_TEXT',
      'USER_MESSAGE_TEXT',
      'USER_CONTENT_TEXT',
      'MODEL_OUTPUT_TEXT',
      'RAW_TEXT',
      'sk-live-0123456789abcdef',
      'abc.def.ghi',
      'postgresql://u:p@h/db',
    ]) {
      expect(serialized).not.toContain(marker)
    }
  })
})

describe('sanitize — redactSecrets / 错误消息', () => {
  it.each([
    ['postgres://u:p@h/db', '[redacted]-connection-string'],
    ['postgresql://u:p@h/db', '[redacted]-connection-string'],
    ['mongodb://u:p@h/db', '[redacted]-connection-string'],
  ])('连接串 %s 被替换', (input, expected) => {
    expect(redactSecrets(input)).toContain(expected)
  })

  it('Bearer token / sk- 密钥 / password= 都被替换', () => {
    expect(redactSecrets('Bearer abc123def456')).toBe('Bearer [redacted]')
    expect(redactSecrets('key sk-abcdefgh12345678')).toBe('key [redacted]')
    expect(redactSecrets('password=hunter2')).toBe('password=[redacted]')
  })

  it('普通文本不被改动', () => {
    expect(redactSecrets('DeepSeek HTTP 500: upstream unavailable')).toBe(
      'DeepSeek HTTP 500: upstream unavailable',
    )
  })

  it('错误消息折叠为单行并截断', () => {
    const message = sanitizeErrorMessage(`line1\nline2\t${'x'.repeat(1000)}`)

    expect(message).not.toContain('\n')
    expect(message.length).toBeLessThanOrEqual(MAX_ERROR_MESSAGE_LENGTH + 1)
  })
})

describe('sanitize — 错误归一化', () => {
  it('AIError → code / provider / retryable / status，且不含 stack', () => {
    const error = new AIError('rate_limited', 'DeepSeek HTTP 429: slow down', {
      status: 429,
      provider: 'deepseek',
    })

    const info = toTraceErrorInfo(error, { operation: 'ai.call' })

    expect(info).toEqual({
      code: 'rate_limited',
      name: 'AIError',
      message: 'DeepSeek HTTP 429: slow down',
      operation: 'ai.call',
      retryable: true,
      provider: 'deepseek',
      status: 429,
    })
    expect(Object.keys(info)).not.toContain('stack')
    expect(JSON.stringify(info)).not.toContain('at ')
  })

  it('ApplicationError → code 与安全 message', () => {
    const error = new ApplicationError('feed_unavailable', 'Get https://feed.test/tech failed')

    const info = toTraceErrorInfo(error, { operation: 'reading.ingest' })

    expect(info).toMatchObject({
      code: 'feed_unavailable',
      name: 'ApplicationError',
      message: 'Get https://feed.test/tech failed',
      operation: 'reading.ingest',
    })
  })

  it('底层错误里的连接串被脱敏（不泄漏数据库凭据）', () => {
    const error = new Error('connect ECONNREFUSED postgresql://neondb_owner:hunter2@host/db')

    const info = toTraceErrorInfo(error)

    expect(info.message).not.toContain('hunter2')
    expect(info.message).toContain('[redacted]-connection-string')
  })

  it('非 Error 抛出物也能安全归一化', () => {
    expect(toTraceErrorInfo('plain string failure').message).toBe('plain string failure')
    expect(toTraceErrorInfo(42).message).toBe('42')
    expect(toTraceErrorInfo({ message: 'object shaped failure' }).message).toBe(
      'object shaped failure',
    )
    expect(toTraceErrorInfo({}).message).toBe('[non-error thrown]')
    expect(toTraceErrorInfo(null).message).toBe('[non-error thrown]')
  })

  it('safeMessage 覆盖默认消息（调用方可显式提供安全文案）', () => {
    const error = new Error('raw internal detail')

    const info = toTraceErrorInfo(error, { safeMessage: 'safe summary', code: 'invalid_ai_payload' })

    expect(info.message).toBe('safe summary')
    expect(info.code).toBe('invalid_ai_payload')
  })
})
