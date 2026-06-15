import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('categoryId')
  const subcategoryId = searchParams.get('subcategoryId')
  const filter = searchParams.get('filter')

  let sql = 'SELECT id, "categoryId", "subcategoryId", title, "titleZh", difficulty, duration, speakers, "playedAt", "createdAt" FROM "ListeningScene" WHERE 1=1'
  const params: string[] = []
  let paramIndex = 1

  if (categoryId) {
    sql += ` AND "categoryId" = $${paramIndex++}`
    params.push(categoryId)
  }
  if (subcategoryId) {
    sql += ` AND "subcategoryId" = $${paramIndex++}`
    params.push(subcategoryId)
  }
  if (filter === 'history') {
    sql += ' AND "playedAt" IS NOT NULL'
  } else {
    sql += ' AND "playedAt" IS NULL'
  }

  sql += filter === 'history' ? ' ORDER BY "playedAt" DESC' : ' ORDER BY "createdAt" DESC'

  const scenes = await prisma.$queryRawUnsafe<any[]>(sql, ...params)

  return NextResponse.json({ scenes })
}