import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const r1 = await prisma.wordReview.deleteMany({})
  console.log(`Deleted ${r1.count} WordReview records`)
  const r2 = await prisma.dailyProgress.deleteMany({})
  console.log(`Deleted ${r2.count} DailyProgress records`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
