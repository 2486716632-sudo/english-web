/**
 * 精听模块 — 共享工具函数
 *
 * 包含：DeepSeek 场景生成、子类定义查询、补货逻辑
 */

import { prisma } from '@/lib/prisma'
import { getSystemPrompt } from './listening-prompts'
import { EdgeTTS } from 'node-edge-tts'
import fs from 'fs'
import path from 'path'

const AUDIO_DIR = path.join(process.cwd(), 'public', 'listening')
const VOICE_MAP: Record<string, string> = {
  A: 'en-US-JennyNeural',        // female — default dialogue
  B: 'en-US-ChristopherNeural',  // male
  Narrator: 'en-US-JennyNeural', // C1 narrative
  Host: 'en-US-ChristopherNeural', // C2 interview host
  Guest: 'en-US-JennyNeural',    // C2 interview guest
}

/** Get the appropriate TTS voice for a speaker label. */
function voiceForSpeaker(speaker: string): string {
  return VOICE_MAP[speaker] || 'en-US-JennyNeural'
}

// ============ 接口定义 ============

/** categories.json 中的子类定义 */
export interface SubCategoryDef {
  id: string
  name: string
  nameZh: string
  description: string
  dialogueType: string
  targetPoolSize: number
  maxPoolSize: number
}

interface CategoryDef {
  id: string
  subcategories: SubCategoryDef[]
}

interface CategoriesFile {
  categories: CategoryDef[]
  rules: {
    targetPoolSize: number
    maxPoolSize: number
    globalSceneLimit: number
  }
}

/** DeepSeek 生成的场景原始数据 */
export interface GeneratedScene {
  title: string
  titleZh?: string
  type?: string                    // "dialogue" | "narrative" | "interview"
  speakerA?: string                // A/B dialogue
  speakerB?: string
  host?: string                    // C2 interview
  guest?: string
  lines: { speaker?: string; english: string; chinese: string }[]
}

// ============ 分类定义读取 ============

let _categoriesCache: CategoriesFile | null = null

export function loadCategories(): CategoriesFile {
  if (_categoriesCache) return _categoriesCache
  const filePath = path.join(process.cwd(), 'src', 'data', 'listening-categories.json')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CategoriesFile
  _categoriesCache = data
  return data
}

/** 根据 subCategoryId 查询子类定义（含 dialogueType） */
export function findSubCategory(subCategoryId: string): SubCategoryDef | null {
  const data = loadCategories()
  for (const cat of data.categories) {
    const sub = cat.subcategories.find(s => s.id === subCategoryId)
    if (sub) return sub
  }
  return null
}

/** 获取所有需要生成内容的子类列表 */
export function getAllSubCategories(): SubCategoryDef[] {
  const data = loadCategories()
  const result: SubCategoryDef[] = []
  for (const cat of data.categories) {
    for (const sub of cat.subcategories) {
      if (sub.dialogueType && sub.dialogueType !== '') {
        result.push(sub)
      }
    }
  }
  return result
}

// ============ DeepSeek 场景生成 ============

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

/**
 * 为某个子类生成一个新场景。
 *
 * @param subCategory 子类定义（含 dialogueType, description 等）
 * @param existingScenes 该子类的已有场景列表（用于 AI 判断要不要生成变体）
 * @returns 生成的场景数据，或 null（失败）
 */
export async function generateScene(
  subCategory: SubCategoryDef,
  existingScenes: { title: string; playedCount: number }[]
): Promise<GeneratedScene | null> {
  const systemPrompt = getSystemPrompt(subCategory.dialogueType)

  // 构造用户 prompt：告诉 AI 子类上下文 + 已有场景
  const existingSummary = existingScenes.length > 0
    ? existingScenes.map(s => `- "${s.title}" (played ${s.playedCount} time${s.playedCount !== 1 ? 's' : ''})`).join('\n')
    : '(暂无已有的场景)'

  const userPrompt = `You are generating content for the "${subCategory.name}" (${subCategory.nameZh}) subcategory.
Description: ${subCategory.description}
Dialogue type: ${subCategory.dialogueType}

Existing scenes in this subcategory:
${existingSummary}

Your task: generate a NEW scene for this subcategory.

IMPORTANT — Choose WIDELY. Look at the existing titles above. If too many are similar (e.g. all about "Bargain" or all about "Missing Fork"), do NOT generate another variant of the same concept. Instead, pick a DIFFERENT aspect from the description that hasn't been covered yet.

For example, if the description says "问路、推荐景点、砍价、参加活动" and existing scenes are all "Street Market Bargain", generate something about asking for directions or getting local recommendations instead.

If the existing scenes already cover diverse topics, you can create a fresh variant of any practical everyday scenario — same situation but different dialogue, different complication.

For dialogue types (A1-A5, B), the title must be SHORT and CATCHY — like "Wrong Order", "Late Night Snack Run", "The Rude Waiter".
For knowledge types (C1, C2), the title should be informative and topic-focused — like "How CRISPR Actually Works", "The Lithium Dilemma".

⚠️ LENGTH REQUIREMENT: For C2 (interview) types, you MUST generate at least 28 lines. For C1 (narrative), at least 30 lines. Count your lines and make sure you meet the minimum.

Generate the full content now.`

  try {
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        // C1/C2 的内容较长，需要更大输出限制
        max_tokens: subCategory.dialogueType === 'C2' ? 4500 : subCategory.dialogueType === 'C1' ? 3500 : 2000,
      }),
    })

    if (!res.ok) {
      console.error(`[listening] DeepSeek API error: ${res.status} ${res.statusText}`)
      return null
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      console.error(`[listening] Empty response from DeepSeek`)
      return null
    }

    // Parse JSON (handle markdown fences)
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(jsonStr) as GeneratedScene

    if (!parsed.lines || !Array.isArray(parsed.lines) || parsed.lines.length < 4) {
      console.error(`[listening] Invalid format: too few lines (${parsed.lines?.length || 0})`)
      return null
    }

    if (!parsed.title) {
      // Fallback: use first few words as title
      parsed.title = parsed.lines[0]?.english?.slice(0, 40) || 'Untitled'
    }

    return parsed
  } catch (err) {
    console.error(`[listening] Failed to generate scene:`, err)
    return null
  }
}

// ============ 数据库写入 ============

/**
 * 将生成的场景数据写入数据库。
 * 支持 A/B 对话、C1 叙述、C2 访谈三种格式。
 */
export async function saveScene(
  subCategoryId: string,
  categoryId: string,
  generated: GeneratedScene,
  difficulty: string = 'intermediate',
  dialogueType?: string,
): Promise<{ id: string } | null> {
  const lineCount = generated.lines.length
  // 每行按 ~6 秒估算
  const estimatedDuration = Math.max(lineCount * 6, 30)

  const isC1 = dialogueType === 'C1'
  const isC2 = dialogueType === 'C2'
  const speakersCount = isC1 ? 1 : 2

  try {
    const scene = await prisma.listeningScene.create({
      data: {
        categoryId,
        subcategoryId: subCategoryId,
        title: generated.title,
        difficulty,
        duration: estimatedDuration,
        speakers: speakersCount,
        lines: {
          create: generated.lines.map((line, i) => ({
            id: `${subCategoryId}-${Date.now()}-${i}`,
            speaker: isC1
              ? 'Narrator'
              : isC2
                ? line.speaker === 'host' ? (generated.host || 'Host') : (generated.guest || 'Guest')
                : line.speaker === 'A' ? (generated.speakerA || 'A') : (generated.speakerB || 'B'),
            english: line.english,
            chinese: line.chinese,
            lineOrder: i,
          })),
        },
      },
      include: {
        lines: {
          orderBy: { lineOrder: 'asc' },
        },
      },
    })

    // ---- Generate audio for each line ----
    const sceneDir = path.join(AUDIO_DIR, scene.id)
    fs.mkdirSync(sceneDir, { recursive: true })

    for (const line of scene.lines) {
      const audioPath = path.join(sceneDir, `line-${line.lineOrder}.mp3`)
      const relativePath = `/listening/${scene.id}/line-${line.lineOrder}.mp3`
      const voice = voiceForSpeaker(line.speaker)

      try {
        const tts = new EdgeTTS({ voice, rate: '0%', pitch: '0%', volume: '100%', timeout: 30000 })
        await tts.ttsPromise(line.english, audioPath)
        await prisma.listeningLine.update({
          where: { id: line.id },
          data: { audioUrl: relativePath },
        })
      } catch (err) {
        console.warn(`[listening] Audio gen failed for line ${line.lineOrder}: ${err}`)
      }

      // Small delay between TTS calls
      await new Promise(r => setTimeout(r, 200))
    }

    return { id: scene.id }
  } catch (err) {
    console.error(`[listening] Failed to save scene:`, err)
    return null
  }
}

// ============ 补货逻辑 ============

/**
 * 检查某个子类是否需要补货，需要则生成 1 个新场景。
 *
 * @param subCategoryId 子类 ID
 * @returns 是否补了货，以及新场景的 id
 */
export async function refillSubCategory(subCategoryId: string): Promise<{
  refilled: boolean
  newSceneId: string | null
  reason: string
}> {
  const sub = findSubCategory(subCategoryId)
  if (!sub) {
    return { refilled: false, newSceneId: null, reason: 'Subcategory not found' }
  }

  // 查询该子类现有场景数量
  const totalCount = await prisma.listeningScene.count({
    where: { subcategoryId: subCategoryId },
  })

  // 查未听数量
  const unplayedCount = await prisma.listeningScene.count({
    where: { subcategoryId: subCategoryId, playedAt: null },
  })

  // 检查是否超过最大限制
  if (totalCount >= sub.maxPoolSize) {
    return { refilled: false, newSceneId: null, reason: `Max pool size reached (${totalCount}/${sub.maxPoolSize})` }
  }

  // 检查是否需要补货：未听数量 < targetPoolSize
  if (unplayedCount >= sub.targetPoolSize) {
    return { refilled: false, newSceneId: null, reason: `Pool adequate (${unplayedCount} unplayed, target ${sub.targetPoolSize})` }
  }

  // 检查全局限制
  const globalTotal = await prisma.listeningScene.count()
  const globalLimit = loadCategories().rules?.globalSceneLimit || 500
  if (globalTotal >= globalLimit) {
    return { refilled: false, newSceneId: null, reason: `Global limit reached (${globalTotal}/${globalLimit})` }
  }

  // 获取该子类的已有场景（title + 播放次数供 AI 参考）
  const existingScenes = await prisma.listeningScene.findMany({
    where: { subcategoryId: subCategoryId },
    select: {
      title: true,
      playedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const existingSummary = existingScenes.map(s => ({
    title: s.title,
    playedCount: s.playedAt ? 1 : 0, // simplified: has been played at least once
  }))

  // 找到对应的 categoryId
  const catId = getCategoryId(subCategoryId)
  if (!catId) {
    return { refilled: false, newSceneId: null, reason: 'Category not found' }
  }

  // 生成新场景
  const generated = await generateScene(sub, existingSummary)
  if (!generated) {
    return { refilled: false, newSceneId: null, reason: 'Generation failed' }
  }

  // 难度：C 类知识内容默认为 advanced，其他 intermediate
  const difficulty = sub.dialogueType === 'C1' || sub.dialogueType === 'C2' ? 'advanced' : 'intermediate'

  // 保存
  const saved = await saveScene(subCategoryId, catId, generated, difficulty, sub.dialogueType)
  if (!saved) {
    return { refilled: false, newSceneId: null, reason: 'Save failed' }
  }

  console.log(`[refill] ✅ ${subCategoryId} — generated "${generated.title}" (${generated.lines.length} lines)`)
  return { refilled: true, newSceneId: saved.id, reason: 'Generated' }
}

/** 根据 subCategoryId 找所属的 categoryId */
function getCategoryId(subCategoryId: string): string | null {
  const data = loadCategories()
  for (const cat of data.categories) {
    if (cat.subcategories.some(s => s.id === subCategoryId)) {
      return cat.id
    }
  }
  return null
}
