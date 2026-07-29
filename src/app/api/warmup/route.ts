import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`
    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: String(err) },
      { status: 500 },
    )
  }
}
