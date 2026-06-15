import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const p = new PrismaClient({ adapter })

async function main() {
  const total = await p.listeningScene.count()
  const lineTotal = await p.listeningLine.count()
  console.log(`总场景数: ${total} | 总行数: ${lineTotal}`)

  const all = await p.listeningScene.findMany({
    include: { lines: { select: { id: true } } }
  })

  // === 1. 短场景 (≤12行) ===
  const short = all.filter(s => s.lines.length <= 12)
  console.log(`\n=== 短场景 (≤${12}行): ${short.length} 个 ===`)
  for (const s of short.sort((a,b) => a.lines.length - b.lines.length)) {
    console.log(`  ${s.lines.length}行 | ${s.subcategoryId} | ${s.title}`)
  }

  // === 2. 重复标题 ===
  const seen: Record<string, number> = {}
  for (const s of all) {
    const key = `${s.subcategoryId}::${s.title}`
    seen[key] = (seen[key] || 0) + 1
  }
  const dupes = Object.entries(seen).filter(([_, n]) => n > 1)
  console.log(`\n=== 重复标题: ${dupes.length} 组 ===`)
  for (const [k, n] of dupes.sort((a,b) => b[1]-a[1])) {
    console.log(`  ×${n} | ${k}`)
  }

  // === 3. 行数分布的统计数据 ===
  const counts = all.map(s => s.lines.length).sort((a, b) => a - b)
  const bins = { '≤10': 0, '11-15': 0, '16-22': 0, '23-28': 0, '29-40': 0, '41-50': 0, '≥51': 0 }
  for (const c of counts) {
    if (c <= 10) bins['≤10']++
    else if (c <= 15) bins['11-15']++
    else if (c <= 22) bins['16-22']++
    else if (c <= 28) bins['23-28']++
    else if (c <= 40) bins['29-40']++
    else if (c <= 50) bins['41-50']++
    else bins['≥51']++
  }
  console.log(`\n=== 行数分布 ===`)
  console.log(`  最少: ${counts[0]} | 最多: ${counts[counts.length-1]} | 中位数: ${counts[Math.floor(counts.length/2)]}`)
  for (const [bin, n] of Object.entries(bins)) {
    console.log(`  ${bin}: ${n} 个`)
  }

  // === 4. 按类型统计平均行数 ===
  interface TypeMap { [subId: string]: string }
  const typeMap: TypeMap = {
    'campus-lecture': 'A1', 'campus-groupwork': 'A1', 'campus-dorm': 'A1', 'campus-activity': 'A1',
    'social-invite': 'A1', 'social-chat': 'A1', 'social-vent': 'A1', 'social-holiday': 'A1',
    'daily-food': 'A2', 'daily-transit': 'A2', 'daily-shopping': 'A2', 'daily-living': 'A2',
    'travel-prep': 'A2', 'travel-airport': 'A2', 'travel-lodging': 'A2',
    'health-doctor': 'A2', 'health-pharmacy': 'A2', 'health-hospital': 'A2', 'health-fitness': 'A2',
    'social-emotion': 'A3', 'campus-courses': 'A4', 'workplace-jobhunt': 'A4',
    'workplace-daily': 'A4', 'workplace-meeting': 'A4', 'workplace-problem': 'A4',
    'daily-emergency': 'A5', 'travel-local': 'A5', 'travel-accident': 'A5',
    'professional-mechanical': 'B', 'professional-automotive': 'B', 'professional-cs': 'B', 'professional-trade': 'B',
    'knowledge-tech': 'C1', 'knowledge-nature': 'C1', 'knowledge-history': 'C1', 'knowledge-sports': 'C1', 'knowledge-psychology': 'C1',
    'knowledge-business': 'C2', 'knowledge-society': 'C2', 'knowledge-health': 'C2',
  }
  const byType: Record<string, number[]> = {}
  for (const s of all) {
    const t = typeMap[s.subcategoryId] || '?'
    if (!byType[t]) byType[t] = []
    byType[t].push(s.lines.length)
  }
  console.log(`\n=== 按类型的平均行数 ===`)
  for (const [t, ls] of Object.entries(byType).sort()) {
    const avg = ls.reduce((a, b) => a + b, 0) / ls.length
    console.log(`  ${t}: 平均 ${avg.toFixed(1)} 行 (${ls.length} 个场景)`)
  }

  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
