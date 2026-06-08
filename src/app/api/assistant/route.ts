import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { messages, query } = await request.json()

  if (!query && (!messages || messages.length === 0)) {
    return NextResponse.json({ error: 'No query provided' }, { status: 400 })
  }

  // Try to find a matching word in the DB
  const lastQuery = (query || messages?.[messages.length - 1]?.content || '').trim()
  const firstWord = lastQuery.split(/[\s,，.。!！?？]+/)[0]?.replace(/[^a-zA-Z-]/g, '') || ''
  let wordData: Record<string, unknown> | null = null

  if (firstWord.length > 0) {
    const found = await prisma.word.findFirst({
      where: { word: firstWord.toLowerCase() },
    })
    if (found) {
      wordData = {
        word: found.word,
        phonetic: found.phonetic,
        partOfSpeech: found.partOfSpeech,
        definition: found.definition,
        collocations: found.collocations,
        example: found.example,
        exampleZh: found.exampleZh,
      }
    }
  }

  // Build system prompt
  let systemContent = `You are an English learning assistant integrated into a vocabulary app. Your role is to help users learn English vocabulary, grammar, and expressions.

## How to respond based on user intent:

### 1. Word lookup (user types a word like "disorder" or "abide by")
   - Show: word, phonetic (in /slashes/), part of speech, Chinese definition
   - Include common collocations with Chinese translations
   - Provide 1-2 example sentences (EN + ZH)
   - Keep it structured and scannable

### 2. "How do I say X in English" / translation requests
   - Give the most natural English equivalent, not literal translation
   - Explain briefly why this expression works
   - Offer 1 example sentence

### 3. Grammar / usage questions
   - Explain clearly and concisely
   - Use examples to illustrate

### 4. General questions about English
   - Answer directly and helpfully

## Style guidelines:
- Be concise but thorough. Use line breaks for readability.
- For word lookups, start with the word itself, then phonetic, then definition.
- Use Chinese for explanations where helpful, but always show English examples.
- Do NOT use markdown formatting like **bold** or lists — use plain text with line breaks.`

  if (wordData) {
    systemContent += `\n\n## Word data found in database (use this as the primary source):\n`
    systemContent += `Word: ${wordData.word}\n`
    systemContent += `Phonetic: ${wordData.phonetic || 'N/A'}\n`
    systemContent += `Part of speech: ${wordData.partOfSpeech}\n`
    systemContent += `Definition: ${wordData.definition}\n`
    if (wordData.collocations) systemContent += `Collocations: ${wordData.collocations}\n`
    if (wordData.example) systemContent += `Example: ${wordData.example}\n`
    if (wordData.exampleZh) systemContent += `Example ZH: ${wordData.exampleZh}\n`
    systemContent += `\nPresent this information clearly. If the example contains " ||| " separators, treat each segment as a separate sentence.`
  }

  // Call DeepSeek
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    // Map 'ai' role to 'assistant' (DeepSeek/OpenAI format)
    const mappedMessages = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }))

    const deepseekMessages = [
      { role: 'system', content: systemContent },
      ...mappedMessages,
    ]

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: deepseekMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`DeepSeek HTTP ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || ''

    return NextResponse.json({ reply, wordData })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AI Assistant]', msg)
    return NextResponse.json({ reply: `Sorry, I got an error: ${msg}`, wordData: null })
  } finally {
    clearTimeout(timeoutId)
  }
}
