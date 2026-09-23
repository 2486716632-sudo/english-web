# Vocabulary 数据来源与遗留 AI 数据 — Phase 7

**日期:** 2026-09-21
**Phase:** 7 — Vocabulary Platform Design & Data Provenance
**状态:** 证据产出，**待外部评审**（Phase 7 = In Review；执行者**不**自批 Approved）
**归属:** 本文件拥有 Phase 7 的 **数据来源（provenance）、许可证据与导入 / 版本化设计**。
平台设计意图归 `VOCABULARY_PLATFORM_DESIGN.md`；迁移与**阶段拆分决策**归 `VOCABULARY_MIGRATION_STRATEGY.md`。

**本阶段性质:** 证据 / 研究 / 设计。本文件**不**导入任何数据集、**不**修改 schema / migration、**不**删除任何数据。

---

## 0. 阅读指南（证据纪律）

本文件的每一句"事实"都必须属于下面三类之一，并且标注类别：

| 标记 | 含义 | 例子 |
|------|------|------|
| **OBSERVED（仓库）** | 直接来自本仓库文件 / 结构 / 字节 | "`WordReview` 有 `@@unique([wordId])`" |
| **OBSERVED（外部）** | 直接来自第一方页面 / 文件（含访问日期） | "ECDICT 的 LICENSE 文件是 MIT" |
| **INFERENCE** | 基于观察的推断，**不是**事实 | "换设备会丢失自定义词包标签" |
| **UNRESOLVED** | 本次无法验证；**不得**用推测填补 | "不背单词官网无法访问" |

**两条硬规则:**

1. 本次执行中无法验证的，一律标 **UNRESOLVED**，不写"应该是"。
2. 仓库里有 MIT 许可证，**不**等于仓库内的数据全部可再分发（见 §7）。

---

## 1. 目标与范围

1. 重建当前**以 IELTS 为取向**的词汇数据管线（来源、优先级、转换、产物）。
2. 明确区分 **A. 词书成员资格 / B. 词汇内容 / C. AI 生成内容** 三类来源，并做字段级归因。
3. 对遗留 AI / DeepSeek 相关数据给出**证据支撑的分类**（preserve / migrate / replace / regenerate / discard / unresolved）。
4. 调研 CET-4 / CET-6 / IELTS / General English / Business English 的候选数据集与其**许可证据状态**。
5. 设计（**不实现**）可复现的导入与版本化路径，使其能回答："**哪个上游数据集、哪个版本、用什么转换，产生了 CET-6 词书版本 X？**"

**范围外:** 不导入数据、不改 schema、不删除数据、不修迁移、不改 UI / API。

---

## 2. 四类数据与来源审批口径（本文件的核心区分）

> **v4 修正（产品澄清，2026-09-23）。** v2/v3 把内容分成"词汇内容 / AI 生成内容"两类。
> v4 的产品口径是：**这些是我们自己的结构化数字词书**（由已批准的外部来源材料构建、存在我们自己的
> PostgreSQL 里、带可追溯 provenance），并且**允许 AI 富化学习者可见内容**。
> 因此必须把"**来源派生**"与"**AI 富化**"分开记录，并把"最终策划条目"单独作为一类。

| 类别 | 定义 | 归属（目标模型） |
|------|------|-----------------|
| **1. Book membership source（成员资格来源）** | "为什么某个词 / 条目被认为属于这本书？" | manifest（受版本控制的来源与许可证据）+ `VocabularyBook` / `VocabularyBookEntry` 的来源引用 |
| **2. Lexical source（词汇证据来源）** | 词典 / 词表证据：词形、音标、词性、释义、等级、频次 | `Word` 的**共享词汇内容**（带来源标记）+ `BookEntryMeaning` 的来源引用 |
| **3. AI enrichment（AI 富化）** | AI 生成或改写的**学习者可见**内容：简化释义、中文解释 / 翻译、例句、搭配、用法辨析、练习、记忆提示 | `BookEntryMeaning` / `BookEntryExample` 的 AI 来源字段（`sourceType` / provider / model / generatorVersion / generatedAt / validationStatus） |
| **4. Final curated BookEntry（最终策划条目）** | 我们产品**实际展示**的版本（可能同时包含来源派生内容与 AI 富化内容） | `VocabularyBookEntry` + 其 `BookEntryMeaning` / `BookEntryExample` |

**为什么必须先分清这四类（对初学者）:** 它们的**法律性质**和**可替换性**完全不同。
成员资格决定"这本书是什么"，必须来自有许可 / 可审计的来源；词汇证据可以来自开放或授权词典；
AI 富化可以保留与替换，但必须**可识别**（否则未来无法做许可审查或质量替换）；
而"最终策划条目"是把前两者组合起来的产品产物，必须能追溯到它的组成部分。

### 2.1 来源的**两个独立问题**：许可适用性 vs 项目导入批准（**v5 修正，B-08**）

> **v4 的缺陷。** v4 用一个状态（"APPROVED FOR IMPORT"）同时表达两件不同的事：
> ① "现有证据看起来允许这种使用（附带条件）"；② "本项目**已经**接受并落实了那些条件"。
> 结果是：**存在未落实的 ShareAlike / 署名义务时，来源仍被标成"已批准导入"** —— 自相矛盾。
> v5 把两者拆成两个**正交**的文档状态（**不是**新的领域实体，**不**引入法律架构）。

**问题 1 — 许可适用性（source eligibility）:** 现有第一方证据是否**看起来允许**我们设想的用途？

| 状态 | 含义 |
|------|------|
| **ELIGIBLE（证据支持，附条件）** | 第一方许可 / 条款文本可读，且**未发现**禁止我们设想的用途；条件（署名 / ShareAlike / 再分发限制）已在 manifest 中列明 |
| **CONDITIONAL / INCOMPLETE** | 方向合理，但关键细节缺失（例如 ShareAlike 的具体影响、逐词典许可、条款未读） |
| **INSUFFICIENT EVIDENCE** | 未见授权条款，或来源受第三方权利约束，或无法核实 |

**问题 2 — 项目导入批准（project import approval）:** 本**项目**是否已经理解、接受并落实了那些条件？

| 状态 | 含义 | 允许的用途 |
|------|------|-----------|
| **APPROVED FOR PRODUCTION IMPORT** | 所有**实质性义务**（署名文本、ShareAlike 影响、再分发范围、署名展示位置）**已被理解并接受**，且**已在项目内落实**（manifest 有 `attributionText`、产品能展示署名、许可策略已确认） | 可进入生产导入 |
| **PENDING PROJECT DECISION** | 许可适用性无问题，但**落实工作尚未完成**（例如署名展示位置未定、ShareAlike 对我们数据许可策略的影响未确认） | **不得**导入：属于"**not approved for production import under current evidence**" |
| **NOT APPROVED** | 许可适用性不足，或项目选择不使用 | 不得导入 |

**两条规则（硬性）:**

1. **"APPROVED FOR PRODUCTION IMPORT" 必须意味着所有实质项目义务已被理解并接受** ——
   只要 attribution / ShareAlike / 再分发处理**仍未落实**，就只能标 `PENDING PROJECT DECISION`，
   **不得**标成已批准（这正是 B-08 要求的分离）。
2. **保留已核实的许可事实**（第一方原文），**不**做无依据的法律结论；
   措辞继续使用"在现有证据下不具备项目导入资格""未找到经核实的再分发许可""需要进一步的许可证据"。

**两条正交的适配性判断（不要混为一谈）:**

1. **member-list suitability**（能否作为"哪些词属于这本书"的成员资格来源）—— 要求最严：需要明确的来源与许可证据；
2. **lexical-enrichment suitability**（能否作为释义 / 音标 / 例句等词汇证据来源）—— 要求同样需要许可证据，但**判据不同**（例如一个开放词典可能适合做释义证据，却**不适合**充当某考试词表的成员资格来源）。

此外必须区分 **English lexical evidence**（英文词汇证据）与 **Chinese learner-facing content**（面向中文学习者的内容）：
前者可由开放英文词网 / 词典提供；后者往往需要**我们自己的 AI 富化 + 校验**，或拥有中文内容的授权来源。
A 数据集在某一方面可用，**不自动**意味着另一方面也可用。

---

## 3. 当前管线重建（全部为 OBSERVED（仓库））

### 3.1 入口与优先级

`prisma/seed.ts` 是当前唯一的词汇数据入口，支持两条路径：

1. **烘焙快路径（默认）**：若 `prisma/complete_seed_data.json` 存在且未传 `--bake`，直接导入该文件
   （`prisma/seed.ts:2798`、`:2877–2879`、`seedFromBaked`）。
2. **完整构建路径**：内联词表 + ECDICT + DeepSeek + Wikipedia 图片 →（可选）写出烘焙文件。

优先级由 `mergeEntry()` 固定（`prisma/seed.ts:2689–2740`）：

```
Layer 1  builtIn（内联在 seed.ts 里的词条）      —— 权威；ECDICT 只补空缺
Layer 2  ECDICT（下载的 sqlite 词典）           —— 权威音标 + 释义；DeepSeek 补充
Layer 3  DeepSeek-only fallback                 —— 以上都没有时使用
```

补充事实：

- 内联词条约 **1,398** 条（按 `^\s*\{ word: '` 行计数，`prisma/seed.ts`）。
- 额外候选词表 `EXTRA_WORDS` 约 **6,030** 个字符串（`prisma/seed.ts:1788` 起），
  但**只有** ECDICT `tag` 含 `ielts` 的才被纳入（`:2903`）。
- 总上限 `MAX_WORDS = 2000`（`:16`、`:2911`）。

### 3.2 ECDICT 的获取方式与过滤规则

| 项 | 内容 | 证据 |
|----|------|------|
| 下载地址 | `https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip` | `prisma/seed.ts:18` |
| 本地落地 | 解压为 `prisma/ecdict/stardict.db`（本地 ≈ 851 MB），**已被 `.gitignore` 排除** | `.gitignore`（`prisma/ecdict/stardict.db`） |
| 使用字段 | `word`、`phonetic`、`definition`、`translation`、`tag` | `prisma/seed.ts`（`loadEcdictData` 的 SELECT） |
| 成员资格过滤 | `ecdict?.tag?.includes('ielts')` | `prisma/seed.ts:2903` |
| 许可（仓库层面） | **MIT License, Copyright (c) 2025 Linwei** | ECDICT 仓库 `LICENSE`（2026-09-21 访问） |
| 数据来源（上游自述） | README 说明数据由**多年多来源拼装**：早期他人提供的 `EDictAZ.txt`、四六级至 GRE 的词汇表、抓取的音标、`cdict-1.0-1.rpm` 开源字典数据、按 BNC 前 16 万词校对等 | ECDICT `README.md`（2026-09-21 访问） |

> **关键法律区分（本文件的重点结论之一）:** ECDICT 的 **MIT 许可证覆盖的是该仓库 / 软件**；
> README 自己说明词条数据由**多个第三方来源**汇集而成。因此"ECDICT 是 MIT"**不足以**证明
> 其中全部词典文本可以自由再分发。参见 §7.1。

### 3.3 DeepSeek 生成的部分（C 类）

| 生成物 | 触发方式 | 写入位置 | 证据 |
|--------|---------|---------|------|
| 搭配（`collocations`） | 种子脚本按词批调用 DeepSeek | `Word.collocations` | `prisma/seed.ts`（`generateWithDeepSeek`、`mergeEntry`） |
| 例句（`example` / `exampleZh`） | 同上；多句用 ` ||| ` 拼接 | `Word.example` / `Word.exampleZh` | `prisma/seed.ts:2651–2687`（`buildExamples`） |
| 主题词表的释义 / 搭配 / 例句 | 种子脚本按主题调用 | `Word.*`（主题词） | `prisma/seed.ts`（THEMES 循环段） |
| 主题词表本身（"哪些词属于这个主题"） | 种子脚本 / 运行时接口调用 DeepSeek | `Word.word` / `Word.theme` | `prisma/seed.ts`；`src/app/api/words/themes/generate/route.ts` |
| 主题 / 词包的 label 与 emoji | 运行时接口调用 DeepSeek（`generateThemeKey`） | **只返回给前端 → 存入 localStorage**，**不落库** | `src/app/api/words/themes/generate/route.ts`（`generateThemeKey`）；`src/app/words/themes/page.tsx:61–98` |
| 口语对练对话（`dialogue` / `aiTips`） | 用户点击时实时生成（不落库） | 无持久化 | `src/app/api/words/ai-train/route.ts` |
| 图片（`imageUrl`） | 从 **Wikipedia** 抓取（非 DeepSeek） | `Word.imageUrl` | `prisma/seed.ts:1734–1780` |

模型与调用方式（OBSERVED（仓库））：`model: 'deepseek-chat'`，`response_format: { type: 'json_object' }`，
并对返回内容做**花括号 / 方括号切片解析**（`content.slice(fb, lb + 1)`）。注意：这些调用点**没有**走
Phase 3 已批准的 `AIClientPort`（属既有技术债，记录为证据，本阶段**不**修）。

### 3.4 数据产物清单（本次执行实测）

| 产物 | 大小 | 计数 | SHA-256（前 16 位） | 是否入库 |
|------|------|------|--------------------|---------|
| `prisma/complete_seed_data.json` | 1,606,709 B | **2000** IELTS 词 + **849** 主题词（20 个主题） | `CDED270E46F7BB87` | 是（默认快路径的来源） |
| `prisma/generated_data.json` | 1,454,825 B | **2000** 条 DeepSeek 生成缓存 | `068FE4818AB305D3` | 是（缓存） |
| `prisma/generated_scene_data.json` | 376,786 B | **823** 条主题词 DeepSeek 缓存 | `4475FDB2AF5B14C3` | 是（缓存） |
| `prisma/ecdict_phonetic.json` | 6,749,747 B | **246,693** 条音标 | `A74A5120ADDB09F7` | 是（**运行时**被 Reading 使用） |
| `prisma/ecdict/stardict.db` | ≈ 851 MB | ECDICT 全量（约 76 万词条级别，未逐条统计） | 未计算（体积大且已被 `.gitignore` 排除） | 否 |

主题分布（`complete_seed_data.json`，OBSERVED）：kitchen 97、body 50、clothing 49、car 48、
mechanical-engineering 45、school 44、technology 43、computer-ai 42、foreign-trade 41、office 41、
automotive 40、shopping 37、hotel 36、restaurant 36、people 35、sports 35、transportation 34、
home 34、weather 32、entertainment 30。

### 3.5 运行时消费点（容易被忽略的耦合）

| 消费点 | 数据 | 证据 |
|--------|------|------|
| Reading 文章词汇的音标回退 | `prisma/ecdict_phonetic.json`（ECDICT 派生） | `src/app/api/reading/[id]/route.ts:6–20,57` |
| 学习队列 / 队列统计 | `Word.source='ielts' AND theme IS NULL` | `src/app/api/words/route.ts`、`src/app/api/words/queues/route.ts` |
| 主题词包列表 | `Word.theme` 分组统计 | `src/app/api/words/themes/route.ts` |
| 主题删除 | 只允许删 `source='generated'` 的词 | `src/app/api/words/themes/[theme]/route.ts`（DELETE） |

> **推论（INFERENCE）:** ECDICT 派生数据目前**同时**影响 Vocabulary 与 Reading 两个模块，
> 因此"替换词汇数据来源"的成本不止在 Vocabulary 侧。

---

## 4. 字段级来源归因（`Word`）

| 字段 | 当前可能的来源 | 类别 | 备注 |
|------|---------------|------|------|
| `word` | 内联词表 / ECDICT / DeepSeek | A/C 混合 | 词条身份；**成员资格**信息却不存在于该字段 |
| `phonetic` | 内联 / ECDICT / DeepSeek | B/C | ECDICT 音标为 ECDICT 派生；`ecdict_phonetic.json` 是它的运行时副本 |
| `partOfSpeech` | 内联 / ECDICT 正则解析 / DeepSeek | B/C | 由 `translation` 前缀正则推断（`mergeEntry` Layer 2） |
| `definition` | 内联 / ECDICT `translation` / DeepSeek | B/C | 混合中英；**逐条来源不可区分**（当前缺陷） |
| `collocations` | 内联 / DeepSeek | C | 主要是 DeepSeek 生成 |
| `example` / `exampleZh` | 内联 / DeepSeek | 3/4（AI 富化 → 最终条目） | 多句以 ` ||| ` 拼接（一个字符串承载列表语义）→ **目标模型改为 `BookEntryExample` 子关系**（v4 定锚：例句属于词书条目 / 目标义项），按条拆分，每行带 `sourceType`（`source-derived` / `curated` / `ai-assisted` / `ai-generated`）与生成元数据；见 `VOCABULARY_PLATFORM_DESIGN.md` §4.7 |
| `imageUrl` | Wikipedia 抓取 | B（第三方） | Wikimedia 内容许可与署名要求需单独核实（UNRESOLVED，见 U-6） |
| `theme` | 主题生成流程 | A/C 混合 | 同时表示"词包成员"与"是否属于雅思池"（`theme IS NULL`） |
| `difficulty` | 写入常量 `IELTS` / `THEME` / `CUSTOM` | A | 实际承载"词书 / 词包身份"，不是难度 |
| `source` | 写入常量 `built-in` / `ielts` / `theme` / `generated` | A/C 混合 | 同时承载"来源"与"产品域" |

**结论（OBSERVED + 归纳）:** 目前**没有任何字段**能回答"这条内容的来源是什么、是否由 AI 生成、属于哪个授权数据集"。
这正是本设计要求引入**逐字段来源标记 + manifest** 的原因。

### 4.1 AI 富化内容的 provenance 与校验门（**v4 新增**）

**允许 AI 做什么（产品口径）:** 因为我们构建的是**自己的**结构化数字词书，
AI **可以**富化学习者可见内容：面向学习者的释义改写 / 简化、中文解释与翻译辅助、
补充例句、搭配、用法 / 易混辨析、练习、记忆提示。

**推荐的流水线:**

```
受信 / 开放词汇证据（lexical source）
        ↓
AI 富化（简化 / 翻译 / 解释 / 举例 / 出题）        ← 使用经 AIClientPort 的调用
        ↓
校验 / 质量门（validation）
        ↓
版本化的最终 BookEntry 内容（meaning / example 行）
```

**AI 富化内容必须记录的字段（内容项级，够用即可）:**

| 字段 | 说明 |
|------|------|
| `sourceType` | 闭集：`source-derived` / `curated` / `ai-assisted` / `ai-generated` |
| `provider` / `model` | 生成方与模型（例如 `deepseek` / 具体模型名） |
| `generatorVersion` | **生成 / prompt 管线版本号**（不是 prompt 正文） |
| `generatedAt` | 生成时间 |
| `validationStatus` / `validationVersion` | 是否通过校验 / 校验规则版本 |
| `sourceManifestRef` | 若该内容基于某个已导入来源，则引用对应 manifest |
| **`attributionText?`**（v5，B-08） | 若该内容来自**要求署名**的来源（CC BY / CC BY-SA / GFDL 等），保留**履行署名义务所需的文本与来源标识**（来源名称、URL、许可名称）；这是"内容项级可追溯"的最低要求，**不**要求建立法律架构 |

**硬性禁止:**

1. **不得伪造来源归属**：AI 生成的内容**不得**被标注为来自某个官方考试 / 出版社来源；
2. **不得用 AI 作为第三方考试词表成员资格的唯一依据** —— 除非该词书**本身**就是我们自研 / 策划的集合，
   并且在产品与数据上都**如实标注**（例如"本词书由 X 团队基于 Y 来源策划 / 生成"）；
3. **不得保存 prompt 正文、用户私有数据或完整模型响应** —— provenance 的目的是"能区分、能追溯、能替换"；
4. **不得跳过校验门**：未经校验的 AI 内容不得进入最终策划条目（校验规则与版本要可追溯）。

**来源派生内容的署名保留（v5，B-08）:** 凡计划使用**需要署名**的来源（NGSL / BSL / CEFR-J / Tatoeba /
Wiktextract / OEWN 等），导入时必须把该内容的**来源记录与署名信息**写入 provenance
（`sourceName` / `sourceRef` / `licenseName` / `attributionText`），
否则产品侧**无法**履行必须的署名义务 —— 而只要这类义务**未落实**，该来源就只能是
`PENDING PROJECT DECISION`（§2.1），**不得**标成已批准导入（§6.3.1）。

**注意（避免过度设计）:** 只要**内容项级**（一条 meaning / 一条 example）能区分"来源派生"与"AI 派生"即可，
**不要求**逐字段的历史版本链（v4 明确不追求 field-level history）。

---

## 5. 遗留 AI / DeepSeek 数据分类

> 分类依据：来源可证明性（证据强度）、许可可证明性、内容可替代性、对产品行为的重要性。
> **本阶段不执行任何删除 / 迁移**；分类只是设计结论。

| # | 数据族 | 类别 | 分类 | 理由（证据） |
|---|--------|------|------|-------------|
| L-1 | **IELTS 词书成员资格**（内联 1,398 条 + ECDICT `tag` 过滤的额外词，上限 2000） | A | **unresolved pending evidence**（倾向 replace） | 成员资格的**判定规则**可见（`:2903`），但"这些词为什么是雅思词"的**上游依据**不可证明：内联词表无来源说明；ECDICT 的 tag 来自其自身多来源拼装（§3.2）。在拿到有许可的 CET/IELTS 数据集之前，无法证明其来源合法，也无法证明其内容正确 |
| L-2 | **内联词条的释义 / 例句**（1,398 条人工内联） | B | **unresolved pending evidence** | 内容写在仓库里（著作权可能属于项目作者），但**原始来源不明**（可能是人工编写，也可能是从词典整理）；无法一概而论 |
| L-3 | **ECDICT 派生内容**（音标、`translation` 作为释义） | B | **unresolved pending evidence**（倾向 migrate-with-citation 或 replace） | ECDICT 仓库为 MIT，但其 README 自述数据由多来源拼装 → 词条文本的再分发权利**未证明** |
| L-4 | **DeepSeek 生成的搭配与例句** | 3（AI 富化） | **preserve（并 migrate 到可逐条标注的表示）** | 由本项目调用生成，来源可证明（调用点可见），可随时替换 / 重新生成。**v4 修正：** 例句迁移到 **`BookEntryExample`**（属于词书条目 / 目标义项，逐条 `sourceType` + 生成元数据 + 校验状态，见 `VOCABULARY_PLATFORM_DESIGN.md` §4.7）；搭配保留为 `Word` 上的有界文本 + 字段级来源标记。**AI 富化在 v4 被明确允许**（§4.1），因此本族数据从"待定"变为"保留 + 标注 + 可替换" |
| L-5 | **深主题词表（"哪些词属于 kitchen"）** | C | **regenerate 或 migrate** | 由 DeepSeek 生成（`themes/generate` + 种子脚本）→ 属生成内容；但**它同时充当"默认词包成员资格"**，因此需要产品决策：Default Pack 是否应由人工策划而非生成 |
| L-6 | **用户自建词包（`source='generated'`）** | C | **preserve**（保持用户可见可用） | 是用户触发产生的内容；但 label / emoji 只在 localStorage（`themes/page.tsx`），**换成服务端持久化**是明确改进项 |
| L-7 | **Wikipedia 图片 URL** | B（第三方） | **unresolved pending evidence** | 图片来自 Wikipedia / Wikimedia；其许可与署名要求需逐条核实，当前只存 URL |
| L-8 | **口语对话（ai-train）** | C | **preserve**（不持久化） | 实时生成、不落库；仅需在 UI 上明确"AI 生成" |
| L-9 | **`ecdict_phonetic.json`（运行时音标表）** | B | **unresolved pending evidence**（倾向 replace 为许可明确的音标源） | 是 ECDICT 的派生副本，且被 Reading 模块运行时依赖 |

**明确的负面结论（允许且重要）:** 现有数据中，**"哪些词属于雅思"这一项无法在 Phase 7 被证明为合规**。
这不等于"必须丢弃"，而是"**在现有证据下不具备生产导入资格**"——
即：在拿到许可证据之前，它不得作为新架构的**权威成员资格来源**；
但它可以作为**legacy 版本**如实迁入并标注来源不明（见迁移策略 §5）。

---

## 6. 外部数据集候选调研

> 纪律：**候选 ≠ 批准**。每条记录给出证据强度。**"公开 GitHub 仓库"不构成许可证据。**
> 所有 URL 访问日期：**2026-09-21**。
> 证据强度分级：**E1 = 第一方许可 / 条款文件可直接读到**；**E2 = 第一方声明存在但关键细节缺失**；
> **E3 = 仅有第三方或社区转述**；**E4 = 无法验证（UNRESOLVED）**。

### 6.1 CET-4 / CET-6

| 候选 | 上游 / 发布方 | 版本 | 许可证据 | 再分发含义 | 字段 | 转换要求 | 更新策略 | 质量限制 | 重复 / 规范化 | 证据状态 |
|------|--------------|------|---------|-----------|------|---------|---------|---------|--------------|---------|
| **全国大学英语四、六级考试大纲（2016 年版）** | 全国大学英语四、六级考试委员会 / 教育部考试中心（发布方） | 2016 版 | **未见公开许可条款**；官方站点 `cet.edu.cn` 的 PDF 为考试大纲 | **UNRESOLVED**：大纲本身的再分发权利未见明确授权 | 官方大纲词汇表（英文词形） | 需人工录入 / 转换；需校对 | 大纲更新周期长（新大纲发布时才变） | PDF 文本提取误差；无音标 / 释义 | 需统一大小写、词形 | **E4 → UNRESOLVED** |
| **mahavivo/english-wordlists** | 个人仓库作者（数据来自上述大纲 PDF 等） | 不明确 | **仓库未授予任何许可**；README 详细列出**第三方 / 商业词典来源**（金山词霸、牛津高阶 8 版、COCA 等） | **未找到经核实的再分发许可** | TXT 词表 | 需重新清洗 | 无 | 来源混杂、含商业词典内容 | 需去重 | **E1（对该 README 的自述）→ 在现有证据下不具备项目导入资格**（v2 措辞修正） |
| **kajweb/dict** | 个人仓库作者 | 不明确 | README 自述 **"Crawl from 'X 道背单词(app)'"**；无许可 | **未找到经核实的再分发许可**（内容来源为商业 App） | JSON（词、音标、例句、题目、近义词） | — | 无 | 内容含商业题库与例句 | — | **E1（对该 README 的自述）→ 在现有证据下不具备项目导入资格**（v2 措辞修正） |

**结论（CET-4 / CET-6）:** 目前**没有**任何一个候选达到"可直接导入"的证据强度。
下一步应优先尝试**从官方 / 授权渠道获取书面许可或明确条款**（这是产品 / 商务动作，不是工程动作）。

### 6.2 IELTS-oriented

| 候选 | 上游 / 发布方 | 许可证据 | 证据状态 |
|------|--------------|---------|---------|
| 官方 IELTS 词汇表 | IELTS 主办方（British Council / IDP / Cambridge） | 未见公开的词汇表数据集与许可条款 | **E4 → UNRESOLVED** |
| 商业 IELTS 词表（图书 / App 内的词表） | 各出版社 / 商业产品 | 受著作权保护；需授权 | **E4 → 不可用（未授权）** |
| 学术词表（Academic Word List, AWL） | Averil Coxhead（学术出版物） | 未见公开许可；网络流传副本多为非授权转载 | **E4 → UNRESOLVED** |

**结论:** IELTS 取向的词书是**本项目当前最缺证据**的部分，也正是现状"最需要被替换"的部分。

### 6.3 General English（通用核心词表 —— 证据最强的一组）

| 候选 | 上游 / 发布方 | 许可证据（本次实读） | 再分发含义 | 字段 | 证据状态 |
|------|--------------|---------------------|-----------|------|---------|
| **NGSL 1.2（New General Service List）** | Browne, C., Culligan, B. & Phillips, J.（站点 `newgeneralservicelist.com`） | **v2 已复核（第一方页面原文）:** "New General Service List by Browne, C., Culligan, B., and Phillips, J. is licensed under a **Creative Commons Attribution-ShareAlike 4.0 International License**."（同页另声明 "Free under Creative Commons, including commercial use"） | **允许（需署名 + 相同方式共享）**：属**传染性**许可，会约束派生数据的许可选择 | 词表（按频次排序）+ 多种衍生列表 | **E1**（第一方许可文本已读到） |
| **BSL 1.2（Business Service List）** | Browne, C. & Culligan, B.（同一站点） | **v2 已复核（第一方页面原文）:** "Business Service List by Browne, C. and Culligan, B., is licensed under a **Creative Commons Attribution-ShareAlike 4.0 International License**. Permissions beyond the scope of this license may be…" | **允许（需署名 + 相同方式共享）** | 商务英语词表（按频次） | **E1**（第一方许可文本已读到） |
| **CEFR-J Wordlist** | 東京外国語大学 投野研究室（Tono Laboratory, TUFS） | **v3 已复核（第一方原文，日文）**：①「本語彙表の著作権は東京外国語大学投野研究室に帰属するが、**適切な引用を行っていただければ研究教育および商用においても無償で利用できる**」（引用格式：`『CEFR-J Wordlist Version 1.6』 東京外国語大学投野由紀夫研究室.（URL: XXX より◎年◎月ダウンロード）`）；②免責事項 4)「**本語彙表を改変して別の語彙表を作ることはかまわないが、必ず本語彙表を適切に引用しなければならない**」（允许改変，须正确引用）；③免責事項 2)「商用利用に関しては、**監修などを行う場合には別途相談の上、必要な経費を請求する**」（涉及其监修 / 编辑参与时需另行协商并可能收费）；④「項目は**同一単語の異なる品詞は別項目**になっており、**異なるCEFRレベル**を付与している」 | **允许（研究 / 教育 / 商用，需正确标注来源与引用；允许改変并须引用；涉及其监修参与时需另行协商）** | 词表（`headword` + `pos` + CEFR 等级 + 主题分类）；**同一 headword 的不同词性为不同条目、可带不同等级** ← B-02 / B-05 的直接来源 | **E1**（第一方页面明确条件，含改変条款） |
| **Oxford 3000 / 5000** | Oxford University Press | 页面可读词表内容；页面标注 OUP 版权；**本次未找到允许再分发的条款文本** | **在现有证据下不具备导入资格**（"no verified redistribution permission found"）；如需使用**需进一步取得许可证据** | 词 + CEFR 等级标签 | **E1（第一方页面，但未见授权条款）** |
| **COCA / BNC 词频表** | Mark Davies（english-corpora.org）/ BNC 版权方 | 站点提供词频表；本次未取得可引用的条款文本 | **UNRESOLVED**（需进一步取证） | 词频 | **E4** |
| **Wiktionary / Wiktextract（kaikki.org）** | Wikimedia 社区 / Tatu Ylonen（Wiktextract） | 明确："made available under the same licenses as Wiktionary - **both CC-BY-SA and GFDL**" | **允许（需署名 + 相同方式共享）**：**传染性**许可，影响派生数据的许可选择 | 释义、词性、词形变化、部分例句 | **E1** |
| **Tatoeba 句子库** | Tatoeba 社区 | 明确：句子文件 **CC BY 2.0 FR**，部分 CC0 1.0；音频许可由贡献者逐条选择 | **允许（需署名；音频需逐条看许可）** | 句子（多语言对） | **E1** |
| **WordNet** | Princeton University | 许可页本次返回 **403**（两次尝试均未取得） | **UNRESOLVED**（需进一步取证） | 英文释义、同义关系 | **E4** |

#### 6.3.1 许可适用性 vs 项目导入批准（**v5 重写，B-08**）

按 §2.1 的**两个正交问题**归类（**文档状态，不是领域实体**）：

**关键结论（先说）:** 目前**没有任何来源**达到 `APPROVED FOR PRODUCTION IMPORT` ——
所有"证据上可用"的来源都带有**尚未落实**的署名 / ShareAlike 义务（见 §10 第 9 项）。
它们的状态是 `ELIGIBLE + PENDING PROJECT DECISION`，即**在现有证据下仍不得进入生产导入**。

| 候选 | ① 许可适用性（eligibility） | ② 项目导入批准（project approval） | 未落实的义务 | 作为 **member-list** 来源？ | 作为 **lexical-enrichment** 来源？ |
|------|---------------------------|-----------------------------------|-------------|---------------------------|-----------------------------------|
| **NGSL 1.2** | **ELIGIBLE（附条件）** CC BY-SA 4.0 | **PENDING PROJECT DECISION** | 署名文本 + ShareAlike 对派生数据许可的影响 | 仅适用于"通用英语核心词表"这类**我们自研 / 策划**的词书 | ✅（词表 / 频次 / 等级顺序） |
| **BSL 1.2** | **ELIGIBLE（附条件）** CC BY-SA 4.0 | **PENDING PROJECT DECISION** | 同上 | 同上（商务英语方向） | ✅ |
| **CEFR-J Wordlist** | **ELIGIBLE（附条件）** 研究 / 教育 / 商用需正确引用；允许改変须引用 | **PENDING PROJECT DECISION** | 引用格式的展示位置 + 改変 / 监修条款的产品 / 法务判断 | ✅（来源自身把不同词性当作不同条目 —— 正是 `BookEntryMeaning` 的用例） | ✅（词 + 词性 + CEFR 等级 + 主题） |
| **Wiktionary / Wiktextract** | **ELIGIBLE（附条件）** CC BY-SA + GFDL | **PENDING PROJECT DECISION** | 署名 + ShareAlike | ⚠️ 不建议单独作为考试词表成员资格来源 | ✅（释义 / 词性 / 词形，英文为主） |
| **Tatoeba** | **ELIGIBLE（附条件）** CC BY 2.0 FR（部分 CC0） | **PENDING PROJECT DECISION** | 句子级署名信息的保留与展示 | ❌（不是词表） | ✅（例句 / 翻译句子） |
| **Open English WordNet（OEWN）** | **ELIGIBLE（附条件）** CC BY 4.0 | **PENDING PROJECT DECISION** | **双署名**（Princeton WordNet + OEWN 团队） | ❌（不是考试词表） | ✅（英文语义网络：synset / 词性 / 关系） |
| **FreeDict** | **CONDITIONAL / INCOMPLETE**（项目级 copyleft 声明可读；逐词典许可未核实） | **NOT APPROVED** | 逐词典许可、是否含英汉方向 | ❌ | ⚠️ 待核实 |
| **Princeton WordNet（原版）** | **INSUFFICIENT EVIDENCE**（许可页 403；仅有 OEWN 的间接转述） | **NOT APPROVED** | 原许可条款本身 | ❌ | ⚠️ 优先改用 OEWN |
| **Oxford 3000 / 5000** | **INSUFFICIENT EVIDENCE** | **NOT APPROVED** | 未见授权条款 | ❌ | ❌ |
| **COCA / BNC 词频表** | **CONDITIONAL / INCOMPLETE**（条款未读） | **NOT APPROVED** | 条款文本 | ❌ | ⚠️ 待取证 |
| **官方四六级大纲 / 官方 IELTS 词表 / BEC 等** | **INSUFFICIENT EVIDENCE** | **NOT APPROVED** | 许可条款（商业出版的备考书**不得**整本复制，见 §7.3 / §7.4） | ❌ | ❌ |
| **商业词典（柯林斯 / 朗文 / 牛津等）** | **INSUFFICIENT EVIDENCE**（需授权协议） | **NOT APPROVED** | 授权协议（商业产品采用**授权**模式，见 §7.3） | ❌ | ❌ |

**给实现者的三条要点:**

1. **两个问题必须分别回答**：`ELIGIBLE` 只表示"证据看起来允许（附条件）"；
   只要义务未落实，就必须是 `PENDING PROJECT DECISION`，**不得**标成已批准导入。
2. **成员资格来源与内容来源是两件事**：一本词书可以"成员资格来自 CEFR-J / NGSL 这类来源"，
   而"释义 / 中文解释由我们用 AI 富化 + 人工校验产生"（§4.1）。
3. **`PROJECT DECISION` 的解锁方式是可枚举的**：确定署名文本与展示位置、
   确认 ShareAlike 对本项目数据许可策略的影响、把 `attributionText` 写进 manifest —— 完成后即可从
   `PENDING` 转为 `APPROVED FOR PRODUCTION IMPORT`（这是**项目决策**，不需要新的法律架构）。

### 6.4 Business English

| 候选 | 上游 / 发布方 | 许可证据 | 证据状态 |
|------|--------------|---------|---------|
| BEC / 商务英语考试词表 | Cambridge / 考试机构 | 未见公开数据集与许可 | **E4 → UNRESOLVED** |
| 商业商务词表（图书 / 商业产品） | 各出版社 | 受著作权保护 | **E4 → 不可用（未授权）** |
| NGSL 的商务子表（BSL 1.2）/ 学术子表（ASL） | Browne & Culligan（同一站点） | **BSL 1.2 已确认为 CC BY-SA 4.0 International**（见 §6.3） | **E1**（BSL）；ASL 未逐一复核 → 按同源页面处理并标注 |

### 6.5 候选分层结论（**不是**导入批准）

| 层级 | 含义 | 本次调研中的例子 |
|------|------|-----------------|
| **Tier A — 许可证据可读且允许使用** | 有第一方许可 / 条款文本，可据此做合规导入设计 | **NGSL 1.2（CC BY-SA 4.0）**、**BSL 1.2（CC BY-SA 4.0）**、CEFR-J Wordlist（研究 + 商业用途，需署名与引用）、Tatoeba（CC BY 2.0 FR）、Wiktextract（CC BY-SA + GFDL） |
| **Tier B — 需要进一步取证** | 方向合理但关键细节缺失 | COCA / BNC（条款未读）、WordNet（页面 403）、同站 ASL 等未逐一复核的子表 |
| **Tier C — 在现有证据下不具备导入资格** | "not eligible for project import under current evidence" —— 未见授权条款，或来源本身受第三方权利约束 | 官方四六级大纲（未见许可条款）、Oxford 3000/5000（未见授权条款）、mahavivo 与 kajweb 仓库（自述来源为商业词典 / 爬取商业 App）、官方 IELTS 词表（未见公开授权） |

**重要提示（必须写进未来任何导入 PR）:** Tier A 的许可多为**署名 / 相同方式共享**类，
这意味着导入后的派生数据可能需要**保留署名**，甚至影响本项目自身数据的许可选择。
这是**产品与法务决策**，不是工程可以单方面拍板的（见 §9 未决）。

---

## 7. 许可与再分发风险（重点分析）

### 7.0 措辞纪律（**v2 修正**：不得把"没看到许可"写成绝对法律结论）

本文件（以及任何引用它的文档）在描述第三方数据时，**必须**使用下面这类**有边有界**的表述：

| 允许的表述 | 含义 | 禁止的表述 |
|-----------|------|-----------|
| "**not eligible for project import under current evidence**（在现有证据下不具备项目导入资格）" | 我们**没有**找到足够证据支持导入 | "legally impossible to redistribute" / "法律上禁止再分发"（除非权威条款原文明确这样写） |
| "**no verified redistribution permission found**（未找到经核实的再分发许可）" | 是关于**取证状态**的事实陈述 | "该数据违法 / 永久不可用" |
| "**requires further permission / license evidence**（需要进一步的许可证据）" | 说明下一步动作 | 把未取证写成"已确认不可用" |
| "来源**明确允许** X 用途，条件为 Y"（读到条款原文时） | 逐字引用 + 列出条件 | 把"允许"扩大到条款未写明的用途 |

**原因（给初学者）:** "我没找到许可"与"法律禁止"是两件不同的事。前者是关于**我们的取证状态**的事实；
后者是关于**法律状态**的断言，需要权威条款或法律意见支持。混为一谈会让文档在评审中失去可信度，
也可能堵死合法路径（例如直接向上游取得授权）。本文件每条外部来源都记录 URL、访问日期与**原文摘录**；
取不到的写 **UNRESOLVED**，不写结论。

### 7.1 ECDICT：仓库 MIT ≠ 数据全部可再分发

**OBSERVED:** ECDICT 仓库 `LICENSE` 为 MIT（Copyright (c) 2025 Linwei）。
**OBSERVED:** ECDICT `README.md` 自述数据来源包括：他人提供的 `EDictAZ.txt`、四六级至 GRE 的词汇表、
从各种资料抓取的音标、`cdict-1.0-1.rpm` 开源字典数据、按 BNC 前 16 万词校对补全等。

**INFERENCE:** MIT 许可证通常是**软件许可**；仓库内容中来自第三方词典 / 语料的文本，
其再分发权利取决于那些上游的许可，而 README 并未逐条给出上游许可证明。

**结论:** ECDICT 可以作为**工程来源**（本项目现在也确实在用它），但**不能**被当作"数据可自由再分发"的证明。
未来若要在仓库内分发 ECDICT 派生内容（例如把它作为词书内容提交进 Git），需要先补上游证据。

### 7.2 爬取型仓库（kajweb/dict 等）

**OBSERVED:** 该仓库 README 自述数据来自抓取某个商业背单词 App。
**结论:** 抓取商业产品内容**不产生**再分发许可；此类仓库**在现有证据下不具备项目导入资格**
（no verified redistribution permission found），**不得**仅因"公开在 GitHub 上"就导入。

### 7.3 商业词典内容（柯林斯 / 朗文 / 牛津）

**OBSERVED（外部）:** 百词斩官网自述"单词释义取自柯林斯、朗文等权威词典" —— 这是**商业授权**模式的证据。
**结论:** 商业词典释义需要**授权协议**才能使用；本项目当前**没有**此类授权，
因此**不得**把任何"看起来像词典释义"的第三方文本当作可自由使用的内容。

### 7.4 考试大纲与考试机构词表

**OBSERVED:** 2016 版四六级考试大纲为官方发布的 PDF；未见到允许再分发的公开条款。
**结论:** 使用前应取得明确许可，或改用**许可可读**的替代品（Tier A 列表）并在产品上明确标注词表来源与口径
（例如"CET-6 取向词表（基于 X 数据集 vY，按 Z 规则筛选）"而不是暗示它是官方词表）。

### 7.5 语料库（COCA / BNC）

**OBSERVED:** 相关站点提供词频表，但本次未取得可引用的条款文本。
**结论:** UNRESOLVED；不得据传闻下结论。

### 7.6 第三方图片（Wikipedia）

**OBSERVED:** 种子脚本从 Wikipedia API 抓取缩略图 URL，写入 `Word.imageUrl`。
**结论:** 图片许可与署名要求需逐条核实（UNRESOLVED）；当前实现只存 URL，未存许可元数据。

---

## 8. 导入与版本化设计（**只设计，不实现**）

### 8.1 要回答的问题

> "CET-6 词书版本 X，是用**哪个上游数据集、哪个版本**，通过**哪个 importer 版本**、**哪些转换与校验规则**产生的？"

### 8.2 职责分配（DB / 版本受控文件 / importer 元数据）

| 信息 | 放在哪里 | 为什么 |
|------|---------|-------|
| 上游身份（名称、发布方、URL） | **manifest（版本受控文件）** | 需要能被评审、能进 diff、能引用许可证据 |
| 上游版本 / release / 发布日期 | manifest | 同上 |
| 许可证据（许可名称、证据 URL、是否允许再分发、是否需署名） | manifest | 合规审查的核心；必须在仓库里可追溯 |
| 上游文件校验和（SHA-256） | manifest | 证明"导入的确实是这一份" |
| importer / 转换版本号 | manifest + 导入记录 | 规则变化要可追溯 |
| 转换与规范化规则（去重、大小写、词形、拒绝策略） | manifest（声明）+ importer 代码（实现） | 声明与实现要能对照 |
| 规范化后的**词表成员与顺序** | **仅在许可允许时**写入版本受控文件；否则只在数据库中materialize | 许可不允许再分发时，不能把词表提交进 Git |
| 词书目录（slug / 标题 / 目标 / 版本 / 状态） | 数据库（`VocabularyBook`） | 运行时查询需要 |
| 成员资格与顺序 | 数据库（**`VocabularyBookEntry`（`entryKey` 稳定身份 + `position` 仅排序）** → `wordId` → `Word`） | 运行时查询需要；`BookEntry` 是学习单位与 SRS 归属，来源条目语义保存在其**从属 `BookEntryMeaning`** 上（`sourceEntryId` / `sourcePosRaw` / `sourceCefrLevel` / …）；**v5（B-06）**：条目身份由 `entryKey` 决定，`position` 只是排序 |
| 导入运行记录（导入数、拒绝数、时间、结果） | 数据库（一条轻量记录） | 运行可审计性；**这是唯一强烈建议新建的表级概念** |
| 共享词汇内容（通用释义 / 音标 / 搭配 / 图片） | 数据库（`Word` 内容字段 + 逐项来源标记） | 体积大、且可能受许可限制不宜进 Git；与"哪本书"无关 |
| **条目内容（目标义项 + 例句）** | 数据库（`BookEntryMeaning` / `BookEntryExample` 子关系：`position` + 来源 / 生成元数据 + 校验状态） | **v4**：一个条目可以有**多个目标义项**，例句可绑定义项；两者都必须**逐条可追溯**（v1 B-03 的修正继续有效） |
| **AI 富化内容的 provenance 字段** | 数据库（随内容行存储）：`sourceType`（`source-derived` / `curated` / `ai-assisted` / `ai-generated`）、`provider`、`model`、`generatorVersion`、`generatedAt`、`validationStatus` / `validationVersion`、（来源派生另加）`sourceManifestRef` | 见 §4.1；目的 = "**能区分、能追溯、能替换**"；**不**存 prompt 正文、**不**存用户私有数据、**不**存完整模型响应 |
| **来源派生内容的署名信息**（v5，B-08） | 数据库（随内容行存储）：`sourceName` / `sourceRef` / `licenseName` / **`attributionText`** | 履行 CC BY / CC BY-SA / GFDL 等**署名义务**所需；**未落实这些义务前，来源只能是 `PENDING PROJECT DECISION`**（§2.1 / §6.3.1） |

**明确不做的（避免"概念存在就建表"）:**

- 不为"许可证据"建表（它是文档，进 manifest / 仓库）。
- 不为"上游数据集"建一张字典表（除非未来出现"同一本书多来源合并"的真实需求）。
- 不为"转换规则"建表（规则属于 importer 代码 + manifest 声明）。

#### 8.2.1 身份层、条目层与去重判定（**v3 新增 B-05 → v4 重写**）

> **为什么必须单独写清楚:** v2 的 manifest 里写着 `by-wordKey-keep-first` 与 `no-duplicate-wordKey`。
> 对**书内条目**使用这类规则会直接吞掉合法来源条目 —— 例如 CEFR-J 把
> `record(noun, B1)` 与 `record(verb, A2)` 当作**两条不同条目**（官方页原文见 §6.3）。
> **v4 再进一步**：`WordUsage` 已移除，来源条目的区分由 **`BookEntryMeaning` 的来源引用**承载，
> 并且**上游多行 → 一个策划条目**是**合法**的映射（N:1）。

| 层 | 身份键 | 去重语义 | 允许 / 禁止 |
|----|-------|---------|------------|
| **1. 词汇身份（`Word`）** | `wordKey`（小写、裁剪、空白折叠） | 同 `wordKey` 的不同来源行 → **归并为一个 `Word`**（只合并"词形身份"） | ✅ 允许按 `wordKey` keep-first（它只合并身份，不丢条目） |
| **2. 来源条目身份（来源行）** | `sourceEntryId`（来源提供时），否则 `(来源顺序 / 书内位置)` | 只有**同一来源条目被导入两次**才算重复 | ✅ 按来源条目身份去重；❌ **不得**按 `wordKey` 去重；❌ **不得**因为两条来源行的 headword 相同就丢一条 |
| **3. 策划条目（`VocabularyBookEntry`）** | **`entryKey`（稳定策划身份，书内唯一）+ `position`（仅排序）**；其内容由 1..N 条 `BookEntryMeaning` 组成 | 上游 N 条来源行**可以**映射为 1 条策划条目（**N:1 合法**），也可以映射为 N 条条目（1:1） | ✅ 两种映射都合法；**是否为每条来源行建一个学习者可见条目，是"该书策划决定"**（设计文档 §4.6.3）；**`position` 不得用作身份**（B-06） |

**判定表（给实现者的直接规则）:**

| 情形 | 判定 | 处理 |
|------|------|------|
| 两行的 `wordKey` 相同，来源词性不同（`record` n / v） | **不是重复**，是**两条来源条目** | 两条都要有位置：可映射为 2 个 `BookEntry`（各自 1 个 meaning），或 1 个 `BookEntry` + 2 个 `BookEntryMeaning`（**策划决定**） |
| 两行的 `wordKey` 相同、来源词性相同，但 `sourceEntryId` 不同 | **不是重复**（来源视为两条：义项 / 考试要求不同） | 两条都保留（可作为同一策划条目下的两个 meaning，或两条条目） |
| 两行的来源身份完全相同（同一 `sourceEntryId`，或来源无 id 且书内位置相同） | **是真正的重复导入** | 保留一条，另一条记入 rejected 并说明原因 |
| 来源写成 `"n./v."`（未区分词性） | 来源**没有**区分 | 原样保留 `sourcePosRaw = "n./v."`；**不得**自行拆成两条 |
| 两行拼写形态不同但 `wordKey` 相同（大小写 / 空白差异） | **同一个词形身份** | 归并为 1 个 `Word`（保留展示形态差异作为备注） |
| 重新导入同一本书（新版本） | **按 `entryKey` 协调**，不是"整体替换" | 已存在的 `entryKey` → **原地更新**（不删除重建）；新 `entryKey` → 新增；本次缺失的旧 `entryKey` → `inactive` / `superseded`（**不物理删除**，学习状态不被孤立）；**只有策划上真的换了学习单位才分配新 `entryKey`**（设计文档 §4.6.6） |

**唯一性约束（与设计文档 §4.6.6 一致）:**

```
UNIQUE(bookId, entryKey)         -- **稳定策划身份（B-06 的目标不变式）**
（position 仅排序，不承担身份；书内顺序的完整性由导入器 + 校验保证，
  或按需加非唯一索引 / 应用层约束）
UNIQUE(bookEntryId, position)    -- 条目内目标义项顺序（BookEntryMeaning）
❌ 不得使用 UNIQUE(bookId, wordId) / UNIQUE(bookId, wordKey)
   —— 同一本书可以合法地多次涉及同一个词（不同词性 / 不同义项 / 不同考试要求）
✅ 来源条目不得重复导入：导入器按 (book, sourceEntryId) 校验；
   若需要数据库级强制，可在 BookEntryMeaning 上冗余 bookId 并建
   部分唯一索引 UNIQUE(bookId, sourceEntryId) WHERE sourceEntryId IS NOT NULL（由 Phase 9 决定）
```

### 8.3 manifest 草案（YAML，示例 —— 说明字段用途，不是最终格式）

```yaml
book:
  slug: cet6
  title: "CET-6 取向核心词表"
  target: cet6            # cet4 | cet6 | ielts | general | business
  version: "2026.1"       # 词书版本（可回答"版本 X"）
  status: active

upstream:
  name: "<数据集名称>"
  publisher: "<发布方 / 作者>"
  source_url: "<上游 URL>"
  release: "<版本号或发布日期>"
  retrieved_at: "2026-09-21"
  sha256: "<上游文件的 SHA-256>"

license:
  name: "<许可名称，例如 CC BY 4.0>"
  evidence_url: "<许可 / 条款证据的 URL>"
  redistribution: unclear        # allowed | unclear | not-allowed
  vendor_wordlist_in_repo: false # 仅当 redistribution=allowed 才可置 true
  # ↓ v5（B-08）：把"许可适用性"与"项目已批准导入"拆成两个字段
  eligibility: conditional       # eligible | conditional | insufficient-evidence
  project_approval: pending      # approved-for-production-import | pending-project-decision | not-approved
  obligations:
    attribution_required: true
    attribution_text: "<需要展示的署名文本>"     # 项目一旦批准导入，必须可被产品展示
    attribution_url: "<署名指向的 URL>"
    share_alike: true            # 是否属于 ShareAlike（影响派生数据的许可选择）
    share_alike_decision: pending # accepted | pending | n/a —— 未解决则 project_approval 不得为 approved
  notes: "<人工说明：证据强度、待确认项>"

identity:                      # ← v5：词形身份 + 来源条目身份 + **稳定策划身份（entryKey）**
  lexical: ["lowercase", "trim", "collapse-whitespace"]    # -> wordKey（Word 词形身份）
  source_entry: ["sourceEntryId-when-present", "else-source-order"]   # 上游来源条目
  curation_entry: "entryKey"                                # **稳定策划身份**：UNIQUE(bookId, entryKey)
  entry_key_scheme: "src:<sourceId>:<sourceEntryId> | curated:<bookSlug>:<wordKey>[:<discriminator>]"
  position_is_identity: false                               # position 仅排序（B-06）

transform:
  importer_version: "vocab-import/0.4.0"
  reconcile: "by-entryKey"        # 已存在 → 原地更新；新增 → 建；缺失 → inactive/superseded（不物理删除）
  dedupe:
    lexical: "by-wordKey-keep-first"           # 只作用于 Word 词形身份层
    source_entry: "by-sourceEntryId"           # 只作用于来源条目层（真正的重复导入）
    forbidden:
      - "by-wordKey-keep-first on source entries"        # ❌ 会吞掉 record(n)/record(v)
      - "no-duplicate-wordKey within a book"             # ❌ 同上
      - "dropping source entries because they collapse to one BookEntry"  # ❌ 必须先记为 meaning 的来源
      - "delete-and-recreate BookEntry rows on re-import" # ❌ 会破坏 (userId, bookEntryId) 的学习状态连续性
  allow:
    - "multiple source entries sharing the same wordKey"        # 合法：不同 POS / 不同义项
    - "multiple BookEntryMeaning rows under one BookEntry"      # 合法：条目可以教多个目标义项
    - "upstream N rows mapped to 1 curated BookEntry (N:1)"     # 合法，但必须保留每条来源的引用
    - "re-import mutating meanings/examples of an existing entryKey"   # 合法：内容修订不换键
  validation:
    - "headword-non-empty"
    - "ascii-letters-hyphen-apostrophe-and-space"
    - "every-source-entry-has-a-home"          # 每条合法来源行都必须在某个 meaning 上有引用
    - "no-duplicate-(book,sourceEntryId)"
    - "no-duplicate-(bookId,entryKey)"         # **稳定身份唯一**
    - "entry-key-stable-across-content-revisions"   # 内容修订不得改键
    - "formal-book-meaning-content-present"    # 正式词书：meaning.text / 目标词性必须显式存在（B-07）
    - "no-implicit-generic-fallback"           # 不得静默用 Word.definition / Word.phonetic / Word.collocations 顶替（B-07）
  rejected_policy: "record-and-continue"

content_contract:              # ← v5（B-07）：正式词书卡片的规范内容契约
  canonical_meaning_source: "BookEntryMeaning"
  canonical_phonetic_source: "BookEntryMeaning.phonetic"
  canonical_collocations_source: "BookEntryMeaning.collocations"
  examples_source: "BookEntryExample"
  fallback_policy:
    mode: none                   # none | explicit（默认 none）
    allowed_fields: []           # explicit 模式下才可列出；**definition / collocations 不得列入**

enrichment:                    # ← v4 新增：AI 富化的允许范围与义务
  allowed:
    - "learner-friendly definition rewrite / simplification"
    - "Chinese explanation / translation assistance"
    - "additional examples / collocations / usage notes"
    - "exercises / memory aids"
  required_provenance: ["sourceType", "provider", "model", "generatorVersion", "generatedAt", "validationStatus"]
  validation_gate: "required-before-publish"   # 未通过校验的 AI 内容不得进入最终条目
  must_not:
    - "claim official exam/publisher origin for generated content"
    - "use AI as the sole basis for third-party exam-list membership"
    - "store prompt text / private user data / full model payloads"

expected:
  entries: 2000          # 期望的**策划条目**数量（不是去重后的词数）
  distinct_wordkeys: "<期望的不同词形数量>"     # 与 entries 分开统计
  source_entries: "<期望的来源条目数量>"        # 上游行数（应等于 meanings 的来源引用总数）
  meanings: "<期望的目标义项总数>"
  wordlist_sha256: "<规范化后条目清单的 SHA-256（用于证明成员未漂移）>"
  entry_keys_sha256: "<entryKey 集合的 SHA-256（用于证明稳定身份未漂移）>"   # v5（B-06）
```

### 8.4 导入流程（设计）

```
1. 读取 manifest
2. 校验许可字段完整（name / evidence_url / redistribution / attribution）—— 缺失则**拒绝导入**
3. 获取上游数据（仓库内文件，或按 source_url 下载）
4. 校验 sha256 与 manifest 一致 —— 不一致则**拒绝**
5. **身份解析（v4：词形身份 + 来源条目身份 + 策划映射）:**
   a. `Word` 层：按 `wordKey` 归并**词形身份**（同词的多行来源 → 一个 `Word`）；
   b. **来源条目层**：为每一条上游来源行建立身份（`sourceEntryId`，缺失时用来源顺序），
      **逐条登记，不得因为 headword 相同而丢行**；
   c. **策划映射**：按该书的 curation 规则把来源行映射为 1..N 条 `BookEntry`，
      并为每条来源行在对应 `BookEntryMeaning` 上写入来源引用（`sourceEntryId` / `sourcePosRaw` /
      `sourceCefrLevel` / `sourceCategory` / `sourceRank`）。
6. **去重（只在该去重时才去重）:**
   - 真正的重复 = 同一 `(book, sourceEntryId)`（来源无 id 时用同一来源顺序）→ 丢弃后者并记录；
   - **不是重复** = 同一 `wordKey` 但词性 / 义项 / 等级 / 分类不同 → **必须都保留**；
   - ❌ **禁止** "by-wordKey-keep-first" / "no-duplicate-wordKey" 作用于**来源条目或书内条目**。
7. **内容生成 / 富化（若该 manifest 声明 AI 富化）:** 受信 / 开放词汇证据 → AI 富化 → **校验门** →
   写入 `BookEntryMeaning` / `BookEntryExample`，并逐条记录 `sourceType` 与生成 / 校验元数据（§4.1）。
8. 校验（非空、字符集、每条来源行都有归属、`(book, sourceEntryId)` 与 **`(bookId, entryKey)`** 无重复、
   正式词书的 `BookEntryMeaning.text` / 目标词性**显式存在**、无隐式通用回退、
   数量与 `expected.entries` / `expected.distinct_wordkeys` / `expected.source_entries` / `expected.meanings`
   对账）→ 记录 rejected
9. 写入数据库（**按 `entryKey` 协调，而不是整体替换**）：
   a. 已存在的 `entryKey` → **原地更新**其内容字段（`position` / `targetPosScope` / `level` /
      `status` / meanings / examples），**不**删除重建（保证 `(userId, bookEntryId)` 学习状态连续）；
   b. 新的 `entryKey` → 新增条目；
   c. 本次未出现的旧 `entryKey` → 置为 `inactive` / `superseded`（**不物理删除**，
      既有 `LearnerEntryReview` 行不被孤立）；
   d. 只有**策划上确实换了学习单位**时才分配新的 `entryKey`。
   e. **幂等性**：同一 manifest 再导入一次 → 全部命中"原地更新"路径，`entryKey` 集合与内容完全一致。
10. 写入一条导入运行记录（版本、checksum、importer 版本、导入条目数、**保留的不同词形数**、
    **保留的来源条目数 / 义项数**、**新增 / 更新 / 置为 inactive 的 entryKey 数量**、拒绝数、时间、结果）
11. 输出报告（供评审与回归对比；**必须**列出"同一 headword 的多条来源行被保留（合并为一条条目或拆成多条）"
    的样例，以及"本次被置为 inactive 的 entryKey"清单，便于人工核对）
```

**幂等性要求:** 同一个 manifest 重复导入必须得到**同一结果**（成员集合与顺序一致），
且不产生重复条目。这要求以"书 + 版本"为粒度整体替换，而不是增量追加。

### 8.5 与 ADR-016 的关系

任何 Vocabulary 数据导入 PR 必须引用 ADR-016 第 4 条并附来源 / 许可记录，否则视为超出范围。
本文件的 §6 候选表与 §8 manifest 结构就是为满足该要求而设计的载体。

---

## 9. 证据方法与本环境的限制

**已实际执行的取证方式:**

- 仓库证据：直接读取文件、按行定位、按字节检查（例如 baseline 迁移的 `FF FE` BOM）、统计 JSON 产物计数与 SHA-256。
- 外部证据：使用 `curl` 抓取第一方页面 / 文件（Anki 手册与仓库文档、ECDICT 仓库文件、产品官网、
  数据集页面），保存到**仓库之外的临时目录**（`tmp/phase-7-research/`，不进入仓库、不进入审核包）。
- 抓取到的页面只用于**读取与引用**；未使用浏览器渲染，因此**前端渲染型页面内容为空视为未取到**（见 U-5）。

**本次无法完成 / 未验证的事项:**

| # | 未验证项 | 原因 |
|---|---------|------|
| U-1 | 不背单词（Bubei）的第一方产品信息 | TLS 握手失败（`SEC_E_ILLEGAL_MESSAGE`），多种参数重试均失败 |
| U-2 | WordNet 许可原文 | 许可页两次返回 403 |
| U-3 | 墨墨论文页（`maimemo.com/paper/`）内容 | 返回 200 但内容为空（前端渲染） |
| U-4 | ~~NGSL 的具体 CC 变体~~ → **v2 已复核解决**：NGSL 1.2 与 BSL 1.2 均为 **CC BY-SA 4.0 International**（第一方许可文本已读到） | 剩余未决：**ASL 等同站其它子表**尚未逐一复核 |
| U-5 | COCA / BNC 条款原文 | 未取得可引用条款文本 |
| U-6 | Wikipedia 图片的逐条许可与署名要求 | 未逐条核实 |
| U-7 | 当前生产数据库中的真实数据分布 | 本阶段**不**连接生产库、不执行查询（遵守禁止事项） |

---

## 10. 未决证据清单（供 **Phase 8 / 9** 与外部评审接手）

1. **CET-4 / CET-6 与 IELTS 是否有可授权的官方口径** —— 需要产品 / 商务决策，不是工程能定的。
2. **CC BY-SA 的"相同方式共享"对本项目意味着什么**（v2 更新）：NGSL 1.2 / BSL 1.2 / Wiktextract 都是
   **ShareAlike** 类许可，会约束**派生数据**的许可选择 —— 需要产品 / 法务判断，不是工程能单方面决定。
3. **ECDICT 上游各来源的许可证据**是否可补（决定 L-3 / L-9 是 preserve 还是 replace）。
4. **Wikipedia 图片策略**：保留 URL、改为本地缓存并带署名，或改用许可更清晰的替代方案。
5. **Tier A 数据的署名要求如何进入产品界面**（许可合规往往要求在 UI 展示署名与引用）。
6. ~~CEFR-J 的"修改后的词表"条款~~ → **v3 已取证解决**：官方页免責事項 4) 原文
   「本語彙表を改変して別の語彙表を作ることはかまわないが、必ず本語彙表を適切に引用しなければならない」
   （允许改変，须正确引用）；同时 ① 明确研究 / 教育 / 商用可免费使用（须正确引用），
   ③ 说明"涉及监修等商业参与需另行协商并可收费"。**仍属未决（产品 / 法务）的独立问题**：
   改変后的派生词表如何标注来源与许可、以及"监修参与"是否适用于本项目 —— 这两点不是工程可以单方面决定的。
7. **同站其它子表（如 ASL）**的许可文本未逐一复核（BSL / NGSL 已确认）。
8. **FreeDict 的逐词典许可**（v4 新增）：项目级"truly free（copyleft 风格）"声明可读，
   但**每本词典的具体许可条款、以及是否包含英汉方向，需要逐条核实**；核实前不得导入（§6.3.1）。
9. **ShareAlike 义务对本项目自身数据许可策略的影响**（v4 强化 → **v5 定位为"阻断项目导入批准"的事项**）：
   NGSL / BSL（CC BY-SA 4.0）与 Wiktextract（CC BY-SA + GFDL）会约束**派生数据**的许可选择；
   在项目明确接受之前，这些来源只能停留在 `ELIGIBLE + PENDING PROJECT DECISION`（§2.1）。
10. **署名信息的展示位置**（v4 新增 → v5 扩展）：OEWN 要求**同时署名** Princeton WordNet 与 OEWN 团队；
    Tatoeba（CC BY 2.0 FR）与 CEFR-J（引用格式）也要求可展示的署名 / 引用文本。
    "署名文本在哪展示、由谁维护"必须先确定，来源才能从 `PENDING` 转为 `APPROVED FOR PRODUCTION IMPORT`。
11. **AI 富化内容的校验门规则由谁定义、如何版本化**（v4 新增）：本设计只规定"必须有校验门
    与 `validationStatus` / `validationVersion`"，具体规则集属后续阶段的产品 / 工程决策。
12. **来源派生内容的署名保留是否覆盖全部字段级引用**（v5）：本设计要求内容项级保留
    `attributionText`；但"同一来源的署名是按内容项逐条保留，还是按 manifest 统一保留"仍需在导入实现前确定。

---

## 11. 来源表（本次实际访问，访问日期 2026-09-21）

| # | 来源 | URL | 观察到什么 |
|---|------|-----|-----------|
| P-1 | ECDICT LICENSE | `https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE` | MIT License, Copyright (c) 2025 Linwei |
| P-2 | ECDICT README | `https://raw.githubusercontent.com/skywind3000/ECDICT/master/README.md` | 数据由多来源多年拼装；tag 字段含 `zk/gk/cet4/...`；支持 CSV / SQLite / MySQL |
| P-3 | mahavivo/english-wordlists README | `https://raw.githubusercontent.com/mahavivo/english-wordlists/master/README.md` | 逐条列出词表来源（高校 PDF、2016 版考试大纲、金山词霸 2003、牛津高阶 8、COCA）；**无许可授予** |
| P-4 | kajweb/dict README | `https://raw.githubusercontent.com/kajweb/dict/master/README.md` | "Crawl from 'X 道背单词(app)'"；JSON 结构含题目 / 例句 / 近义词 |
| P-5 | NGSL 官网首页 | `https://www.newgeneralservicelist.com/` | "Free under Creative Commons, including commercial use"（首页未写具体变体） |
| P-5b | **NGSL 1.2 官方页（v2 新增）** | `https://www.newgeneralservicelist.com/new-general-service-list` | "New General Service List by Browne, C., Culligan, B., and Phillips, J. is licensed under a **Creative Commons Attribution-ShareAlike 4.0 International License**." + 建议引用格式 |
| P-5c | **BSL 1.2 官方页（v2 新增）** | `https://www.newgeneralservicelist.com/business-service-list` | "Business Service List by Browne, C. and Culligan, B., is licensed under a **Creative Commons Attribution-ShareAlike 4.0 International License**. Permissions beyond the scope of this license may be…" |
| P-6 | CEFR-J Wordlist 下载页（v3 重新取证） | `https://www.cefr-j.org/download.html` | 第一方日文原文：①版权归东京外国语大学投野研究室，**正确引用即可免费用于研究教育及商用**（含引用格式，Version 1.6）；②免責事項 4)：**允许改変为另一份词表，但必须正确引用本源**；③免責事項 2)：涉及**监修等商业参与需另行协商并可能收费**；④「**同一単語の異なる品詞は別項目**」并赋予**不同 CEFR 等级**（B-02 / B-05 的依据） |
| P-7 | kaikki.org（Wiktextract） | `https://kaikki.org/dictionary/` | 抽取自 Wiktionary；"both CC-BY-SA and GFDL" |
| P-8 | Tatoeba downloads | `https://tatoeba.org/en/downloads` | 句子 CC BY 2.0 FR；部分 CC0 1.0；音频许可逐条 |
| P-9 | Oxford 3000/5000 词表页 | `https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000` | 词表内容 + OUP 版权；未见再分发许可 |
| P-10 | WordNet 许可页 | `https://wordnet.princeton.edu/license-and-commercial-use` | **403（两次）→ UNRESOLVED** |
| P-11 | 百词斩官网 | `https://www.baicizhan.com/` | "单词释义取自柯林斯、朗文等权威词典"；海量词表 / 自定义词数；场景化例句；单词TV |
| P-12 | 墨墨背单词官网 | `https://www.maimemo.com/` | 基于 BMMS 记忆行为数据；"单词上限"为付费产品 |
| P-13 | 墨墨百科（墨墨记忆卡文档） | `https://memodocs.maimemo.com/` | 目录含"如何更换单词书进行学习""云词本""牌组""Anki 导入""开放 API"等 |
| P-14 | FSRS README | `https://raw.githubusercontent.com/open-spaced-repetition/free-spaced-repetition-scheduler/main/README.md` | 源自 Maimemo DHP 模型 + DSR；本地运行 |
| P-15 | Anki 手册 | `https://docs.ankiweb.net/getting-started.html` 等 | Notes / Cards / Decks 概念；card 状态 New / Learning / Review / Relearn；deck options 与 presets |
| P-16（v4） | **Open English WordNet（OEWN）** README / LICENSE.md | `https://raw.githubusercontent.com/globalwordnet/english-wordnet/main/README.md`、`.../LICENSE.md` | README："Open English Wordnet is released under **CC-BY 4.0**"；LICENSE.md："derived from Princeton WordNet under the WordNet License and further developed under the **Creative Commons Attribution 4.0 International License**… attribution is given to **both Princeton WordNet and the Open English Wordnet team**"；2025 Edition（2025-12-31 发布）提供 LMF / JSON / RDF / WNDB |
| P-17（v4） | **FreeDict 官网 / 关于页** | `https://freedict.org/`、`https://freedict.org/about/` | "truly free bilingual dictionaries… right to study, change and modify them, **as long as you guarantee others these freedoms, too**"（项目级 copyleft 风格）；140+ 词典 / 45 语言；**逐词典许可未在本次取证中核实** |

---

## 12. 相关文档

- `docs/refactor/tasks/phase-7-task.md` —— 本阶段范围权威
- `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md` —— 领域模型、重叠词语义、技术决策研究
- `docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md` —— 迁移映射与阶段拆分决策
- `docs/refactor/DECISIONS.md` —— ADR-016（数据来源 / 许可前置审查）、ADR-021（本阶段的 Proposed 数据来源决策）
- `docs/refactor/EVALUATION_BASELINE.md` —— 迁移验证门（真实数据库验收要求）
