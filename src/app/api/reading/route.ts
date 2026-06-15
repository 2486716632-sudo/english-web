import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'new' | 'history' | null

    const where: Record<string, unknown> = {}
    if (filter === 'new') {
      where.readAt = null
    } else if (filter === 'history') {
      where.readAt = { not: null }
    } else if (filter === 'favorites') {
      where.favoritedAt = { not: null }
    }

    const articles = await prisma.article.findMany({
      where,
      select: {
        id: true,
        title: true,
        titleZh: true,
        imageUrl: true,
        source: true,
        sourceEmoji: true,
        summary: true,
        difficulty: true,
        tags: true,
        readAt: true,
        createdAt: true,
        publishedAt: true,
        _count: { select: { vocabItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ articles })
  } catch (err) {
    console.error('[reading/list] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}
