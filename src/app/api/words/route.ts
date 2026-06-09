import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sm2 } from '@/lib/sm2'
import { Prisma } from '@/generated/prisma/client'

const DEFAULT_DAILY_TARGET = 15

export async function GET(request: NextRequest) {
  const now = new Date()
  const { searchParams } = new URL(request.url)
  const queue = searchParams.get('queue')
  const theme = searchParams.get('theme')
  const DAILY_TARGET = Math.min(Math.max(Number(searchParams.get('dailyTarget')) || DEFAULT_DAILY_TARGET, 1), 100)

  // Theme mode: return all words for a theme, no SRS filtering
  if (theme) {
    const words = await prisma.word.findMany({
      where: { theme },
      orderBy: { word: 'asc' },
    })
    shuffleArray(words)
    const result = words.map((w) => ({ ...w, review: null }))
    return NextResponse.json({
      words: result,
      total: result.length,
      theme,
    })
  }

  const allReviewedIds = await prisma.wordReview.findMany({
    select: { wordId: true },
  })
  const excludeIds = new Set(allReviewedIds.map((r) => r.wordId))

  if (queue === 'new') {
    const excludeArr = [...excludeIds]
    const fresh = await prisma.$queryRaw<Array<{ id: number; word: string; phonetic: string | null; partOfSpeech: string; definition: string; collocations: string | null; example: string | null; exampleZh: string | null; imageUrl: string | null; theme: string | null; difficulty: string; source: string; createdAt: Date; updatedAt: Date }>>`
      SELECT * FROM "Word"
      WHERE source = 'ielts' AND theme IS NULL
      ${excludeArr.length > 0 ? Prisma.sql`AND id NOT IN (${Prisma.join(excludeArr)})` : Prisma.empty}
      ORDER BY RANDOM()
      LIMIT ${DAILY_TARGET}
    `
    const words = fresh.map((w) => ({ ...w, review: null }))
    const result = words.map(mapWord)
    return NextResponse.json({
      words: result,
      total: result.length,
      reviewCount: 0,
      newCount: result.length,
    })
  }

  if (queue === 'review') {
    const dueReviews = await prisma.wordReview.findMany({
      where: {
        nextReviewAt: { lte: now },
        isMastered: false,
      },
      include: { word: true },
      orderBy: { nextReviewAt: 'asc' },
    })
    const words = dueReviews.map((r) => ({ ...r.word, review: r }))
    const result = words.map(mapWord)
    return NextResponse.json({
      words: result,
      total: result.length,
      reviewCount: result.length,
      newCount: 0,
    })
  }

  // Default: combined queue (unchanged)
  const dueReviews = await prisma.wordReview.findMany({
    where: {
      nextReviewAt: { lte: now },
      isMastered: false,
    },
    include: { word: true },
    orderBy: { nextReviewAt: 'asc' },
  })

  const dueWords = dueReviews.map((r) => ({ ...r.word, review: r }))
  const remaining = Math.max(0, DAILY_TARGET - dueWords.length)

  let newWords: (ReturnType<typeof mapWord>)[] = []

  if (remaining > 0) {
    const excludeArr = [...excludeIds]
    const fresh = await prisma.$queryRaw<Array<{ id: number; word: string; phonetic: string | null; partOfSpeech: string; definition: string; collocations: string | null; example: string | null; exampleZh: string | null; imageUrl: string | null; theme: string | null; difficulty: string; source: string; createdAt: Date; updatedAt: Date }>>`
      SELECT * FROM "Word"
      WHERE source = 'ielts' AND theme IS NULL
      ${excludeArr.length > 0 ? Prisma.sql`AND id NOT IN (${Prisma.join(excludeArr)})` : Prisma.empty}
      ORDER BY RANDOM()
      LIMIT ${remaining}
    `
    newWords = fresh.map((w) => ({ ...w, review: null }))
  }

  const words = [...dueWords, ...newWords].slice(0, DAILY_TARGET)
  // Randomize order so users don't always see A-words first
  shuffleArray(words)
  const result = words.map(mapWord)

  return NextResponse.json({
    words: result,
    total: result.length,
    reviewCount: dueWords.length,
    newCount: newWords.length,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { wordId, rating, mastered, unmastered } = body

  const word = await prisma.word.findUnique({ where: { id: wordId } })
  if (!word) {
    return NextResponse.json({ error: 'Word not found' }, { status: 404 })
  }

  // Un-mastered — remove mastered status
  if (unmastered === true) {
    const review = await prisma.wordReview.upsert({
      where: { wordId },
      update: {
        isMastered: false,
        nextReviewAt: new Date(),
        interval: 0,
        easiness: 2.5,
        repetitions: 0,
      },
      create: {
        wordId,
        isMastered: false,
        nextReviewAt: new Date(),
        interval: 0,
        easiness: 2.5,
        repetitions: 0,
      },
    })
    return NextResponse.json({ review, unmastered: true })
  }

  // Mastered — mark and return
  if (mastered === true) {
    const review = await prisma.wordReview.upsert({
      where: { wordId },
      update: { isMastered: true, lastReviewedAt: new Date() },
      create: {
        wordId,
        isMastered: true,
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
        interval: 0,
        easiness: 2.5,
        repetitions: 0,
      },
    })
    return NextResponse.json({ review, mastered: true })
  }

  if (typeof wordId !== 'number' || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid input: rating must be 1-5' }, { status: 400 })
  }

  const existing = await prisma.wordReview.findUnique({
    where: { wordId },
  })

  const prev = existing ?? { interval: 0, easiness: 2.5, repetitions: 0 }
  const result = sm2(rating, prev)

  const review = await prisma.wordReview.upsert({
    where: { wordId },
    update: {
      interval: result.interval,
      easiness: result.easiness,
      repetitions: result.repetitions,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: new Date(),
    },
    create: {
      wordId,
      interval: result.interval,
      easiness: result.easiness,
      repetitions: result.repetitions,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: new Date(),
    },
  })

  return NextResponse.json({ review })
}

function shuffleArray(arr: unknown[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function mapWord(w: Record<string, unknown> & { review: unknown }) {
  return {
    id: w.id,
    word: w.word,
    phonetic: w.phonetic,
    partOfSpeech: w.partOfSpeech,
    definition: w.definition,
    collocations: w.collocations,
    example: w.example,
    exampleZh: w.exampleZh,
    imageUrl: w.imageUrl,
    theme: w.theme,
    difficulty: w.difficulty,
    source: w.source,
    review: w.review,
  }
}
