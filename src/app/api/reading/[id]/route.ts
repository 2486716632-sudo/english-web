import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import path from 'node:path'
import fs from 'node:fs'

const PHONETIC_JSON_PATH = path.resolve(process.cwd(), 'prisma', 'ecdict_phonetic.json')

let phoneticMap: Record<string, string> | null = null
function getPhoneticMap() {
  if (phoneticMap) return phoneticMap
  if (fs.existsSync(PHONETIC_JSON_PATH)) {
    try {
      phoneticMap = JSON.parse(fs.readFileSync(PHONETIC_JSON_PATH, 'utf-8'))
    } catch { /* ignore */ }
  }
  return phoneticMap
}

function lookupPhonetic(word: string): string | null {
  const map = getPhoneticMap()
  if (!map) return null
  return map[word.toLowerCase().trim()] || null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const articleId = parseInt(id, 10)
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 })
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { vocabItems: true },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Enrich vocab items with phonetics from word bank or phonetic map
    const enrichedVocab = await Promise.all(
      article.vocabItems.map(async (v) => {
        if (v.phonetic || v.type === 'expression') return v

        // Try exact match in main word bank first
        const match = await prisma.word.findFirst({
          where: { word: { equals: v.word } },
          select: { phonetic: true },
        })
        if (match?.phonetic) return { ...v, phonetic: match.phonetic }

        // Fallback to ECDICT phonetic map
        const p = lookupPhonetic(v.word)
        if (p) return { ...v, phonetic: p }

        // For phrases, try first content word
        if (v.type === 'phrase') {
          const words = v.word.split(/\s+/).filter(w => !['the', 'a', 'an', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from'].includes(w.toLowerCase()))
          for (const w of words) {
            const pw = lookupPhonetic(w)
            if (pw) return { ...v, phonetic: pw }
          }
        }

        return v
      })
    )

    return NextResponse.json({ article: { ...article, vocabItems: enrichedVocab } })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}
