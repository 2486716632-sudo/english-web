import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/* ---- POST ---- */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { theme } = body

    if (!theme || typeof theme !== 'string' || !theme.trim()) {
      return NextResponse.json({ error: 'Missing theme' }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
    }

    // Step 0: Generate English theme key from user input
    const namingResult = await generateThemeKey(theme, apiKey, baseUrl)
    const normalTheme = namingResult.key
    const themeLabel = namingResult.label
    const themeEmoji = namingResult.emoji

    const force = body.force === true

    // Check if theme already exists
    const existing = await prisma.word.count({ where: { theme: normalTheme } })
    if (existing > 0 && !force) {
      return NextResponse.json({ exists: true, theme: normalTheme, count: existing, label: themeLabel, emoji: themeEmoji })
    }

    // Step 1: Generate word list
    const wordList = await generateWordList(theme, normalTheme, apiKey, baseUrl)

    // Step 2: Generate collocations + examples
    const enrichMap = await generateEnrichments(wordList, apiKey, baseUrl)

    // Step 3: Save to DB
    const wordsToCreate = wordList.map(w => ({
      word: w.word.toLowerCase(),
      phonetic: w.phonetic || null,
      partOfSpeech: w.partOfSpeech || '',
      definition: w.definition || '',
      collocations: enrichMap[w.word]?.collocations || null,
      example: enrichMap[w.word]?.example || null,
      exampleZh: enrichMap[w.word]?.exampleZh || null,
      theme: normalTheme,
      difficulty: 'CUSTOM',
      source: 'generated',
    }))

    let createdCount = 0
    for (const w of wordsToCreate) {
      try {
        await prisma.word.create({ data: w })
        createdCount++
      } catch {
        // Skip duplicates silently
      }
    }

    return NextResponse.json({
      created: createdCount,
      theme: normalTheme,
      label: themeLabel,
      emoji: themeEmoji,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[words/themes/generate] Error:', msg)
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 500 })
  }
}

/** Step 0: Generate a clean English theme key + label from user input */
async function generateThemeKey(
  userInput: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ key: string; label: string; emoji: string }> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You generate English theme keys for vocabulary packs. Respond ONLY with a JSON object: {"key":"short-kebab-case-key","label":"Human Readable Name","emoji":"🎯"}. key must be 1-3 lowercase words joined by hyphens, label is the display name, emoji is a single relevant emoji.',
        },
        { role: 'user', content: `Generate a theme key for: "${userInput}"` },
      ],
      max_tokens: 128,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek naming HTTP ${res.status}`)
  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content || ''
  const fb = content.indexOf('{')
  const lb = content.lastIndexOf('}')
  if (fb === -1 || lb <= fb) throw new Error('Failed to parse theme name')
  const result = JSON.parse(content.slice(fb, lb + 1))
  return {
    key: (result.key || 'custom').toLowerCase().replace(/\s+/g, '-'),
    label: result.label || result.key || 'Custom',
    emoji: result.emoji || '📦',
  }
}

/** Step 1: Generate vocabulary list */
async function generateWordList(
  rawInput: string,
  normalTheme: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ word: string; phonetic: string; partOfSpeech: string; definition: string }[]> {
  const systemPrompt = `You are an English vocabulary expert. Generate vocabulary for a given theme.

For each word provide:
- word
- phonetic (IPA in /slashes/)
- partOfSpeech (short: v./n./adj./adv./prep./pron./conj./interj.)
- definition (Chinese meaning, semicolon-separated if multiple)

Output ONLY a JSON array with this structure:
[
  { "word": "example", "phonetic": "/ɪɡˈzæmpəl/", "partOfSpeech": "n.", "definition": "例子；榜样" }
]

CRITICAL RULE — output ONLY words that ARE the theme, NOT words related to the theme:
- Correct for "colors": red, blue, green (these ARE colors)
- Wrong for "colors": brightness, shade, pigment, spectrum, hue (these are NOT colors, they are color-related concepts)
- Correct for "kitchen": stove, fridge, microwave (these ARE kitchen items)
- Wrong for "kitchen": cook, bake, meal (these are kitchen-related actions/things, NOT kitchen items)
- Correct for "car": steering wheel, seatbelt, trunk (these ARE car parts)
- Wrong for "car": drive, highway, commute (these are driving-related, NOT car parts)

OTHER RULES:
- Start with the most common/foundational words for this theme, then progress to more specialized terms — ORDER MATTERS, learners see the list in this order
- Every word must be specific and concrete — avoid generic words
- Include a mix of nouns, verbs, and adjectives where appropriate
- Generate 35-45 words total`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000)

  let content = ''
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Theme: "${rawInput}"\n\nGenerate 35-45 specific vocabulary words for this theme. Remember: output ONLY words that ARE ${rawInput}, not words about or related to ${rawInput}. Order from most common to most specialized.` },
        ],
        max_tokens: 8192,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
    const data = await res.json()
    content = data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timeoutId)
  }

  if (!content) throw new Error('Empty response from word generation')

  const fb = content.indexOf('[')
  const lb = content.lastIndexOf(']')
  if (fb === -1 || lb <= fb) throw new Error('Failed to parse word list JSON')

  const wordList = JSON.parse(content.slice(fb, lb + 1))
  if (!Array.isArray(wordList) || wordList.length < 5) throw new Error('AI returned too few words')
  return wordList
}

/** Step 2: Generate collocations + examples */
async function generateEnrichments(
  wordList: { word: string }[],
  apiKey: string,
  baseUrl: string,
): Promise<Record<string, { collocations: string; example: string; exampleZh: string }>> {
  const wordNames = wordList.map(w => w.word).join(', ')
  const prompt = `For each of these English words: ${wordNames}

Generate collocations (2-3 common collocations per word) and example sentences (2 per word, paired EN + ZH).

Output ONLY a JSON object where keys are words and values have:
{
  "collocations": "collocation1 中文1, collocation2 中文2, collocation3 中文3",
  "example": "English sentence 1. ||| English sentence 2.",
  "exampleZh": "中文翻译1 ||| 中文翻译2"
}

Rules:
- Collocations: common, natural pairings
- Examples: practical sentences for intermediate learners
- example: EN only, separated by |||
- exampleZh: ZH only, separated by |||
- Collocations format: "english phrase 中文"`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  let content = ''
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an English learning content generator. Output ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 12000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`DeepSeek enrichment HTTP ${res.status}`)
    const data = await res.json()
    content = data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timeoutId)
  }

  let enrichMap: Record<string, { collocations: string; example: string; exampleZh: string }> = {}
  if (content) {
    const fb = content.indexOf('{')
    const lb = content.lastIndexOf('}')
    if (fb !== -1 && lb > fb) {
      try { enrichMap = JSON.parse(content.slice(fb, lb + 1)) } catch { /* empty */ }
    }
  }
  return enrichMap
}
