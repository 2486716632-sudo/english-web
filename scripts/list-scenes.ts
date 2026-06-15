import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })
async function main() {
  const scenes = await p.listeningScene.findMany({ take: 20, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, categoryId: true, subcategoryId: true } })
  for (const s of scenes) console.log(s.id, '|', s.title, '|', s.categoryId, '|', s.subcategoryId)
  await p.$disconnect()
}
main()
