import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const articles = await prisma.article.findMany({
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
        createdAt: true,
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
