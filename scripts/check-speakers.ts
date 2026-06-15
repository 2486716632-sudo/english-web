import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  const lines = await p.listeningLine.findMany({
    where: { sceneId: 'campus-lecture-1' },
    orderBy: { lineOrder: 'asc' },
    select: { lineOrder: true, speaker: true, english: true }
  })
  for (const l of lines) {
    console.log(`  ${l.lineOrder}: ${l.speaker} → ${l.english.slice(0, 60)}`)
  }
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
