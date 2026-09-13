import { NextRequest, NextResponse } from 'next/server'
import { getAssistantReplyUseCase } from '@/bootstrap'
import type { AssistantQaTurn } from '@/application/prompts/assistant/qa.prompt'

export async function POST(request: NextRequest) {
  const { messages, query } = (await request.json()) as { messages?: AssistantQaTurn[]; query?: string }

  if (!query && (!messages || messages.length === 0)) {
    return NextResponse.json({ error: 'No query provided' }, { status: 400 })
  }

  try {
    const result = await getAssistantReplyUseCase().execute({ messages, query })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AI Assistant]', msg)
    return NextResponse.json({ reply: `Sorry, I got an error: ${msg}`, wordData: null })
  }
}
