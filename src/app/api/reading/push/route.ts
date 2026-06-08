import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, titleZh, url, imageUrl, source, sourceEmoji, content, summary, summaryEn, difficulty, tags, vocabItems } = body

    if (!title || !content || !summary) {
      return NextResponse.json({ error: 'Missing required fields: title, content, summary' }, { status: 400 })
    }

    const article = await prisma.article.create({
      data: {
        title,
        titleZh: titleZh || null,
        url: url || null,
        imageUrl: imageUrl || null,
        source: source || 'Unknown',
        sourceEmoji: sourceEmoji || '📰',
        content,
        summary,
        summaryEn: summaryEn || null,
        difficulty: difficulty || 3,
        tags: tags || '',
        vocabItems: {
          create: (vocabItems || []).map((v: {
            word: string; type: string; partOfSpeech?: string; phonetic?: string;
            definition: string; contextSentence: string; example?: string; exampleZh?: string;
          }) => ({
            word: v.word,
            type: v.type || 'word',
            partOfSpeech: v.partOfSpeech || null,
            phonetic: v.phonetic || null,
            definition: v.definition,
            contextSentence: v.contextSentence,
            example: v.example || null,
            exampleZh: v.exampleZh || null,
          })),
        },
      },
      include: { vocabItems: true },
    })

    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reading/push] Error:', msg)
    return NextResponse.json({ error: 'Push failed', detail: msg }, { status: 500 })
  }
}
