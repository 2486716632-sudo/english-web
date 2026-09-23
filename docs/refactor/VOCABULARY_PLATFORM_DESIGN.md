# Vocabulary Platform 设计 — Phase 7

**日期:** 2026-09-21（v1–v3）；**2026-09-23 修订（v4 —— 产品澄清后的重新定锚）**
**Phase:** 7 — Vocabulary Platform Design & Data Provenance
**状态:** 设计产出，**待外部评审**（Phase 7 = In Review；执行者**不**自批 Approved）
**归属:** 本文件拥有 Phase 7 的 **Vocabulary 平台设计意图**（产品域模型、重叠词语义、分层归属、技术决策研究）。
路线图与 Phase 顺序归 `MASTER_PLAN.md`；阶段状态归 `PHASE_STATUS.md`；已接受决策归 `DECISIONS.md`；
数据来源与许可归 `VOCABULARY_DATA_PROVENANCE.md`；迁移与**阶段拆分决策**归 `VOCABULARY_MIGRATION_STRATEGY.md`。

**本阶段性质:** 证据 / 研究 / 架构设计。本文件**不含**任何生产实现、schema 变更、migration、数据导入或 UI 改动。
文中所有"应实现 / 建议"都是**后续已批准阶段**的输入，不是本阶段的交付物。

> **v4 修订摘要（产品澄清，2026-09-23）。** 早期评审（v1 → v3）已解决当时的阻断项
> （迁移 baseline / squash、来源条目语义、例句逐条来源、非拼接式 SRS 迁移），
> 但**产品澄清在收尾前改变了核心设计前提**，因此 Phase 7 被**有意重新打开**：
> 1. **学习与 SRS 的单位是「词书条目」**：状态键 = `(userId, bookEntryId)`（**不是**全局词状态）；
> 2. **`BookEntry` 承载该书的策划学习目标**（目标词性 / 用法、一个或多个目标义项、顺序 / 层级 / 元数据、来源）；
> 3. **`WordUsage` 移除**（不再需要跨书共享锚点；§4.6）；
> 4. **明确拒绝**跨书 SRS 同步 / 掌握度传播 / 状态合并 / 迁移评分（§5.4）；
> 5. **AI 可以富化学习者可见内容**（释义简化、中文解释、例句、搭配、练习、记忆提示），
>    但必须带来源标记与校验状态，且**不得**伪造"来自官方来源"的归属（见 `VOCABULARY_DATA_PROVENANCE.md` §4）。
> 历史版本的方案与论证保留在本文件中（例如 §4.6b），**不**被删除。

> **给读者的提示（本项目的用户正在边做边学 AI 应用工程）。**
> 本文件第 2 节是**名词速查**：每个术语先用平实语言解释"它是什么"，再解释"它在本项目里干什么"。
> 第 8 节是**技术决策研究**：每门技术都按统一格式解释（含义 / 位置 / 解决的问题 / 连接对象 / 本项目是否已用 /
> 备选 / 收益 / 成本风险 / 决定 / 证据 / 重新考虑触发条件）。术语第一次出现时会给出解释，**不假设读者已经懂**。

---

## 1. 目标与非目标

### 1.1 目标

1. 说明**目标 Vocabulary 架构是什么**（WHAT）：领域概念、模型、归属、重叠词语义、分层归属。
2. 说明**为什么是这样**（WHY）：每个选择相对哪些备选方案被选中，以及它与本项目既有架构、SM-2 受保护基线、
   ADR-016 的两个产品域、Phase 6 的用户归属不变式如何一致。
3. 让后续的 Phase 8 / 9 / 10 有**已被评审的设计输入**，而不是从聊天记忆里推导。

### 1.2 非目标（本阶段明确不做）

- 不修改 `prisma/schema.prisma`、不新增 / 不修复 migration、不对任何数据库执行迁移或写入；
- 不实现 `VocabularyBook` / `VocabularyBookEntry` / user-scoped `WordReview` 的生产表；
- 不导入任何外部词表数据集、不删除任何遗留数据；
- 不改 Words UI、不改 Vocabulary API、不改 SRS 行为；
- 不引入 pgvector / 向量库 / RAG 实现 / Redis / 队列 / LangChain / LangGraph / Agent / MCP / 新依赖。

---

## 2. 名词速查（初学者可读）

下表每个术语给出**平实语言含义**与**在本项目中的位置**。本节只解释，不决定；决定见后续各节。

| 术语 | 平实语言含义 | 在本项目中的位置 |
|------|-------------|-----------------|
| **Lexical item / Word（词条）** | "一个词本身"，与"它出现在哪本书里""谁在学它"无关。英文里叫 headword。 | `Word` 表的目标角色：**共享的词汇身份** |
| **Content / Enrichment（内容 / 释义资料）** | 围绕这个词的解释性资料：释义、音标、词性、例句、搭配、图片。 | 现在与身份混在 `Word` 里；本设计讨论是否拆开 |
| **Vocabulary Book（词书）** | 一本**有稳定身份、可被选择**的词表，例如"CET-6 词书""雅思核心词"。它的成员资格来自**外部数据集**。 | 目前**不存在**；现在用 `Word.source='ielts' AND theme IS NULL` 近似表示 |
| **Book Entry（词书条目）** | "某个词属于某本词书，并且排在第 N 位"。它是**关系**，不是词本身。 | 目标新增 `VocabularyBookEntry`（membership 表） |
| **Themed Pack（主题词包）** | 围绕一个主题（kitchen / office）的一组词，例如"厨房词汇包"。 | 现在用 `Word.theme` + `Word.source='theme'` / `'generated'` 表示 |
| **Default Pack（默认词包）** | 由**产品方**提供的主题包，所有用户看到的是同一份。 | 现在是 `source='theme'` 的 20 个主题 |
| **User-created Pack（用户自建词包）** | **学习者自己**创建 / 生成 / 收藏的词集。 | 现在是运行时 AI 生成的 `source='generated'` 词包 |
| **Learner state（学习状态）** | "这个学习者对**这本书的这个条目**的记忆状态"：间隔、难度因子、重复次数、下次复习时间、是否掌握。 | `WordReview` 的角色，但目前**没有用户维度**（全局单份）；目标模型是 `LearnerEntryReview(userId, bookEntryId)`（v4） |
| **SRS（Spaced Repetition System / 间隔重复）** | 按"遗忘曲线"安排复习时间的算法体系：答对就拉长间隔，答错就缩短。 | `src/lib/sm2.ts`（SM-2 算法，Phase 2 受保护基线） |
| **SM-2** | 1987 年由 SuperMemo 提出的经典间隔重复算法；本项目的 `sm2()` 即其实现。 | 纯计算逻辑，属 Domain 层职责 |
| **Workflow（确定性工作流）** | 步骤固定、顺序明确的流程编排（不是"AI 自己决定"）。 | Phase 4 已建立参考样板（Reading 摄取管线） |
| **Agent** | 由模型**动态决定**下一步做什么的系统。 | 本项目**刻意延后**（Phase 14），且必须由真实动态决策需求驱动 |
| **Provenance（来源追溯）** | "这条数据从哪来、什么时候、用什么规则转换而来"的记录。 | 本阶段核心产物之一（见 `VOCABULARY_DATA_PROVENANCE.md`） |
| **Manifest（清单文件）** | 一份**受版本控制的**小文件，声明"这次导入用的是哪个上游、哪个版本、什么许可、怎么转换"。 | 本设计推荐的导入元数据载体（第 8 节 SQL/文件之争） |
| **Checksum / Hash（校验和）** | 一段数据的指纹；数据变了指纹就变，用来证明"导入的确实是这一份"。 | 导入可复现性的关键字段 |
| **ORM（对象关系映射）** | 让程序用"对象/函数"操作数据库表，而不用手写 SQL 的库。 | Prisma 在本项目的角色 |
| **Migration（迁移）** | 对数据库结构（表、列、索引）的一次版本化变更脚本。 | `prisma/migrations/**`；本项目的 baseline 迁移已损坏（见 `VOCABULARY_MIGRATION_STRATEGY.md`） |
| **Embedding（嵌入向量）** | 把一段文本变成一串数字，使"意思相近"的文本在数学上距离更近。 | 本项目**尚未使用**；本阶段只评估是否需要 |
| **pgvector** | PostgreSQL 的一个扩展，让它能存 / 查向量。体积换能力：装了就多一层运维与调优成本。 | **未安装**；本设计给出"何时才值得装"的触发条件 |
| **RAG（检索增强生成）** | 先从资料库里**检索**相关内容，再把这些内容交给模型生成回答。 | 属 Phase 13 的工程调查范围（ADR-018） |
| **Redis / 队列** | 外部缓存服务 / 后台任务系统，用于跨进程共享状态与异步化。 | 当前**没有**被证明的用例；本设计的结论是"暂时拒绝" |

---

## 3. 当前系统（证据摘要）

> 完整证据、行号与字段级归因见 `VOCABULARY_DATA_PROVENANCE.md` 与 `VOCABULARY_MIGRATION_STRATEGY.md`。
> 本节只保留做设计决策所需的**已核实事实**（任务构建时的观察已在本次执行中**重新核实**）。

**已核实的事实（observable，2026-09-21 重新核实）：**

| # | 事实 | 证据 |
|---|------|------|
| F-1 | `Word` 同时承载**身份 + 内容 + 产品域 + 来源**：`theme`（词包成员）、`difficulty`（默认 `IELTS`，实际写入 `IELTS`/`THEME`/`CUSTOM`）、`source`（默认 `built-in`，实际写入 `built-in`/`ielts`/`theme`/`generated`） | `prisma/schema.prisma:10–26` |
| F-2 | `WordReview` 是**全局单份**：`@@unique([wordId])`，**没有 `userId`** | `prisma/schema.prisma:28–42` |
| F-3 | "雅思词池"不是一等概念，而是一个**查询条件**：`source = 'ielts' AND theme IS NULL`，且新词按 `ORDER BY RANDOM()` 抽取 | `src/app/api/words/route.ts`（GET，queue=new 与默认队列） |
| F-4 | 队列统计同样用 `source: 'ielts'` 过滤 | `src/app/api/words/queues/route.ts` |
| F-5 | 主题词包在**运行时**由 3 次内联 DeepSeek 调用生成，写入 `difficulty='CUSTOM'` / `source='generated'`；展示用 label / emoji **只存在浏览器 localStorage** | `src/app/api/words/themes/generate/route.ts`、`src/app/words/themes/page.tsx:61–98` |
| F-6 | 种子数据的合并优先级是 `builtIn > ECDICT > DeepSeek`；ECDICT 额外词仅当 `tag` 含 `ielts` 时纳入；IELTS 池上限 2000 | `prisma/seed.ts:2689–2740`（`mergeEntry`）、`:2903`、`:16` |
| F-7 | 烘焙数据产物为 **2000 IELTS + 849 主题词（20 主题）**；2000 条 IELTS 词全部含多例句（` ||| ` 拼接） | `prisma/complete_seed_data.json`（本次统计）、`prisma/seed.ts:2651–2687`（`buildExamples`） |
| F-8 | 题库以外的运行时依赖 ECDICT 派生产物：Reading 详情页用 `prisma/ecdict_phonetic.json`（246,693 条）做音标回退 | `src/app/api/reading/[id]/route.ts:6–20,57` |
| F-9 | `prisma/migrations/20260609000001_baseline/migration.sql` 是 UTF-16LE（BOM `FF FE`）的 **PowerShell 错误转储**，不是 SQL；完整迁移链的生产部署因此处于 BLOCKED | 该文件字节检查 + `PHASE_STATUS.md` / `handoff` 记录 |

**从证据到设计的推论（inference，明确标注）：**

- I-1：因为"雅思词书"只是一个查询条件，**换书 / 加书在当前模型里无法表达**（inference）。
- I-2：因为 `WordReview` 全局唯一且无 `userId`，**多用户下进度会互相覆盖**（inference；Phase 6 已把它列为 D-01 延后项）。
- I-3：因为用户自建词包的 label / emoji 只存在浏览器，**换设备即丢失展示元数据**（inference，代码路径支持该判断）。

---

## 4. 目标领域模型（最小正确）

### 4.1 概念分区

> **v4 修正（产品澄清，2026-09-23）。** 本节的模型**取代** v3 的"共享 `WordUsage` + 掌握度按词"方案。
> 新的产品原则是：**"先选一本词书，然后学习与 SRS 都作用在这本书的条目上"**；
> **不得**为了跨书同步同一个拼写而引入复杂度。v3 的 `WordUsage` 经重新评估后**移除**（理由见 §4.6）。

Vocabulary 的问题本质是**四类信息混在一起**。目标模型的第一原则是**按职责分区**：

```
    ┌─────────────────────────────────────────────────────────────────┐
    │ A. Lexical substrate（词汇底座，共享；**不是**学习单位）           │
    │    Word（词条身份：wordKey + headword）                          │
    │    + 共享词汇内容（音标 / 通用释义 / 搭配 / 图片，带来源标记）      │
    └─────────────────────────────────────────────────────────────────┘
                                  ▲ wordId（headword 引用）
    ┌─────────────────────────────┴───────────────────────────────────┐
    │ B. Book domain（词书域：学习者真正在学习的东西）                   │
    │   VocabularyBook（稳定学习集合 + provenance + 版本 + 状态）       │
    │   VocabularyBookEntry / BookEntry  ← **SRS 归属单位**            │
    │       · **entryKey（稳定身份）** + position（仅排序）             │
    │       · 目标词性 / 用法、层级、书目元数据、来源引用、状态          │
    │   BookEntryMeaning（从属，1..N：目标义项 / 用法，逐条来源）        │
    │   BookEntryExample（从属，0..N：例句，逐条来源）                  │
    └─────────────────────────────────────────────────────────────────┘
                                  │
    ┌─────────────────────────────┴───────────────────────────────────┐
    │ C. Learner state（学习者状态）                                   │
    │   LearnerEntryReview(userId, bookEntryId, SM-2 字段)             │
    │   （可选，版本安全）LearnerBookProgress(userId, bookVersion, …)   │
    └─────────────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────────────┐
    │ D. Packs（Default / User-created 词包；**独立产品域**，          │
    │    其学习者状态语义由 Phase 10 决定，不与 Books 同步）            │
    └─────────────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────────────┐
    │ E. Provenance（来源追溯，跨 A–D）                                │
    │   manifest（受版本控制的清单）+ 导入运行记录 + 内容项来源标记      │
    └─────────────────────────────────────────────────────────────────┘
```

**为什么这样分区（对初学者）:** 把"词是什么"（A）、"词属于哪些集合"（B、C）、"这个人学到哪了"（D）、
"这些数据从哪来"（E）分开之后，每类改动的影响范围就变小了。今天的模型把 A、B、C 挤在同一个 `Word` 表里，
所以"加一本词书"会连带影响"复习队列""统计""界面"，并且无法回答"这个词为什么属于雅思"。

**v4 与 v3 的关键差别（一句话）:** v3 认为"掌握度是关于**词**的"，因此需要跨书共享；
v4 按产品澄清改为"**掌握度是关于这本书的这个条目的**" —— `BookEntry` 才是学习与 SRS 的单位，
`Word` 只负责词形身份与共享词汇内容。

### 4.2 目标模型草案（**Phase 9（Books）的输入**，本阶段不实现）

| 模型 | 关键字段（草案） | 职责 | 消费者（必须有真实或近期消费者） |
|------|-----------------|------|--------------------------------|
| `Word` | `id`、`wordKey`（归一化身份键）、`headword`（展示形式）、**共享词汇内容**（`phonetic` / 通用 `definition` / `collocations` / `imageUrl` + 逐项来源标记） | **词形身份 + 共享词汇基础设施**（供去重与非书专属内容复用）；**不是 SRS 归属单位** | 词书条目的 headword 引用、词包条目、Reading/AI Coach 的通用词汇查询 |
| ~~`WordUsage`~~ | —（**v4 移除**，见 §4.6） | — | — |
| `VocabularyBook` | `id`、`slug`（`cet6` / `ielts` / `business`…）、`title`、`target`（目标考试 / 通用）、`publisher` / 来源、`version`、`sourceManifestRef`、`sourceChecksum`、`status` | 一本**有身份、可选择、有来源**的学习集合及其**当前版本** | 选书 UI、导入管线、进度统计 |
| `VocabularyBookEntry`（BookEntry） | **`entryKey`（稳定策划身份，见 §4.6.6）**、`bookId`、`wordId`（headword 引用）、`position`（**仅排序，不是身份**）、**目标词性 / 用法范围**（`targetPosScope` / `targetPosRaw`）、层级 / 等级（`level` 或来源等级）、`status`（`active` / `inactive` / `superseded`）、来源摘要（`sourceRefSummary`）、`createdAt` / `updatedAt` | **学习者可见的学习单位**：承载该书的**策划学习目标**（headword + 目标用法 + 目标义项集合 + 顺序 / 元数据 + 来源）；**SRS 归属单位**（状态键 = `(userId, bookEntryId)`，而 `bookEntryId` 由**稳定的 `entryKey`** 决定其连续性） | 学习卡片、复习队列、书内进度、掌握标记 |
| `BookEntryMeaning`（**从属**，1..N） | `bookEntryId`、`position`、**`text`（目标义项 —— 该书学习卡的规范释义）**、`translation?`（面向学习者的中文解释 / 翻译）、`targetPosScope` / `posLabel?`、**`phonetic?`（该义项 / 词性的规范音标）**、**`collocations?`（该书作用域的有界搭配文本）**、**来源**（`sourceType` = `source-derived` / `ai-assisted` / `ai-generated` / `curated`；来源引用 `sourceName` / `sourceEntryId` / `sourcePosRaw` / `sourceCefrLevel` / `sourceCategory` / `sourceRank` / **`attributionText?`**；或生成元数据 `provider` / `model` / `generatorVersion` / `generatedAt`）、`validationStatus` / `validationVersion`、`status` | 一个条目可以教**一个或多个**目标义项 / 用法；**它是正式出版词书学习内容的规范载体**（§4.8）；**不是** SRS 归属单位，也**不是** `WordSense` 本体 | 卡片释义 / 音标 / 搭配区、许可与署名展示、内容替换 / 重新校验 |
| `BookEntryExample`（**从属**，0..N） | `bookEntryId`、`bookEntryMeaningId?`（可空 = 条目级例句）、`text`、`translation?`、`position`、`sourceType` + 来源 / 生成元数据（同上）、`status`（`active` / `superseded`） | **多值例句 + 逐条来源**，可逐条替换；**不是** SRS 归属单位 | 卡片例句、替换 / 重生成 AI 例句、许可审查 |
| `VocabularyPack` | `id`、`kind`（`default` / `user`）、`ownerUserId`（default 包为 `null`）、`title`、`themeKey`、`label`、`emoji`、`status` | 主题 / 自定义**词包**及其归属 | 主题页、用户词包页、学习队列 |
| `VocabularyPackEntry` | `packId`、`wordId`、`position`、`entrySource`（`curated` / `generated` / `imported`） | 词包成员资格 + 顺序 + 条目来源 | 词包学习、AI 生成内容标注 |
| `LearnerEntryReview`（`WordReview` 的演进） | `userId`、**`bookEntryId`**、`interval`、`easiness`、`repetitions`、`nextReviewAt`、`lastReviewedAt`、`isMastered`；`@@unique([userId, bookEntryId])` | 学习者的**记忆 / 复习状态**（**按书内条目**） | 复习队列、掌握统计、书内进度、AI Coach 弱项 |
| （可选，**语义必须版本安全**）`LearnerBookProgress` | `userId`、`bookId`、`bookVersion`、**稳定引用**（如 `lastStudiedBookEntryId`）与 `lastStudiedAt` | "在这本书里学到哪" | 选书页进度条 |

### 4.3 建模纪律（沿用 Phase 6 的既有原则）

1. 每个持久字段必须有**真实或近期消费者**；"听起来有用"不是理由。
2. 不做通用 JSON dumping ground（不用一个 JSON 列装所有来源信息）。
3. 不因为"别的项目这样建"就照抄 schema。

### 4.4 明确**不**在本设计中引入的概念，以及触发条件

| 概念 | 本设计的处置 | 触发条件（出现什么证据才考虑） |
|------|-------------|------------------------------|
| **`WordUsage`（v3 的轻量用法层）** | **移除**（v4 不再引入；理由与替代见 §4.6） | 若将来出现"必须在**多本书之间共享同一批用法级内容**"的真实需求，再经治理流程评估 |
| `Lexeme` / `WordForm` / `WordSense`（词位 / 词形 / **义项本体**） | **不引入** | 当出现"必须做语言学意义上的义项辨析 / 本体映射"的真实产品需求时 |
| `BookEntryMeaning`（从属的目标义项 / 用法） | **引入**（真实需求已成立：一个策划条目可以教一个或多个目标义项；CEFR-J 等来源把同一 headword 的不同词性当作不同条目 —— 见 §4.6） | —（已触发；不再延后） |
| `BookEntryExample`（多值例句 + 逐条来源） | **引入**（触发条件**已经成立**：现网数据用 ` ||| ` 在一个字符串里塞多条例句，且这些例句由 AI 生成、需要可逐条替换 —— 见 §4.7） | —（已触发；不再延后） |
| `LearnerEntryReview`（按条目归属的学习状态） | **引入**（v4 产品决定：SRS 属于 `User + BookEntry`） | —（已决定；见 §5 / §6） |
| `VocabularyBookVersion` 独立表 | **暂不引入**（版本信息先落在 `VocabularyBook.version` + manifest 引用 + checksum） | 当产品需要**回看历史版本内容**、或学习者必须被**钉在某个版本**上学习时 |
| 向量库 / embedding 检索 | **不引入**（见 §8） | 当出现可测量的检索问题、且结构化 / 词法检索被证明不足时（Phase 13 的范围） |
| 缓存 / 队列基础设施 | **不引入** | 当出现**被测量的**性能或异步化需求时（见 §8 Redis / 队列条目） |
| **跨书 SRS 同步（propagation / merge / transfer scoring）** | **明确拒绝**（见 §5.4） | 需要新的产品决策 + 治理流程；**不得**在实现中悄悄加入 |

### 4.5 Books 与 Packs 的边界（ADR-016）

**决策（沿用 ADR-016，本设计不改变它）:** Books 与 Packs 是**两个产品域**，共享词汇底座与 SRS 引擎，
但**不合并为一个通用"词汇容器"抽象**。

| 维度 | Vocabulary Books | Themed Packs |
|------|-----------------|--------------|
| 内容来源 | **外部数据集**（需 provenance / 许可审查） | 产品方策划（default）或**用户触发 / AI 生成**（user） |
| 归属 | 全局共享，产品级目录 | default 全局；user 归属单个学习者 |
| 变化节奏 | 跟随数据集版本（低频、需要审计） | 用户随时创建 / 删除（高频、用户自治） |
| 许可风险 | **高**（必须逐数据集审查） | 低（生成内容由本项目产生；但引用外部释义仍受来源约束） |
| 进度语义 | **书内条目进度**（按 `LearnerEntryReview` 状态统计，v4） | 词包内进度（由 Phase 10 定义；**不与书同步**） |

**为什么不合并且不重复造轮子（对初学者）:** 两者的"法律风险"和"谁能改"完全不同。
把有许可要求的词书和用户随手生成的主题包塞进同一张表，会让"这条例子的来源是什么"变得无法回答，
也会让许可审查无法落地。共享底层词汇表和 SRS 算法是合理的（不重复实现），但**产品概念保持独立**。

### 4.6 源条目语义与 `WordUsage` 处置（**v4 决策**）

> **背景（v1 → v3 → v4）。** v1 复核指出"用 headword 标识 `Word` + 把 POS 当共享内容"会丢失来源语义
> （CEFR-J 官方页把同一 headword 的不同词性当作**不同条目**、并可能给**不同 CEFR 等级**）。
> v3 用 **模型 C**（`Word` + 轻量 `WordUsage` + `BookEntry` 指向 usage）解决该问题。
> **v4 的产品澄清改变了前提**：SRS 属于 **`User + BookEntry`**（见 §5 / §6），
> 并且**不要求**跨书共享或同步；同时 `BookEntry` **本身**可以承载一个或多个目标义项 / 用法。

#### 4.6.1 决策：`WordUsage` **移除**（不再作为目标领域实体）

| 问题 | 结论 |
|------|------|
| v3 为什么需要 `WordUsage`？ | ① 给"用法级内容"（词性相关音标 / 释义 / 例句）一个**跨书共享的稳定锚点**；② 让"按用法记录掌握度"变成改一个外键 |
| v4 为什么不再需要？ | ① **SRS 已按条目归属**，学习单位就是 `BookEntry`，不需要另一个共享锚点；② 产品**明确不要求**跨书共享内容或同步状态；③ `BookEntry` + 从属的 `BookEntryMeaning` 已能表达"目标词性 / 一个或多个目标义项"；④ 移除后不必对来源 POS 做闭集归一化（`posKey` 的 `multi` / `unknown` 问题随之消失），来源词性以**原文**保留 |
| 如果仍然保留会怎样？ | 它必须**内部化并保持从属**（只做内容锚点、绝不做 SRS 归属）。但 v4 的结论是：**多这一层没有真实消费者**，因此**移除**比保留更简单、更正确 |
| 移除后丢失了什么？ | 只丢失"跨书复用同一批用法级内容"这一能力 —— 该能力**未被产品要求**（§5.4 明确拒绝跨书同步）。若将来真的需要跨书共享内容，再经治理流程评估（触发条件写在 §4.4） |

**给初学者的一句话:** v3 把"词的某种用法"抽成一张共享表，是因为它假设"掌握度属于词、多本书共享"。
v4 改成"掌握度属于这本书的这个条目"后，那张共享表就没有必须存在的理由了 —— 少一层概念，少一处需要同步的地方。

#### 4.6.2 v4 备选方案与选定结果

| 方案 | 身份 / 学习单位 | 上游 POS 条目能否保留 | 一个条目能否教多个义项 | 新增概念 | 结论 |
|------|----------------|---------------------|----------------------|---------|------|
| A（v3 模型 C） | `Word` + `WordUsage` + `BookEntry`（SRS 按**词**） | ✅ | 通过多个 entry | +1（`WordUsage`） | **被 v4 取代**：共享锚点在 per-entry SRS + 不跨书共享的前提下没有消费者 |
| B | `Word = (wordKey, posKey)` | ✅ | 通过多个 entry | 0（但改写语义） | **拒绝**：把"词"拆成多条，破坏词形身份与去重 |
| C | `Word` + `BookEntry`（条目自己携带来源 POS / 释义） | ⚠️ 只能在条目上放**一个** POS / 一份释义 | ❌ 无位置容纳"多义项 + 各自来源" | 0 | **不足**：无法同时满足"条目可含多个义项"与"逐义项来源 / 校验" |
| **D（选定）** | `Word`（词形身份）+ **`BookEntry`（学习单位 + SRS 归属 + 策划目标）** + 从属 `BookEntryMeaning` / `BookEntryExample` | ✅（来源条目在 meaning 层逐条保留） | ✅（1..N meanings） | +2（均为**从属**概念，且**不做 SRS 归属**） | **采用** |

#### 4.6.3 上游"同一 headword 多条 POS / 义项"如何不被丢弃、也不被强行拆成卡片

```
上游数据集（示例：CEFR-J）
  record (noun, B1)      record (verb, A2)
        │                       │
        └──────────┬────────────┘
                   ▼  导入器：身份解析 + 来源条目保留
Word "record"（一个词形身份）
                   ▼
VocabularyBookEntry（该书策划的学习单位：可以是 1 个，也可以是 2 个）
   ├─ BookEntryMeaning #1：目标词性 n.，来源引用（sourceEntryId / sourceCefrLevel=B1 / sourcePosRaw=noun）
   └─ BookEntryMeaning #2：目标词性 v.，来源引用（sourceEntryId / sourceCefrLevel=A2 / sourcePosRaw=verb）
                   ▼
BookEntryExample（逐条例句，可绑定某个 meaning；逐条来源）
```

**两条硬性规则:**

1. **来源行不得丢弃**：每一条合法的上游条目都必须在目标模型里有位置（落在 `BookEntryMeaning` 的
   `sourceEntryId` / `sourcePosRaw` / `sourceCefrLevel` / `sourceCategory` / `sourceRank` 上）；
   导入器**只**允许丢弃"同一来源条目被导入两次"这种**真重复**。
2. **不得强行拆成学习者可见卡片**：上游把 noun / verb 分成两行，**不自动**意味着我们的书要有两张卡。
   是否拆成两个 `BookEntry`，是**该书策划决定**（例如 CET-6 书可能合成一条"record（n./v.）"，
   而另一本书可能拆成两条）。两种做法都合法，且都必须保留来源区分。

#### 4.6.4 具体回答：`record`（noun B1 / verb A2）

| 问题 | 答案（v4 模型 D） |
|------|------------------|
| **全局共享什么？** | 一个 `Word`（`wordKey = "record"`）+ 共享词汇内容（默认音标 / 通用释义 / 搭配 / 图片，带来源标记） |
| **属于 `BookEntry` 什么？** | `wordId`、**目标词性范围**（`targetPosScope`，例如 `n.` 或 `n./v.`，另存来源原文 `targetPosRaw`）、`position`（书内顺序）、层级 / 等级、curation `status`、来源摘要；以及 **SRS 状态 `(userId, bookEntryId)`** |
| **属于 `BookEntryMeaning` 什么？** | 每个目标义项 / 用法：含义文本、目标词性、以及**该来源的引用**（`sourceEntryId`、`sourcePosRaw`、`sourceCefrLevel`、`sourceCategory`、`sourceRank`）或 AI 生成元数据（provider / model / generatorVersion / generatedAt）+ `validationStatus` |
| **属于 `BookEntryExample` 什么？** | 例句与逐条来源（可绑定到某个 meaning，从而避免名词条目显示动词例句） |
| **学习者状态？** | **按条目**：`(userId, bookEntryId)`。若我们的书把 noun / verb 合成**一个**条目，则该条目只有一条状态（名词与动词一起被调度 —— 这是策划决定）；若策划成**两个**条目，则两条状态独立 |
| **跨书怎么办？** | **不传播、不合并、不评分转移**：另一本词书里的 `record` 是**另一个条目**，有自己的状态。用户若已掌握，可在新书里自行按已掌握按钮（现有产品能力，见 §5.4） |
| **绝不允许的做法** | ① 因 `wordKey` 相同而丢掉合法来源条目；② 上游写成 `"n./v."`（未区分）时自行拆成两条；③ 把上游义项/词性差异**强行**变成学习者可见卡片（是否拆由该书策划决定）；④ 跨书同步掌握度 |

#### 4.6.5 字段归属总表（v4）

| 字段 | 归属 | 理由 |
|------|------|------|
| `headword` / `wordKey` / 共享 `phonetic` / 通用 `definition` / `collocations` / `imageUrl` | `Word` | 词形身份与**与书无关**的共享词汇内容；来自 lexical source，带来源标记 |
| `targetPosScope` / `targetPosRaw` | **`BookEntry`** | "这本书要教这个词的哪个（些）用法"是**书**的策划决定，不是词的属性 |
| `position` / 层级 / `status` / 来源摘要 | **`BookEntry`** | 书内顺序、层级与策划状态 |
| 目标义项文本 / 目标义项的词性 / 逐义项来源引用 / 逐义项生成元数据 / 校验状态 | **`BookEntryMeaning`** | 一个条目可以有多个目标义项，且每个义项可能有不同来源或不同生成批次 |
| 例句 / 例句来源 / 例句作用域（绑定的 meaning） | **`BookEntryExample`** | 多值 + 逐条来源 + 逐条替换（v1 B-03 的修正继续有效） |
| 学习者复习状态 | **`LearnerEntryReview`（`userId`, `bookEntryId`）** | v4 的 SRS 归属决定 |

#### 4.6.6 稳定条目身份与唯一性（**v5 修正，B-06**）

> **v4 的缺陷。** v4 把 `position` 当作条目的顺序**兼身份**，同时允许导入"整体替换条目集合"。
> 一旦词书更新（插入 / 删除 / 重排），`position` 会漂移，而学习状态是 `(userId, bookEntryId)` ——
> **学习者的 SRS 连续性会被破坏**（同一个 `bookEntry` 行可能变成另一个学习单位，或状态被静默孤立）。

**目标不变式（硬性）:**

```
VocabularyBookEntry
  entryKey                                        -- **稳定策划身份**（curated key）
  UNIQUE(bookId, entryKey)                        ← 目标不变式
  position                                        -- **仅排序**，语义上**不是**身份

BookEntryMeaning
  UNIQUE(bookEntryId, position)                   -- 条目内义项顺序

来源条目身份（来源行，不是策划身份）
  ❌ 不得用 UNIQUE(bookId, wordKey) / UNIQUE(bookId, wordId)
  ✅ 同一来源条目不得被导入两次：导入器按 (book, sourceEntryId) 校验并记录 rejected
```

**`entryKey` 的语义（给实现者的直接规则）:**

| 规则 | 内容 |
|------|------|
| 生成 | 由**该书策划**决定；必须**稳定**、可读、且在同一本书内唯一。推荐形态：来源提供条目 id 时用 `src:<sourceId>:<sourceEntryId>`；否则用确定性的 `curated:<bookSlug>:<wordKey>[:<discriminator>]`（discriminator 用于同词多条策划条目，例如 `:n` / `:v` / `:1`） |
| 不随排序变化 | 重排（改 `position`）**不得**改变任何 `entryKey` |
| 不随内容修订变化 | 修正释义、换例句、改音标、改层级 → **保持同一个 `entryKey`**（学习状态连续） |
| 语义变化才换键 | 当策划上**确实是另一个学习单位**（例如把一条 `record` 拆成名词 / 动词两条，或把两条合并成一条）时，**必须**分配**新的 `entryKey`**，并把旧条目置为 `inactive` / `superseded` |
| 不做跨书身份 | `entryKey` 只在**一本书内**唯一；**不得**用它做跨书的身份或同步（§5.4） |

**导入 / 重新导入 / 更新的协调规则（reconcile，不是删除重建）:**

1. 以 `(book, entryKey)` 为**主键语义**协调：已存在的 `entryKey` → **原地更新**内容字段（
   `position` / `targetPosScope` / `level` / `status` / 其 meanings 与 examples），**不**删除重建；
2. 新出现的 `entryKey` → 新增条目（新学习单位 → 学习者的该条目从未学习开始）；
3. 本次导入**未出现**的旧 `entryKey` → 置为 **`inactive` / `superseded`**，
   **不**物理删除，从而**不**让既有的 `LearnerEntryReview` 行静默孤立；
4. 旧的 `LearnerEntryReview` 行**始终保留**（历史可审计）；是否在 UI 上呈现"该条目已不在本书中"是产品决策（U-3）；
5. **迭代幂等**：同一个 manifest 连续导入两次，`entryKey` 集合与内容**完全一致**（第二次全部命中"原地更新"路径）。

**为什么用 `entryKey` 而不是"引用 `position`"或"直接换行"（对初学者）:**
`position` 是**排名**，排名会变；学习状态记录的是"我在这个**学习单位**上的记忆"，而学习单位必须有自己的
**名字**。`entryKey` 就是这个名字：只要这个学习单位还是同一个（哪怕释义被修正、顺序被调整），
名字不变、学习状态就继续有效；只有策划上真的换了一个学习单位，才换名字。

**明确不做:** 不引入 `VocabularyBookVersion` 表（除非后续出现"必须回看历史版本内容 / 必须把学习者钉在某个版本"的
真实需求）；不引入跨书身份或同步。

### 4.6b 历史对照：v3 的 `WordUsage` 方案（**已被 v4 取代 —— 保留作评审追溯**）

> 本节内容**不再属于目标模型**，仅保留 v3 当时的对比与论证，便于外部评审对照 v3 → v4 的变化。
> 其中的模型 C、`posKey` 闭集、`WordExample.wordUsageId`、`(userId, wordId)` 状态等措辞均**已被 v4 取代**。

> **v1 复核 B-02（已接受为已解决）** 指出：用归一化 headword 标识 `Word`、
> 把 `partOfSpeech` 当作共享内容，会**丢失来源语义**。
> **v2 复核 B-05（本轮阻断项）** 进一步指出：v2 虽然把 `sourcePos` / `sourceCefrLevel` 等
> 放到了 entry 上，但**导入 / 去重规则仍然写着 "by-wordKey-keep-first" 与 "no-duplicate-wordKey"**，
> 这会让导入器把 `record(noun)` 与 `record(verb)` **当成重复条目丢弃一条** —— 端到端**不自洽**。
> 本节把身份、用法、条目、内容四层一次性对齐。

#### 4.6.1 真实来源证据（第一方）

**CEFR-J Wordlist 官方页（2026-09-21 访问，原文）:**

> 「ただし、項目は**同一単語の異なる品詞は別項目**になっており、**異なるCEFRレベル**を付与している。」
> （同一单词的不同词性**是不同的条目**，并被赋予**不同的 CEFR 等级**。）

这条第一方陈述就是本设计必须支持的**真实数据集行为**：`record` 作为名词（B1）与作为动词（A2）
是两个**合法条目**，任何一个都不能因为"归一化后都是 `record`"而被丢弃。

#### 4.6.2 三个最小模型对比

| | **A. 共享 `Word` + 多个 entry 各自携带来源语义** | **B. `Word` 身份包含归一化 POS** | **C. 共享 `Word` + 轻量 `WordUsage` + entry 指向 usage**（**选定**） |
|---|---|---|---|
| 身份 | `Word = wordKey` | `Word = (wordKey, posKey)` | `Word = wordKey`；`WordUsage = (wordId, posKey)` |
| 条目 | `BookEntry(bookId, wordId, sourcePos, …)` | `BookEntry(bookId, wordId)` | `BookEntry(bookId, wordUsageId, sourceEntryId, sourceCefrLevel, sourceCategory, sourceRank, position)` |
| 能否保留 noun/verb 两条 | ✅ | ✅ | ✅ |
| **用法级内容**（POS 相关音标 / 释义 / 例句）放在哪 | ❌ 没有稳定锚点：只能放在**每个 entry** 上 → 跨书重复、无法共享 | 勉强（内容挂在按 POS 拆出的"词"上），但"词"被拆成多条，`record` 会变成两个"词" | ✅ `WordUsage` 就是那个锚点（共享、唯一、可被多本书引用） |
| 例句作用域（§4.7） | ⚠️ 需要在 `WordExample` 上塞 `posScope`（等价于 usage，但概念分散在两张表） | ⚠️ 同上（示例挂在 POS 词上） | ✅ `WordExample` 可选引用 `WordUsage`（一个字段） |
| 学习者状态按用法切分（若将来需要） | ⚠️ 需要 invent 一个新键 | ✅ 天然（状态挂在 POS 词上） | ✅ 只改状态外键（`wordUsageId`），不需重做身份 |
| 与现网数据兼容 | ✅ | ⚠️ 现网存在多词性字符串（如 `n./v.`）与短语条目，必须**拆分或造 POS** | ✅ 用 `posKey = multi` / `unknown` 如实表达"来源未区分" |
| 新增概念数量 | 0 | 0（但改动语义） | **1**（`WordUsage`） |
| 主要代价 | 用法语义分散在 entry / 例句两处，跨书无法共享，未来升级要动多处 | 把"词"拆成多条记录，破坏"一个词一条"的直觉与重叠词统计 | 多一个概念与一次导出（identity → usage → entry） |

#### 4.6.3 选定方案：C（共享 `Word` + 轻量 `WordUsage`）

**Phase 8 / 9 采用 C。** 理由：

1. **它同时满足三条真实需求**：保留 noun / verb 两条来源条目；让 POS 相关的**内容**（音标 / 释义 / 例句）
   有唯一锚点；让未来"按用法追踪掌握度"成为**改一个外键**而不是重做模型。
2. **`WordUsage` 不是 `WordSense`**：它只表达"这个词的某个**教学相关用法**"（词性维度），
   **不含**义项编号、义项释义辨析、本体映射。它由 `posKey` 定义，值域是**闭集**：
   `n` / `v` / `adj` / `adv` / … / `phrase` / `multi` / `unknown`。
3. **A 是 C 的特例**（usage 为空 / `unknown`），因此选择 C **不会**让简单情况变复杂：
   没有词性信息的来源只产生一个 `unknown` usage。
4. **B 被拒绝**：它把"词"拆成多条记录，破坏"一个词一条"的认知与重叠词统计，
   并且对现网的多词性 / 短语条目需要造出并不存在的 POS 划分。

**给初学者的解释（为什么多一层反而更简单）:**

```
Word        "record"                 ← 一个词（拼写身份），全局只有一条
WordUsage   record + n  /  record + v ← 这个词的两种用法（教学相关），全局各一条
BookEntry   CET-6 里的 record(n) with B1
            CET-6 里的 record(v) with A2   ← 书目条目，各自属于某本词书
WordExample 属于 record+v 的例句        ← 例句知道自己是"动词用法"的例句
```

如果没有中间那一层，那么"名词的音标"、"动词的例句"就只能塞在**每一本书的条目**里 ——
同一份内容会在不同的书里各存一遍；将来想让"名词/动词分别算掌握度"也无处可挂。
中间那层的作用就是：**把"这个词的某种用法"变成一个可以被多本书共享、被例句引用、
将来还能被学习状态引用的对象**。

#### 4.6.4 具体回答：`record`（noun B1 / verb A2）

| 问题 | 答案（C 模型） |
|------|---------------|
| **全局共享什么？** | 一个 `Word`（`wordKey = "record"`）+ 两个 `WordUsage`（`posKey = n`、`posKey = v`）+ 与用法无关的共享内容（如通用释义、图片） |
| **属于用法（usage）什么？** | 用法级的音标、释义、例句归属（`record` 名词 `/ˈrekɔːd/` vs 动词 `/rɪˈkɔːd/`）、例句作用域 |
| **属于条目（entry）什么？** | `sourceCefrLevel`（B1 / A2）、`sourceEntryId`、`sourceCategory`、`sourceRank`、`position`，以及该来源特有释义（若有，避免覆盖共享/用法内容） |
| **学习者状态？** | 仍是**一个词一条** `(userId, wordId)` —— 掌握 `record` 即名词与动词条目都显示为已掌握。这是**有意简化的产品规则**，其后果与升级路径在 §6.4 写明 |
| **绝不允许的做法** | ①因为 `wordKey` 相同而丢掉其中一条来源条目（B-05 的核心）；②把 `"n./v."` 当成"两个词性"去**自行拆分**（来源没区分就不能替它区分）。此时用 `posKey = multi` 并保留 `sourcePosRaw` |

#### 4.6.5 各字段归属总表（v3）

| 字段 | 归属 | 理由 |
|------|------|------|
| `headword` / `wordKey` | `Word` | 拼写身份，全局唯一 |
| `posKey` / `posLabel` | `WordUsage` | 用法维度；闭集归一化；`multi` / `unknown` 用于来源未区分的情形 |
| `phonetic`（用法相关时）/ 用法级释义 | `WordUsage`（可选） | POS 相关发音是真实存在的（`record` 名词 /ˈrekɔːd/ vs 动词 /rɪˈkɔːd/） |
| 通用释义 / 搭配 / `imageUrl` | `Word`（共享，带来源标记） | 与"哪本书、哪个用法"无关的内容 |
| `sourcePosRaw` | **entry**（或 usage 的来源标注） | 如实保留来源原文（例如某来源写成 `n./v.`） |
| `sourceCefrLevel` / `sourceEntryId` / `sourceCategory` / `sourceRank` | **entry** | 这些是**来源 / 词书**的判断：同一词在 A 表 A2、在 B 表 B1 完全可能 |
| 来源特有释义 / 标注 | **entry**（可选） | 避免某个来源的释义覆盖共享或用法内容 |

#### 4.6.6 条目层唯一性（供实现参考）

```
VocabularyBookEntry
  bookId, wordUsageId, position            ← position 在同一本书内唯一
  sourceEntryId?  (来源提供的条目 id)
  sourcePosRaw?, sourceCefrLevel?, sourceCategory?, sourceRank?

约束:
  UNIQUE(bookId, position)                              -- 顺序必须有定义
  UNIQUE(bookId, sourceEntryId) WHERE sourceEntryId IS NOT NULL   -- 同一来源条目不重复导入
  ❌ 不得使用 UNIQUE(bookId, wordUsageId)               -- 同一本书可以合法地两次列出同一用法
                                                          （不同义项 / 不同考试要求）
```

**为什么不能加 `UNIQUE(bookId, wordUsageId)`:** 来源本身可能对同一个用法给出多条条目
（例如同一名词的两个不同考试要求 / 义项）。用 `position` + `sourceEntryId` 表达唯一性，
既防止真正的重复导入，又**不**会吞掉合法条目。

### 4.7 多值例句与逐条例句来源（**v2 修正 → v4 重新定锚**）

> **v1 外部复核 B-03（绑定）。** v1 的审计已经指出 `Word.example` / `Word.exampleZh` 用 ` ||| `
> 在一个字符串里塞多条例句，但目标模型仍把它们当成**标量 `Word` 字段 + 字段级来源标记**。
> 这无法表达：多条例句、**逐条**来源、以及"某一条 AI 例句可以被单独替换 / 重新生成"。
> 本节给出最小正确表示。
>
> **v4 重新定锚。** v3 把例句挂在**共享的 `WordUsage`** 上（为了跨书复用）。v4 移除了 `WordUsage`
> 且不要求跨书共享，因此例句**挂在词书条目（及其目标义项）**上：`BookEntryExample`。
> 逐条来源、逐条替换、以及"名词条目不得显示动词例句"这三条要求**全部保留**。

#### 4.7.1 备选方案对比

| 方案 | 表示 | 多值 | 逐条来源 | 单独替换某条 | 成本 |
|------|------|------|---------|-------------|------|
| E-1 "一个 canonical 例句在 `Word`，其余放别处" | 标量 + 子表并存 | 部分 | 部分（两条路径来源不同，容易混淆） | 困难 | 中（两处真相） |
| **E-2 `BookEntryExample` 轻量子关系**（**推荐**） | 每条例句一行，带 `position`、作用域与来源元数据 | ✅ | ✅ | ✅（改 `status` + 新增行，不删历史） | 低 — 中（一张小表 + 读取时的排序） |
| E-3 保留 ` \|\|\| ` 拼接 + 字段级来源 | 一个字符串 | 形式上"有" | ❌（整串一个来源） | ❌ | 最低（但**满足不了需求**） |

**选定 E-2（v4 形态：`BookEntryExample`）。** 触发条件**已经成立**（现网 2,000 条 IELTS 词全部含多条例句，
且这些例句由 DeepSeek 生成、未来需要按来源替换），因此这**不是**过早规范化；
同时它只覆盖"例句"这一处，不波及释义 / 音标 / 搭配（§4.7.4）。

#### 4.7.2 `BookEntryExample` 的最小字段（设计，不实现）

| 字段 | 作用 | 备注 |
|------|------|------|
| `bookEntryId` | 归属的词书条目 | 例句属于**这本书的这个条目**（v4 定锚） |
| `bookEntryMeaningId?` | **可空**：该例句示范哪个目标义项 / 用法 | 为空 = 条目级（该条目通用）例句；非空 = 只属于该义项的例句（见 §4.7.5） |
| `text` / `translation` | 英文例句 / 中文对照（对照可为空） | 当前 ` ||| ` 拼接的两端分别落到这两个字段，**按条拆分** |
| `position` | 展示顺序 | 取代"字符串内的顺序"；UI 取最小 `position` 作为主例句（**不再**保留标量 `example`） |
| `sourceType` | **闭集**：`source-derived` / `curated` / `ai-assisted` / `ai-generated` | 决定是否可再分发、是否需要署名、是否需要标注"AI 生成" |
| `provider` / `model` / `generatorVersion` | 仅 AI 相关来源时填写：生成方（如 `deepseek`）、模型名、**生成管线版本** | **不**存 prompt 正文、不存用户私有数据、不存完整请求 / 响应载荷 |
| `generatedAt` | 生成时间 | 用于批次追溯与替换 |
| `sourceManifestRef` | 仅来源派生内容填写：产生该条数据的 manifest / 版本引用 | 与导入设计（来源文档 §8）对接 |
| `status` | `active` / `superseded` | 支持"替换而不删除"：旧例句转 `superseded`，可审计 |

#### 4.7.3 AI 派生内容必须具备的 provenance（最低要求）

1. **生成方身份**：`provider`（如 `deepseek`）+ `model`；
2. **生成 / 导入路径与版本**：`generatorVersion`（管线 / importer 版本号）或 `sourceManifestRef`；
3. **时间**：`generatedAt`；
4. **可区分性**：`source` 必须能区分 `generated` 与 `licensed` / `curated`，
   使许可审查与"哪些内容可以被自由替换"一目了然；
5. **最小化**：**不**保存 prompt 正文、**不**保存用户私有数据、**不**保存不必要的模型原始响应。

即：provenance 的目的是"**能区分、能追溯、能替换**"，不是"把生成过程整包存档"。

#### 4.7.4 搭配（collocations）归属 —— **v5 对齐（B-07）**

**v4 的不一致（B-07 指出）:** 一处说搭配属于共享 `Word`，另一处又要求"正式词书卡片使用条目级内容"。
v5 明确如下（与 §4.8 的内容契约一致）:

| 位置 | 角色 | 是否学习卡片的规范内容 |
|------|------|---------------------|
| **`BookEntryMeaning.collocations?`**（有界文本） | **该书学习卡片展示的搭配**（策划 / 来源派生 / AI 富化，带来源与校验状态） | ✅ **是**（正式出版词书的学习内容必须是显式的条目级内容） |
| `Word.collocations`（共享词汇数据，带来源标记） | 词形身份层面的**通用**搭配信息；可用于非词书场景（如 Reading / AI Coach 的通用词汇查询）与**策划时的素材** | ❌ 不是正式词书卡片的规范内容（除非该书显式声明允许回退，见 §4.8） |

**为什么不把搭配拆成独立子表（保持 v4 的简化）:** 搭配在 UI 上**整体展示**，
没有"逐条替换 / 逐条署名"的需求；把它拆成子表会增加 join 与编辑复杂度却没有对应消费者。
因此搭配以**有界文本**存在 `BookEntryMeaning` 上；留下触发条件 —— 当出现"需要对单条搭配单独标注来源或单独替换"时再拆。

#### 4.7.5 例句的作用域（**v4：条目 / 义项作用域**）

**问题（v3 已提出，仍然成立）:** 如果例句只挂"词"，一个**名词**条目可能显示到只属于**动词**的例句
（例如 `I recorded the song.` 出现在 `record` 名词卡片上）。这是真实的正确性问题，不是风格问题。

**v4 的选择:** 例句**属于词书条目**，并可**可选**绑定到该条目的某个目标义项：

| 方案 | 描述 | 能否避免串用 | 跨书复用 | 结论 |
|------|------|------------|---------|------|
| **T-1 `BookEntryExample` + 可选 `bookEntryMeaningId`**（**选定**） | 例句属于条目；绑定义项 = 只服务该义项；不绑定 = 该条目通用例句 | ✅ | ❌（不共享，符合 v4 产品决定） | **采用** |
| T-2 例句必须绑定到某个义项 | 不存在"条目通用例句" | ✅ | ❌ | 拒绝：短语 / 通用例句确实与具体义项无关 |
| T-3 例句只挂 `Word`（v2 形态） | 全部例句属于词 | ❌（正是问题所在） | ✅ | 拒绝 |
| T-4 例句挂 `WordUsage`（v3 形态） | 共享用法锚点 | ✅ | ✅ | 随 `WordUsage` 一并移除（跨书共享不是需求） |

**解析规则（与 §4.8 一致）:**

```
展示某个 BookEntry 的例句 =
    该条目下 active 例句中，(bookEntryMeaningId IS NULL) 的条目级例句
  ∪ (bookEntryMeaningId = 当前展示义项) 的义项级例句
  按 position 排序
  ❌ 绝不包含其它义项作用域的例句
```

**为什么 v4 不再需要"共享例句":** 跨书共享内容的前提是"同一个学习单位在多本书里重复出现" ——
v4 明确不把跨书同步作为产品需求（§5.4），因此为共享而设计的中间层（`WordUsage`）与共享例句
都不再有消费者。若将来确实需要跨书复用同一批例句，再经治理流程评估（§4.4 的触发条件）。

### 4.8 正式词书学习卡片的规范内容契约（**v5 重写，B-07**）

> **v4 的缺陷。** v4 的规则写成"BookEntry → Word 逐级回退"，而对**正式出版的词书**来说，
> 这会**静默**把通用 `Word.definition` / `Word.phonetic` / `Word.collocations` 当作学习卡片内容 ——
> 而该书的策划目标可能与之不同（同一 headword 的不同词性有不同释义与发音）。这是**正确性**问题。

**契约（唯一规则）:**

```
正式出版 VocabularyBook 的学习卡片
  释义 / 目标义项  ← 必填：BookEntryMeaning.text（该书策划的规范释义）
  目标词性        ← 必填：BookEntryMeaning.targetPosScope / posLabel（或 BookEntry.targetPosRaw）
  中文解释 / 翻译  ← 选填：BookEntryMeaning.translation
  音标            ← 选填：BookEntryMeaning.phonetic（**按义项 / 词性区分**）
  搭配            ← 选填：BookEntryMeaning.collocations（该书作用域的有界文本）
  例句            ← BookEntryExample（可绑定到某个 meaning）

缺失时：显式缺失（UI 显示占位 / "暂无"），
        **绝不**静默用共享 Word 数据顶替；也绝不跨义项 / 跨条目 / 跨书借用。
```

| 字段 | 规范来源（正式词书） | 共享 `Word` 数据的角色 | 是否允许回退 |
|------|--------------------|----------------------|-------------|
| 释义 / 目标义项 | **`BookEntryMeaning.text`**（1..N，按 `position`） | 策划**素材**（来源词表 / 词典证据）；非词书场景（Reading / AI Coach 通用查询）的直接数据 | ❌ 默认**不允许**；见下方"显式回退策略" |
| 词性 | `BookEntryMeaning.targetPosScope` / `posLabel`（或条目级 `targetPosRaw` 原文） | —（`Word` 无词性） | ❌ |
| 中文解释 / 翻译 | `BookEntryMeaning.translation`（可为 AI 富化，带 provenance + 校验） | — | ❌ |
| 音标 | **`BookEntryMeaning.phonetic`**（义项级；`record` 名词 `/ˈrekɔːd/` vs 动词 `/rɪˈkɔːd/` 由此表示） | 策划素材 / 通用查询 | ❌ 默认**不允许**（`Word.phonetic` 不能假定对所有词性成立） |
| 搭配 | **`BookEntryMeaning.collocations`**（有界文本） | 素材 / 通用查询 | ❌ 默认**不允许**（§4.7.4） |
| 例句 | `BookEntryExample`（`bookEntryMeaningId` 可空 = 条目级；非空 = 义项级） | — | ❌（不得跨义项 / 跨条目） |
| 图片 | `Word.imageUrl`（与用法无关，可共享） | 通用数据 | ✅ 允许（图片不改变本书的策划目标） |

**四条硬性要求:**

1. **正式词书卡片的规范内容必须在 `BookEntryMeaning` / `BookEntryExample` 上显式存在**；
   共享 `Word` 数据**只是素材与通用查询数据**，不是学习卡片的规范内容。
2. **不存在隐式回退**：任何"用 `Word.definition` / `Word.phonetic` / `Word.collocations` 顶替"的行为
   都**不是**默认行为，而且**不得**改变本书的策划目标。
3. **显式回退策略（可选、需申报与校验）**：一本书**可以**在 manifest 中声明
   `fallbackPolicy: { mode: explicit, allowedFields: ["phonetic"] }`（默认 `none`），
   用于"该书明确允许在缺失时借用共享词形数据"的**受控**情形。声明必须：① 逐字段列出；
   ② 经过校验（例如名词条目的音标不得与义项声明的词性冲突）；③ 在导入报告中可见。
   **`definition` / `collocations` 默认不可列入允许字段** —— 它们直接决定学习内容。
4. **来源与校验元数据随内容走**：每条 meaning / example 都带 `sourceType`、来源引用或生成元数据、
   `validationStatus`（AI 富化内容必须通过校验门），以便许可审查、署名与替换。

**`record` 的可表示性（B-07 要求的具体例子）:**

```
Word            record（一个词形身份）
BookEntry       CET-6 里的 record（entryKey = "curated:cet6:record"）
   ├─ BookEntryMeaning #1  targetPosScope = n.
   │     text = "记录；唱片"            phonetic = "/ˈrekɔːd/"      collocations = "keep a record 保留记录, ..."
   │     sourceType = source-derived（来源 …）+ validationStatus = passed
   └─ BookEntryMeaning #2  targetPosScope = v.
         text = "记录；登记"            phonetic = "/rɪˈkɔːd/"     collocations = "record a meeting 记录会议, ..."
         sourceType = ai-assisted       + provider/model/generatorVersion + validationStatus = passed
```

该结构同时满足三件事：**名词与动词的发音不同**、**各自的搭配不同**、**各自的来源 / 校验状态不同**；
而它们仍然是**同一个 `BookEntry`**（如果这本书的策划就是这样教这个词）。
若该书决定把名词与动词拆成两张卡片，则它们是**两条 `BookEntry`**（各自的 `entryKey`，见 §4.6.6）。

---

## 5. 重叠词语义（**v4 重新决策**）

**场景:** `allocate` 同时属于 CET-6、IELTS 与 Business English。

> **v3 → v4 的方向变化（必须明说）:** v3 的结论是"一个 `Word` + **全局** `(userId, wordId)` 掌握度 +
> 书只记录成员资格"。**v4 的产品澄清推翻了这一点**：
> **SRS 状态属于 `User + BookEntry`**，产品**不要求**跨书同步，也**不要求**跨书共享内容。
> 因此"重叠词"不再是一个需要**算法**解决的问题，而是一个**产品语义**问题：
> 不同词书里的 `allocate` 是**两个不同条目**，各有各的状态。

### 5.1 决策（v4）

> 学习状态键 = **`(userId, bookEntryId)`**。

- 同一个拼写出现在两本书 → **两个 `BookEntry`** → **两条独立学习状态**（各自的策划目标可能不同：
  不同义项、不同等级、不同例句、不同顺序）。
- **换书不重置、也不传播**：新书里的这个条目就是一条新记录，从未学习开始；
  旧书里的状态**保持不动**（不会被删除，也不会被复制过去）。
- 学习者若已在别处掌握，**自行**在新书里按"已掌握"（现有产品已提供知识等级 / 掌握标记能力）；
  系统**不**替用户推导。

### 5.2 备选方案对比（含 v3 方案）

| 方案 | 学习单位 / 状态键 | 换书后的行为 | 数据重复 | 调度数量 | 需要额外机制 | 结论 |
|------|------------------|-------------|---------|---------|-------------|------|
| A. 每条目各存一份**完整内容**（连词形内容也复制） | `(userId, entry)` | 新条目从零开始 | **高**（内容重复） | ×书数 | 无 | 拒绝：内容重复与漂移；用 `Word` 共享词形与共享内容即可避免 |
| B. **全局词状态**（v3 方案） | `(userId, wordId)` | 自动"已掌握" | 无 | ×1 | **需要**共享锚点层（`WordUsage`）+ 跨书语义 + 迁移归并 + 冲突处理 | **v4 拒绝**：产品不需要跨书同步；这些机制的成本换不来产品价值 |
| **C. 按书条目状态（选定）** | `(userId, bookEntryId)` | 新条目从零开始；用户可自行标记 | 无（内容由 `Word` 共享词形与共享词汇内容） | ×书数 | 无 | **采用** |
| D. 义项 / 用法级状态 | `(userId, entryMeaningId)` | 更细 | 无 | ×义项数 | 需要定义"部分掌握"与混合出题 | 拒绝（当前无需求；若将来需要，是 C 的自然细分） |

### 5.3 代价与收益（诚实记录）

| 代价 | 说明 |
|------|------|
| 同一个词可能在多本书里被重复练习 | 这是 v4 **有意接受**的产品行为；用户可自行标记已掌握 |
| 没有天然的"全球掌握词数" | 统计口径必须显式定义（按书统计；若要跨书去重统计，则按 `wordKey` 去重**统计**即可 —— 这是**统计**，不是 SRS 状态） |

| 收益 | 说明 |
|------|------|
| 模型少一层 | 不再需要 `WordUsage` 这样的共享锚点层（§4.6） |
| 不需要同步 / 合并 / 冲突逻辑 | 没有跨书状态合并，就没有 v2 那类"合并不可拼接的状态"的风险在跨书场景出现 |
| 学习单位与产品一致 | "先选一本词书，然后学习这本书的条目"直接映射到 `BookEntry` |
| 迁移更简单 | 旧库的雅思池 → 雅思书的条目，状态随条目迁移；不同集合之间不需要合并 |

### 5.4 明确拒绝的实现（**不得**在实现中悄悄加入）

1. 全局跨书 SRS 同步（global cross-book SRS synchronization）；
2. 自动掌握度传播（automatic mastery propagation）；
3. 跨书复习状态合并（cross-book review-state merging）；
4. 迁移评分 / 转移分数（transfer scoring）；
5. 合成的"全局熟悉度调度器"（synthetic global familiarity scheduler）。

若将来产品确实需要其中任何一项，必须走**治理流程**（任务书 + 外部评审 + 用户批准），
并给出可测量证据；**不得**在实现阶段自行加入。

### 5.5 关键场景的具体答案（v4）

| 场景 | v4 行为 | 说明 |
|------|--------|------|
| 换书（同一拼写出现在新书） | 新书条目**从未学习**开始；旧书状态**不动** | 没有传播，也没有合并；用户可自行按"已掌握" |
| 词书版本更新 | 按 **`entryKey` 协调**（§4.6.6）：同名条目**原地更新**（释义 / 音标 / 搭配 / 顺序 / 例句可变），**学习状态连续**；新条目获得新 `entryKey`（从未学习开始） | **`position` 不是身份** —— 重排不破坏状态；内容修订也不破坏状态（B-06） |
| 新版本删除了某个条目 | 旧条目置为 **`inactive` / `superseded`**（**不**物理删除），其 `LearnerEntryReview` 行**保留**、不被静默孤立；是否在 UI 呈现"已不在本书中" = **产品决策** | 记为未决 U-3 |
| 策划上确实换了学习单位（如把一条 `record` 拆成名词 / 动词两条） | **必须分配新的 `entryKey`**；旧条目转 `superseded` | 这是"换键"的唯一合法理由（§4.6.6） |
| 学习者在别处已掌握该词 | **不自动**视为已掌握；用户在新书里自行标记 | 这正是 v4 明确拒绝自动传播的结果 |

---

## 6. 学习者进度与所有权

### 6.1 权威归属（沿用 Phase 6 不变式，**不得绕过**）

- 归属身份**只能**来自 `ExecutionContext.userId`（Delivery / Composition 解析，Domain 不读 cookie / header）。
- 操作 payload **不携带** `userId`；缺失 / 非法 → 显式失败，不在 Application 内回落默认用户。
- 词包（user pack）的 `ownerUserId` 与学习状态同源使用该身份。

### 6.2 学习状态与进度的精确定义（**v4：按条目归属**）

| 概念 | 存储 | 回答的问题 |
|------|------|-----------|
| **掌握度 / SRS 状态** | **`LearnerEntryReview(userId, bookEntryId)`** | "这个学习者对**这本书的这个条目**的记忆到什么程度？" |
| **书内进度（book progress）** | 派生（由该书的 `LearnerEntryReview` 状态 + 当前版本条目集合计算）；或可选的、**版本安全**的 `LearnerBookProgress` | "在这本书里我推进到哪里？" |
| **词包进度** | 由 Phase 10 定义（词包是独立产品域）；本设计只要求"不与书同步" | "这个主题包我学到哪了？" |
| **跨书掌握度** | **不存在**（明确拒绝，见 §5.4） | —（产品不提供该概念） |

**设计选择:** 优先**派生**（不存冗余计数），因为冗余计数会与 SRS 状态产生一致性风险。
只有当"统计查询成本被实测证明不可接受"时，才引入缓存列 —— 这就是典型"不要提前建表"的纪律。

**版本安全要求（v2 补充，对应外部复核的非阻塞项）:** 如果将来真的把书内进度**持久化**，
它**不得**是一个"裸的位置游标"（例如 `lastStudiedEntryPosition = 42`）——
词书成员与顺序会随版本变化，位置 42 在新版本里可能指向**另一个词**。
可接受的做法只有三类：

1. **推迟持久化**（推荐起点）：书内进度先用派生方式计算，不落库；
2. **绑定书版本**：持久化时同时记录 `bookVersion`，并在版本变化时按规则重算或失效；
3. **使用稳定引用**：记录一个稳定标识（如 `lastStudiedWordId` + 时间戳）而不是序号。

本设计**不在 Phase 7 引入任何生产模型**；上述三条是给 **Phase 9（Books）/ Phase 10（Packs）** 的约束。

### 6.3 与 SM-2 的关系

- SM-2（`sm2()`）保持**纯函数**，算法与返回值语义**逐字节不变**（Phase 2 的 32 个表征测试是受保护基线）。
- 变化只发生在"状态归属"：由 `@@unique([wordId])`（全局单份）演进为
  **`@@unique([userId, bookEntryId])`**（每用户 · 每书内条目一条）。
- 队列组装（新词 / 复习 / 混合 + 每日上限）属于 Application 编排，不属于 Domain 计算。
- **队列的作用对象是条目**：新词 = 当前书里尚无状态的条目；复习 = 该书里有状态且到期的条目。
  队列**不**跨书合并（没有跨书调度，见 §5.4）。
- **状态连续性依赖稳定 `entryKey`（v5，B-06）**：`LearnerEntryReview` 的键是 `bookEntryId`，
  而 `bookEntryId` 只在 **`entryKey` 不变**时才代表同一个学习单位。导入按 `entryKey` 协调
  （原地更新、不删除重建、移除条目转 `inactive`），因此**内容修订与重排都不会丢失学习状态**。

### 6.4 状态、条目与"同一拼写"的关系（**v4 重写**）

**v4 的规则（唯一被批准的产品规则）:**

> 学习状态属于**词书条目**。同一个拼写在不同书里 = 不同条目 = **各自独立的状态**；
> **不合并、不传播、不迁移评分**。

**必须一致对待的下游行为:**

| 下游 | 该规则下的行为 | 必须做的事 |
|------|---------------|-----------|
| **复习队列** | 队列按**当前所选词书**的条目组装：新条目 / 到期条目 | 切换词书 → 队列内容随之切换；**不**合并两本书的队列 |
| **书内进度** | 按该书条目的状态统计（已学习 / 已掌握 / 剩余） | 进度**只在该书内有意义**；不要把两本书的进度相加当作"总进度" |
| **同一拼写出现在多条** | 若我们的书把 noun / verb 策划为**一个**条目，则它们共享该条目的状态；若策划为**两个**条目，则两条状态独立 | 这是**该书策划决定**（§4.6.3），必须在设计 / 文案上体现，而不是靠算法猜测 |
| **UI** | "已掌握"标记是**条目级**的；卡片应显示当前条目的目标词性 / 义项（如 `record (n.)`） | 不显示"全局已掌握该词"这类不存在的信息 |
| **换书** | 新书条目从"未学习"开始；旧书状态保留 | 用户若已掌握，可自行按"已掌握"（现有产品能力） |

**明确不做（v4）:** 不做用法级状态（`(userId, bookEntryMeaningId)`）—— 当前没有需求；
若将来需要（例如"同一条目内的不同义项掌握度差异显著，且产品要分别展示"），
它是本模型的**自然细分**（状态键再挂一层），且必须走治理流程。

**与 v3 的差异（对照用）:**

| 维度 | v3（历史） | **v4（当前）** |
|------|-----------|---------------|
| 状态键 | `(userId, wordId)` | **`(userId, bookEntryId)`** |
| 同一拼写跨书 | 共享一条状态（换书自动已掌握） | **两条独立状态**（不传播） |
| 中间层 | 需要 `WordUsage` 作共享锚点 | **不需要**（已移除） |
| 迁移风险 | 需要跨池状态合并（C-2 冲突处置） | 只在"多条旧行映射到**同一个条目**"时才需要，且可测量（预期为 0，见迁移策略 §3.4/§4） |

---

## 7. 分层与结构

### 7.1 分层图（本项目既有四层架构）

```
Next.js UI / API Route（Layer 1 · `src/app/`）
        │  只做参数校验 → 调用用例 → 格式化响应
        ▼
Application Use Cases（Layer 2 · `src/application/`）
        │  编排步骤、构造 Prompt、组装队列、调用 Port
        ▼
Domain Rules（Layer 3 · `src/domain/`）
        │  纯计算：SM-2、书内进度计算、内容校验（无 IO / 无 Prisma / 无 Next.js）
        ▼
Repository Ports（Layer 2 定义接口）
        ▼
Prisma Adapter（Layer 4 · `src/infrastructure/`）
        ▼
PostgreSQL（Neon）
```

### 7.2 各能力归位

| 能力 | 归属层 | 具体形态（设计意图） |
|------|--------|---------------------|
| Vocabulary Books（目录、成员、顺序） | Domain 类型 + Application 用例 + Repository Port + Prisma adapter | `WordRepositoryPort` / `VocabularyBookRepositoryPort`（Application 定义，Infrastructure 实现） |
| 学习者 SRS 状态 | Domain 纯规则（算法）+ Application 用例（编排）+ Port（持久化） | `LearnerReviewRepositoryPort`，**`(userId, bookEntryId)`** 归属（v4） |
| 导入 / provenance | **离线命令（CLI）** 走 Application 用例 + Port（与 Phase 4 `scripts/reading-push.ts` 共享用例的模式一致） | manifest 在仓库内受版本控制；导入结果落库并带 version / checksum |
| 未来的 retrieval 能力 | Application 用例 + 新 Port；**不得**污染 Domain | Phase 13 的范围；本阶段只给触发条件（§8） |
| Prompt（AI 生成派生内容） | Application（`src/application/prompts/`），经 `AIClientPort` | 严禁在 Route / Domain 里直接 `fetch` provider |

### 7.3 为什么**不**引入第二个数据库

1. 现有需求（词书成员、学习状态、导入元数据）都是**关系型 + 小规模**，PostgreSQL 完全够用。
2. 引入第二个数据库会带来跨库事务、备份、迁移、监控、成本与认知负担（对初学者尤其明显）。
3. 只有出现**被测量**的、PostgreSQL 无法满足的需求（例如大数据量向量检索被证明必需）时才重新评估；
结论会先以"工程实验"的形式出现在 Phase 13，而不是在 Phase 7 / 9 直接落地。

---

## 8. 技术决策研究（每门技术按统一格式）

> 格式固定为：Technology / Plain-language meaning / Where it sits in our architecture / Problem it solves /
> What it connects to / Current project already uses it? / Alternatives / Benefits / Costs/risks /
> Decision / Evidence / Reconsideration trigger。决定取值限定为
> `adopt / keep / reject / defer / investigate later`。

### 8.1 SQL

```
Technology: SQL
Plain-language meaning: 一种用来描述"要从表里取什么、怎么改"的通用查询语言。它是一种语言标准，不是某个数据库产品。
Where it sits in our architecture: 最底层数据存取层的表达方式；Prisma 在它之上生成这种语句。
Problem it solves: 让"查询与更新数据"有统一、可组合、可优化的表达方式。
What it connects to: PostgreSQL（执行者）、Prisma（生成者）、Prisma adapter（连接通道）。
Current project already uses it?: 是（Prisma 生成 SQL；`src/app/api/words/route.ts` 还有一段手写 `$queryRaw`）。
Alternatives: 只用 ORM 抽象、完全手写查询、换成文档数据库查询语言（都不改本结论）。
Benefits: 标准化、可被数据库优化器优化、团队可读、可做数据审计。
Costs/risks: 手写 SQL 容易与 schema 漂移；本项目里 `$queryRaw` 已经承担了"雅思词池"这类领域语义，属于职责错位。
Decision: keep
Evidence: `src/app/api/words/route.ts` 使用 `Prisma.sql` 手写筛选；`prisma/schema.prisma` 为关系模型。
Reconsideration trigger: 无（除非整体更换数据存储范式，那属于新的产品决策）。
```

### 8.2 PostgreSQL

```
Technology: PostgreSQL
Plain-language meaning: 一个开源的关系型数据库；把数据存成有严格结构约束的表，并支持事务、索引、约束。
Where it sits in our architecture: 系统的持久化底座（Layer 4 之下的存储）。
Problem it solves: 可靠地存"用户 / 词汇 / 学习状态 / 导入记录"，并保证一致性（事务、外键、唯一约束）。
What it connects to: Prisma adapter、Neon（托管）、未来的导入 CLI。
Current project already uses it?: 是（`datasource db { provider = "postgresql" }`）。
Alternatives: MySQL、SQLite、文档数据库、图数据库、外部检索服务。
Benefits: 强约束（唯一约束正是"每词每人一份状态"的正确工具）、成熟的事务与索引、生态完善。
Costs/risks: 需要迁移管理（本项目的迁移链已损坏）；schema 变更需要治理与验证。
Decision: keep
Evidence: `prisma/schema.prisma:6–8`；Phase 6 新增三张表使用外键 + 唯一约束。
Reconsideration trigger: 出现 PostgreSQL 无法满足且被实测的需求（例如必须的向量检索规模或延迟目标）。
```

### 8.3 Neon

```
Technology: Neon
Plain-language meaning: 一个托管 PostgreSQL 的云服务（数据库本身仍是 PostgreSQL，只是别人帮你运维）。
Where it sits in our architecture: 运行时数据库的托管方；`src/lib/prisma.ts` 直接连接它。
Problem it solves: 免去自建数据库的运维（备份、升级、扩容），并支持 serverless 连接。
What it connects to: `@prisma/adapter-neon`、`DATABASE_URL`、部署平台。
Current project already uses it?: 是。
Alternatives: 自建 PostgreSQL、其它托管（Supabase / RDS / Railway）。
Benefits: 起步成本低、与 Vercel 类部署配合好、支持分支数据库（可用于隔离测试库）。
Costs/risks: 连接方式与池化需要注意（仓库里已出现 pooler / 直连的参数处理逻辑）；冷启动延迟。
Decision: keep
Evidence: `src/lib/prisma.ts`（Neon adapter + statement_timeout 处理）；`package.json` 依赖 `@prisma/adapter-neon`。
Reconsideration trigger: 出现迁移 / 备份 / 隔离测试库的硬性需求且 Neon 无法满足。
```

### 8.4 Prisma

```
Technology: Prisma
Plain-language meaning: 本项目的"数据库访问层"：用一份 schema 文件描述表结构，用它生成类型安全的查询代码。
Where it sits in our architecture: Infrastructure 层的 adapter 内部（Domain / Application 不直接依赖它）。
Problem it solves: 让"读写数据库"有类型检查、有唯一入口、可生成迁移。
What it connects to: `prisma/schema.prisma`、生成的 client、`src/infrastructure/**` 的 repository 实现。
Current project already uses it?: 是（同时用于种子脚本、API Route 的过渡代码、Phase 6 的 repository）。
Alternatives: 直接写 SQL / 其它 ORM（Drizzle、TypeORM）。
Benefits: 类型安全、迁移工具、与 PostgreSQL 契合；schema 是单一事实来源。
Costs/risks: 迁移链问题（本项目 baseline 迁移损坏）会直接阻塞部署；在 Route 里直接用 Prisma 会绕过分层。
Decision: keep
Evidence: `prisma/schema.prisma`；`ARCHITECTURE_RULES.md` EXT-003（schema 默认冻结）；Phase 6 迁移文件。
Reconsideration trigger: 若迁移工具链被证明无法可靠修复（见迁移策略文档），需要重新评估迁移管理方式（仍保留 Prisma 作为访问层）。
```

### 8.5 关系型多对多建模（relational many-to-many modeling）

```
Technology: 关系型多对多建模
Plain-language meaning: 用"中间表"表达"很多词属于很多书"这种关系：中间表的每一行代表一次归属。
Where it sits in our architecture: 词书 / 词包成员资格的实现方式（本设计的核心结构）。
Problem it solves: 让"同一个词属于多本书"和"一本书有很多词"同时成立，且不复制词条本身。
What it connects to: `Word` ↔ `VocabularyBookEntry` ↔ `VocabularyBook`（Packs 同理）。
Current project already uses it?: 部分（`ArticleVocab` 就是文章与词汇条目的中间表；但词书没有）。
Alternatives: 在 Word 上放 `bookId` 字段（一对多，无法表达多书）、JSON 数组（无法加约束与索引）。
Benefits: 支持重叠词、支持顺序、支持按书查询与统计；是"最小正确"表达。
Costs/risks: 查询需要 join；需要在导入时维护一致性（外键 + 唯一约束可保证）。
Decision: adopt（用于 Books 与 Packs 的成员资格）
Evidence: 重叠词是**已确立的需求**（`MIGRATION_PLAN.md` 的 Books 阶段条目「跨词书重叠词的处理」；
`MASTER_PLAN.md` 的 Phase 7 出口决策门把「跨词书重叠词语义」列为 Books 阶段的风险项之一）。
Reconsideration trigger: 无（除非词汇底座本身被替换）。
```

### 8.6 数据库迁移（database migrations）

```
Technology: 数据库迁移
Plain-language meaning: 把"数据库结构的一次变更"写成带时间戳的脚本，让任何环境都能按顺序执行到同一形状。
Where it sits in our architecture: `prisma/migrations/**` + Prisma CLI；属于交付与运维机制，不是产品代码。
Problem it solves: 让本地 / 测试 / 生产数据库结构可复现、可审计、可回滚（在可行范围内）。
What it connects to: `prisma/schema.prisma`、部署流程、隔离测试库。
Current project already uses it?: 是，但**已损坏**：最早的 baseline 迁移文件是 PowerShell 错误转储，不是 SQL。
Alternatives: `db push`（无历史）、手写 SQL 管理、迁移工具与 schema 分离。
Benefits: 可复现、可审计；配合真实数据库验证可以证明"新环境能起来"。
Costs/risks: 修复已损坏的历史迁移需要真实数据库验证与明确的风险处置（见迁移策略文档）。
Decision: keep（并把"修复 + 验证"作为独立的高风险变更处理；本阶段只设计）
Evidence: `prisma/migrations/20260609000001_baseline/migration.sql`（UTF-16LE BOM `FF FE`，内容为 PowerShell 报错）；
  `20260913000001_add_user_state_and_memory/migration.sql`（合法增量）。
  官方语义（Prisma ORM v7，2026-09-21 访问）区分两条不冲突的路线：
  **Baselining**（为"已存在的数据库"初始化迁移历史；用 `prisma migrate diff --from-empty --to-schema …` 生成 SQL，
  再用 `prisma migrate resolve --applied <dir>` 标记已应用）与
  **Squashing**（把历史压缩为**一份** baseline：清空 `prisma/migrations/`、新建排序最靠前的目录、
  `migrate diff --from-empty --to-schema ./prisma/schema.prisma --script > …/migration.sql`、
  `migrate resolve --applied <dir>`）。squash 后**新环境只执行这一份 baseline**，
  被压缩的历史目录必须**归档并移出活动链**（官方同时提示：手工改动过的 SQL 不会被保留）。
  详见 `VOCABULARY_MIGRATION_STRATEGY.md` §6.2。
Reconsideration trigger: 若修复阶段证明"重建历史 baseline"（路线 A）在证据上比 squash（路线 B）更可验证，
  或官方语义发生变化，则需要重新评估该选择。
```

### 8.7 确定性 SRS / 领域逻辑（deterministic SRS / domain logic）

```
Technology: 确定性 SRS 领域逻辑（纯函数）
Plain-language meaning: 复习算法写成"给同样的输入就得到同样的输出"的函数，不查数据库、不调 AI。
Where it sits in our architecture: Domain 层（`src/domain/**`）；当前实现在 `src/lib/sm2.ts`。
Problem it solves: 让核心学习行为可测试、可解释、可回归（Phase 2 的 32 个表征测试）。
What it connects to: Application 用例（传入/取出状态）、Repository Port（持久化状态）。
Current project already uses it?: 是（`sm2()` 为纯函数，32 个表征测试）。
Alternatives: 在 Route 内联算法、用第三方 SRS 库（FSRS 等）、让模型决定复习时间。
Benefits: 确定性、可测试、无外部依赖、成本为零。
Costs/risks: SM-2 是较老的算法；若未来要换算法（如 FSRS），需要新的评估与治理（属后续阶段）。
Decision: keep
Evidence: `src/lib/sm2.ts`；`src/lib/__tests__/sm2.test.ts`（Phase 2 受保护基线的一部分）。
Reconsideration trigger: 出现"用数据证明另一种调度（例如 FSRS）对本站学习者更好"的评估需求（Phase 11/12 的评估基础设施之后）。
```

### 8.8 PostgreSQL 文本 / 检索能力（text / search capabilities）

```
Technology: PostgreSQL 文本与检索能力（`tsvector` 全文、`pg_trgm` 模糊匹配、`ILIKE` / 前缀索引）
Plain-language meaning: 数据库自带的"按文字找东西"能力，不需要额外服务。
Where it sits in our architecture: 数据层能力；通过 Application 用例 + Repository Port 暴露为"查词"功能。
Problem it solves: "搜一个词 / 前缀匹配 / 拼写近似"这类**词典型检索**需求，成本几乎为零。
What it connects to: `Word` / `VocabularyBookEntry` 查询；未来的 AI Coach 词汇查找工具。
Current project already uses it?: 未使用（当前没有搜索功能；主题查询用等值过滤 + `groupBy`）。
Alternatives: 应用层内存过滤、外部搜索引擎（Elasticsearch / Meilisearch）、embedding 语义检索。
Benefits: 零新增基础设施、零额外服务、与事务一致。
Costs/risks: 中文分词需要额外配置（本项目词条为英文，风险有限）；复杂相关性排序需要调优。
Decision: investigate later（在需要"查词 / 搜索"功能时优先评估它，而不是先上向量检索）
Evidence: 当前无搜索实现（`src/app/api/words/**` 只有等值 / `groupBy` 查询）。
Reconsideration trigger: 出现词汇搜索 / 模糊匹配的真实产品需求（例如 AI Coach 需要"按词查释义"的工具）。
```

### 8.9 Embeddings（嵌入向量）

```
Technology: Embeddings
Plain-language meaning: 把文字变成一串数字（向量），意思相近的文字在数学上更接近。
Where it sits in our architecture: 若使用，属于 Infrastructure（生成与存储）与 Application（检索编排），**不得**进入 Domain。
Problem it solves: "意思相近但不含相同关键词"的检索（语义检索）。
What it connects to: 向量存储（pgvector 或外部服务）、检索用例、AI 模型提供方（生成向量）。
Current project already uses it?: 否。
Alternatives: 结构化 / 词法 / 前缀匹配（PostgreSQL 自带）；规则 / 标签体系。
Benefits: 能处理同义与模糊表达；对 RAG 类能力是常见前置。
Costs/risks: 额外模型调用成本与延迟；向量与内容的一致性问题（内容更新后需要重建）；调试难度高；对当前词汇需求没有证据支持的必要性。
Decision: defer
Evidence: 当前词汇需求是"按书取词 / 按主题取词 / 按计划复习"（`src/app/api/words/**`），全部是结构化查询，不需要语义相似度。
Reconsideration trigger: Phase 13 的检索工程调查中出现"结构化 / 词法检索无法满足"的被测量证据（例如语义检索明显提升检索质量）。
```

### 8.10 pgvector / 向量检索

```
Technology: pgvector（PostgreSQL 向量扩展）
Plain-language meaning: 给 PostgreSQL 加一个"存向量并按距离查找"的扩展；它让"向量库"不再需要单独的服务。
Where it sits in our architecture: 若使用，位于数据层（Prisma 之外的原生扩展能力）；通过 Repository Port 暴露。
Problem it solves: 在数据库内做近邻搜索，避免引入独立向量数据库带来的跨库一致性成本。
What it connects to: PostgreSQL 实例（Neon）、embedding 生成流程、检索用例。
Current project already uses it?: 否；本项目**未安装**该扩展。
Alternatives: 独立向量数据库（Pinecone / Weaviate / Qdrant）、内存向量索引、结构化检索替代方案。
Benefits: 单一数据库、事务一致、运维面小。
Costs/risks: 扩展可用性依赖托管方（Neon 支持情况需在采用时验证）；索引调优与内存成本；一旦使用会带来"向量与内容同步"的长期维护责任。
Decision: defer（并明确：**安装扩展 ≠ 需要 RAG**，也 ≠ 必然采用）
Evidence: `prisma/schema.prisma` 无向量字段；无 embedding 生成流程；无检索需求证据。
Reconsideration trigger: Phase 13 的评估显示"语义检索确实解决问题，且 pgvector 的成本低于独立向量数据库"。
```

### 8.11 RAG / 检索增强生成

```
Technology: RAG（检索增强生成）
Plain-language meaning: 先在自己的资料里检索相关内容，再把检索结果作为上下文交给模型，让回答有据可依。
Where it sits in our architecture: Application 用例 + 检索 Port；Domain 只提供纯规则；**不得**让检索内容成为系统指令权威。
Problem it solves: 让模型回答"有来源、可核对"，而不是完全依赖参数记忆。
What it connects to: 语料（词汇 / 阅读 / 知识）、检索层、AI Client、Trace。
Current project already uses it?: 否。
Alternatives: 直接把内容放进 prompt（有限上下文）、结构化查询 + 模板回答、微调。
Benefits: 可溯源、可更新（改资料不用改模型）、更适合"查询式"学习问答。
Costs/risks: 需要评估（否则无法证明有用）、需要安全边界（检索内容是**不可信数据**）、引入延迟与成本。
Decision: defer（Phase 13 拥有该工程调查；ADR-018 要求可测量证据）
Evidence: 路线图 `MASTER_PLAN.md` Phase 13 + `PORTFOLIO_ENGINEERING_CRITERIA.md` §3.4；当前无检索实现。
Reconsideration trigger: Phase 13 建立基线（结构化 / 词法）后，出现被测量收益或明确失败证据。
```

### 8.12 Redis / 缓存

```
Technology: Redis（外部内存缓存）
Plain-language meaning: 一个独立运行的高速键值存储，常用来缓存热点数据或做分布式锁。
Where it sits in our architecture: 若引入，属 Infrastructure，通过 Cache Port 使用。
Problem it solves: 降低重复查询的延迟 / 数据库压力；跨实例共享临时状态。
What it connects to: 数据库、API 层、部署环境（多实例时）。
Current project already uses it?: 否。当前缓存是**进程内**的（`src/lib/word-cache.ts`、`src/lib/prisma.ts` 的全局单例）。
Alternatives: 进程内缓存（已有）、PostgreSQL 查询优化 / 索引、Neon 连接池。
Benefits: 命中时快、成熟。
Costs/risks: 新增一个有状态的外部服务（运维、失效策略、一致性、成本）；本项目**没有**被测量的瓶颈证明它必要。
Decision: reject（当前无被证明的用例）
Evidence: 词汇数据规模为 2000 + 849 条（本地数据产物统计），查询为简单过滤 + 索引可覆盖；
  现有 `word-cache.ts` 是模块级缓存，尚未出现缓存失效需求。
Reconsideration trigger: 出现被测量的性能瓶颈（例如 P95 延迟或数据库负载指标）且索引 / 查询优化无法解决。
```

### 8.13 队列 / 后台任务（queues / background jobs）

```
Technology: 队列 / 后台任务系统
Plain-language meaning: 把耗时的活（例如批量导入、生成内容）排队交给后台慢慢做，不让用户请求等在那儿。
Where it sits in our architecture: 若引入，属 Infrastructure（执行器）+ Application（任务编排）；Domain 不受影响。
Problem it solves: 长耗时任务的异步化、重试、进度可见性。
What it connects to: 导入 CLI、AI 调用、数据库、部署平台。
Current project already uses it?: 否。当前的做法是**离线脚本**（`src/app/api/words/themes/generate` 仍是同步请求内生成，
  `prisma/seed.ts` / `scripts/reading-push.ts` 为 CLI 触发）。
Alternatives: 离线 CLI（已有模式）、平台自带的后台任务能力（例如部署平台提供的定时 / 后台函数）、同步执行。
Benefits: 用户体验更好、失败可重试、可观测。
Costs/risks: 引入运行基础设施与可观测性要求；对本项目当前规模是过度设计。
Decision: defer
Evidence: 导入类工作当前全部由 CLI 完成（`package.json` 的 `seed` / `push:reading` 脚本），没有在线长任务需求被证明。
Reconsideration trigger: 出现"用户在请求路径里等待长任务"的真实产品需求（例如学习者在页面内生成大词包并需要进度反馈）。
```

### 8.14 AI / DeepSeek 用于派生词汇内容

```
Technology: DeepSeek（AI 辅助 / 生成**学习者可见**内容）
Plain-language meaning: 用大模型生成或简化例句、搭配、讲解、中文解释、练习与记忆提示等"围绕词的解释性内容"。
Where it sits in our architecture: 经 `AIClientPort` 从 Application 用例调用（Infrastructure 实现 adapter）。
Problem it solves: 快速产出有语境、难度合适的学习材料（例句、搭配、讲解、练习），成本远低于人工编写。
What it connects to: Application Prompts、`AIClientPort`、内容来源标记（provenance）、
  `BookEntryMeaning` / `BookEntryExample`（或词包条目）、校验门（validation）、卡片 UI。
Current project already uses it?: 是（`prisma/seed.ts` 生成搭配与例句；`/api/words/themes/generate` 生成主题词表与解释；
  `/api/words/ai-train` 生成口语对话）。
Alternatives: 人工编写、使用许可明确的语料库例句（例如 CC 授权的句子集合）、不使用派生内容。
Benefits: 覆盖面广、可批量生成、可按主题与难度调节；能把"来源派生的词典证据"转写为**面向学习者**的解释。
Costs/risks: **不能作为第三方考试词表成员资格的权威来源**（模型会编造"这个词属于 CET-6"），
  除非该词书本身**明确是我们自研 / 策划**的集合并且**如实标注**；
  内容必须能区分"来源派生"与"AI 派生"，并经过校验门；不得把生成内容当作权威事实。
Decision: keep（**允许**用于学习者可见内容的富化；必须带 provenance 与校验状态，且不得伪造来源归属）
Evidence: `prisma/seed.ts`（DeepSeek 生成搭配 / 例句）；`src/app/api/words/themes/generate/route.ts`（运行时生成）；
  `src/app/api/words/ai-train/route.ts`（口语对话）。
  **v4 政策**: 推荐流水线 = 受信 / 开放词汇证据 → AI 富化（简化 / 翻译 / 解释）→ 校验 / 质量门 → 版本化的最终条目内容；
  生成内容记录 `sourceType`（`ai-assisted` / `ai-generated`）、`provider`、`model`、`generatorVersion`、
  `generatedAt`、`validationStatus`（详见 `VOCABULARY_DATA_PROVENANCE.md` §4）。
Reconsideration trigger: 若生成内容被证明质量不足（评估显示学习者表现更差），或替换为许可明确的语料成为可行方案。
```

---

## 9. 技术选择原则（必须与架构一起考虑）

对每一个有意义的技术选择，按顺序回答：

1. **存在什么真实的产品 / 工程问题？**
2. **需要什么架构职责？**
3. **已可用的最简单可靠技术是什么？**
4. **引入新技术会创造什么额外复杂度？**
5. **什么证据才足以证明该复杂度是合理的？**

**禁止**为了简历观感而采纳技术（do not adopt technology for résumé appearance）。
本项目已明确：**技术调查 ≠ 技术采纳**；允许的结论包括"这个技术对本项目不值得其复杂度"。

---

## 10. 参考研究（产品与开源系统）

> 以下区分 **OBSERVED（第一方页面直接可读的陈述）** 与 **INFERENCE（基于观察的推断）**。
> 访问日期均为 **2026-09-21**；抓取到的页面副本保存在仓库之外的临时工作目录（不作为仓库产物）。

### 10.1 商业产品

| 产品 | OBSERVED（第一方可见内容） | INFERENCE | 对本项目的启示 |
|------|---------------------------|-----------|---------------|
| **百词斩（Baicizhan）** | 官网自述：图背单词；**海量词表**（"从小学到出国，从教材到高频词汇"，支持自定义词数）；**单词全解**："单词释义取自柯林斯、朗文等权威词典"；场景化例句；真人讲解的"单词TV"；提供雅思 / 数学等子平台 | 其**释义内容来自商业词典授权**，因而不可能来自公开爬取；词表体系是产品核心资产（inference） | ①"词书 = 可选择的结构化目录"是真实产品形态；②**释义数据必须解决许可**，商业产品的做法是**授权**；③卡片可以承载图文与多模态内容（但不改变底层数据模型） |
| **墨墨背单词（Maimemo）** | 官网自述：基于 **BMMS** 收集的记忆行为数据做"精准规划海量记忆"；"单词上限"为付费产品项。其官方百科（墨墨百科 / 墨墨记忆卡文档）目录包含：**如何更换单词书进行学习**、**云词本**、内容标签、释义 / 助记 / 例句、**牌组**（deck）、**Ai 制卡**、**Anki 牌组导入**、**开放 API**、收藏牌组的学习与更新逻辑、"已学习卡片复习安排逻辑"、"重置学习数据"等 | ①"换书"是**一等产品行为**，说明换书后的进度语义必须被设计（inference）；②"牌组"体系接近 Anki 的 deck 概念，并支持跨系统导入（inference）；③其记忆模型有公开论文（INFERENCE，见下） | ①换书语义必须有明确设计（本设计 §5.5）；②"自定义词集（云词本）"与"官方词书"是两类对象（对应 Books vs Packs）；③导入 / 导出与开放 API 是长期价值点 |
| **不背单词（Bubei）** | **本次执行环境无法访问其第一方站点（TLS 握手失败）** | — | **未验证**。本设计**不得**基于对它的记忆或传闻做结论；如后续需要，应作为独立证据补充（见未决问题 U-1） |

**关于 Maimemo 记忆模型的补充（跨来源观察）:** FSRS 项目的 README 明确写着 FSRS "springs from **MaiMemo's DHP model**"
并链接其论文页（`https://www.maimemo.com/paper/`）。本次执行中该论文页返回 200 但内容为空（前端渲染），
因此：**"Maimemo 公开了记忆模型研究"是可观察的（由第三方项目 README 引证），论文细节本身为 UNRESOLVED。**

### 10.2 开源系统（含 Anki）

| 系统 | 观察到的工程模式（OBSERVED） | 是否适合本项目 | 实现 / 迁移 / 运维 / 认知成本 |
|------|-----------------------------|---------------|------------------------------|
| **Anki** | ①**Notes 与 Cards 分离**：note 是内容（fields），card 是"由模板生成的一道题"，学习状态挂在 **card** 上；②**Deck 是卡片的分组**，可"只学一部分"；③**调度属于 deck 配置（presets）**：新卡 / 复习上限、learning steps、ease、interval modifier、FSRS 开关；④**card 状态**：New / Learning / Review（Young < 21 天、Mature ≥ 21 天）/ Relearn；⑤Browser 支持按 cards 或 notes 两种模式浏览 | **部分适合**：内容（note）与"学习对象"分离、以及"集合（deck）分组"的思路直接适用；**Per-deck 调度预设**对本项目**过度**（我们是单产品、单一调度策略）；**card 模板系统**（多张卡片共用一条笔记、正反向卡片）本项目暂不需要 | 读 / 借用**概念**成本低；照抄 schema 成本高且不必要 |
| **FSRS（Free Spaced Repetition Scheduler）** | 开源调度算法，基于 DSR（difficulty / stability / retrievability）模型，源自 Maimemo 的 DHP 模型与 Wozniak 的三要素记忆模型；有多语言实现与优化器 | **暂不适合（延后）**：本项目当前的 SM-2 已被 Phase 2 固化为受保护基线；更换算法需要"可测量证据 + 评估基础设施"，属 Phase 10/11 之后 | 引入需要评估框架、参数拟合与数据积累；现在替换会破坏受保护基线 |
| **其它开源 SRS / 词表项目（本次实际检查）** | ①`skywind3000/ECDICT`：MIT 许可证（见来源表），但 README 自述数据由**多年多来源拼装**（早期文本文件、四六级到 GRE 词汇表、抓取的音标、cdict 开源字典、BNC 语料校对等）；②`mahavivo/english-wordlists`：README 明确写出各词表来源（某高校 PDF、2016 版四六级考试大纲 PDF、金山词霸 2003 版资料、牛津高阶词典 8 版、COCA 词频表），**未授予任何许可**；③`kajweb/dict`：README 写明 "Crawl from 'X 道背单词(app)'"，**无许可**，内容含商业 App 的题目与例句 | **作为"反面证据"极有价值**：说明**公开 GitHub 仓库 ≠ 数据再分发许可**；这正是本设计对导入路径提出 manifest + 许可证据要求的原因 | 「使用」成本为零（作为证据）；「导入」成本不可接受（许可不可证明） |

**给初学者的要点（为什么必须区分 OBSERVED / INFERENCE）:** 从应用界面只能看到**行为**，
看不到它背后的数据库结构。把"我猜它大概是这么实现的"写成事实，会让后续设计建立在不牢固的地基上。
所以本文件对产品研究只写下"第一方页面明确写了什么"，其余标注为推断或未验证。

---

## 11. Phase 9 / Phase 10 的边界（设计输入，不是实现授权）

| 归 **Phase 9**（Vocabulary Books Implementation） | 归 **Phase 10**（Themed Packs Convergence） |
|----------------------------------------------|----------------------------------------|
| 词书目录与成员资格模型（`VocabularyBook` / `VocabularyBookEntry`） | 词包模型（default / user-created）与归属 |
| 用户归属的 SRS 状态（**`LearnerEntryReview`**，`@@unique([userId, bookEntryId])`） | 词包的 label / emoji 等服务端持久化（替换 localStorage-only） |
| 导入管线 + manifest + 版本 / 校验和 | 自定义词包生成迁移到已批准架构（经 `AIClientPort`） |
| 选书体验（UI 入口，属实现范围） | 词包进度语义 |
| **迁移链修复与迁移正确性验收**（是否与 Books 同阶段见迁移策略文档） | 保持 Default / Custom 的产品差异 |
| **只迁移正式词书侧**（当前 IELTS 池 → `VocabularyBook` + `BookEntry` + `LearnerEntryReview`）；**保留**当前 Theme / generated 行与其遗留运行时 / 复习路径不变（见迁移策略 §5/§7.3，B-10） | **词包侧**：把 default / generated 主题成员迁移到 Pack / PackEntry；定义词包学习状态；**之后**才移除遗留 theme / source / difficulty 语义与遗留 review 路径 |

> **Phase 8 是什么（2026-09-23 拆分激活）:** `Migration Chain Repair & Reproducible Baseline` ——
> **只做**迁移链修复与可复现基线，**不含**任何产品功能；Books 的模型 / 导入 / UI 全部属于 **Phase 9**。
> 见 `MASTER_PLAN.md`、`PHASE_STATUS.md` 与 `DECISIONS.md` ADR-022。

**明确的边界:** 本文件不授权任何实现；Phase 8 / 9 / 10 的范围以其**各自被批准的任务书**为准。
**过渡期约束（B-10）:** Books 阶段**不得**为了"模型整齐"而提前实现词包收敛，
也**不得**删除词包当前依赖的遗留字段 / 路径；跨域的 `Word` 身份合并是**长期目标**，必须**分阶段**达成。

---

## 12. 未决问题（Phase 7 未能闭环的部分）

| # | 未决问题 | 为什么未决 | 建议的下一步 |
|---|---------|-----------|-------------|
| U-1 | 不背单词（Bubei）的产品行为 | 本次环境无法访问其第一方站点 | 在可访问环境中补充第一方证据，或明确放弃该参考项 |
| U-2 | Maimemo 记忆模型论文细节 | 论文页为前端渲染，抓取内容为空 | 若需要技术对标（例如未来评估 FSRS），单独取证 |
| U-3 | 词书版本更新后，被移除的**条目**（及其学习状态）如何呈现 / 是否清理 | 属产品决策，非架构决策 | 在 Phase 9 任务书中显式规定行为 |
| U-4 | 每日学习目标（当前 localStorage）是否升为服务端学习者状态 | 属 Phase 6 明确延后的 D-05；跨设备体验问题已被观察到 | 与 Phase 9 / 11 的范围一起评估 |
| U-5 | 学习队列的随机化语义（当前 `ORDER BY RANDOM()`）在目标模型下如何保持 | 影响学习体验与可测试性 | Phase 9 任务书内给出确定性 / 随机化策略 |
| U-6 | 词书排序的"学习顺序"是内容属性还是学习者属性 | 两种都有商业产品先例 | 需要产品输入；本设计不擅自规定 |
| U-7（v4） | 词包（Themed Packs）的学习状态语义 | 词包是独立产品域，其状态语义由 **Phase 10** 定义；本设计只要求"不与书同步" | 在 Phase 10 任务书中定义 |
| U-8（v4） | 跨书统计口径（是否存在"跨书去重后的总掌握词数"这类产品指标） | 统计口径 ≠ SRS 状态；本设计不擅自规定 | 需要产品输入 |
| U-9（v4） | 一本书内"同一词性的两条不同义项"是否合并为一个 `BookEntry` | 这是**该书策划决定**（§4.6.3） | 由各书的策划 / 导入规则决定，并在 manifest 中声明 |

---

## 13. 来源（本次执行实际访问，访问日期 2026-09-21）

| # | 来源 | URL | 观察到的关键内容 |
|---|------|-----|-----------------|
| S-1 | ECDICT 仓库许可 | `https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE` | MIT License, Copyright (c) 2025 Linwei |
| S-2 | ECDICT README | `https://raw.githubusercontent.com/skywind3000/ECDICT/master/README.md` | 数据由**多来源多年拼装**（EDictAZ 文本、四六级—GRE 词汇表、抓取音标、cdict 开源字典、BNC 校对）；tag 字段含 `zk/gk/cet4` 等 |
| S-3 | Anki 手册 · 入门 | `https://docs.ankiweb.net/getting-started.html` | card / deck 概念；card 状态 New / Learning / Review（Young / Mature）/ Relearn |
| S-4 | Anki 手册 · Deck Options | `https://docs.ankiweb.net/deck-options.html` | 调度属于 deck 配置与 presets；包含 FSRS 段落、daily limits、learning steps、ease、interval modifier |
| S-5 | Anki 手册 · Browsing | `https://docs.ankiweb.net/browsing.html` | Browser 支持 cards / notes 两种模式；可编辑与查找重复 |
| S-6 | Anki 手册 · Field Replacements / Templates | `https://docs.ankiweb.net/templates/fields.html`、`.../templates/intro.html` | note 的 fields 与 card 模板；Deck Override（同一 note 的多张 card 可进不同 deck） |
| S-7 | FSRS README | `https://raw.githubusercontent.com/open-spaced-repetition/free-spaced-repetition-scheduler/main/README.md` | 源自 Maimemo DHP 模型 + Wozniak DSR；本地运行；多语言实现 |
| S-8 | 百词斩官网 | `https://www.baicizhan.com/` | 图背单词；海量词表（含自定义词数）；释义取自**柯林斯、朗文**等词典；场景化例句；单词TV |
| S-9 | 墨墨背单词官网 | `https://www.maimemo.com/` | 基于 BMMS 记忆行为数据；"单词上限"为付费项 |
| S-10 | 墨墨百科 / 墨墨记忆卡文档 | `https://memodocs.maimemo.com/` | 目录含"如何更换单词书进行学习""云词本""牌组""Anki 导入""开放 API""已学习卡片复习安排逻辑""重置学习数据"等 |
| S-11 | 不背单词官网 | `https://www.bubei.com/` | **无法访问（TLS 握手失败）→ 未验证** |
| S-12 | mahavivo/english-wordlists README | `https://raw.githubusercontent.com/mahavivo/english-wordlists/master/README.md` | 词表来源为高校 PDF、2016 版四六级考试大纲、金山词霸 2003 资料、牛津高阶 8 版、COCA 词频表；**未授予许可** |
| S-13 | kajweb/dict README | `https://raw.githubusercontent.com/kajweb/dict/master/README.md` | 自述 "Crawl from 'X 道背单词(app)'"；内容含题目、例句、近义词；**无许可** |
| S-14 | NGSL 1.2 官方页 | `https://www.newgeneralservicelist.com/new-general-service-list` | "New General Service List by Browne, C., Culligan, B., and Phillips, J. is licensed under a **Creative Commons Attribution-ShareAlike 4.0 International License**." |
| S-14b | BSL 1.2（Business Service List）官方页 | `https://www.newgeneralservicelist.com/business-service-list` | "Business Service List by Browne, C. and Culligan, B., is licensed under a **Creative Commons Attribution-ShareAlike 4.0 International License**." |
| S-15 | CEFR-J Wordlist 下载页 | `https://www.cefr-j.org/download.html` | 版权归 Tono Laboratory；页面明确**可用于研究与商业用途，条件是正确标注来源**，并给出引用格式（Version 1.6） |
| S-16 | kaikki.org（Wiktextract） | `https://kaikki.org/dictionary/` | 数据抽取自 Wiktionary，"made available under the same licenses as Wiktionary - both CC-BY-SA and GFDL" |
| S-17 | Tatoeba 下载页 | `https://tatoeba.org/en/downloads` | 句子文件为 **CC BY 2.0 FR**，部分为 CC0 1.0；音频许可由贡献者选择 |
| S-18 | Oxford 3000/5000 词表页 | `https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000` | 页面可读词表内容，版权归 Oxford University Press；**未找到允许再分发的条款 → 在现有证据下不具备项目导入资格**（"no verified redistribution permission found"） |
| S-19 | WordNet 许可页 | `https://wordnet.princeton.edu/license-and-commercial-use` | **本次两次访问均返回 403 → 未验证**（不得据此下结论） |
| S-20（v4） | Open English WordNet 仓库 README / LICENSE.md | `https://raw.githubusercontent.com/globalwordnet/english-wordnet/main/README.md`、`.../LICENSE.md` | "Open English Wordnet is released under **CC-BY 4.0**"；LICENSE 进一步写明"derived from Princeton WordNet under the WordNet License and further developed under the **Creative Commons Attribution 4.0 International License**；需同时署名 Princeton WordNet 与 Open English Wordnet 团队" |
| S-21（v4） | FreeDict 官网 / 关于页 | `https://freedict.org/`、`https://freedict.org/about/` | 项目自述提供"truly free bilingual dictionaries"，使用者可学习、修改、分发，但必须**传递同等自由**（copyleft 风格）；**每本词典的具体许可需逐条核实**（→ §10 未决） |

> 更细的数据来源 / 许可分析、字段级归因与候选数据集表格见 `VOCABULARY_DATA_PROVENANCE.md`。

---

## 14. 相关文档

- `docs/refactor/tasks/phase-7-task.md` —— 本阶段的范围权威
- `docs/refactor/VOCABULARY_DATA_PROVENANCE.md` —— 数据来源、遗留 AI 数据分类、外部数据集调研、导入与版本化设计
- `docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md` —— 迁移映射、风险、阶段拆分决策
- `docs/refactor/DECISIONS.md` —— ADR-016（两个产品域）、ADR-017 / ADR-018（作品集证据与 AI 能力门槛）、ADR-019…ADR-022（本阶段提出的 **Proposed** 决策）
- `docs/refactor/ARCHITECTURE_RULES.md` / `TARGET_ARCHITECTURE.md` —— 分层与依赖规则
- `docs/refactor/MIGRATION_PLAN.md` / `PHASE_STATUS.md` / `MASTER_PLAN.md` —— 路线图、阶段与迁移路径
- `docs/refactor/EVALUATION_BASELINE.md` / `TEST_STRATEGY.md` —— 评估基线与测试分层（含迁移验证门）
