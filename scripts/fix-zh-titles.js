const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 1. "脏碗堆成山" → English: "Dirty Dishes Mountain", titleZh stays "脏碗堆成山"
  await pool.query(
    `UPDATE "ListeningScene" SET title = 'Dirty Dishes Mountain', "titleZh" = '脏碗堆成山' WHERE id = 'cmq91dboe000b90ex1n7zumur'`
  );
  console.log('Fixed: cmq91dboe000b90ex1n7zumur (脏碗堆成山 → Dirty Dishes Mountain)');

  // 2. "Fighting About分工" → "Fighting About Work Division"
  await pool.query(
    `UPDATE "ListeningScene" SET title = 'Work Division Dispute' WHERE id = 'campus-group-3'`
  );
  console.log('Fixed: campus-group-3 (Fighting About分工 → Work Division Dispute)');

  // Verify
  const { rows } = await pool.query(
    `SELECT id, title, "titleZh" FROM "ListeningScene" WHERE id = 'cmq91dboe000b90ex1n7zumur' OR id = 'campus-group-3'`
  );
  for (const r of rows) {
    console.log(`  ${r.id}: title="${r.title}" titleZh="${r.titleZh}"`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
