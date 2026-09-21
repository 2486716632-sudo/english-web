# Phase 7 任务定义 — Vocabulary Platform Design & Data Provenance

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 7 |
| **名称** | Vocabulary Platform Design & Data Provenance |
| **状态** | Ready / **Not Started**（本文件是 Phase 7 的正式任务定义；执行前需**用户明确批准**） |
| **阶段性质** | **证据（evidence）+ 研究（research）+ 架构设计（architecture design）** —— 阶段内**不实现**任何 Vocabulary 未来架构 |
| **前置条件** | Phase 0–6 全部 Completed / Approved；Phase 6 于 2026-09-14 经外部审核 **v3 Approved**（Blocking Issues: None）；已批准**全量测试套件** 40 files / **544 tests** 全绿（其中 Phase 2–5 **受保护基线** 为 **442 tests**，Phase 6 新增 **102 tests**） |
| **已验证 Git 基线** | 分支 `refactor/portfolio-engineering-roadmap`，HEAD `fa1f3e63507efbf80f0a95d2b47f70f1d0cf90ee`，工作区干净（`origin/refactor/portfolio-engineering-roadmap` 与本地一致） |
| **可依赖的已批准资产** | Phase 3 `AIClientPort`；Phase 4 参考确定性 Workflow（Reading 摄取管线）；Phase 5 `TracePort` / `ExecutionContext` / `runInTrace` / `runInSpan`；Phase 6 `ExecutionContext.userId` 权威身份、`UserRepositoryPort` / `MemoryRepositoryPort`、`GetUserContextUseCase` / `UpdateLearningProfileUseCase` / `RememberUserFactUseCase`、有界确定性 Memory 选择、canonical State vs Memory 所有权 |
| **本阶段产出形态** | 设计 / 证据**文档**（不产出生产代码、schema、migration、数据导入） |
| **评审状态** | 执行者**不得**自行标记 Approved；外部审核 + 用户明确批准是唯一闸门 |
| **开始日期** | — （需用户明确批准后填写） |

> 本文件是 Phase 7 的**唯一**范围归属。范围以本文件为准，**不得**扩张。
> 本文件由 TASK-CONSTRUCTION（任务构建）会话产出，**不**构成实现授权：
> 它没有实现 Phase 7，也没有修改任何生产源码、Prisma schema、migration、依赖、Vocabulary UI / API、
> seed 数据或数据库数据。

---

## Part 0 — 复原说明（后续执行会话必读）

本任务必须能够被一个**没有聊天记忆**的 Codex 执行会话独立完成。执行者必须：

1. 依据**当前仓库与 Git**重建上下文（见 Part 1 / Part 2），而不是依据聊天记录或旧命令措辞；
2. 把本文件当作**范围权威**，把 `docs/refactor/` 下的既有权威文档当作**设计意图权威**；
3. 在**证据不足**时显式记录为 unresolved，**不得**用推测、记忆或"看起来合理"填补；
4. 遵守 `docs/refactor/PHASE_EXECUTION_PROTOCOL.md` 的执行、验证、评审、收尾规则。

冲突处理：Git / 当前 diff 是"实际存在什么"的真相；`docs/refactor/` 是"意图中的已批准架构与范围"的真相；
两者不一致时**先检查、先报告**，不得静默选边。

---

## Part 1 — 目标（Objective）

**设计一个证据支撑的 Vocabulary 平台架构，然后才允许修改数据库或产品。**

Phase 7 的产物是**决策与证据**，不是功能。设计必须同时学习于：

1. **当前仓库行为与遗留数据**（真实代码 / schema / seed / 数据产物）；
2. **真实的商业词汇学习产品**（产品行为，而非视觉复制）；
3. **高质量开源词汇 / 间隔重复系统**（工程模式，而非 schema 抄写）；
4. **权威或文档完善的词汇数据集**（候选来源 + 许可 / 使用条件证据）；
5. **本项目既有架构与技术栈**（四层 + Port/Adapter + Composition Root、Workflow 优先、已批准基础设施）；
6. **显式的技术取舍**（每个技术的成本 / 收益 / 触发条件）。

**不得**在真空中设计 Vocabulary 平台。

### 非目标（Non-goals，本阶段明确不做）

- 不实现 Vocabulary Books / Themed Packs 的生产模型、UI、API；
- 不修改 `prisma/schema.prisma`、不新增 / 修复 migration、不对任何数据库执行迁移或写入；
- 不导入任何外部词表数据集；
- 不删除、不重新归属任何既有数据；
- 不引入 pgvector / 向量库 / RAG 实现 / Redis / 队列 / LangChain / LangGraph / Agent / MCP / 新依赖；
- 不改变现有 SM-2 行为、不改变 Words UI、不改变 Vocabulary API 行为；
- 不做无关清理或顺手重构。

研究 / 评估上述技术是**允许**的（研究 ≠ 采纳）；把它们放进生产是**禁止**的。

---

## Part 2 — 入口校验（Entry Verification，必须最先执行）

在编辑任何文件之前，执行并**如实记录**：

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git log --oneline -8
git remote -v
```

1. **网络可用时**抓取远端 refs（`git fetch --all --prune`）；网络不可用时**如实记录不可用**，不得假设远端状态。
2. 确认当前工作基线包含**已批准的路线图提交**：
   `fa1f3e63507efbf80f0a95d2b47f70f1d0cf90ee`
   预期权威路线分支：`refactor/portfolio-engineering-roadmap`。
3. **不要**盲目切到 `master`。`master` **不是**当前 post-Phase-6 的权威路线基线
   （任务构建时 `origin/master` = `d48a2f1`，早于路线图重新基线与第二次路线修订）。
4. **停止条件（STOP and report）** —— 若出现以下任一情况，**不要**猜测、**不要**覆盖他人工作，
   直接报告不一致：
   - 工作区存在无法解释的改动；
   - 当前分支 / 历史不包含上述已批准路线基线；
   - 仓库状态与权威文档存在实质差异（例如 `PHASE_STATUS.md` 不再把 Phase 7 标为 Ready / Not Started，
     或已存在 Phase 7 的 handoff / review / 实现）。

记录内容至少包含：分支、HEAD、初始 `git status --short`、是否成功 fetch、停止条件是否命中。

---

## Part 3 — 权威来源阅读（Source of Truth）

执行者必须至少完整读取（若某文件不存在，**报告**而不是跳过）：

- `AGENTS.md`
- `CLAUDE.md`
- `docs/refactor/MASTER_PLAN.md`
- `docs/refactor/PHASE_STATUS.md`
- `docs/refactor/DECISIONS.md`（尤其 ADR-015 / ADR-016 / ADR-017 / ADR-018，以及 ADR-004…ADR-014 的分层与基础设施契约）
- `docs/refactor/PHASE_EXECUTION_PROTOCOL.md`
- `docs/refactor/ARCHITECTURE_RULES.md`
- `docs/refactor/TARGET_ARCHITECTURE.md`
- `docs/refactor/MIGRATION_PLAN.md`
- `docs/refactor/PORTFOLIO_ENGINEERING_CRITERIA.md`
- `docs/refactor/EVALUATION_BASELINE.md`（含**迁移验证门**）
- `docs/refactor/TEST_STRATEGY.md`
- `docs/refactor/tasks/phase-6-task.md`
- `docs/refactor/handoffs/phase-6-handoff.md`（尤其 §9 Phase 7 交接与 guardrails）
- `docs/refactor/reviews/phase-6-review.md`

并**实际检查**当前 Vocabulary 实现与数据路径，至少覆盖：

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/**`（含历史损坏迁移）
- `prisma/*.json`（`complete_seed_data.json` / `generated_data.json` / `generated_scene_data.json` / `ecdict_phonetic.json`）
- `src/app/api/words/**`（`route.ts` / `queues` / `mastered` / `ai-train` / `themes` / `themes/generate` / `themes/[theme]`）
- `src/app/words/**`（`page.tsx` / `dashboard` / `study` / `mastered` / `themes/**`）
- `src/lib/sm2.ts`、`src/lib/types.ts`、`src/lib/word-cache.ts`、`src/lib/prisma.ts`
- seed / 运行时引用的词汇 JSON 数据产物，以及被 `.gitignore` 排除的本地数据（例如 `prisma/ecdict/stardict.db`）

> **仓库 / Git 事实优先于聊天历史。** 本文件 Part 4.3 提供的现状快照是**任务构建时的已核实观察**，
> 用于降低执行者的定位成本；执行者**必须**重新核实并纠正（若已过时），不得直接复制为结论。

---

## Part 4 — 必须完成的研究 / 设计工作流

以下 13 项**全部**必须完成。每一项都必须产出**可被第三方检查的仓库证据**（文档、表格、清单、图），
并明确区分 **observable evidence（可观察证据）** 与 **inference（推断）**。

### 4.1 产品参考研究（Product Reference Study）

研究当前真实存在的词汇学习产品，至少包括：

- **Baicizhan**（百词斩）
- **Maimemo**（墨墨背单词）
- **Bubei Vocabulary**（不背单词）
- 以及研究过程中发现的其它有比较价值的同类产品

关注**产品行为**而非视觉复制：

- 词书选择（book selection）；
- 换书 / 切换词书后的行为（book switching）；
- 进度语义（progress semantics）；
- 跨词书**重叠词**的行为（overlapping words across books）；
- 复习调度（review scheduling）；
- 自定义词单 / 词集（custom collections）；
- 主题词汇（themed vocabulary）；
- 生成的学习内容（generated learning content）；
- 可观察到的词书 / 版本更新行为（book / version updates）。

要求：

- 对每条结论标注 **observable**（可被第三方直接观察，例如产品文档、公开帮助页、应用内可见行为）
  还是 **inference**（基于行为推断）；
- 记录来源（产品页面 / 帮助文档 / 公开说明）与**获取日期**；
- **不得**把营销文案当作技术事实，也**不得**把推断写成证据；
- **不得**复制任何产品的视觉设计、文案或素材。

### 4.2 开源架构研究（Open-Source Architecture Study）

研究相关的高质量开源项目，**包括 Anki 与其它合适的词汇 / SRS 系统**。

- **不得**仅按 star 数选项目；必须说明选择理由（架构质量、文档质量、与真实问题的相关性）。
- 至少抽取以下工程模式：
  content vs user-state 分离；word / card 身份（identity）；deck / book 归属（membership）；
  调度归属（scheduling ownership）；数据导入（import）；版本化（versioning）；
  迁移策略（migration）；来源与可追溯性（provenance）；可扩展性（extensibility）。
- 对每个有用模式必须解释：
  1. 它解决什么真实问题；
  2. 为什么**可能**或**可能不**适合本项目（对齐本项目的架构原则与技术栈）；
  3. 它的实现成本（建模成本、迁移成本、运维成本、认知成本）。
- **禁止**照抄 schema。**禁止**因为项目流行就建议采纳。

### 4.3 当前 Vocabulary 审计（Current Vocabulary Audit）

以**当前仓库**为准，记录真实的当前行为与模型，至少覆盖：

`Word`、`WordReview`、`theme`、`difficulty`、`source`、当前**以 IELTS 为中心**的流程、
AI 生成的主题词汇、seed / 导入路径、当前 SRS 行为、当前 **`WordReview` 缺乏用户归属**、
当前全局 / 遗留语义。

必须明确回答：**当前哪些字符串字段同时承载多个领域含义。**

任务构建时的已核实观察（**必须重新核实**）：

| # | 观察（observable） | 证据位置 |
|---|-------------------|---------|
| O-1 | `Word.difficulty` 同时承载"难度"与"词书身份"两种含义（取值例如 `IELTS` / `THEME` / `CUSTOM`） | `prisma/schema.prisma`、`prisma/seed.ts`、`src/app/api/words/themes/generate/route.ts` |
| O-2 | `Word.source` 同时承载"来源 / 归因"与"产品域"含义（默认 `built-in`；实际写入 `ielts` / `theme` / `generated`） | `prisma/schema.prisma`、`prisma/seed.ts`、`themes/generate` |
| O-3 | `Word.theme` 同时表示"主题词包成员"与"是否属于 IELTS 词池"（队列查询用 `theme IS NULL` 作为 IELTS 判定） | `src/app/api/words/route.ts`、`src/app/api/words/queues/route.ts` |
| O-4 | `Word.definition` 混装英文释义与中文释义；`partOfSpeech` 为自由字符串 | `prisma/complete_seed_data.json`、`prisma/seed.ts` |
| O-5 | `Word.example` / `Word.exampleZh` 用 ` ||| ` 拼接**多值**，即"一个字符串字段承载列表语义" | `prisma/seed.ts`（`buildExamples`）、`prisma/complete_seed_data.json` |
| O-6 | `WordReview` 为**全局单份**（`@@unique([wordId])`），无 `userId`：结构上只允许一个用户的学习进度 | `prisma/schema.prisma` |
| O-7 | 学习队列按 `source = 'ielts' AND theme IS NULL` 抽取新词，且 `ORDER BY RANDOM()` | `src/app/api/words/route.ts` |
| O-8 | 主题词包在**运行时**由 `POST /api/words/themes/generate` 的 3 次内联 DeepSeek 调用生成，写入 `source='generated'` / `difficulty='CUSTOM'`；显示用 label / emoji **只存在于浏览器 localStorage**（不落库） | `src/app/api/words/themes/generate/route.ts`、`src/app/words/themes/page.tsx` |
| O-9 | `DailyProgress` 无用户维度；`Article.readAt/favoritedAt`、`ListeningScene.playedAt` 为全局列 | `prisma/schema.prisma` |

> O-1…O-9 是**任务构建时的观察**，不是 Phase 7 的最终结论。执行者必须核实、补全，并在文档中写明核实日期与命令 / 文件证据。

### 4.4 Vocabulary 领域设计（Vocabulary Domain Design）

调查并给出**最小正确**的目标模型（minimum model that remains correct as the product grows），至少覆盖：

- lexical item / `Word`
- Vocabulary Book
- Vocabulary Book Entry / membership
- Themed Pack
- Default Pack
- User-created Pack
- learner review / progress state

约束：

- **不要**自动引入 `Lexeme` / `WordForm` / `WordSense` 等高规范化构造，除非**真实产品需求**证明其必要；
  若认为必要，必须给出需求证据与解释（面向初学者，见 Part 7）。
- 每个模型 / 字段都必须有**真实或近期消费者**；"听起来有用"不构成理由
  （对齐 Phase 6 的建模纪律）。
- 明确回答：**共享（shared）与书内专属（book-specific）分别是什么。**
- Books 与 Packs 是**两个不同的产品域**（ADR-016）：可以共享底层词汇基础设施，
  但**不得**为了架构整齐合并成一个通用抽象。

### 4.5 重叠词语义（Overlapping-Word Semantics）

显式分析：若 `"allocate"` 同时属于 CET-6、IELTS 与 Business English，则：

- 底层是否存在**一个** lexical item？
- SRS 掌握度是**全局**归属于该 lexical item，还是**按书独立**？
- 是否存在"全局掌握度 + 书内进度"的组合语义？
- **换书之后**发生什么？
- **词书版本变化**之后发生什么？

必须先比较多种备选方案、文档化 trade-off，**然后**才给出推荐；结论必须说明被拒绝方案为何被拒绝。

### 4.6 现有数据来源重建（Existing Data Provenance Reconstruction）

从**仓库证据**重建现有以 IELTS 为取向的数据管线，至少区分：

| 类别 | 定义 | 需要回答 |
|------|------|---------|
| **A. Book membership** | 为什么某个词被认为是 IELTS 的？ | 判定规则、来源、可复现性、可审计性 |
| **B. Lexical / enrichment content** | 释义、音标、例句、搭配、翻译等 | 字段级来源归因 |
| **C. AI-derived content** | 哪些字段 / 内容由 DeepSeek 生成或补充 | 逐字段标注 |

必须记录当前 **built-in → ECDICT → DeepSeek** 的优先级与转换行为（以仓库证据为准）。

任务构建时的已核实观察（**必须重新核实**）：

- `prisma/seed.ts` 内的合并优先级为 `builtIn > ECDICT > DeepSeek`（`mergeEntry`）。
- ECDICT 来源为运行时下载：`https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip`，
  解压为 `prisma/ecdict/stardict.db`（本地约 851 MB，**已被 `.gitignore` 排除**，不随仓库分发）。
- **Book membership 过滤规则**：额外词只有当 ECDICT 的 `tag` 包含 `ielts` 时才被纳入
  （`ecdict?.tag?.includes('ielts')`）。
- 写入规模：`MAX_WORDS = 2000`；写入时 `difficulty='IELTS'` / `source='ielts'`。
- 主题词包（20 个主题）由 DeepSeek 生成词表 + 搭配 / 例句，并尝试抓取 Wikipedia 图片。
- 烘焙快路径：`prisma/complete_seed_data.json` 存在时直接导入，跳过 ECDICT / DeepSeek；
  实测内容为 **2000 IELTS 词 + 849 主题词（20 个主题）**，其中 2000 条 IELTS 词全部含多例句（` ||| ` 拼接）。
- 缓存产物：`prisma/generated_data.json`（2000 条）、`prisma/generated_scene_data.json`（823 条）、
  `prisma/ecdict_phonetic.json`（246,693 条）。

**硬性要求：**

- 每个来源主张必须可追溯到**具体仓库证据**（文件 + 行 / 结构），不得凭印象；
- **不得**在没有证据的情况下声称当前数据集"法律上安全"或"不安全"；
- 对无法验证的内容，记录为 **unresolved pending evidence**，而不是猜测。

### 4.7 遗留 DeepSeek 数据决策（Legacy AI-Generated Data Decision）

调查以下**工作方向**，但**不得**把它当作预先确定的真相：

- DeepSeek 生成的**词书 membership** 很可能**不应**继续作为权威；
- 来源不清的既有 IELTS 词书 membership 应被复核，**可能**被替换；
- AI 生成的**派生学习内容**（例句、解释、练习、对话、记忆提示等）在**明确标注为生成内容**的前提下，
  可能仍是合法的未来能力；
- 既有生成主题词汇应与**规范化 Vocabulary Books 分开评估**，可能被迁移、重新生成或丢弃（后续阶段执行）。

Phase 7 的设计必须产出**证据支撑的分类**：

| 分类 | 含义 |
|------|------|
| **preserve** | 保留（有证据支持其来源与用途） |
| **migrate** | 迁移到目标模型 |
| **replace** | 用有明确来源 / 许可的数据替换 |
| **regenerate** | 用已批准路径重新生成 |
| **discard** | 丢弃（须给出理由与影响范围） |
| **unresolved pending evidence** | 证据不足，暂不判定 |

**Phase 7 不得删除任何既有数据。** 分类只是设计结论。

### 4.8 外部数据集调研（External Dataset Research）

调研以下方向的**候选**来源：

- CET-4
- CET-6
- IELTS-oriented vocabulary
- General English
- Business English

**候选 ≠ 已批准。** 每一个**严肃候选**必须记录：

- canonical upstream / source（权威上游）
- owner / publisher
- dataset / release / version（若可得）
- **准确的 license 或使用条款**
- 可验证范围内的**再分发含义**（redistribution implications）
- 转换要求（transformation requirements）
- 更新 / 版本故事
- 数据字段（data fields）
- 质量限制（quality limitations）
- 重复 / 规范化问题（duplicates / normalization concerns）
- 证据是否**完整**或**不完整**

硬性要求：

- **"公开的 GitHub 仓库"不构成数据再分发权利的充分证据。**
- 优先使用第一方或权威的许可 / 来源证据（上游官网、官方发布页、明确的 LICENSE / 条款文件）。
- 无法验证的，记录为 **unresolved**，**不得**猜测。
- 记录获取日期；若执行环境**无网络**，必须如实记录"无法验证"，不得编造来源或引用。

### 4.9 导入与版本化设计（Import + Versioning Design）

**设计**（不实现）一条可复现的未来导入路径，并评估职责应落在：

- 数据库表；
- 版本受控的 JSON / YAML manifest；
- importer 元数据；
- 或上述组合。

设计必须能够回答：**"究竟是哪个数据集 / 哪个版本产生了 CET-6 词书版本 X？"**

至少覆盖：source version、source URL / upstream identity、license evidence、checksum / hash、
transformation / importer version、normalization、duplicate handling、validation、imported counts、
rejected records、book version。

**不得**因为"这些概念存在"就创建数据库模型。必须明确区分：
哪些信息必须进入数据库、哪些必须进入版本受控 manifest、哪些只是导入期证据。

### 4.10 技术决策研究（Technology Decision Study）

对**每一门被讨论的技术**，必须先为**初学者**解释它，然后才推荐。统一使用以下格式：

```
Technology:
Plain-language meaning:
Where it sits in our architecture:
Problem it solves:
What it connects to:
Current project already uses it?:
Alternatives:
Benefits:
Costs/risks:
Decision: adopt / keep / reject / defer / investigate later
Evidence:
Reconsideration trigger:
```

至少覆盖与该领域相关的：

- SQL
- PostgreSQL
- Neon
- Prisma
- relational many-to-many modeling
- database migrations
- deterministic SRS / domain logic
- PostgreSQL text / search capabilities（在相关处）
- embeddings
- pgvector / vector search
- RAG / retrieval
- Redis / cache（**仅在存在被证明的用例时**）
- queues / background jobs（**仅在存在被证明的用例时**）
- AI / DeepSeek 用于派生词汇内容

硬性要求：

- **不得**把上述任何技术强行塞进生产；**technology investigation ≠ technology adoption**。
- `Decision` 字段必须显式给出 `adopt / keep / reject / defer / investigate later` 之一；
- 必须优先选择**满足已验证需求的最简单技术**；
- 每条 decision 必须给出 `Reconsideration trigger`（什么新证据会让决定改变）。

### 4.11 数据库 / 应用结构（Database / Application Structure）

用**可视化 + 具体**的方式解释提议架构，例如区分层次：

```
Next.js UI/API
     ↓
Application use cases
     ↓
Domain rules
     ↓
Repository ports
     ↓
Prisma adapter
     ↓
PostgreSQL
```

必须说明：Vocabulary Books、SRS state、import / provenance 逻辑、以及未来的 retrieval 能力
**各自属于哪一层**，并说明它们与相邻组件的关系。

**除非证据证明 PostgreSQL 不足，不得引入第二个数据库。**

### 4.12 迁移策略（Migration Strategy，只设计不执行）

在不改动 schema 的前提下，把当前模型映射到可能的目标概念，至少覆盖：

- 遗留 `Word` 记录；
- 当前 `theme` / `source` / `difficulty` 语义；
- `WordReview`；
- IELTS 记录；
- 主题 / 生成词；
- **现有 SM-2 行为的保持**（Phase 2 受保护基线不得放宽）；
- 用户归属（user ownership）；
- 词书重叠语义。

必须说明：迁移的**可逆性 / 不可逆性**、数据风险、验证方式、以及"不做迁移"的后果。

### 4.13 迁移链损坏与 Phase 8 拆分决策（Damaged Migration Chain）

检查既有**历史损坏的 Prisma migration 证据**：

`prisma/migrations/20260609000001_baseline/migration.sql`（任务构建时：3060 字节，
UTF-16LE BOM（首字节 `FF FE`），内容为 PowerShell 报错转储而非 SQL —— 历史遗留，Phase 6 **未**修复）。

Phase 7 **必须**判定：

- **A. migration-chain repair**（迁移链修复）与
- **B. Vocabulary Books implementation**（Vocabulary Books 实现）

能否安全地留在**同一个有界 Phase** 内。若二者属于**可以独立审核的高风险变更**，
则必须在**实现开始之前**建议拆分路线图（走正常治理流程：任务书 + 外部审核 + 用户明确批准）。

硬性要求：

- **Phase 7 不得修复 migration**；
- 该判定必须是**显式结论**（"可保留在同一 Phase" 或 "应拆分"，附理由与证据）；
- 必须说明拆分后的阶段编号 / 顺序**建议**（编号不受保护），以及各自应承担的迁移正确性验收门
  （见 `EVALUATION_BASELINE.md` 的迁移验证门）。

---

## Part 5 — 技术选择原则（必须显式写入设计文档）

**架构与技术选择必须一起考虑。** 对每一个有意义的选择，必须回答：

1. 存在什么**真实的产品 / 工程问题**？
2. 需要什么**架构职责**？
3. 已可用的**最简单可靠技术**是什么？
4. 引入新技术会创造什么**额外复杂度**？
5. 什么**证据**才足以证明该复杂度是合理的？

**禁止**为了简历观感而采纳技术（do not adopt technology for résumé appearance）。

---

## Part 6 — 必须产出的交付物（Deliverables）

在证据允许的范围内，执行者必须产出：

1. `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md`
   —— 产品域模型（Books / Packs / Word / membership / learner state）、重叠词语义、
     分层归属、技术决策研究（4.10 格式）、结构图、以及"Phase 8 之后各阶段应实现什么"的边界。
2. `docs/refactor/VOCABULARY_DATA_PROVENANCE.md`
   —— 当前数据管线重建（A / B / C 三类）、字段级来源归因、
     遗留 AI 数据分类（preserve / migrate / replace / regenerate / discard / unresolved）、
     外部数据集候选表（含许可证据与 unresolved 标注）、导入与版本化设计（4.9）。
3. `docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md`
   —— 当前模型 → 目标概念的映射、SM-2 行为保持要求、user ownership 设计、
     重叠词语义落地、迁移风险与验证方式、迁移链修复处置方向、
     **以及 Phase 8 拆分决策的显式结论**。

其它允许的产出：

- 对 `docs/refactor/DECISIONS.md` 的 **ADR 提案**（Proposed）；
- 对 `docs/refactor/PHASE_STATUS.md` 的**状态更新**（Phase 7 = In Progress / In Review；**不得**自批 Approved）；
- `docs/refactor/handoffs/phase-7-handoff.md`（在 Phase 7 研究 / 设计工作完成后按协议产出）。

硬性约束：

- 执行者**不得**自行批准 ADR；Accepted 需要常规外部评审 + 用户批准流程；
- 执行者**不得**把 Phase 7 标记为 Completed / Approved；
- **本任务文件本身**：`docs/refactor/tasks/phase-7-task.md`。

---

## Part 7 — 面向初学者的架构说明要求（Beginner-Readable Architecture）

用户正在**边重建项目边学习 AI 应用工程**。因此 Phase 7 的设计文档**不得**只罗列技术名词。

每当引入一个非平凡的技术或架构术语，必须解释：

- 它**用平实语言**是什么；
- 它在**本项目**中扮演什么角色；
- 它与相邻组件如何关联；
- 为什么**需要**或**不需要**它。

优先使用**具体的项目例子**与**简单架构图**。

**不得**为了通俗而降低技术准确度、精确性、批判性或完整性。

---

## Part 8 — 硬性禁止事项（Hard Prohibitions）

Phase 7 **不得**：

- 修改 `prisma/schema.prisma`；
- 创建或修复 migrations；
- 导入任何外部词汇数据集；
- 删除任何遗留数据；
- 修改 Words UI；
- 修改 Vocabulary APIs；
- 修改 SRS 行为；
- 在生产中把 `WordReview` 变成 user-scoped；
- 创建 VocabularyBook 生产表；
- 安装 pgvector；
- 安装任何向量数据库；
- 引入 RAG 实现；
- 引入 Redis；
- 引入队列；
- 引入 LangChain；
- 引入 LangGraph；
- 引入 Agent；
- 引入 MCP；
- 新增任何无关依赖；
- 做机会主义式重构。

以上都是**后续已批准阶段的实现决策**。**研究或评估**某技术在相关处是允许的。

此外：

- **不得**把 Phase 7 的结论写成"已批准的实现计划"；
- **不得**用本阶段的设计自由去绕过 Phase 6 已批准的所有权不变式
  （`ExecutionContext.userId` 权威归属；canonical User State vs Memory 所有权；有界读取）。

---

## Part 9 — 验证要求（Validation，设计阶段专属）

因为这是**设计 / 研究阶段**，**不要**为了模仿代码阶段而机械运行昂贵的实现验证。

完成时**至少**验证：

```bash
git status --short
git diff --stat
git diff --check
```

并**显式确认**以下文件**未**发生变更：

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `src/app/words/**`
- `src/app/api/words/**`
- `src/lib/sm2.ts`
- `package.json`
- `package-lock.json`（或等价 lockfile）
- 一般意义上的生产源码

并确认：

- **没有**提交数据集转储（dataset dumps）；
- **没有**新增外部二进制产物（external binary artifacts）；
- 每一条外部 provenance 主张都有**可追溯证据**；
- **不确定性被明确标注**（unresolved / inference / unverified）；
- **Phase 8 拆分决策是显式的**。

可选（若环境允许且确有助于证据质量）：`npx tsc --noEmit` 或现有测试套件，
用于证明"本阶段没有破坏任何东西"；若未运行，必须说明原因，**不得**声称已运行。

---

## Part 10 — 评审与治理（Review / Governance）

- Phase 7 必须遵循 `docs/refactor/PHASE_EXECUTION_PROTOCOL.md`。
- 执行者可以产出**证据与建议**，但**不得**把自己的工作标记为 Approved。
- **外部评审 + 用户明确批准**是唯一的闸门。
- 历史 Phase 0–6 记录**不得**为匹配新的未来编号而被改写。
- 若外部评审返回 Changes Requested：留在当前阶段、保留评审历史、只做被要求的修正、
  重跑所需验证、重新生成评审证据、再次接受外部评审。

---

## Part 11 — 任务质量检查（Task Quality Check）

在完成设计之前，执行者必须确认下面**每一个问题都被显式回答**（回答位置必须可定位）。
若任何一个问题被任务范围遗漏，**先修正设计范围**，再继续。

1. 在本产品中，`Word` 到底**是什么**？
2. `Vocabulary Book` 到底**是什么**？
3. `Themed Pack` 到底**是什么**？
4. 什么是**共享**的、什么是**书内专属**的？
5. **谁拥有**学习者进度？
6. 词在**多个词书之间重叠**时会发生什么？
7. 现有以 IELTS 为取向的数据的 **provenance** 是什么？
8. 哪些遗留 AI 生成数据应被 **preserve / replace / discard**？
9. 哪些外部数据集是**可行的未来候选**？
10. 数据集如何**版本化**、导入如何**复现**？
11. 哪些技术解决 **Phase 8 / 9** 的真实需求？
12. 哪些技术应当**继续延后**？
13. 迁移修复与 Books 实现能否安全留在**同一个 Phase**？
14. **Phase 8 实际应当包含什么**？

---

## Part 12 — 状态管理、Git 纪律、完成报告与审核包

### 12.1 状态管理

- 开始：Phase 7 = **In Progress**
- 设计完成：Phase 7 = **In Review**；Phase 8 = **Not Started**
- **不得**自行标记 Completed / Approved（需要外部审核 + 用户批准）

### 12.2 Git 纪律

- 变更前记录 branch / HEAD / `git status --short` / `git diff --stat`；工作区必须干净。
- **不自动提交**；**不推送**；**不**使用破坏性 Git 命令；**不**重写既往已批准的提交。

### 12.3 完成报告（必须返回）

1. 已验证的分支；
2. 已验证的 HEAD；
3. 初始 `git status`；
4. 检查过的文件清单；
5. 变更的文件清单；
6. 提议的 Phase 7 范围 / 结论的简明摘要；
7. 未解决问题（若有）；
8. `git diff --stat`；
9. `git diff --check` 结果；
10. 显式确认**没有**生产 / schema / migration 文件被修改。

### 12.4 审核包

若本阶段产出审核包，默认内容遵循 `PHASE_EXECUTION_PROTOCOL.md` §9
（任务书、设计文档、交接、评审、`PHASE_STATUS.md`、可能变更的 `DECISIONS.md`、
变更的生产源码 —— 本阶段预期为"无"、验证结果、`git status`、`git diff --stat`、
完整 Phase diff、review manifest、file-hash verification）。

**默认排除**：`.env` 与 API Key、凭据与数据库密钥、恢复码、`node_modules`、`.next`、
无关临时文件、嵌套的旧审核 ZIP、真实或私有用户数据、非必要二进制 / 音频资产、
以及任何**词汇数据集转储**（含 ECDICT 二进制与 `prisma/*.json` 数据产物，除非它们本身是审计对象
且体积与许可允许）。

打包边界：**以 Git 仓库根目录为项目边界**，不要打包父级工作区目录。

---

## Part 13 — 验收标准（Acceptance Criteria）

1. 分支 / HEAD / 工作区校验完成，且与已批准路线基线 `fa1f3e6…` 一致（或已如实报告不一致并停止）。
2. 三份交付物文档存在，且每一条外部 / 遗留数据主张都可追溯到证据或明确标注为 unresolved。
3. 当前 Vocabulary 审计覆盖模型、字段语义重叠、队列行为、seed / 导入路径、SRS 行为、
   `WordReview` 归属缺失，并区分 observable 与 inference。
4. Vocabulary 领域设计给出**最小正确**模型，明确 shared vs book-specific，且未无证据地引入高规范化构造。
5. 重叠词语义给出备选方案对比、trade-off 与推荐，并覆盖换书与词书版本变化。
6. 遗留 AI 数据分类覆盖 preserve / migrate / replace / regenerate / discard / unresolved，
   且**未删除任何数据**。
7. 外部数据集候选表覆盖 CET-4 / CET-6 / IELTS / General English / Business English，
   每条记录许可证据状态（可验证 / unresolved），且未把"公开仓库"当作许可证据。
8. 导入与版本化设计能回答"哪个数据集版本产生了词书版本 X"，且未据此创建生产数据库模型。
9. 技术决策研究使用指定格式覆盖 Part 4.10 全部技术，每条都有 Decision 与 Reconsideration trigger，
   且未把任何技术强行塞入生产。
10. 分层结构说明把 Books / SRS state / import-provenance / 未来 retrieval 归位到具体层，并保留单一 PostgreSQL。
11. 迁移策略覆盖 Part 4.12 全部对象，并明确 SM-2 行为保持与不可逆风险。
12. **Phase 8 拆分决策是显式结论**（可同阶段 / 应拆分），附理由、证据与后续治理动作。
13. Part 11 的 14 个问题全部被显式回答，且回答位置可定位。
14. 验证结果（`git status --short` / `git diff --stat` / `git diff --check` 与未变更文件确认）齐全；
    **没有** schema / migration / UI / API / 依赖 / 生产源码变更。
15. Phase 7 = In Review；Phase 8 = Not Started；**未**自行批准；**未**提交；**未**推送。

---

## 相关文档

- `AGENTS.md` / `CLAUDE.md` —— 会话入口与长期约束
- `docs/refactor/MASTER_PLAN.md` —— 路线图、Phase 7 出口与 Phase 8 范围决策门
- `docs/refactor/PHASE_STATUS.md` —— Phase 7 状态与依赖资产
- `docs/refactor/DECISIONS.md` —— ADR-015 / ADR-016（Vocabulary 两个产品域与数据来源前置审查）、ADR-017 / ADR-018
- `docs/refactor/ARCHITECTURE_RULES.md` / `TARGET_ARCHITECTURE.md` —— 分层与依赖规则
- `docs/refactor/MIGRATION_PLAN.md` —— Phase 7–9 迁移路径与出口条件
- `docs/refactor/EVALUATION_BASELINE.md` —— 迁移验证门
- `docs/refactor/PORTFOLIO_ENGINEERING_CRITERIA.md` —— 证据契约（含实验记录八字段）
- `docs/refactor/tasks/phase-6-task.md` / `handoffs/phase-6-handoff.md` / `reviews/phase-6-review.md` —— 上一阶段的已批准资产与 guardrails
