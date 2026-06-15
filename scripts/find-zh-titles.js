const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: 'C:/Users/24867/Desktop/Ethan\'s Workspace/Ethan\'s English Learning Assistant/english-web/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(
    `SELECT id, title, "titleZh" FROM "ListeningScene" WHERE title ~ '[一-鿿]' ORDER BY "createdAt"`
  );
  console.log(`Found ${rows.length} scenes with Chinese in title field:\n`);
  for (const r of rows) {
    console.log(`${r.id}: title="${r.title}" titleZh="${r.titleZh || '(null)'}"`);
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
