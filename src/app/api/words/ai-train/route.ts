import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wordId } = body

    if (typeof wordId !== 'number') {
      return NextResponse.json({ error: 'Invalid wordId' }, { status: 400 })
    }

    const word = await prisma.word.findUnique({ where: { id: wordId } })
    if (!word) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
    }

    const systemPrompt = `You are a native English dialogue writer. Given a vocabulary word, generate a short, hyper-natural spoken dialogue that demonstrates the word in context.

Output ONLY valid JSON with this structure:
{
  "dialogue": "A: ...\nB: ...\nA: ...",
  "aiTips": "一句中文口语妙招点拨，点出这个词在实际对话中的使用精髓"
}

Rules:
- Dialogue must feel like real American TV/movie dialogue, not textbook English.
- The word must appear naturally in the dialogue (can be used by either speaker).
- Keep dialogue 3-6 lines total, short and punchy.
- aiTips must be ONE sentence in Chinese, offering a practical speaking tip.`

    const userPrompt = `Word: "${word.word}"
Part of speech: ${word.partOfSpeech}
Definition: ${word.definition}
Example: ${word.example || '(no example)'}

Generate a native spoken dialogue featuring this word.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1024,
          temperature: 0.85,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || ''

      if (!content) {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 })
      }

      const firstBrace = content.indexOf('{')
      const lastBrace = content.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace <= firstBrace) {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
      }

      const result = JSON.parse(content.slice(firstBrace, lastBrace + 1))
      return NextResponse.json({
        dialogue: result.dialogue || '',
        aiTips: result.aiTips || '',
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[words/ai-train] Error:', msg)
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 502 })
  }
}
