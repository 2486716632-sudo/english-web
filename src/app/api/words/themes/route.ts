import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const themes = await prisma.word.groupBy({
    by: ['theme'],
    where: { theme: { not: null } },
    _count: { id: true },
  })

  const result = themes
    .map((t) => ({
      theme: t.theme!,
      count: t._count.id,
    }))
    .sort((a, b) => a.theme.localeCompare(b.theme))

  return NextResponse.json({ themes: result })
}
