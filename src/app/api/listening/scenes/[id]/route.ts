import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refillSubCategory } from '@/features/listening/lib/listening'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const scene = await prisma.listeningScene.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: { lineOrder: 'asc' },
        select: {
          id: true,
          speaker: true,
          english: true,
          chinese: true,
          lineOrder: true,
          audioUrl: true,
        },
      },
    },
  })

  if (!scene) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  }

  return NextResponse.json(scene)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Mark scene as played
  const scene = await prisma.listeningScene.update({
    where: { id },
    data: { playedAt: new Date() },
  })

  // Trigger refill for this scene's subcategory
  const refill = await refillSubCategory(scene.subcategoryId)

  return NextResponse.json({
    success: true,
    playedAt: scene.playedAt,
    refill,
  })
}
