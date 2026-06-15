import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import Parser from 'rss-parser'
// @ts-expect-error jsdom has no types
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

const MAX_ARTICLES = 50
const MAX_PER_RUN = parseInt(process.env.MAX_PER_RUN || '8', 10)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

const FEEDS: { url: string; tag: string }[] = [
  { url: 'https://theconversation.com/us/technology/articles.atom', tag: 'tech' },
  { url: 'https://theconversation.com/us/environment/articles.atom', tag: 'environment' },
  { url: 'https://theconversation.com/us/health/articles.atom', tag: 'health' },
  { url: 'https://theconversation.com/us/business/articles.atom', tag: 'business' },
  { url: 'https://theconversation.com/us/arts/articles.atom', tag: 'society' },
]

interface VocabItem {
  word: string
  type: string
  partOfSpeech?: string
  definition: string
  contextSentence: string
}

interface DeepSeekResult {
  titleZh: string
  summaryZh: string
  vocabItems: VocabItem[]
}

type FeedItem = {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  guid?: string
  categories?: string[]
  creator?: string
}

type Feed = {
  title?: string
  items: FeedItem[]
}

const parser = new Parser<Feed, FeedItem>()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function shuffleArray(arr: unknown[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function extractImageFromHtml(html: string): string | null {
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
  if (match) return match[1]
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i)
  if (imgMatch) return imgMatch[1]
  return null
}

async function fetchAndExtract(url: string, rssHtml?: string): Promise<{
  textContent: string
  htmlContent: string
  imageUrl: string | null
  excerpt: string
}> {
  let html: string

  if (rssHtml) {
    html = rssHtml
  } else {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EnglishLearningBot/1.0)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    html = await res.text()
  }

  const imageUrl = extractImageFromHtml(html)

  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()

  if (!article || !article.textContent) {
    throw new Error('Readability failed to parse content')
  }

  const textContent = article.textContent.trim()
  const htmlContent = (article.content || '').trim()
  const excerpt = textContent.slice(0, 300).replace(/\s+/g, ' ').trim()

  return { textContent, htmlContent, imageUrl, excerpt }
}

async function processWithDeepSeek(
  title: string,
  content: string,
): Promise<DeepSeekResult> {
  const maxContentChars = 4000
  const truncated =
    content.length > maxContentChars
      ? content.slice(0, maxContentChars) + '...'
      : content

  const res = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an English learning assistant. Given an English news article, extract content for Chinese-speaking IELTS learners.

A word's meaning often depends on the phrase it appears in (e.g. "give up" vs "give in", "look after" vs "look into"). Phrases, phrasal verbs, and collocations are just as important as individual words — they show how words are actually used in context.

Return JSON with:
- titleZh: Chinese translation of the title
- summaryZh: One-paragraph Chinese summary (catchy, like a digest)
- vocabItems: Array of key vocabulary items useful for IELTS learners

Each vocabItem has:
- word: the word/phrase
- type: "word" | "phrase" | "expression"
- partOfSpeech: "noun" | "verb" | "adj." | "adv." etc (only for type=word)
- definition: Chinese definition
- contextSentence: The exact sentence from the article where this word appears (keep original English)

Guidelines:
- Words and phrases are NOT mutually exclusive. A word can appear both as a standalone word (type="word") AND as part of a phrase (type="phrase") — they serve different learning purposes
- Focus on phrases where the meaning cannot be inferred from individual words: phrasal verbs ("give up", "carry out"), idioms, and strong collocations ("heavy rain", "make a decision")
- If the article uses a word in both a literal and a phrasal sense, include both`,
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nArticle:\n${truncated}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DeepSeek API error: ${res.status} ${text}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content

  if (!raw) {
    throw new Error('DeepSeek returned empty content')
  }

  const parsed: DeepSeekResult = JSON.parse(raw)

  return {
    titleZh: parsed.titleZh || '',
    summaryZh: parsed.summaryZh || '',
    vocabItems: Array.isArray(parsed.vocabItems) ? parsed.vocabItems.slice(0, 10) : [],
  }
}

async function main() {
  console.log(`[reading-push] Starting...`)
  console.log(`[reading-push] Max articles: ${MAX_ARTICLES}, Per run: ${MAX_PER_RUN}`)

  if (!DEEPSEEK_API_KEY) {
    console.error('[reading-push] ERROR: DEEPSEEK_API_KEY not set')
    process.exit(1)
  }

  // Strip quotes from DATABASE_URL (GitHub secrets may include them from .env)
  const dbUrl = (process.env.DATABASE_URL || '').replace(/^"(.*)"$/, '$1')
  const pool = new Pool({ connectionString: dbUrl })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    // 1. Parse all category feeds and collect articles
    interface ScoredItem {
      item: FeedItem
      tags: string[]
    }

    const allItems = new Map<string, ScoredItem>() // key = link, dedup by URL

    for (const feedDef of FEEDS) {
      console.log(`[reading-push] Fetching feed: ${feedDef.url}`)
      const feed = await parser.parseURL(feedDef.url)
      console.log(`[reading-push]   ${feed.items.length} items from "${feedDef.tag}" feed`)

      for (const item of feed.items) {
        const link = item.link || ''
        if (!link) continue

        const existing = allItems.get(link)
        if (existing) {
          // Merge tags: add this feed's tag if not already present
          if (!existing.tags.includes(feedDef.tag)) {
            existing.tags.push(feedDef.tag)
          }
        } else {
          allItems.set(link, { item, tags: [feedDef.tag] })
        }
      }
    }

    const candidates = [...allItems.values()]
    console.log(`[reading-push] ${candidates.length} unique articles after dedup`)

    if (candidates.length === 0) {
      console.log('[reading-push] No matching articles found. Exiting.')
      return
    }

    // 2. Shuffle candidates to get diverse mix across feeds, then dedup against DB
    shuffleArray(candidates)
    const existingUrls = new Set(
      (await prisma.article.findMany({
        select: { url: true },
        where: { url: { not: null } },
      })).map((a) => a.url).filter(Boolean) as string[],
    )

    const existingTitles = new Set(
      (await prisma.article.findMany({
        select: { title: true },
      })).map((a) => a.title.toLowerCase().trim()),
    )

    const newCandidates = candidates.filter((c) => {
      const link = c.item.link?.toLowerCase().trim() || ''
      if (existingUrls.has(link)) return false
      const title = c.item.title?.toLowerCase().trim() || ''
      if (existingTitles.has(title)) return false
      return true
    })

    console.log(`[reading-push] ${newCandidates.length} are new (${candidates.length - newCandidates.length} already in DB)`)

    if (newCandidates.length === 0) {
      console.log('[reading-push] No new articles to push. Exiting.')
      return
    }

    // 4. Process articles (up to MAX_PER_RUN)
    const toProcess = newCandidates.slice(0, MAX_PER_RUN)
    let pushed = 0
    let failed = 0

    for (let i = 0; i < toProcess.length; i++) {
      const { item, tags } = toProcess[i]
      const title = item.title || 'Untitled'
      const link = item.link || ''
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null

      console.log(`\n[reading-push] [${i + 1}/${toProcess.length}] Processing: "${title}"`)

      try {
        // Use Atom feed content as HTML source (avoid extra HTTP fetch)
        const rssHtml = item.content || ''
        const extracted = await fetchAndExtract(link, rssHtml)
        const contentText = extracted.textContent

        if (contentText.length < 100) {
          console.log(`[reading-push]   ⚠ Content too short (${contentText.length} chars), skipping`)
          continue
        }

        console.log(`[reading-push]   Content: ${contentText.length} chars, image: ${extracted.imageUrl ? 'yes' : 'no'}`)

        // Call DeepSeek for translation + vocab
        let dsResult: DeepSeekResult | null = null
        try {
          dsResult = await processWithDeepSeek(title, contentText)
          console.log(`[reading-push]   DeepSeek: titleZh="${dsResult.titleZh.slice(0, 30)}...", ${dsResult.vocabItems.length} vocab items`)
        } catch (err) {
          console.log(`[reading-push]   ⚠ DeepSeek failed: ${err instanceof Error ? err.message : err}`)
          dsResult = { titleZh: '', summaryZh: '', vocabItems: [] }
        }

        // Calculate difficulty (heuristic: content length)
        const difficulty = contentText.length > 3000 ? 4 : contentText.length > 1500 ? 3 : 2

        // Push to DB
        const article = await prisma.article.create({
          data: {
            title,
            titleZh: dsResult.titleZh || null,
            url: link,
            imageUrl: extracted.imageUrl || null,
            publishedAt,
            source: 'The Conversation',
            sourceEmoji: '📰',
            content: contentText,
            summary: dsResult.summaryZh || extracted.excerpt,
            summaryEn: extracted.excerpt,
            difficulty,
            tags: tags.join(','),
            vocabItems: {
              create: dsResult.vocabItems.map((v) => ({
                word: v.word,
                type: v.type || 'word',
                partOfSpeech: v.partOfSpeech || null,
                phonetic: null,
                definition: v.definition,
                contextSentence: v.contextSentence,
              })),
            },
          },
        })

        pushed++
        console.log(`[reading-push]   ✓ Pushed as article #${article.id} | Tags: ${tags.join(', ')} | Difficulty: ${difficulty}`)

        // Small delay to avoid DeepSeek rate limits
        await sleep(1500)
      } catch (err) {
        failed++
        console.log(`[reading-push]   ✗ Failed: ${err instanceof Error ? err.message : err}`)
      }
    }

    // 5. Trim to MAX_ARTICLES
    const totalArticles = await prisma.article.count()
    console.log(`\n[reading-push] DB now has ${totalArticles} articles (max ${MAX_ARTICLES})`)

    if (totalArticles > MAX_ARTICLES) {
      const toDelete = totalArticles - MAX_ARTICLES
      const oldestArticles = await prisma.article.findMany({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: toDelete,
      })
      const deleteIds = oldestArticles.map((a) => a.id)

      await prisma.articleVocab.deleteMany({
        where: { articleId: { in: deleteIds } },
      })
      await prisma.article.deleteMany({
        where: { id: { in: deleteIds } },
      })

      console.log(`[reading-push] Deleted ${deleteIds.length} oldest articles to stay under limit`)
    }

    console.log(`\n[reading-push] ✅ Done: ${pushed} articles pushed, ${failed} failed`)
    console.log(`[reading-push] DB: ${await prisma.article.count()}/${MAX_ARTICLES} articles`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('[reading-push] Fatal error:', err)
  process.exit(1)
})
