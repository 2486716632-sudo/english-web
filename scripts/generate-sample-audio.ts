import 'dotenv/config'
import { KokoroTTS } from 'kokoro-js'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import path from 'path'
import fs from 'fs'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })
const AUDIO_DIR = path.join(process.cwd(), 'public', 'listening')

const SCENE_IDS = [
  'campus-lecture-1',    // Surprise Quiz
  'daily-food-1',        // Coffee Shop Confusion
  'travel-airport-1',    // Check in
]

const voices = ['af_heart', 'am_fenrir', 'af_bella', 'am_michael', 'af_nicole', 'am_echo'] as const

// Strip parenthesized stage directions like (laughs), (sighs)
function cleanForTTS(text: string): string {
  return text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() || text
}

async function generateForScene(tts: KokoroTTS, scene: any) {
  const voiceMap: Record<string, string> = {}
  let voiceIdx = 0
  for (const line of scene.lines) {
    if (!voiceMap[line.speaker]) {
      voiceMap[line.speaker] = voices[voiceIdx % voices.length]
      voiceIdx++
    }
  }

  const sceneDir = path.join(AUDIO_DIR, scene.id)
  if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir, { recursive: true })
  console.log(`\n--- ${scene.id}: ${scene.title} (${scene.lines.length} lines) ---`)
  console.log('  Voices:', voiceMap)

  for (const line of scene.lines) {
    const voice = voiceMap[line.speaker]
    const audioPath = path.join(sceneDir, `line-${line.lineOrder}.wav`)
    const relativePath = `/listening/${scene.id}/line-${line.lineOrder}.wav`

    const ttsText = cleanForTTS(line.english)
    console.log(`  Line ${line.lineOrder} [${line.speaker}→${voice}]: "${ttsText.slice(0, 50)}..."`)
    try {
      const audio = await tts.generate(ttsText, { voice: voice as typeof voices[number] })
      audio.save(audioPath)
      await p.listeningLine.update({
        where: { id: line.id },
        data: { audioUrl: relativePath }
      })
      console.log(`    ✅ saved`)
    } catch (e) {
      console.log(`    ❌ failed: ${e}`)
    }
  }
}

async function main() {
  console.log('Loading Kokoro-82M model...')
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8',
    device: 'cpu',
  })

  for (const sceneId of SCENE_IDS) {
    const scene = await p.listeningScene.findUnique({
      where: { id: sceneId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } }
    })
    if (!scene) {
      console.log(`\n--- ${sceneId} [NOT FOUND] ---`)
      continue
    }
    await generateForScene(tts, scene)
  }

  console.log('\nDone!')
  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
