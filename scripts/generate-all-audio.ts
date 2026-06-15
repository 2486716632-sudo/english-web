/**
 * Batch generate audio for all listening scenes using Microsoft Edge TTS
 *
 * Usage: npx tsx scripts/generate-all-audio.ts
 *
 * Features:
 * - Resume support: skips lines that already have audioUrl set
 * - Random voice assignment per speaker per scene
 * - +10% speech rate
 * - Updates DB audioUrl immediately after each line
 */

import 'dotenv/config'
import { EdgeTTS } from 'node-edge-tts'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import path from 'path'
import fs from 'fs'

const VOICES = [
  'en-US-AriaNeural',
  'en-US-JennyNeural',
  'en-US-GuyNeural',
  'en-GB-RyanNeural',
]

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const AUDIO_DIR = path.join(process.cwd(), 'public', 'listening')

function cleanForTTS(text: string): string {
  return text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() || text
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function main() {
  // Fetch all scenes with at least their first line
  const allScenes = await prisma.listeningScene.findMany({
    include: { lines: { orderBy: { lineOrder: 'asc' }, take: 1 } },
    orderBy: { createdAt: 'asc' },
  })

  const needGenerate = allScenes.filter(s =>
    s.lines.length === 0 || !s.lines[0].audioUrl
  )

  const totalScenes = allScenes.length
  const skipCount = totalScenes - needGenerate.length
  console.log(`Total scenes: ${totalScenes}`)
  console.log(`Already have audio: ${skipCount}`)
  console.log(`Need generate: ${needGenerate.length}`)

  if (needGenerate.length === 0) {
    console.log('All scenes have audio!')
    await prisma.$disconnect()
    return
  }

  let generated = 0
  let failed = 0
  const startTime = Date.now()

  for (const scene of needGenerate) {
    const fullScene = await prisma.listeningScene.findUnique({
      where: { id: scene.id },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    })
    if (!fullScene) continue

    const linesTodo = fullScene.lines.filter(l => !l.audioUrl)
    if (linesTodo.length === 0) {
      console.log(`  Skipping ${scene.id} — all lines have audio`)
      generated++
      continue
    }

    // Build speaker → voice mapping (shuffled for variety)
    const voiceMap: Record<string, string> = {}
    const shuffled = shuffle(VOICES)
    let vi = 0
    for (const line of fullScene.lines) {
      if (!voiceMap[line.speaker]) {
        voiceMap[line.speaker] = shuffled[vi % shuffled.length]
        vi++
      }
    }

    const sceneDir = path.join(AUDIO_DIR, scene.id)
    if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir, { recursive: true })

    console.log(`\n[${generated + 1}/${needGenerate.length}] ${scene.id}: ${fullScene.title} (${linesTodo.length} lines)`)

    let sceneOk = true
    for (const line of linesTodo) {
      const voice = voiceMap[line.speaker]
      const audioPath = path.join(sceneDir, `line-${line.lineOrder}.mp3`)
      const relativePath = `/listening/${scene.id}/line-${line.lineOrder}.mp3`

      const ttsText = cleanForTTS(line.english)
      try {
        const tts = new EdgeTTS({ voice, lang: 'en-US', rate: '+10%' })
        await tts.ttsPromise(ttsText, audioPath)
        await prisma.listeningLine.update({
          where: { id: line.id },
          data: { audioUrl: relativePath },
        })
        process.stdout.write(`  [${line.lineOrder}] ✓\n`)
      } catch (err) {
        process.stdout.write(`  [${line.lineOrder}] ✗ ${err}\n`)
        sceneOk = false
        failed++
      }
    }

    if (sceneOk) generated++

    const pct = ((generated / needGenerate.length) * 100).toFixed(1)
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const rate = generated / Math.max(elapsed, 1)
    const eta = rate > 0 ? Math.floor((needGenerate.length - generated) / rate) : '?'
    console.log(`  Progress: ${pct}% | Elapsed: ${elapsed}s | ETA: ${eta}s`)
  }

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Done: ${generated}/${needGenerate.length} scenes`)
  console.log(`Failed: ${failed} lines`)
  console.log(`${'='.repeat(40)}`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
