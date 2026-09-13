import { NextRequest, NextResponse } from 'next/server'
import { getAssistantReplyUseCase } from '@/bootstrap'
import { getTraceRecorder } from '@/bootstrap/trace-composition'
import { runInTrace } from '@/application/observability/trace-helpers'
import type { AssistantQaTurn } from '@/application/prompts/assistant/qa.prompt'

/**
 * `POST /api/assistant` —— 传输层：解析请求、调用 Application Use Case、格式化响应。
 *
 * Phase 5 追加（仅可观测性，不改变行为）：
 *  - 本次请求的 root trace = `http.assistant`（category `http`），在 `X-Trace-Id` 响应头回传 traceId
 *  - JSON 响应体结构**未改变**；失败时的友好 200 回退行为**未改变**
 *  - 失败请求仍把 trace 标记为失败（`error` + 归一化错误码），便于事后定位
 */
export async function POST(request: NextRequest) {
  return runInTrace(
    getTraceRecorder(),
    'http.assistant',
    {
      category: 'http',
      metadata: { 'http.method': 'POST', 'http.route': '/api/assistant' },
    },
    async (trace) => {
      const { messages, query } = (await request.json()) as {
        messages?: AssistantQaTurn[]
        query?: string
      }

      trace.addMetadata({ 'assistant.messageCount': messages?.length ?? 0 })

      if (!query && (!messages || messages.length === 0)) {
        trace.recordError(new Error('No query provided'), {
          code: 'invalid_request',
          operation: 'http.assistant.validate',
        })
        trace.end('error', { metadata: { 'http.status': 400 } })
        return withTraceId(NextResponse.json({ error: 'No query provided' }, { status: 400 }), trace.traceId)
      }

      try {
        const result = await getAssistantReplyUseCase().execute({ messages, query }, { trace })
        trace.end('ok', {
          metadata: { 'http.status': 200, 'assistant.wordFound': result.wordData !== null },
        })
        return withTraceId(NextResponse.json(result), trace.traceId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        // 用户可见行为不变：仍然是 200 + 友好文案；但 trace 如实记录失败。
        trace.recordError(err, { operation: 'assistant.qa' })
        trace.recordEvent('assistant.fallback', { metadata: { 'http.status': 200 } })
        trace.end('error', { metadata: { 'http.status': 200, 'http.outcome': 'friendly_fallback' } })
        console.error('[AI Assistant]', msg)
        return withTraceId(
          NextResponse.json({ reply: `Sorry, I got an error: ${msg}`, wordData: null }),
          trace.traceId,
        )
      }
    },
  )
}

/** 在不改变响应体的前提下回传 traceId，便于把用户报告关联到 trace。 */
function withTraceId(response: NextResponse, traceId: string): NextResponse {
  response.headers.set('X-Trace-Id', traceId)
  return response
}
