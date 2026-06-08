import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const mastered = await prisma.wordReview.findMany({
    where: { isMastered: true },
    include: { word: true },
    orderBy: { updatedAt: 'desc' },
  })

  const words = mastered.map((r) => ({
    id: r.word.id,
    word: r.word.word,
    phonetic: r.word.phonetic,
    partOfSpeech: r.word.partOfSpeech,
    definition: r.word.definition,
    masteredAt: r.updatedAt,
  }))

  return NextResponse.json({ words, total: words.length })
}
