import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  const scenes = await p.listeningScene.count()
  const lines = await p.listeningLine.count()
  console.log('Scenes:', scenes, 'Lines:', lines)

  const byCat = await p.listeningScene.groupBy({ by: ['categoryId'], _count: true })
  for (const c of byCat) {
    console.log(`  ${c.categoryId}: ${c._count} scenes`)
  }

  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
