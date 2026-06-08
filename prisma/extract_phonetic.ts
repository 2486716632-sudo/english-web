/**
 * Extract common English word phonetics from ECDICT stardict.db into a JSON file.
 * This replaces the runtime dependency on node:sqlite for Vercel deployment.
 *
 * Usage: npx tsx prisma/extract_phonetic.ts
 */
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const ECDICT_DB_PATH = path.resolve(process.cwd(), 'prisma', 'ecdict', 'stardict.db')
const OUTPUT_PATH = path.resolve(process.cwd(), 'prisma', 'ecdict_phonetic.json')

if (!fs.existsSync(ECDICT_DB_PATH)) {
  console.error('ECDICT database not found at', ECDICT_DB_PATH)
  process.exit(1)
}

const db = new DatabaseSync(ECDICT_DB_PATH)

// Extract entries that have phonetics and are:
// 1. IELTS tagged
// 2. OR have short words (likely common)
// This gives us ~50K+ entries covering virtually all article vocab
const rows = db.prepare(`
  SELECT word, phonetic, tag FROM stardict
  WHERE phonetic IS NOT NULL AND phonetic != ''
`).all() as { word: string; phonetic: string; tag: string | null }[]

const result: Record<string, string> = {}

for (const row of rows) {
  const word = row.word.toLowerCase().trim()
  if (!word || result[word]) continue

  // Always include IELTS words
  // For non-IELTS, only include if it looks like a common word (short, no spaces, no special chars)
  const isIelts = row.tag?.includes('ielts')
  const isCommon = /^[a-z]+$/.test(word) && word.length >= 2 && word.length <= 14

  if (isIelts || isCommon) {
    result[word] = row.phonetic
  }
}

db.close()

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result))
console.log(`Extracted ${Object.keys(result).length} phonetics to ${OUTPUT_PATH}`)
console.log('File size:', (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2), 'MB')
