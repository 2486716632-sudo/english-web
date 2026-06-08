import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const totalWords = await prisma.word.count()

  const reviewQueue = await prisma.wordReview.count({
    where: {
      nextReviewAt: { lte: now },
      isMastered: false,
    },
  })

  const masteredCount = await prisma.wordReview.count({
    where: { isMastered: true },
  })

  const reviewedIds = await prisma.wordReview.findMany({
    select: { wordId: true },
  })
  const excludeIds = new Set(reviewedIds.map((r) => r.wordId))
  const newWordsQueue = Math.min(20, totalWords - excludeIds.size)

  return NextResponse.json({
    reviewQueue,
    newWordsQueue,
    masteredCount,
    totalWords,
  })
}
