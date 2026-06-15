import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  const all = await p.listeningScene.findMany({ include: { lines: { select: { id: true } } } })
  const short = all.filter(s => s.lines.length <= 10)
  console.log(`Deleting ${short.length} short scenes...`)
  for (const s of short) {
    await p.listeningLine.deleteMany({ where: { sceneId: s.id } })
    await p.listeningScene.delete({ where: { id: s.id } })
    console.log(`  ${s.subcategoryId} | ${s.title} | ${s.lines.length}行`)
  }
  console.log('Done')
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
