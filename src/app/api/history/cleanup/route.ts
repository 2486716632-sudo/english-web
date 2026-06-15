import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'listening' | 'reading' | null (both)

    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const result: { listening: number; reading: number } = { listening: 0, reading: 0 }

    if (!type || type === 'listening') {
      result.listening = await prisma.$executeRaw`
        UPDATE "ListeningScene" SET "playedAt" = NULL
        WHERE "playedAt" IS NOT NULL AND "playedAt" < ${cutoff}
      `
    }

    if (!type || type === 'reading') {
      result.reading = await prisma.$executeRaw`
        UPDATE "Article" SET "readAt" = NULL
        WHERE "readAt" IS NOT NULL AND "readAt" < ${cutoff}
          AND "favoritedAt" IS NULL
      `
    }

    return NextResponse.json({ cleaned: result, cutoff: cutoff.toISOString() })
  } catch (err) {
    console.error('[history/cleanup] Error:', err)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
