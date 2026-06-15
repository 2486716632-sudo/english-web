import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const totalWords = await prisma.word.count({
    where: { source: 'ielts' },
  })

  const reviewQueue = await prisma.wordReview.count({
    where: {
      nextReviewAt: { lte: now },
      isMastered: false,
      word: { source: 'ielts' },
    },
  })

  const masteredCount = await prisma.wordReview.count({
    where: {
      isMastered: true,
      word: { source: 'ielts' },
    },
  })

  const reviewedIds = await prisma.wordReview.findMany({
    where: { word: { source: 'ielts' } },
    select: { wordId: true },
  })
  const excludeIds = new Set(reviewedIds.map((r) => r.wordId))
  const newWordsQueue = Math.max(0, totalWords - excludeIds.size)

  return NextResponse.json({
    reviewQueue,
    newWordsQueue,
    masteredCount,
    totalWords,
  })
}
