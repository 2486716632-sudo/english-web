import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DS_TIMEOUT = 30_000

async function enrichWord(word: string): Promise<{
  phonetic: string | null
  partOfSpeech: string | null
  definition: string | null
  collocations: string | null
  examples: { en: string; zh: string }[]
} | null> {
  if (!DEEPSEEK_API_KEY) return null

  const escaped = word.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const prompt = `You are an IELTS vocabulary expert. Generate complete learning data for the given word.

Return ONLY valid JSON — a single object. No other text.

{
  "word": "${escaped}",
  "phonetic": "/IPA/",
  "partOfSpeech": "v./n./adj./adv.",
  "definition": "中文释义",
  "collocations": "collocation1 中文1, collocation2 中文2, collocation3 中文3",
  "examples": [
    { "en": "example sentence.", "zh": "翻译" },
    { "en": "another example.", "zh": "翻译" },
    { "en": "a third example.", "zh": "翻译" }
  ]
}

Rules:
- Phonetic must be accurate IPA enclosed in //
- Part of speech: v., n., adj., adv., prep., etc.
- Definition in Chinese
- 3 collocations with Chinese
- 3 example sentences covering different usages
- ALWAYS valid JSON only — no markdown, no explanation`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DS_TIMEOUT)

  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: word },
        ],
        max_tokens: 2048,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!res.ok) return null

    const data = await res.json()
    const content: string = data.choices?.[0]?.message?.content || ''

    const objStart = content.indexOf('{')
    const objEnd = content.lastIndexOf('}')
    if (objStart === -1 || objEnd <= objStart) return null

    const parsed = JSON.parse(content.slice(objStart, objEnd + 1))
    return {
      phonetic: parsed.phonetic || null,
      partOfSpeech: parsed.partOfSpeech || null,
      definition: parsed.definition || null,
      collocations: parsed.collocations || null,
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

async function addVocabToSrs(vocab: {
  id: number; word: string; phonetic: string | null; partOfSpeech: string | null;
  definition: string; contextSentence: string; example: string | null; exampleZh: string | null;
}) {
  const existingWord = await prisma.word.findFirst({
    where: { word: vocab.word },
  })

  let wordId: number
  if (existingWord) {
    wordId = existingWord.id
    const existingReview = await prisma.wordReview.findUnique({ where: { wordId } })
    if (!existingReview) {
      await prisma.wordReview.create({
        data: { wordId, interval: 0, easiness: 2.5, repetitions: 0, nextReviewAt: new Date(new Date().setHours(0, 0, 0, 0)) },
      })
    }
  } else {
    // Generate collocations + examples via DeepSeek
    const enriched = await enrichWord(vocab.word)
    const exampleParts: string[] = []
    const exampleZhParts: string[] = []

    if (enriched && enriched.examples.length > 0) {
      for (const ex of enriched.examples) {
        if (ex.en) exampleParts.push(ex.en)
        if (ex.zh) exampleZhParts.push(ex.zh)
      }
    } else {
      exampleParts.push(vocab.contextSentence)
      if (vocab.example) exampleParts.push(vocab.example)
      if (vocab.exampleZh) exampleZhParts.push(vocab.exampleZh)
    }

    const newWord = await prisma.word.create({
      data: {
        word: vocab.word,
        phonetic: enriched?.phonetic || vocab.phonetic || null,
        partOfSpeech: enriched?.partOfSpeech || vocab.partOfSpeech || 'unknown',
        definition: enriched?.definition || vocab.definition,
        collocations: enriched?.collocations || null,
        example: exampleParts.join(' ||| '),
        exampleZh: exampleZhParts.length > 0 ? exampleZhParts.join(' ||| ') : null,
        difficulty: 'IELTS',
        source: 'ielts',
      },
    })
    wordId = newWord.id

    await prisma.wordReview.create({
      data: { wordId, interval: 0, easiness: 2.5, repetitions: 0, nextReviewAt: new Date() },
    })
  }

  await prisma.articleVocab.update({
    where: { id: vocab.id },
    data: { addedToReview: true },
  })

  return wordId
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const articleId = parseInt(id, 10)
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 })
    }

    const body = await request.json()
    const { vocabId, vocabIds } = body

    // Batch mode
    if (vocabIds && Array.isArray(vocabIds)) {
      const results: number[] = []
      for (const vid of vocabIds) {
        const v = await prisma.articleVocab.findUnique({ where: { id: vid } })
        if (!v || v.addedToReview) continue
        const wordId = await addVocabToSrs(v)
        results.push(wordId)
      }
      return NextResponse.json({ success: true, count: results.length, wordIds: results })
    }

    // Single mode
    if (!vocabId) {
      return NextResponse.json({ error: 'Missing vocabId or vocabIds' }, { status: 400 })
    }

    const vocab = await prisma.articleVocab.findUnique({ where: { id: vocabId } })
    if (!vocab) {
      return NextResponse.json({ error: 'Vocab not found' }, { status: 404 })
    }
    if (vocab.addedToReview) {
      return NextResponse.json({ message: 'Already added to review' })
    }

    const wordId = await addVocabToSrs(vocab)
    return NextResponse.json({ success: true, wordId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reading/vocab] Error:', msg)
    return NextResponse.json({ error: 'Failed to add vocab', detail: msg }, { status: 500 })
  }
}
