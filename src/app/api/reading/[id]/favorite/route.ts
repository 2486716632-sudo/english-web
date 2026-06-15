import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const article = await prisma.article.findUnique({ where: { id: Number(id) } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const updated = await prisma.article.update({
      where: { id: Number(id) },
      data: { favoritedAt: article.favoritedAt ? null : new Date() },
    })

    return NextResponse.json({ favoritedAt: updated.favoritedAt })
  } catch (err) {
    console.error('[reading/favorite] Error:', err)
    return NextResponse.json({ error: 'Failed to toggle favorite' }, { status: 500 })
  }
}
