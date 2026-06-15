/**
 * 精听模块 - Edge TTS 批量音频生成脚本
 *
 * 读取数据库中已有的 ListeningScene + ListeningLine，
 * 对每行调用 Edge TTS 生成音频文件，写入 public/listening/ 目录。
 *
 * 用法: npx tsx scripts/generate-listening-audio.ts
 */

import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { EdgeTTS } from 'node-edge-tts'

const AUDIO_DIR = path.join(__dirname, '..', 'public', 'listening')
const VOICE_MAP: Record<string, string> = {
  A: 'en-US-JennyNeural',  // female
  B: 'en-US-ChristopherNeural', // male
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function main() {
  ensureDir(AUDIO_DIR)

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  // Get all scenes that have lines without audio
  const scenes = await prisma.listeningScene.findMany({
    include: {
      lines: {
        orderBy: { lineOrder: 'asc' },
        where: { audioUrl: null },
      },
    },
  })

  const scenesNeedingAudio = scenes.filter(s => s.lines.length > 0)
  console.log(`Found ${scenesNeedingAudio.length} scenes needing audio generation`)

  let totalLines = 0

  for (const scene of scenesNeedingAudio) {
    const sceneDir = path.join(AUDIO_DIR, scene.id)
    ensureDir(sceneDir)
    console.log(`\n🎙️  ${scene.id} — ${scene.title} (${scene.lines.length} lines)`)

    for (const line of scene.lines) {
      // Determine voice based on speaker
      const voice = VOICE_MAP[line.speaker] || 'en-US-JennyNeural'
      const audioPath = path.join(sceneDir, `line-${line.lineOrder}.mp3`)
      const relativePath = `/listening/${scene.id}/line-${line.lineOrder}.mp3`

      console.log(`  🔈 Line ${line.lineOrder}: "${line.english.slice(0, 50)}..."`)

      try {
        const tts = new EdgeTTS({
          voice,
          rate: '0%',
          pitch: '0%',
          volume: '100%',
          timeout: 30000,
        })
        await tts.ttsPromise(line.english, audioPath)

        // Update the line with the audio URL
        await prisma.listeningLine.update({
          where: { id: line.id },
          data: { audioUrl: relativePath },
        })

        totalLines++
      } catch (err) {
        console.error(`  ❌ Line ${line.lineOrder} failed: ${err}`)
      }

      // Small delay between TTS calls
      await new Promise(r => setTimeout(r, 200))
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Total audio files generated: ${totalLines}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━`)

  await prisma.$disconnect()
}

main().catch(console.error)
