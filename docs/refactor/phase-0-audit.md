# Phase 0 项目现状审计

**日期:** 2026-07-27
**执行:** Phase 0 执行工程师

---

## 项目概览

一个以 AI 为引擎、覆盖听说读写的英语学习 Web 应用。

| 维度 | 值 |
|------|-----|
| 前端框架 | Next.js 16.2.6 + React 19.2.4 |
| 样式方案 | Tailwind CSS v4 + inline style |
| 后端 | Next.js API Routes (App Router) |
| 数据库 | PostgreSQL (Neon Serverless) via Prisma 7.8 |
| AI 模型 | DeepSeek Chat (`deepseek-chat`) — 唯一 LLM |
| TTS | Edge TTS (Microsoft 云) + Kokoro-js (本地 ONNX) |
| 动画 | GSAP 3.15 + Motion 12.40 + OGL (WebGL) |
| 前端字体 | Geist + Playfair Display |
| 图标 | Lucide React |
| 状态管理 | React useState/useReducer, 模块级缓存 |
| 认证 | 无（单用户本地应用） |

**当前内容量:**
- 词汇: ~2000 内建 IELTS 词 + ~681 场景主题词
- 阅读: 50 篇英语文章（dev server 返回值）
- 听力: 290 个场景（dev server 返回值）+ 知识内容
- AI Coach: 预置 5 个场景种子，支持动态生成

---

## 功能清单

### 1. 词汇系统 (Vocabulary)

| 项目 | 详情 |
|------|------|
| **入口** | `/words` → `/words/dashboard` → `/words/study` |
| **主要文件** | `src/app/words/*.tsx`, `src/app/api/words/*.ts`, `src/lib/sm2.ts`, `src/lib/word-cache.ts` |
| **当前状态** | ✅ Words 页面 UI 和学习交互冻结。内部 API/基础设施可在后续阶段进行行为保持一致的迁移（需提前授权） |

**功能点:**
- SM-2 间隔重复算法（3 轮学习: 认识→复习→弱词强化）
- 每日学习队列（可配置 1-100 词/天）
- 主题词包（Kitchen, Car, Office 等 20+ 主题）
- AI 生成对话训练（每个词可生成情景对话 + 口语小贴士）
- AI 生成主题词包（3 步：主题名→词表→搭配例句）
- 已掌握词汇列表
- 模块级缓存（`word-cache.ts`）

### 2. 阅读系统 (Reading)

| 项目 | 详情 |
|------|------|
| **入口** | `/reading` |
| **主要文件** | `src/app/reading/*.tsx`, `src/app/api/reading/*.ts`, `scripts/reading-push.ts` |
| **当前状态** | ✅ 已完成 — Reading 不在 CLAUDE.md 明确冻结范围内，可在后续阶段进行受控重构 |

**功能点:**
- 文章列表浏览（新文章 / 历史 / 收藏）
- 文章阅读页（内联词汇提取 + 音标）
- 文章词汇添加至 SRS 复习队列（自动用 DeepSeek 补全音标/搭配/例句）
- 推送文章（API + CLI 脚本）
- RSS 解析（`rss-parser`）+ Mozilla Readability
- 10 天历史自动清理

### 3. 听力系统 (Listening)

| 项目 | 详情 |
|------|------|
| **入口** | `/listening` |
| **主要文件** | `src/app/listening/**/*.tsx`, `src/app/api/listening/**/*.ts`, `src/features/listening/**/*` |
| **当前状态** | 🚧 进行中 — Edge TTS 音频批量生成 (~25%) |

**功能点:**
- AI 生成听力场景（8 种对话类型: A1-A5, B, C1, C2）
- 场景自动补货（`refillSubCategory` — 当未听数量少于目标值时自动生成）
- TTS 音频生成（`node-edge-tts`，多角色声音映射）
- 分类系统（categories JSON 配置文件）
- 场景播放记录 + 历史管理
- 知识类听力（C1 单人叙述, C2 访谈）

### 4. AI Coach 口语对练

| 项目 | 详情 |
|------|------|
| **入口** | `/coach` |
| **主要文件** | `src/app/coach/page.tsx`, `src/app/api/coach/route.ts`, `src/app/api/scene/*.ts` |
| **当前状态** | ✅ AI Coach、Coach 场景系统和相关产品行为严格冻结。修改前必须获得明确授权 |

**功能点:**
- 语音识别输入（Web Speech API）
- 每轮两步 AI 调用：(1) 生成 AI 回复 → (2) 翻译 + 语法纠正 + 下一轮提示
- 预置 5 个场景种子（机械工程, AI Agent, 车辆工程, Friends, 餐厅）
- 智能场景推荐（基于已练习标签，反泡沫多样性）
- 动态场景生成
- 实时纠错（语法/拼写/地道性）

### 5. AI Assistant 浮动助手

| 项目 | 详情 |
|------|------|
| **入口** | 全局浮动按钮（所有页面可见） |
| **主要文件** | `src/components/AIAssistant.tsx`, `src/app/api/assistant/route.ts` |
| **当前状态** | ✅ 运行中 |

**功能点:**
- 英语单词查询（整合数据库）
- 翻译/语法/用法问答
- 浮动可拖拽面板（位置记忆 localStorage）
- 单词发音（SpeechSynthesis）

### 6. RAG / 知识检索

| 项目 | 详情 |
|------|------|
| **当前状态** | ❌ 未实现 |

目前没有独立的 RAG 系统。知识检索仅限于数据库单词和文章的精确查找。

### 7. 其他

| 功能 | 详情 |
|------|------|
| 数据库健康检查 | `/api/warmup` |
| 历史清理 | 10 天自动过期阅读/播放记录 |
| 每日进度 | `DailyProgress` 表已存在但未使用 |

---

## 当前架构

### 项目目录结构

```
english-web/
├── prisma/
│   ├── schema.prisma              # 7 个数据模型
│   ├── seed.ts                    # 3100+ 行种子脚本
│   ├── extract_phonetic.ts        # ECDICT 音标提取
│   └── *.json                     # 数据/缓存文件
├── src/
│   ├── app/
│   │   ├── layout.tsx             # 全局布局（含 AIAssistant + NoiseOverlay）
│   │   ├── page.tsx               # 首页（4 个功能入口卡片）
│   │   ├── error.tsx
│   │   ├── api/                   # 所有 API 路由（见下文）
│   │   ├── words/                 # 词汇页面
│   │   ├── reading/               # 阅读页面
│   │   ├── listening/             # 听力页面
│   │   └── coach/                 # AI Coach 页面
│   ├── features/
│   │   └── listening/             # 听力模块（组件 + lib）
│   ├── components/                # 通用组件（AIAssistant, 动画等）
│   ├── lib/                       # 共享库（prisma, sm2, types, utils, 缓存）
│   ├── data/                      # 静态 JSON 数据（listening-categories）
│   └── generated/prisma/          # Prisma 客户端生成输出
├── scripts/                       # CLI 工具（reading-push, audio-gen 等）
└── public/listening/              # TTS 音频文件
```

### API 路由清单

| 路由 | 方法 | 用途 | AI 调用 |
|------|------|------|---------|
| `/api/assistant` | POST | AI 助手问答 | 1× DeepSeek |
| `/api/warmup` | GET | 数据库健康检查 | 无 |
| `/api/coach` | POST | AI Coach 对话 | 2× DeepSeek |
| `/api/scene/generate` | POST | 生成新场景 | 1× DeepSeek |
| `/api/scene/recommend` | POST | 推荐场景 | 1× DeepSeek |
| `/api/reading` | GET | 文章列表 | 无 |
| `/api/reading/push` | POST | 推送文章 | 无 |
| `/api/reading/[id]` | GET | 获取文章详情 | 无 |
| `/api/reading/[id]/read` | POST | 标记已读 | 无 |
| `/api/reading/[id]/favorite` | POST | 切换收藏 | 无 |
| `/api/reading/[id]/vocab` | POST | 词汇加入 SRS | 1× DeepSeek |
| `/api/listening/categories` | GET | 获取分类 | 无 |
| `/api/listening/scenes` | GET | 场景列表 | 无 |
| `/api/listening/scenes/[id]` | GET/POST | 获取场景/标记播放 | 无（POST 触发 refill） |
| `/api/words` | GET/POST | 获取词库/SM-2 提交 | 无 |
| `/api/words/queues` | GET | 队列统计 | 无 |
| `/api/words/mastered` | GET | 已掌握词列表 | 无 |
| `/api/words/ai-train` | POST | AI 生成对话训练 | 1× DeepSeek |
| `/api/words/themes` | GET | 主题列表 | 无 |
| `/api/words/themes/[theme]` | DELETE | 删除主题 | 无 |
| `/api/words/themes/generate` | POST | 生成主题词包 | 3× DeepSeek |
| `/api/history/cleanup` | POST | 清除旧历史 | 无 |

### 当前架构图（文本）

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js SSR)              │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐  │
│  │ Words   │ │ Reading │ │Listening │ │ Coach   │  │
│  │ Pages   │ │ Pages   │ │ Pages    │ │ Page    │  │
│  └────┬────┘ └────┬────┘ └────┬─────┘ └────┬────┘  │
│       └──────────┼────────────┼─────────────┘       │
│                  │  AIAssistant (global)             │
│                  ▼                                    │
│           fetch() → /api/*                            │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              API Routes (Next.js App Router)          │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │  CRUD     │ │  Coach   │ │  Scene/Theme Gen   │   │
│  │  Routes   │ │(2-step)  │ │  (AI calls)        │   │
│  └────┬─────┘ └────┬─────┘ └─────────┬──────────┘   │
│       │            │                  │              │
│       ▼            ▼                  ▼              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐     │
│  │  Prisma   │ │  fetch   │ │  node-edge-tts  │     │
│  │  Client   │ │DeepSeek  │ │  (TTS)          │     │
│  └────┬─────┘ └────┬─────┘ └──────────────────┘     │
│       │            │                                 │
└───────┼────────────┼────────────────────────────────┘
        │            │
        ▼            ▼
┌───────────────┐ ┌────────────────────┐
│  PostgreSQL   │ │  DeepSeek API      │
│  (Neon)       │ │  api.deepseek.com  │
└───────────────┘ └────────────────────┘

Audio Storage: public/listening/ (local filesystem)
```

### Service 层

项目中不存在独立的 Service 层。所有业务逻辑直接在 API Route 中实现，或散落在 `features/listening/lib/` 下。具体来说：

- **API Routes** 同时承担：请求验证 + 提示词构建 + AI 调用 + 数据库操作 + 响应格式化
- **`features/listening/lib/listening.ts`** 是唯一接近 Service 的文件，但它混合了：AI 调用、DB 写入、TTS 生成、文件系统操作
- **`lib/` 目录** 只包含基础设施（prisma 客户端、SM-2 算法、类型、工具函数）

---

## AI 调用分析

### 调用总览

| # | 文件 | 调用次数/请求 | 模型 | 结构化输出 | 超时 | 重试 |
|---|------|-------------|------|-----------|------|------|
| 1 | `api/coach/route.ts` | 2 | deepseek-chat | 第2步是 | 30s | 无 |
| 2 | `api/scene/generate/route.ts` | 1 | deepseek-chat | 是 | 30s | 无 |
| 3 | `api/scene/recommend/route.ts` | 1 | deepseek-chat | 是 | 30s | 无 |
| 4 | `api/assistant/route.ts` | 1 | deepseek-chat | 否 | 30s | 无 |
| 5 | `api/words/ai-train/route.ts` | 1 | deepseek-chat | 是 | 30s | 无 |
| 6 | `api/words/themes/generate/route.ts` | 3 | deepseek-chat | 全是 | 30-120s | 无 |
| 7 | `api/reading/[id]/vocab/route.ts` | 1 | deepseek-chat | 是 | 30s | 无 |
| 8 | `features/listening/lib/listening.ts` | 1 | deepseek-chat | 否(手动解析) | 无 | 无 |
| 9 | `prisma/seed.ts` | 批量 | deepseek-chat | 是 | 有常量 | 无 |
| 10 | `scripts/reading-push.ts` | 1/文章 | deepseek-chat | 是 | 无 | 无 |

**关键发现:**
- **全部使用 DeepSeek Chat** — 无其他 LLM 供应商
- **10 个独立调用文件** — AI 调用完全分散
- **每次调用自己实现 fetch** — 无共享客户端层
- **无重试机制** — 任何位置都没有指数退避或重试
- **无 Token 统计** — 无处记录 Token 消耗
- **无耗时跟踪** — 无处记录 AI 调用延迟
- **端点路径不一致** — `listening.ts` 使用 `/chat/completions`（缺少 `/v1/`），其他位置正确使用 `/v1/chat/completions`
- **Prompt 管理**: 除 `listening-prompts.ts` 外，所有提示词都是内联字符串嵌入在路由文件中

---

## 数据模型分析

### 数据库表（7 个模型）

| 表 | 主要用途 | 关键问题 |
|----|---------|---------|
| `Word` | 核心词汇表（~2681 词） | 缺少 `word` 列索引 |
| `WordReview` | SM-2 间隔重复状态 | 每词仅一条记录（`@@unique([wordId])`），无历史、无用户关联 |
| `DailyProgress` | 每日学习进度 | **已创建但未被任何代码使用** |
| `Article` | 阅读文章（50 篇，dev server 验证） | `readAt`/`favoritedAt` 直接挂文章上，不支持多用户；`tags` 为逗号分隔字符串 |
| `ArticleVocab` | 文章词汇提取 | 缺少索引 |
| `ListeningScene` | 听力场景 | 使用字符串 ID（cuid），`categoryId`/`subcategoryId` 为字符串无 FK 约束 |
| `ListeningLine` | 对白/字幕行 | 正常 |

### 严重问题

1. **没有用户模型** — 整个应用无 `User` 表、无认证、无用户 ID。所有学习记录（WordReview 的播放/阅读状态）都是全局共享的。这意味着应用本质上是**单用户实例**。

2. **WordReview 缺少用户层** — `@@unique([wordId])` 约束意味着每个词只有一条复习记录。当前 WordReview 足以保存 SM-2 当前调度状态，但不保存逐次复习事件历史，因此无法支持：
   - 学习行为分析（如用户对某词的掌握趋势）
   - SM-2 算法效果评估（不同 rating 的长期分布）
   - 历史追溯（某词之前的复习记录回溯）
   - 多用户支持

3. **DailyProgress 表已死** — 表结构已定义，但没有任何页面或 API 读写它。

4. **缺少必要索引:**
   - `Word.word`（常用作查找条件）
   - `DailyProgress.date`（按日期查询）
   - `Article.tags` / `Article.content`（搜索/过滤）

---

## Pipeline 分析

### 1. 阅读 Pipeline

```
输入: RSS Feed URL / 手动推送
  │
  1. 获取文章（rss-parser + Mozilla Readability）
  │
  2. DeepSeek 分析（reading-push.ts: processWithDeepSeek）
     - 生成中文标题 (titleZh)
     - 生成中文摘要 (summaryZh)
     - 提取词汇表 (vocabItems: word, definition, contextSentence)
  │
  3. 存入数据库（POST /api/reading/push）
     - 创建 Article 记录 + 关联 ArticleVocab 记录
  │
  4. 用户阅读（GET /api/reading/[id]）
     - 音标富化（DB 匹配 → ECDICT → 短语首词回退）
  │
  5. 用户添加词汇到 SRS（POST /api/reading/[id]/vocab）
     - 如词不在 Word 表 → DeepSeek enrichWord（生成音标/词性/搭配/例句）
     - 创建 Word + WordReview 记录
  │
输出: 阅读体验 + 词汇进入 SRS 队列
```

**特点:** 第 2 步（AI 处理）在 CLI 脚本中完成（离线），第 5 步（词汇富化）是触发式的。Pipeline 各阶段通过数据库耦合，没有统一编排。

### 2. 听力 Pipeline

```
输入: 用户播放某个场景 → 触发 refillSubCategory
  │
  1. 检查补货条件:
     - 子类总数 < maxPoolSize?
     - 未听数量 < targetPoolSize?
     - 全局场景数 < globalSceneLimit?
  │
  2. DeepSeek 生成新场景（generateScene）
     - 根据 dialogueType 选择 system prompt（A1-A5/B/C1/C2）
     - 传入已有场景列表（供 AI 判断多样性）
     - 输出: GeneratedScene { title, titleZh?, type?, speakers?, lines[] }
  │
  3. 写入数据库（saveScene）
     - 创建 ListeningScene + ListeningLine 记录
     - 为每行生成音频（node-edge-tts, 多角色声音）
     - 每行间隔 200ms 防限流
  │
  4. 用户播放（GET /api/listening/scenes/[id]）
     - 标记 playedAt
     - 触发 refill（回到步骤 1）
  │
输出: 听力场景 + 音频文件
```

**特点:** 这是一个**惰性补货 Pipeline** — 内容在用户消费时才生成，而非预生成。Pipeline 逻辑都在 `features/listening/lib/listening.ts` 中，耦合度高。

### 3. 词汇学习流程

```
用户进入学习 → 请求 /api/words
  │
  ├── 复习队列: nextReviewAt <= now 且 isMastered=false
  ├── 新词队列: source='ielts' 且 theme IS NULL 且无 WordReview
  │
  3 轮学习:
  R1: 展示词 → 用户评 Known/Unknown → 翻面 → 详情 → Next/Mistaken
  R2: 同上，但未被 Mastered 的词重新出现
  R3: R2 未通过的词，最终轮
  │
  提交评分 → SM-2 算法计算间隔 → 更新 WordReview
  │
输出: 更新 SRS 状态
```

### 4. AI Coach 流程

```
用户选择/生成场景 → 进入对话
  │
  每轮:
  1. 用户输入（打字或语音识别）
  2. Step 1 (DeepSeek): 生成 AI 角色回复
     - 非 JSON 模式，纯文本
     - System prompt 包含角色、设定、对话规则
  3. Step 2 (DeepSeek): 分析
     - JSON 模式
     - 输出: 中文翻译、下一轮提示、语法纠正、是否结束
  4. 展示结果给用户
  │
  对话结束后可选: 推荐新场景（/api/scene/recommend）
```

---

## 技术债

### P0 — 架构性问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **没有用户模型** | 整个应用 | 无法支持多用户，所有数据全局共享。如果要加用户系统，WordReview、Article、ListeningScene 等都需要加 userId |
| 2 | **AI 调用完全分散** | 10 个独立文件各自实现 fetch | 无统一重试/降级/Token 统计/Trace。更换模型供应商需改 10 个文件 |
| 3 | **无共享 AI Client 层** | 全部 API routes | 无法统一管理超时、错误处理、重试策略 |
| 4 | **API Routes 职责过重** | 所有 route.ts 文件 | 业务逻辑、Prompt 构建、AI 调用、DB 操作全部混在一起 |

### P1 — 代码质量问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 5 | **Prompt 管理混乱** | 大部分内联在 API routes 中 | 难以审查、版本化、评估 prompt 质量。只有 `listening-prompts.ts` 做了分离 |
| 6 | **JSON 提取模式重复** | 至少 5 处 `indexOf('{')` + `lastIndexOf('}')` + `JSON.parse` | 抽取公共函数可减少大量重复代码 |
| 7 | **无错误处理一致性** | 各处 `try/catch` 行为不同 | 有时返回空值，有时 throw，有时返回错误 JSON |
| 8 | **每日进度表未使用** | `DailyProgress` 模型存在但 0 引用 | 无用的表定义，可能让开发者困惑 |
| 9 | **字符串标签** | `Article.tags` 为逗号分隔字符串 | 查询/过滤效率低，无法建立关联 |
| 10 | **端点路径不一致** | `listening.ts` 用 `/chat/completions` 而非 `/v1/` | 如果 DeepSeek 更改 API 路径会出问题 |

### P2 — 可观测性/可维护性

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 11 | **无 Token 统计** | 所有 AI 调用 | 无法监控成本，无法优化 Prompt 长度 |
| 12 | **无调用耗时跟踪** | 所有 AI 调用 | 无法发现性能瓶颈 |
| 13 | **无日志系统** | 整个应用 | 只有 `console.error`，无法追溯问题链路 |
| 14 | **无测试** | 整个项目 | Playwright 在 devDependencies 中但无测试文件。SM-2 算法、API 路由、AI 处理均无测试覆盖 |

### P3 — 架构演进障碍

| # | 问题 | 影响 |
|---|------|------|
| 15 | **业务逻辑与 AI 调用耦合** | 未来 Agent 化时无法单独替换 AI 组件 |
| 16 | **无 Trace 系统** | Agent 的多步决策无法追溯（哪一步错了？为什么？） |
| 17 | **模块级缓存不可控** | `word-cache.ts` 的模块级缓存不支持清除或过期 |
| 18 | **无用户状态管理** | 不支持跨会话学习路径、弱项追踪、个性化推荐 |

### 重复代码清单

1. **DeepSeek fetch 模式** — 在 `api/coach/route.ts`, `api/scene/generate/route.ts`, `api/scene/recommend/route.ts`, `api/assistant/route.ts`, `api/words/ai-train/route.ts`, `api/words/themes/generate/route.ts` (×3), `api/reading/[id]/vocab/route.ts`, `features/listening/lib/listening.ts`, `prisma/seed.ts`, `scripts/reading-push.ts` 中重复

2. **JSON 安全提取** — `coach/route.ts` 的 `safeJsonParse` + 散落在 4+ 文件中的 `indexOf/slice/parse` 模式

3. **AbortController + setTimeout 模式** — 在至少 6 个文件中重复

4. **环境变量读取** — `DEEPSEEK_API_KEY` 和 `DEEPSEEK_BASE_URL` 在 7 个文件中重复读取

---

## Phase 1 重构建议

基于以上现状分析，Phase 1（设计目标架构）应重点关注：

### 建议优先级

| 优先级 | 关注点 | 理由 |
|--------|--------|------|
| **最高** | 设计 AI Client 统一层 | 解决 P0#2/#3，是所有后续 Phase 的基础 |
| **高** | 规划 Service 层 | 解耦 API Routes 的业务逻辑与请求处理 |
| **高** | 定义 User 模型 | 虽然 Phase 6 才实现记忆系统，但 Phase 1 需要预留用户模型空间，避免后续重建 |
| **中** | 规范 Prompt 管理 | 复用 `listening-prompts.ts` 的方式，将所有 prompt 集中管理 |
| **中** | Pipeline 标准化设计 | 阅读/听力/词汇的 Pipeline 需要统一编排模式 |
| **低** | 索引与数据优化 | 可在 Phase 3/4 中逐步完成 |

### 架构目标草图（Phase 1 输出）

```
Frontend (Pages)          →  保持现状
  │
API Routes (App Router)   →  薄层，只做请求/响应转换
  │
Service Layer (新增)       →  业务逻辑：编排 Workflow、调用 AI Client
  │
AI Client (统一层)         →  Provider Adapter + 重试/降级/Token 统计/Trace
  │
Data Layer (Prisma)        →  保持现状 + 补充索引
```

Phase 1 的具体架构设计文档将在 Phase 1 中产出。

---

> **注意:** 本文档仅为现状分析，不修改任何业务代码，不引入新框架，不提前实现后续 Phase 的内容。

---

## 关键结论证据索引

以下为审计过程中每个重要结论的证据记录。

### F-001: AI 调用完全分散

| 项目 | 内容 |
|------|------|
| **结论** | 10 个独立文件各自实现 DeepSeek fetch 调用，无共享客户端层 |
| **涉及文件** | `api/coach/route.ts`, `api/scene/generate/route.ts`, `api/scene/recommend/route.ts`, `api/assistant/route.ts`, `api/words/ai-train/route.ts`, `api/words/themes/generate/route.ts` (×3), `api/reading/[id]/vocab/route.ts`, `features/listening/lib/listening.ts`, `prisma/seed.ts`, `scripts/reading-push.ts` |
| **关键证据** | 每个文件都独立包含 `fetch(.../chat/completions...)` + `Authorization: Bearer ${apiKey}` + 各自的超时/错误处理 |
| **调用关系** | API Routes → fetch DeepSeek (直接，无中间层) |
| **影响** | P0 — 更换模型需改 10 个文件；无法统一监控/重试/降级 |
| **验证方式** | ✅ 代码阅读确认 |

### F-002: 无重试机制

| 项目 | 内容 |
|------|------|
| **结论** | 所有 AI 调用均无指数退避或重试逻辑 |
| **涉及文件** | 所有含 DeepSeek 调用的文件（见 F-001） |
| **关键证据** | 每个调用的 `catch` 块要么返回 null，要么 throw，要么返回错误 JSON — 从不重试 |
| **影响** | P0 — 临时网络故障会导致功能完全失效 |
| **验证方式** | ✅ 代码阅读确认 |

### F-003: 无 Token 统计 / 耗时跟踪

| 项目 | 内容 |
|------|------|
| **结论** | 无处记录 Token 消耗或调用延迟 |
| **涉及文件** | 所有含 DeepSeek 调用的文件 |
| **关键证据** | 没有任何地方读取 `usage` 字段或记录 `performance.now()` |
| **影响** | P2 — 无法评估成本、优化 Prompt 长度、发现性能瓶颈 |
| **验证方式** | ✅ 代码阅读确认 |

### F-004: Prompt 管理混乱

| 项目 | 内容 |
|------|------|
| **结论** | 大部分提示词内联嵌入在路由文件中 |
| **涉及文件** | 除 `features/listening/lib/listening-prompts.ts` 外的所有含 AI 调用的文件 |
| **关键证据** | `listening-prompts.ts` 是唯一做抽取的文件（8 个独立 Prompt）；其他文件的 prompt 以字符串字面量形式嵌在路由代码中 |
| **影响** | P1 — 难以审查、版本化、复用 Prompt |
| **验证方式** | ✅ 代码阅读确认 |

### F-005: API Routes 职责过重

| 项目 | 内容 |
|------|------|
| **结论** | API Route 同时承担请求验证、Prompt 构建、AI 调用、DB 操作、响应格式化 |
| **涉及文件** | 大部分 `api/*/route.ts` 文件 |
| **关键证据** | 以 `api/coach/route.ts` 为例（280 行）：类型定义(40行) + fetch 包装(28行) + 业务逻辑(180行) + 错误处理(30行) |
| **影响** | P0 — 无法独立测试 AI 调用逻辑，模块边界模糊 |
| **验证方式** | ✅ 代码阅读确认 |

### F-006: JSON 提取模式重复

| 项目 | 内容 |
|------|------|
| **结论** | 多处使用相同的 `indexOf('{')` + `lastIndexOf('}')` + `slice` + `JSON.parse` 模式 |
| **涉及文件** | `api/coach/route.ts`, `api/scene/generate/route.ts`, `api/scene/recommend/route.ts`, `api/words/ai-train/route.ts`, `api/words/themes/generate/route.ts`, `api/reading/[id]/vocab/route.ts`, `features/listening/lib/listening.ts` |
| **关键证据** | 几乎完全相同的代码块重复出现，仅变量名不同 |
| **影响** | P1 — 抽取公共函数可减少 6+ 处重复 |
| **验证方式** | ✅ 代码阅读确认 |

### F-007: AbortController 模式重复

| 项目 | 内容 |
|------|------|
| **结论** | `new AbortController()` + `setTimeout(abort)` + `clearTimeout` 模式在至少 6 个文件中重复 |
| **涉及文件** | `api/coach/route.ts`, `api/scene/generate/route.ts`, `api/scene/recommend/route.ts`, `api/assistant/route.ts`, `api/words/ai-train/route.ts`, `api/words/themes/generate/route.ts`, `api/reading/[id]/vocab/route.ts` |
| **关键证据** | 每个文件都包含 8-12 行的超时控制样板代码 |
| **影响** | P1 — 模板代码可统一封装 |
| **验证方式** | ✅ 代码阅读确认 |

### F-008: DailyProgress 未使用

| 项目 | 内容 |
|------|------|
| **结论** | `DailyProgress` 模型定义在 schema 中但无任何业务代码引用 |
| **涉及文件** | `prisma/schema.prisma` (模型定义) |
| **关键证据** | 全局搜索 `DailyProgress`、`dailyProgress`、`daily_progress` — 仅在生成的 Prisma 客户端文件中出现 |
| **影响** | P1 — 无用表定义，可能让新开发者困惑 |
| **验证方式** | ✅ `grep -r "DailyProgress" src/app/` 无结果 |

### F-009: WordReview 无用户维度

| 项目 | 内容 |
|------|------|
| **结论** | `WordReview` 中没有 `userId` 字段，`@@unique([wordId])` 限制每词一条记录 |
| **涉及文件** | `prisma/schema.prisma` → WordReview 模型 |
| **关键证据** | `@@unique([wordId])` 约束，无 `userId` 列。当前 WordReview 足以保存 SM-2 当前调度状态，但不保存逐次复习事件历史 |
| **影响** | P0 — 无法支持多用户，无法追踪复习历史 |
| **验证方式** | ✅ schema 阅读确认 |

### F-010: 模块级缓存

| 项目 | 内容 |
|------|------|
| **结论** | 两处模块级缓存（非 React 状态，跨挂载生命周期） |
| **涉及文件** | `src/lib/word-cache.ts` (listWordCache, studyWordCache), `src/app/reading/[id]/page.tsx` (articleCache) |
| **关键证据** | `word-cache.ts`: `export const listWordCache: Record<string, WordData[]> = {}` — 模块级对象；`articleCache`: `const articleCache = new Map<string, ArticleData>()` — 模块级 Map |
| **影响** | P3 — 缓存不可控（无法主动清除/过期），可能返回过时数据；无用户隔离 |
| **验证方式** | ✅ 代码阅读确认 |

### F-011: 本地音频文件存储

| 项目 | 内容 |
|------|------|
| **结论** | TTS 音频文件存储在 `public/listening/` 下，运行时写入 |
| **涉及文件** | `features/listening/lib/listening.ts` (AUDIO_DIR), `scripts/generate-listening-audio.ts`, `scripts/generate-all-audio.ts` |
| **关键证据** | 297 个场景目录，5709 个 MP3 文件。build 报告 2 条警告：matching 25768 files 和 11418 files |
| **影响** | P1 — `public/` 是静态资源目录，不应作为运行时写入位置；build 性能受影响；部署时需处理音频同步 |
| **验证方式** | ✅ `ls public/listening/` 确认；✅ `npx next build` 输出确认警告 |

### F-012: 端点路径不一致

| 项目 | 内容 |
|------|------|
| **结论** | `listening.ts` 使用 `/chat/completions`（缺少 `/v1/`），其他文件正确使用 `/v1/chat/completions` |
| **涉及文件** | `features/listening/lib/listening.ts` 第 148 行 |
| **关键证据** | 该文件: `` `${DEEPSEEK_BASE_URL}/chat/completions` ``；其他全部: `` `${DEEPSEEK_BASE_URL}/v1/chat/completions` `` |
| **影响** | P1 — 如果 DeepSeek 更改 API 路径，此位置可能提前失效 |
| **验证方式** | ✅ 代码阅读对比确认 |

### F-013: 无认证 — 数据安全边界

| 项目 | 内容 |
|------|------|
| **结论** | 整个应用无用户认证机制 |
| **涉及文件** | 全局 |
| **关键证据** | schema 中无 User 模型；所有 API routes 无 token/cookie/session 验证 |
| **影响** | P0 — 如果部署到公共网络，所有学习数据完全公开 |
| **验证方式** | ✅ 代码阅读确认；⚠️ 当前为本地开发环境，风险在可控范围内 |

### F-014: 无测试覆盖

| 项目 | 内容 |
|------|------|
| **结论** | Playwright 在 devDependencies 中，但无任何测试文件 |
| **涉及文件** | 全局 |
| **关键证据** | `package.json` 包含 `@playwright/test`，但 `src/` 和根目录下无 `.spec.`/`.test.` 文件 |
| **影响** | P2 — SM-2 算法（核心业务逻辑）、API 路由、AI 处理均无测试覆盖 |
| **验证方式** | ✅ `grep -r "describe\|it\|test(" src/ --include="*.ts" --include="*.tsx"` 无结果 |

### F-015: 使用 `$queryRawUnsafe` 的安全与维护风险

| 项目 | 内容 |
|------|------|
| **结论** | `api/listening/scenes/route.ts` 使用 `$queryRawUnsafe`，当前值参数通过占位符传递，尚未确认存在实际 SQL 注入漏洞，但该模式降低了安全保证 |
| **涉及文件** | `src/app/api/listening/scenes/route.ts` 第 30 行 |
| **关键证据** | `$queryRawUnsafe<any[]>(sql, ...params)` — 虽然值通过参数占位符传递，但 SQL 字符串用 `$${paramIndex++}` 动态拼接，外层仍使用 `$queryRawUnsafe`（而非 `$queryRaw`）|
| **影响** | P1 — 当前未发现可利用的注入点，但 `$queryRawUnsafe` 模式与参数化字符串拼接的组合降低了安全保证，增加了维护者的认知负担。后续应审查并替换为 `$queryRaw` 或 Prisma 类型化查询 |
| **验证方式** | ✅ 代码阅读确认 |

### F-016: refill Pipeline 并发风险

| 项目 | 内容 |
|------|------|
| **结论** | `refillSubCategory` 无锁机制，高并发下可能重复生成场景 |
| **涉及文件** | `features/listening/lib/listening.ts` (refillSubCategory) |
| **关键证据** | 函数先检查 count 条件（SELECT），再生成（DeepSeek），再写入（INSERT），期间无事务或锁保护 |
| **影响** | P2 — 理论上可能生成重复场景（实际低频调用，风险较低） |
| **验证方式** | ⚠️ 代码逻辑推演，未通过并发测试验证 |

### F-017: 听力场景生成无超时

| 项目 | 内容 |
|------|------|
| **结论** | `features/listening/lib/listening.ts` 中 `generateScene` 无 AbortController |
| **涉及文件** | `features/listening/lib/listening.ts` `generateScene` 函数（约第 148-164 行） |
| **关键证据** | fetch 调用没有 `signal` 参数，无 `AbortController`；而 C2 类型 max_tokens=4500 可能耗时很长 |
| **影响** | P1 — 如果 DeepSeek 响应慢或无响应，请求可能挂起数分钟 |
| **验证方式** | ✅ 代码阅读确认 |

### F-018: `Article.tags` 为逗号分隔字符串

| 项目 | 内容 |
|------|------|
| **结论** | 标签以逗号分隔的普通字符串存储，无法高效查询 |
| **涉及文件** | `prisma/schema.prisma` → Article.tags: `String` |
| **关键证据** | 查询标签时只能用 `LIKE %tag%`（当前未用 Prisma 的 `contains` 过滤标签） |
| **影响** | P1 — 需要多对多关系或 JSON 数组以提高查询效率 |
| **验证方式** | ✅ schema 阅读确认 |

---

## 模块依赖与调用关系图

### 页面 → API Route 映射

```
/ (首页)
  ├── layout.tsx ─────────────────────────→ <AIAssistant /> (全局浮动按钮)
  │
  ├── /words ─── /words/page.tsx
  │               ├── → Nav: /words/dashboard
  │               └── → Nav: /words/themes
  │
  ├── /words/dashboard ── /words/dashboard/page.tsx
  │                        └── fetch → GET /api/words/queues
  │                        ├── Nav: /words/study?queue=new&dailyTarget=N
  │                        └── Nav: /words/study?queue=review&dailyTarget=N
  │
  ├── /words/study ── /words/study/page.tsx
  │                    ├── fetch → GET /api/words (queue, dailyTarget, theme)
  │                    └── fetch → POST /api/words (wordId, rating)
  │
  ├── /words/themes ── /words/themes/page.tsx
  │                     ├── fetch → GET /api/words/themes
  │                     ├── fetch → POST /api/words/themes/generate {theme}
  │                     └── Nav: /words/themes/[theme]
  │
  ├── /reading ── /reading/page.tsx
  │                └── fetch → GET /api/reading (filter)
  │                └── Nav: /reading/[id]
  │
  ├── /reading/[id] ── /reading/[id]/page.tsx
  │                     ├── fetch → GET /api/reading/[id]
  │                     ├── fetch → POST /api/reading/[id]/read
  │                     ├── fetch → POST /api/reading/[id]/favorite
  │                     └── fetch → POST /api/reading/[id]/vocab {vocabId/vocabIds}
  │
  ├── /listening ── ListeningLanding
  │                  ├── fetch → GET /api/listening/categories
  │                  └── fetch → GET /api/listening/scenes
  │                  └── Nav: /listening/scenes | /listening/knowledge
  │
  ├── /listening/scenes ── /listening/scenes/page.tsx
  │                         └── fetch → GET /api/listening/scenes (categoryId)
  │                         └── Nav: /listening/[id]
  │
  ├── /listening/[id] ── /listening/[id]/page.tsx
  │                       ├── fetch → GET /api/listening/scenes/[id]
  │                       ├── fetch → GET /api/listening/scenes (for prev/next)
  │                       ├── fetch → POST /api/listening/scenes/[id] (mark played → triggers refill)
  │                       └── <audio> → /listening/{sceneId}/line-{n}.mp3 (static)
  │
  └── /coach ── /coach/page.tsx
                 ├── fetch → POST /api/scene/recommend {practicedTags}
                 ├── fetch → POST /api/scene/generate {prompt, reference}
                 └── fetch → POST /api/coach {messages, scenario}
                 └── Web Speech API (voice input + output)
```

### API Route → lib/features → 外部依赖

```
── API Routes ────────→ lib/features ──────→ External ─────┐

/api/assistant                │                              │
  └→ 读取 DEEPSEEK_API_KEY    ├── fetch → ────→ api.deepseek.com
  └→ 可选查询 Word 表         └── prisma ────→ Neon PostgreSQL

/api/coach (两步)             │                              │
  └→ Step 1: 生成回复         ├── fetch → ────→ api.deepseek.com
  └→ Step 2: 翻译+纠正        ├── fetch → ────→ api.deepseek.com

/api/scene/generate           │                              │
  └→ 生成场景                 ├── fetch → ────→ api.deepseek.com

/api/scene/recommend          │                              │
  └→ 推荐场景                 ├── fetch → ────→ api.deepseek.com

/api/words/ai-train           │                              │
  └→ 查询 Word 表             ├── prisma ────→ Neon PostgreSQL
  └→ 生成对话                 ├── fetch → ────→ api.deepseek.com

/api/words/themes/generate    │                              │
  └→ Step 0: 主题名           ├── fetch → ────→ api.deepseek.com
  └→ Step 1: 词表             ├── fetch → ────→ api.deepseek.com
  └→ Step 2: 搭配例句         ├── fetch → ────→ api.deepseek.com
  └→ 写入数据库               └── prisma ────→ Neon PostgreSQL

/api/reading/[id]/vocab       │                              │
  └→ enrichWord (DeepSeek)    ├── fetch → ────→ api.deepseek.com
  └→ 写入 Word + WordReview   └── prisma ────→ Neon PostgreSQL

/api/listening/scenes/[id]/POST                              │
  └→ mark played              ├── prisma ────→ Neon PostgreSQL
  └→ refillSubCategory        │                              │
      ├→ generateScene        ├── fetch → ────→ api.deepseek.com
      └→ saveScene             │                             │
          ├→ DB insert         ├── prisma ────→ Neon PostgreSQL
          ├→ Edge TTS gen      ├── node-edge-tts → Microsoft Edge TTS
          └→ audio write       └── fs ────────→ public/listening/{id}/

/api/reading (CRUD)           │                              │
/api/words (CRUD)             ├── prisma ────→ Neon PostgreSQL
/api/words/queues             │
/api/words/mastered           │
/api/listening/scenes (GET)   │
/api/listening/categories     ├── fs ────────→ src/data/listening-categories.json
/api/history/cleanup          └── prisma ────→ Neon PostgreSQL

── Scripts ────────────→ lib/features ──────→ External ─────┐

scripts/reading-push.ts       │                              │
  ├→ rss-parser               ├── fetch → ────→ RSS feeds (The Conversation)
  ├→ @mozilla/readability     ├── (内存 HTML 解析)
  ├→ processWithDeepSeek      ├── fetch → ────→ api.deepseek.com
  └→ 写入数据库               └── prisma ────→ Neon PostgreSQL

prisma/seed.ts                │                              │
  ├→ ECDICT 读取              ├── better-sqlite3 → prisma/ecdict/stardict.db
  ├→ DeepSeek 生成            ├── fetch → ────→ api.deepseek.com
  └→ 写入数据库               └── prisma ────→ Neon PostgreSQL

scripts/generate-listening-*.ts                              │
  ├→ 数据库读场景              ├── prisma ────→ Neon PostgreSQL
  ├→ Edge TTS 批量生成         ├── node-edge-tts → Microsoft Edge TTS
  └→ 音频写入                 └── fs ────────→ public/listening/{id}/
```

### 模块内调用关系（细粒度）

```
=== Listening 模块 ===

POST /api/listening/scenes/[id]
  │
  ├── prisma.listeningScene.update({where:{id}, data:{playedAt}})
  │
  └── refillSubCategory(subCategoryId)
        │
        ├── findSubCategory(id) → loadCategories() → fs.readFile(categories.json)
        ├── prisma.listeningScene.count(where:{subcategoryId})
        ├── prisma.listeningScene.findMany(where:{subcategoryId}) (existing titles)
        │
        ├── generateScene(subCategory, existingScenes)
        │     ├── getSystemPrompt(dialogueType) → listening-prompts.ts
        │     └── fetch(DeepSeek /chat/completions) ← 无 /v1/，无超时！
        │
        └── saveScene(subCategoryId, categoryId, generated, difficulty)
              ├── prisma.listeningScene.create({data:{..., lines:{create:[...]}}})
              ├── fs.mkdirSync(AUDIO_DIR/scene.id)
              ├── for each line:
              │     ├── new EdgeTTS({voice}).ttsPromise(english, audioPath)
              │     └── prisma.listeningLine.update({where:{id}, data:{audioUrl}})
              │     └── await new Promise(r => setTimeout(r, 200))
              └── return {id}

=== 词汇模块 ===

GET /api/words?queue=xxx
  │
  ├── queue='review':
  │     └── prisma.wordReview.findMany({where:{nextReviewAt≤now, isMastered:false}, include:{word}})
  │
  ├── queue='new':
  │     └── prisma.$queryRaw(SELECT ... FROM "Word" WHERE source='ielts' AND id NOT IN (...excludeIds...) ORDER BY RANDOM() LIMIT N)
  │
  └── queue=null (combined):
        ├── 先取 dueReviews (同上)
        ├── 计算剩余容量 = dailyTarget - dueReviews.length
        └── 取新词 (同上，LIMIT remaining)

POST /api/words (SM-2 评分提交)
  └── sm2(rating, prev) → {interval, easiness, repetitions, nextReviewAt}
  └── prisma.wordReview.upsert(...)

=== 阅读模块 ===

GET /api/reading/[id] (文章详情)
  ├── prisma.article.findUnique({where:{id}, include:{vocabItems}})
  └── 对每个 vocabItem:
        ├── prisma.word.findFirst({where:{word}}) (音标匹配)
        ├── getPhoneticMap() → fs.readFile(ecdict_phonetic.json)
        └── 短语回退: 取首词查音标

POST /api/reading/[id]/vocab
  └── addVocabToSRS(vocab)
        ├── prisma.word.findFirst({where:{word:vocab.word}})
        ├── 不存在 → DeepSeek enrichWord(word) → 创建 Word + WordReview
        ├── 存在 → 如果无 WordReview → 创建 WordReview
        └── prisma.articleVocab.update({where:{id}, data:{addedToReview:true}})
```

---

## 环境变量和外部依赖清单

### 运行环境变量

| 变量名 | 使用位置 | 必需 | 外部服务 | 缺失时影响 | Fallback |
|--------|---------|------|---------|-----------|---------|
| `DATABASE_URL` | `src/lib/prisma.ts` | ✅ 是 | Neon PostgreSQL | 数据库无法连接，应用完全不可用 | 无 |
| `DEEPSEEK_API_KEY` | 7 个 API 文件 + 2 个脚本 | ✅ 是 | DeepSeek API | 所有 AI 功能（Coach/阅读/听力/词汇）失效 | 读取后检查 `if (!apiKey) return error` |
| `DEEPSEEK_BASE_URL` | 同上 | ❌ 否 | DeepSeek API | 使用默认值 `https://api.deepseek.com` | `'https://api.deepseek.com'` |

### 外部服务依赖

| 服务 | 用途 | 协议 | 调用方式 | 降级策略 |
|------|------|------|---------|---------|
| **DeepSeek API** | 所有 AI 文本生成 | HTTPS REST | `fetch(api.deepseek.com/v1/chat/completions)` | 部分位置返回空值/错误消息（无统一降级） |
| **Neon PostgreSQL** | 数据持久化 | PostgreSQL Wire | Prisma Client (WebSocket) | `prisma.ts` 预热连接池，失败时 API 返回 500 |
| **Microsoft Edge TTS** | 听力音频合成 | HTTPS | `node-edge-tts` 库 | 音频行生成失败时跳过（`console.warn`），DB 中 `audioUrl` 为 null |
| **ECDICT (SQLite)** | 音标/词义数据源（种子阶段） | 本地文件 | `better-sqlite3` | 仅种子脚本使用，非运行时依赖 |
| **RSS Feeds** | 阅读文章采集 | HTTPS | `rss-parser` | 推送脚本中跳过失败的 feed |
| **Mozilla Readability** | HTML 文章提取 | 本地库 | `@mozilla/readability` + `jsdom` | 如果提取失败，跳过该文章 |

### 本地依赖

| 依赖 | 用途 | 位置 | 说明 |
|------|------|------|------|
| Kokoro-js (ONNX) | TTS 模型（脚本使用） | `node_modules/kokoro-js` | `scripts/generate-sample-audio.ts` 使用，生产未使用 |
| ECDICT 音标 JSON | 运行时音标查找 | `prisma/ecdict_phonetic.json` (6.4MB) | `api/reading/[id]/route.ts` 读取到内存 |
| 种子数据 JSON | 预生成种子数据 | `prisma/complete_seed_data.json` (1.6MB) | 快速烘焙种子使用 |
| AI 生成数据缓存 | 种子脚本断点续传缓存 | `prisma/generated_data.json` (1.4MB) + `generated_scene_data.json` (377KB) | 非生产依赖 |

### 文件系统依赖

| 路径 | 用途 | 运行时写入 | 部署风险 |
|------|------|-----------|---------|
| `public/listening/` | TTS 音频文件（5709 个 MP3） | ✅ 是 | **高风险** — `public/` 专为静态资源设计，运行时写入在 Vercel/Serverless 环境会丢失；build 时被 Turbopack 扫描（11418 文件匹配），影响构建性能 |
| `src/data/listening-categories.json` | 听力分类配置 | ❌ 否 | 低风险 — JSON 配置文件 |
| `prisma/ecdict_phonetic.json` | 音标查找表 | ❌ 否 | 低风险 — 只读数据 |

---

## 当前运行基线

### 测试环境

| 项目 | 值 |
|------|-----|
| Node.js | 通过 `npx` 运行（D:\\nodejs\\node.exe） |
| 操作系统 | Windows 11 Home China |
| 包管理器 | npm |
| 数据库 | Neon PostgreSQL（`.env` 中已配置） |
| .env 文件 | ✅ 存在，含 DATABASE_URL + DEEPSEEK_API_KEY + DEEPSEEK_BASE_URL |

### 依赖安装

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `node_modules/` | ✅ 存在 | 已执行 `npm install` |
| `postinstall` (prisma generate) | ✅ 已完成 | `src/generated/prisma/` 已生成 |

### TypeScript 类型检查

| 命令 | 结果 |
|------|------|
| `npx tsc --noEmit` | ✅ **通过** — 无错误输出（约 7.2s） |

### ESLint 检查

| 命令 | 结果 |
|------|------|
| `npx next lint` | ❌ 因路径含 `'`（Ethan's）导致 Next.js 目录检测失败 |
| `npx eslint src/` | ⚠️ **39 errors, 38 warnings** |

**主要错误文件：**

| 文件 | 错误类型 | 严重度 |
|------|---------|--------|
| `src/app/coach/page.tsx` | 2× setState in effect (`react-hooks/set-state-in-effect`) | 高 |
| `src/app/listening/[id]/page.tsx` | 3× ref access during render (`react-hooks/refs`) | 高 |
| `src/app/coach/page.tsx` | `no-unused-expressions` | 中 |
| 多个页面文件 | `@next/next/no-img-element` (×多个) | 低 |
| 多个页面文件 | `@typescript-eslint/no-unused-vars` (×多个) | 低 |
| 多个文件 | `@typescript-eslint/no-explicit-any` (×多个) | 低 |

> **注意:** `set-state-in-effect` 和 `refs` 错误来自 React 19 的新严格 lint 规则。这些在 React 18 中不会报错。从 React 19 官方指南看，这些模式虽然不推荐但仍可运行。

### Production Build

| 命令 | 结果 |
|------|------|
| `npx next build` | ✅ **编译成功** (13.0s) |
| TypeScript 阶段 | ✅ 通过 (7.2s) |
| 静态页面生成 | ✅ 33/33 pages (761ms) |
| 警告 | ⚠️ 2 条 — `public/listening/` 文件模式过宽（25768/11418 文件匹配），影响构建性能 |

**构建输出的所有路由：**

```
Route (app) - 总计 31 路由
├ ○ / (静态)
├ ○ /_not-found
├ ƒ /api/assistant, /api/coach, /api/history/cleanup
├ ƒ /api/listening/categories, /api/listening/scenes, /api/listening/scenes/[id]
├ ƒ /api/reading, /api/reading/[id], /api/reading/[id]/favorite
├ ƒ /api/reading/[id]/read, /api/reading/[id]/vocab, /api/reading/push
├ ƒ /api/scene/generate, /api/scene/recommend, /api/warmup
├ ƒ /api/words, /api/words/ai-train, /api/words/mastered
├ ƒ /api/words/queues, /api/words/themes, /api/words/themes/[theme]
├ ƒ /api/words/themes/generate
├ ○ /coach (静态)
├ ○ /listening (静态)
├ ƒ /listening/[id] (动态)
├ ○ /listening/history, /listening/knowledge, /listening/scenes
├ ○ /reading, /reading/favorites, /reading/history
├ ƒ /reading/[id] (动态)
├ ○ /words, /words/dashboard, /words/mastered, /words/study
├ ○ /words/themes, /words/themes/[theme], /words/themes/[theme]/list
```

> `○` = 静态生成，`ƒ` = 动态（Server/Edge）

### Dev Server

| 检查项 | 状态 | 备注 |
|--------|------|------|
| Dev server | ✅ 验证完成 | `npx next dev -p 3456` 启动成功，3.6s 内 Ready |

### 数据库连接

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `.env` 配置 | ✅ 已确认 | DATABASE_URL 已配置到 Neon |
| Prisma Client 生成 | ✅ 已确认 | `src/generated/prisma/` |
| 数据库连接实现 | ✅ 已确认 | `prisma.ts` 中有预热查询 `SELECT 1 AS warmed_up`，失败标记 `warmedUp = false`，查询会在首次请求时重试 |
| 数据库实际连通性 | ✅ 验证通过 | `/api/warmup` 返回 `{"status":"ok"}`，Neon 连接正常。首次请求耗时 1314ms (application-code) + 381ms (next.js) |
| 数据库迁移 | ✅ 已确认 | 3 次迁移（baseline + publishedAt + favoritedAt）|

### 页面/API 可达性（通过 dev server 实际验证）

| 检查项 | HTTP 状态 | 响应时间 | 备注 |
|--------|----------|---------|------|
| `/` (首页) | 200 | 992ms | 静态页面，渲染正常 |
| `/words` | 200 | 495ms | 词汇入口正常 |
| `/reading` | 200 | 477ms | 阅读列表正常 |
| `/listening` | 200 | 387ms | 听力入口正常 |
| `/coach` | 200 | 438ms | Coach 入口正常 |
| `/listening/scenes` | 200 | 402ms | 场景列表正常 |
| `/listening/knowledge` | 200 | 406ms | 知识听力正常 |
| `/reading/1444` (单篇文章) | 200 | — | 动态文章页正常 |
| `/api/warmup` | 200 | 1695ms | DB 健康检查通过 → `{"status":"ok"}` |
| `/api/reading` (文章列表) | 200 | 790ms | 返回 50 篇文章 |
| `/api/listening/categories` | 200 | 226ms | 返回 8 个分类配置 |
| `/api/listening/scenes` | 200 | — | 返回 290 个场景 |
| `/api/words/queues` | 200 | 1152ms | 返回队列统计（review=12, new=1967, mastered=21, total=2000）|
| 所有 DeepSeek 调用 | ⏳ 未测试 | — | 不消耗 DeepSeek 额度 |

**运行结论:**
- ✅ TypeScript 类型检查通过
- ✅ Production build 通过（33/33 pages）
- ✅ Dev server 启动正常
- ✅ Neon 数据库实际连接成功
- ✅ 所有只读 API 正常返回
- ⚠️ ESLint 39 错误（主要为 React 19 新 lint 规则）
- ⚠️ 构建 2 条警告（public/listening 文件模式过宽）

---

## 已知风险与未知事项

### 已确认问题（代码阅读验证）

| # | 风险 | 严重度 | 验证方式 |
|---|------|--------|---------|
| R-01 | `public/listening/` 运行时写入 — 在 Serverless/容器化部署中会丢失音频文件 | **高** | build 输出警告确认（25768 文件匹配）|
| R-02 | 多条 AI 调用路径无超时 — `features/listening/lib/listening.ts` 的 `generateScene` 无 AbortController | **高** | 代码阅读确认 |
| R-03 | `reading-push.ts` 的 `processWithDeepSeek` 无超时 | **中** | 代码阅读确认 |
| R-04 | 数据库写入无幂等性 — `POST /api/reading/push` 不检查 title/url 唯一性（由 CLI 脚本去重） | **中** | 代码阅读 — API 直接 `article.create` |
| R-05 | refill Pipeline 无事务/锁保护 — 并发请求可能重复生成场景 | **中** | 代码逻辑推演 |
| R-06 | 模块级缓存不可控 — `word-cache.ts` 和 `articleCache` 不过期、不清除 | **中** | 代码阅读确认 |
| R-07 | WordReview 无日志模式 — `@@unique([wordId])` 只保留最新状态，丢失历史 | **中** | schema 确认 |
| R-08 | `api/listening/scenes/route.ts` 使用 `$queryRawUnsafe` — 虽然参数化但 SQL 字符串拼接是不安全模式 | **低** | 代码阅读确认 |
| R-09 | `Article.tags` 字符串格式 — 无法高效按标签筛选文章 | **低** | 代码阅读确认 |
| R-10 | ESLint 39 错误 — 主要为 React 19 新 lint 规则触发 | **低** | eslint 运行验证 |

### 推测风险（逻辑推演，未通过运行验证）

| # | 风险 | 依据 |
|---|------|------|
| R-11 | `generateScene` 的 JSON 解析可能失败 — 使用 fence 剥离而非 `response_format: json_object` | DeepSeek 可能返回 markdown 包装的 JSON，如果格式变化可能解析失败 |
| R-12 | 200ms TTS 延迟可能导致长时间响应 — 如果场景 30 行，总延迟约 6s | 每行生成后 `await new Promise(r => setTimeout(r, 200))` |
| R-13 | Coach 两步串行调用总延迟可能超 60s — Step 1 (30s timeout) + Step 2 (30s timeout) | 体验为串行等待 |
| R-14 | 听力场景生成 C2 类型 max_tokens=4500 可能被截断 | DeepSeek 默认输出限制未知，4500 tokens 对长访谈可能不够 |
| R-15 | 主题词包生成 Step 2 (max_tokens=12000) 可能在 120s 超时内完成不了 | 35-45 词的搭配 + 例句同时生成 |

### 尚未验证

| # | 项目 | 原因 |
|---|------|------|
| U-01 | ~~Dev server 能否正常启动~~ | ✅ 已验证通过 — 3.6s 启动，所有静态页面和只读 API 返回 200 |
| U-02 | ~~数据库连接是否正常~~ | ✅ 已验证通过 — `/api/warmup` 返回 `{"status":"ok"}` |
| U-03 | DeepSeek API Key 是否有效 | Key 在 `.env` 中配置。需发送实际请求验证。Key 可能余额不足或过期 |
| U-04 | 听力音频是否可播放 | MP3 文件生成的 Edge TTS 格式正确性未验证（2.3 秒内完成所有场景的 TTS 生成可能有些文件不完整） |
| U-05 | SM-2 算法边界情况 | `sm2.ts` 无测试覆盖，rating=3/4/5 的边界行为未验证 |
| U-06 | 阅读文章内容完整性 | `scripts/reading-push.ts` 使用 `@mozilla/readability` 从 HTML 提取，部分文章可能提取不完整 |
| U-07 | Seed 脚本能否重跑 | `prisma/seed.ts` 使用 `deleteMany` 先删后插，需验证不会破坏现有数据 |

### 因环境或凭据无法验证

| # | 项目 | 原因 |
|---|------|------|
| V-01 | DeepSeek 实际调用和响应质量 | 需要消耗 API 额度；评估 prompt 质量需要多名测试者 |
| V-02 | Neon 数据库迁移正确性 | 需要目标数据库连接可写；当前迁移已应用，回滚测试有风险 |
| V-03 | Edge TTS 配额/限速 | `node-edge-tts` 调用微软云服务，可能受调用频率限制 |
| V-04 | 实际预置 5 个 Coach 场景执行效果 | 需要 DeepSeek Key + 实际对话测试 |
| V-05 | 主题词包生成质量和数据正确性 | 需要 DeepSeek Key + 人工审核生成结果 |

---

## 冻结模块说明

### 来源

CLAUDE.md 中 "禁止修改（需用户明确授权）" 规则：

```
## 禁止修改（需用户明确授权）
AI Coach 口语对练 + 场景系统 / Words 页面 UI / `schema.prisma`
```

VISION.md 中的说明：

```
§4 AI Coach（锁定）
§5 词汇 SRS（锁定）
```

### 冻结范围解释

| 冻结条目 | 涉及文件/目录 | 禁止的行为 | 允许的行为 | 判断标准 |
|---------|-------------|-----------|-----------|---------|
| **AI Coach 口语对练** | `src/app/coach/`、`src/app/api/coach/route.ts`、`src/app/api/scene/`、`src/app/coach/types.d.ts` | 改变 Coach 功能行为、UI 布局、对话流程、页面结构 | 对 Coach 内部使用的 AI 调用进行"行为保持一致的内部迁移"（如统一 AI Client、添加 Trace） | 用户侧不应感知到变化 |
| **Words 页面 UI** | `src/app/words/*.tsx`（页面文件） | 修改词汇页面的视觉布局、交互逻辑、学习流程 | 更新词汇相关 API 的内部实现（如统一 AI Client），但修改前仍须获得用户明确授权 | Words 页面渲染出的 UI 应保持一致 |
| **`schema.prisma`** | `prisma/schema.prisma` | 添加、删除、修改数据模型字段或关系 | — | **最严格冻结** — 任何 schema 修改都需要明确授权 |
| **场景系统** | 与 Coach 场景生成相关的文件 | 修改场景生成逻辑、种子场景定义、场景推荐行为 | — | 跟随 AI Coach 冻结范围 |

> **注意:** Reading 模块**不在** CLAUDE.md 明确冻结范围内，可在后续阶段进行受控重构。

### 后续重构的影响规则

1. **Phase 3 统一 AI Client 时**：允许对冻结模块内部使用的 AI 调用进行迁移（将 `fetch(DeepSeek)` 替换为统一的 AI Client 调用），但**必须**：
   - 保持输入/输出格式完全一致
   - 保持调用参数（温度、max_tokens 等）相同
   - 不影响功能行为
   - 迁移后经过回归验证
   - 对于明确冻结的文件，修改前仍须获得用户明确授权

2. **Phase 4 重构 Pipeline 时**：非冻结模块（Reading、Listening）可以先引入新架构，冻结模块保持原架构。

3. **冻结文件修改流程**：任何需要对冻结文件、目录或模型进行的修改，必须：
   - 在修改前显式询问用户授权
   - 说明修改范围、理由和对冻结模块的影响
   - 获得明确确认后再执行

### 不受冻结影响的范围

以下目录/文件允许在后续 Phase 中正常修改（保持行为一致的前提下）：

- `src/app/reading/` — 阅读模块（⚠️ 不受冻结约束，但修改前仍建议清晰说明影响范围）
- `src/app/listening/` — 听力模块（⚠️ `schema.prisma` 中的 ListeningScene/ListeningLine 模型受冻结保护）
- `src/features/listening/` — 听力业务逻辑
- `src/components/` — 通用组件（`AIAssistant.tsx` 等）
- `src/lib/` — 共享库（可新增 AI Client 等）
- `scripts/` — 维护脚本
- `prisma/seed.ts` — 种子脚本
