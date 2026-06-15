/**
 * 精听模块 — 批量场景生成脚本
 *
 * 读取 listening-categories.json，对每个子类按 dialogueType 选用对应 prompt，
 * 批量生成初始场景并写入数据库。
 *
 * 用法: npx tsx scripts/generate-listening-dialogue.ts
 *
 * 每次运行是幂等的：已存在的场景跳过，只补缺。
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import {
  getAllSubCategories,
  generateScene,
  saveScene,
  findSubCategory,
} from '../src/features/listening/lib/listening'

// ============ 主流程 ============

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  const subs = getAllSubCategories()
  console.log(`Found ${subs.length} subcategories with dialogue types\n`)

  let totalGenerated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const sub of subs) {
    // 查询已有场景数
    const existingCount = await prisma.listeningScene.count({
      where: { subcategoryId: sub.id },
    })

    const needCount = sub.targetPoolSize - existingCount
    if (needCount <= 0) {
      console.log(`⏭️  ${sub.id} — already has ${existingCount} scenes (target ${sub.targetPoolSize})`)
      totalSkipped++
      continue
    }

    console.log(`🎯 ${sub.id} (${sub.dialogueType}) — need ${needCount} more (${existingCount}/${sub.targetPoolSize})`)

    // 获取已有场景列表（供 AI 参考避免重复）
    const existingScenes = await prisma.listeningScene.findMany({
      where: { subcategoryId: sub.id },
      select: { title: true },
      orderBy: { createdAt: 'desc' },
    })
    const existingSummary = existingScenes.map(s => ({
      title: s.title,
      playedCount: 0,
    }))

    // 逐个生成
    for (let i = 0; i < needCount; i++) {
      // 每生成一个，实时更新已生成列表
      const currentExisting = await prisma.listeningScene.findMany({
        where: { subcategoryId: sub.id },
        select: { title: true },
        orderBy: { createdAt: 'desc' },
      })
      const currentSummary = currentExisting.map(s => ({
        title: s.title,
        playedCount: 0,
      }))

      console.log(`  Generating ${i + 1}/${needCount}...`)

      const generated = await generateScene(sub, currentSummary)
      if (!generated) {
        console.error(`  ❌ Failed to generate`)
        totalFailed++
        continue
      }

      // 找 categoryId
      const catId = getCategoryId(sub.id)
      if (!catId) {
        console.error(`  ❌ Cannot find category for ${sub.id}`)
        totalFailed++
        continue
      }

      // 难度：C 类知识默认 advanced，其他 intermediate
      const difficulty = sub.dialogueType === 'C1' || sub.dialogueType === 'C2' ? 'advanced' : 'intermediate'

      const saved = await saveScene(sub.id, catId, generated, difficulty, sub.dialogueType)
      if (!saved) {
        console.error(`  ❌ Failed to save "${generated.title}"`)
        totalFailed++
        continue
      }

      console.log(`  ✅ "${generated.title}" — ${generated.lines.length} lines`)
      totalGenerated++

      // 限速等待
      await new Promise(r => setTimeout(r, 800))
    }

    console.log('')
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Generated: ${totalGenerated}`)
  console.log(`Skipped:   ${totalSkipped}`)
  console.log(`Failed:    ${totalFailed}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━`)

  await prisma.$disconnect()
}

/** 根据 subcategoryId 找 categoryId (从 JSON 里查) */
function getCategoryId(subcategoryId: string): string | null {
  const fs = require('fs')
  const path = require('path')
  const filePath = path.join(__dirname, '..', 'src', 'data', 'listening-categories.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  for (const cat of data.categories) {
    if (cat.subcategories.some((s: any) => s.id === subcategoryId)) {
      return cat.id
    }
  }
  return null
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
