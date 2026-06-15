import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/* ---- DELETE ---- */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ theme: string }> },
) {
  try {
    const { theme } = await params

    // Only allow deleting generated themes
    const words = await prisma.word.findMany({
      where: { theme, source: 'generated' },
      select: { id: true },
    })

    if (words.length === 0) {
      return NextResponse.json({ error: 'Theme not found or not deletable' }, { status: 404 })
    }

    const ids = words.map(w => w.id)

    // Delete reviews first (FK constraint)
    await prisma.wordReview.deleteMany({ where: { wordId: { in: ids } } })
    await prisma.word.deleteMany({ where: { id: { in: ids } } })

    return NextResponse.json({ deleted: ids.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[words/themes/delete] Error:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
