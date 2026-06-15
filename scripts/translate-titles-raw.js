/**
 * Translate all scene titles to Chinese using DeepSeek API.
 * Uses raw @neondatabase/serverless (no Prisma client needed).
 *
 * Usage: node -r dotenv/config scripts/translate-titles-raw.js
 */
const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE || 'https://api.deepseek.com';

async function translateBatch(titles) {
  const prompt = `Translate the following English scene/dialogue titles to natural Chinese. Return ONLY a JSON array of strings, no explanation.

Examples:
"Surprise Quiz" → "突击测验"
"Requesting a Raise" → "申请加薪"
"Lost in the Airport" → "机场迷路"

Titles:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Respond with ONLY a JSON array like: ["翻译1", "翻译2", ...]`;

  const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from DeepSeek');

  const jsonMatch = content.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) throw new Error(`Could not parse JSON from: ${content}`);

  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const { rows: scenes } = await pool.query(
    'SELECT id, title, "titleZh" FROM "ListeningScene" ORDER BY "createdAt" ASC'
  );

  const needTranslate = scenes.filter(s => !s.titleZh);
  console.log(`Total: ${scenes.length}, Need translation: ${needTranslate.length}`);

  if (needTranslate.length === 0) {
    console.log('All done!');
    await pool.end();
    return;
  }

  const BATCH_SIZE = 20;
  let done = 0;

  for (let i = 0; i < needTranslate.length; i += BATCH_SIZE) {
    const batch = needTranslate.slice(i, i + BATCH_SIZE);
    const titles = batch.map(s => s.title);

    try {
      const translations = await translateBatch(titles);
      for (let j = 0; j < batch.length; j++) {
        await pool.query(
          'UPDATE "ListeningScene" SET "titleZh" = $1 WHERE id = $2',
          [translations[j] || batch[j].title, batch[j].id]
        );
        done++;
        console.log(`[${done}/${needTranslate.length}] ${batch[j].title} → ${translations[j] || '?'}`);
      }
    } catch (err) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message);
    }
  }

  console.log(`\nDone! Translated ${done} titles.`);
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
