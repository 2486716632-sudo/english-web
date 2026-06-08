@AGENTS.md

# Project — English Learning PWA

Next.js 16.2.6 + DeepSeek API + Tailwind v4 + Prisma/SQLite.
See `VISION.md` for full specs, API contracts, and locked specifications.

## Critical constraints
- **DeepSeek json_object**: returns empty at 7+ messages → use two-step (plain text reply + short-context json_object)
- **Tailwind v4**: `shadow-[rgba(...)]` 等含括号的任意值失效 → 用 inline `style`
- **Build check**: `npx tsc --noEmit`（`npx next build` 可能被 auto mode 拦截）
- **Test new routes**: use `npx next dev`, not production build (404)
- **Write code**: read AGENTS.md's linked docs first

## Immutable modules (DO NOT TOUCH without explicit permission)
- **AI Coach** (口语对练舱 + 场景系统) — see VISION.md §9 for locked spec
- **Words page UI** — see VISION.md §10 for frozen design. Any UI/color/layout change needs user approval
- **Schema.prisma** — model definitions are finalized

## Behavioral rules
- **External dependency failure**: Any external dependency (API, download, package) that fails → STOP and tell the user. Never silently switch to an alternative approach.
- **Scope discipline**: If the task is about backend (word bank, algorithm, API), ONLY touch backend files. Never rewrite frontend UI unless explicitly asked.
- **Word data priority**: handwritten 550 > ECDICT > DeepSeek. Handwritten words keep their original phonetic/definition.
- **Example pairing**: Examples are always stored as paired EN+ZH (` ||| ` separated), never orphan sentences.
- **Memory storage**: All project memory is stored in two files in the project root:
  - `CLAUDE.md` — behavioral rules, UI preferences, constraints, quick refs for me (the AI)
  - `VISION.md` — design specs, architecture decisions, feature specs, roadmaps, locked requirements
  Do NOT use `~/.claude/projects/.../memory/` — that system is deprecated.

## Hover animation pattern
- All interactive elements use `hover:scale-105` + `hover:shadow-*` combo for "lift" effect
- Duration: `duration-200` for small elements, `duration-300` for buttons/cards, `duration-500` for large elements
- Active: `active:scale-[0.95]` or `active:scale-[0.97]` for click feedback
- Input fields: `hover:border` + `hover:shadow` enhancement (never scale, to not disrupt typing)
- Emoji in Surprise Me: `group-hover:rotate-[360deg] group-hover:scale-125` with `duration-500`
- Text in Surprise Me: `group-hover:tracking-widest group-hover:text-stone-800`

## AI Assistant (global floating ball)
- Component: `src/components/AIAssistant.tsx`
- Position stored in localStorage as `{right, bottom}` format (NOT `{x,y}`)
  - Old `{x,y}` format is rejected by validation in `loadPosition()`
- Default position: `{right: 24, bottom: 88}` (above the floating ball)
- DeepSeek role mapping: `'ai'` → `'assistant'` (DeepSeek/OpenAI format)
- Panel opens on top of content (z-50 overlay), not as a sidebar

## Current project state
- **Reading module** (外刊, in progress): YouTube-style grid list + article detail with sidebar vocab panel. 2 test articles seeded. Summary: English default, Chinese toggle. Title: Chinese toggle on card. Details in VISION.md §六.
- **Vocabulary page animations**: Book icon entrance (scale+rotate stagger), title/subtitle fade-slide-up, all study buttons hover:scale-105+shadow across Daily Study and Word Packs
- **Vocabulary**: 2000 IELTS words + 681 scene words (16 themes) in DB
- **Scene word packs**: 16 themes — see VISION.md §8 for full list and design rules
- **Word schema** now includes `theme` (scene pack name) and `imageUrl` (Wikipedia image) optional fields
- **New API**: `GET /api/words?theme=kitchen` returns scene words; `GET /api/words/themes` lists available packs
- **Entry page**: `/words` shows two cards — Daily Study (IELTS SRS → `/words/study`) and Word Packs (scene packs → `/words/themes`)
- **Image fallback**: Wikipedia 3-step fetch, no placeholder shown when no image available
- **ECDICT**: Integrated — `prisma/ecdict/stardict.db` (3.4M entries), used for phonetic + definitions + IELTS tag filtering
- **DeepSeek**: Generates collocations + 1 example per scene word. Cached in `prisma/generated_scene_data.json`
- **Data seed**: `npx tsx prisma/seed.ts` — full re-seed takes ~20min (DeepSeek), incremental seed (cached) takes seconds
- **Example highlight**: `highlightWord()` in words/page.tsx uses `\\b(word\\w*)\\b` to match inflected forms

## Vocabulary UI preferences (behavioral rules)
- **Entry route**: `/words` is the landing page (not `/words/study`). Clicking "Vocabulary" on homepage goes here.
- **Phonetic display**: All phonetics must be wrapped in `/` slashes. `formatPhonetic()` auto-fixes bare phonetics.
- **Word List buttons**: Got It column uses "✔", Not Yet column uses "✗" (no Chinese text)
- **No image placeholder**: Words without Wikipedia images show no image area. The word itself is the visual focus.
- **Scene card front**: Single "Show Answer" button flips the card. Rating buttons only appear after flip.

## Reading module (behavioral rules)
- **AI pushes articles, not user**: Claude selects and processes articles. No user article hunting.
- **Two vocab types**: `word` → join SRS queue (Daily Study); `phrase`/`expression` → 参考 label only, no SRS
- **Title toggle**: Card shows "中文" button next to tags, toggles between `title` and `titleZh`. Detail page title has no toggle.
- **Summary toggle**: Detail page shows English (summaryEn) by default below title, "中文" button toggles to Chinese (summary).
- **Image priority**: Plan A = source OG image (imageUrl), Plan B = tag-matched gradient + emoji (never empty, never mixed)
- **Card body**: No summary on cards (title + tags + date only). Summary is detail-page-only.
- **Sources**: Free/no-paywall sites — The Conversation, BBC, Reuters, NPR, Scientific American, etc.
- **Knowledge scope**: Articles should broaden user's general knowledge (tech, science, current events, engineering, economics, history, society) — user lacks browsing/news exposure.
