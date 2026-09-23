# Phase 7 交接文档 — Vocabulary Platform Design & Data Provenance

**日期:** 2026-09-21（v1–v3）；**2026-09-23 修订（v4 产品澄清；v5 修正 B-06…B-10）；2026-09-23 行政收尾（Approved）**
**Phase 状态:** ✅ **Completed / Approved**（**2026-09-23 外部评审 v5 Approved，Blocking Issues: None**）
**任务定义:** `docs/refactor/tasks/phase-7-task.md`（任务基线提交 `8279dff`）
**设计 / 证据文档:** `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md`、
`docs/refactor/VOCABULARY_DATA_PROVENANCE.md`、`docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md`
**决策记录:** `DECISIONS.md` ADR-019 / ADR-020 / ADR-021 / ADR-022（全部 **Proposed — Pending External Review**）
**Git 基线:** 分支 `refactor/portfolio-engineering-roadmap`，Phase 7 开始前 HEAD = `8279dff`
（父提交 `fa1f3e6` = 已批准路线图基线）。**本阶段未提交、未推送。**
> **收尾更新（2026-09-23）:** ADR-019…ADR-022 已由行政收尾命令从 `Proposed` 转为 **`Accepted`**；
> 阶段拆分已激活（Phase 8 = 迁移链修复 / Phase 9 = Books / Phase 10 = Packs，
> 原 Phase 10–15 顺延为 Phase 11–16）。详见 §12 与 `DECISIONS.md` 的收尾记录。

**外部审核记录:** `docs/refactor/reviews/phase-7-review.md`
—— **v1 = Changes Requested**、**v2 = Changes Requested**（B-01…B-04 接受为 resolved；B-05 为新增阻断项）、
**v3 = 当时阻断项（B-05）已解决（按评审渠道记录；本地无独立 v3 verdict 文件，差异已在评审记录中标明）**；
随后**产品澄清在收尾前改变了核心设计前提**，Phase 7 被**有意重新打开**并完成 **v4 修正**；
**v4 复审 = Changes Requested（2026-09-23）**，其中 v4 的架构决定被**接受且不得重新打开**，
新增阻断项 **B-06…B-10** 已在 **v5** 修正；**v5 复审 = ✅ Approved（Blocking Issues: None）**。
**历史记录完整保留，未改写任何更早的结论。**

---

## 1. 一句话总结

在**不碰生产代码 / schema / migration / 数据**的前提下，产出了 Vocabulary 平台的
**证据支撑设计**：把"词条身份 / 内容 / 词书成员资格 / 词包成员资格 / 学习者状态 / 来源追溯"分区，
用**一个词条 + 全局掌握度**解决跨词书重叠词问题，把遗留数据的来源问题诚实标为
**unresolved pending evidence**（不猜、不删），并给出**建议拆分 Phase 8**的显式决策。

**不是**实现阶段：没有新表、没有 migration、没有导入、没有 UI / API / SRS 行为变更。

---

## 2. 本阶段性质与边界

| 项 | 内容 |
|----|------|
| 阶段类型 | 证据（evidence）+ 研究（research）+ 架构设计（architecture design） |
| 是否实现 | **否**（本阶段不产出任何生产代码 / schema / migration / 数据变更） |
| 是否删除数据 | **否**（遗留数据只做分类，不执行任何删除 / 迁移） |
| 是否导入数据集 | **否**（只做候选调研与许可证据评估） |
| 是否自批 | **否**（Phase 7 = In Review；外部评审 + 用户批准是唯一闸门。v1 外部审核 = **Changes Requested**） |
| 是否提交 / 推送 | **否**（按执行命令要求；等待后续明确收尾命令） |

**v1 → v2 修正（2026-09-21，全部为文档修正）:** B-01 迁移 squash 策略（新增 Prisma v7 baselining / squashing
两条路线 + 归档 / 对齐 / 验收要求）；B-02 目标模型保留来源条目语义（`VocabularyBookEntry` 承载 `sourcePos` /
`sourceCefrLevel` / `sourceEntryId` / `sourceCategory` / `sourceRank`）；B-03 例句改为 `WordExample` 子关系 +
逐条 provenance；B-04 复习状态合并禁止拼接（C-0 / C-1 / C-2 三情形）；来源与措辞修正
（NGSL 1.2 与 BSL 1.2 = CC BY-SA 4.0；新增措辞纪律）；书内进度版本安全要求；v2 审核包 manifest 去控制字符。
未改动任何生产代码 / schema / migration / API / UI / SRS / 依赖 / 数据；未提交、未推送。

**v2 → v3 修正（2026-09-21，B-05，全部为文档修正）:** 引入轻量 `WordUsage` 并选定模型 C；
三层身份与去重判定写入设计与来源文档，导入规则**移除** `by-wordKey-keep-first` / `no-duplicate-wordKey`
对书内条目的适用；新增内容解析规则（entry → usage → word）；`WordExample` 增加可空 `wordUsageId`（例句作用域）；
学习者状态后果（词级掌握度 + 用法级状态触发条件）显式化；CEFR-J 条款逐字取证并清理过时表述。

**v3 → v4 修正（2026-09-23，产品澄清，全部为文档修正）:** 见 §10 的 "v3 → v4 product clarification" 摘要。
要点：SRS 归属改为 **`(userId, bookEntryId)`**；**`WordUsage` 移除**；`BookEntry` 承载策划学习目标
（含从属 `BookEntryMeaning` / `BookEntryExample`）；**明确拒绝**跨书同步 / 传播 / 合并 / 迁移评分；
数据来源改按**四类**分离并引入**审批三态**；**允许带 provenance 与校验门的 AI 富化**。

**v4 → v5 修正（2026-09-23，外部复核 v4 的 B-06…B-10，全部为文档修正）:**

- **B-06：稳定条目身份** —— 引入 **`entryKey`**（`UNIQUE(bookId, entryKey)`）；`position` **仅排序**；
  导入**按 `entryKey` 协调**（原地更新 / 新增 / 缺失转 `inactive` / `superseded`，**不物理删除**），
  从而保证 `(userId, bookEntryId)` 的学习状态**连续性**；只有策划上确实是另一个学习单位才换键。
- **B-07：规范内容归属** —— 正式词书卡片以 **`BookEntryMeaning` 为规范内容**
  （目标释义 / 目标词性 / **义项级音标** / **书内搭配** / 翻译），`BookEntryExample` 承载例句；
  **禁止隐式回退**到 `Word.definition` / `Word.phonetic` / `Word.collocations`；
  新增显式 `fallbackPolicy`（默认 `none`）；`record` 名词 `/ˈrekɔːd/` 与动词 `/rɪˈkɔːd/` 可分别表示。
- **B-08：两个独立问题** —— 把**许可适用性**与**项目导入批准**拆开；当前**没有任何来源**达到
  `APPROVED FOR PRODUCTION IMPORT`（全部为 `ELIGIBLE + PENDING PROJECT DECISION`）；
  要求来源派生内容保留 `attributionText` 等署名信息。
- **B-09：ADR-020** —— 重构为**一个现行决定 + 现行理由**，历史 v1–v3 理由明确标注为 superseded
  （其中与 v4 相反的论断不得再被引用）。
- **B-10：阶段边界** —— Books 阶段**只迁正式词书侧**，**保留**词包依赖的 `theme` / `source` / `difficulty`
  与遗留 review 路径（标注 transitional / deprecated）；词包收敛与跨域 `Word` 合并留到 Phase 10；
  **V-15 修正**（不得在 Books 阶段要求全局去重），新增 V-25…V-31 与 R-16…R-19。

---

## 3. 变更清单（全部为文档）

| 文件 | 类型 | 内容 |
|------|------|------|
| `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md` | 新增 | 名词速查（初学者）；领域分区模型（含目标模型草案表与"不引入什么 + 触发条件"）；重叠词语义的备选 / trade-off / 推荐 / 被拒方案；归属与所有权定义；分层归属图；**14 项技术决策研究**（SQL / PostgreSQL / Neon / Prisma / 多对多 / 迁移 / 确定性 SRS / PG 文本检索 / embeddings / pgvector / RAG / Redis / 队列 / DeepSeek，统一 12 字段格式）；技术选择原则；产品与开源参考研究（OBSERVED vs INFERENCE）；Phase 8 / 9 边界；未决问题；来源表 |
| `docs/refactor/VOCABULARY_DATA_PROVENANCE.md` | 新增 | 三类数据（A 成员资格 / B 内容 / C AI 生成）；当前管线逐段重建（含行号证据、产物计数与 SHA-256）；`Word` **字段级来源归因表**；遗留 AI / ECDICT 数据的 preserve / migrate / replace / regenerate / discard / unresolved 分类；**外部数据集候选表**（含证据分级 E1–E4）；许可与再分发风险分析；导入与版本化设计（manifest 草案 + 流程 + 幂等要求）；本环境限制与未决证据 |
| `docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md` | 新增 | 当前 → 目标映射（M-1…M-13）；**三层身份与去重判定**（v3：`Word` / `WordUsage` / `BookEntry`）；**重复词条与状态归并规则**（含 `wordKey` 归一化决定）；`WordReview` → `LearnerWordReview` 回填与约束重建；内容 / 成员资格迁移分类；**迁移链损坏处置方向（路线 A / 路线 B，推荐 B）**；**Phase 8 拆分决策**；19 项验证策略；11 项风险登记；未决问题 |
| `docs/refactor/DECISIONS.md` | 修改 | 追加 ADR-019（领域模型分离）、ADR-020（学习者状态归属与重叠词）、ADR-021（数据来源 / 许可证据 / 可复现导入）、ADR-022（Phase 8 拆分建议）；全部标为 **Proposed — Pending External Review**，未修改任何既有 ADR 的状态 |
| `docs/refactor/PHASE_STATUS.md` | 修改 | Phase 7：`Ready / Not Started` → 🔄 **In Review**，新增「执行记录（2026-09-21）」；Phase 8 保持 **Not Started**；历史记录不改写 |
| `docs/refactor/handoffs/phase-7-handoff.md` | 新增 | 本文件 |

**未变更（硬性确认）:** `prisma/schema.prisma`、`prisma/migrations/**`、`src/app/words/**`、
`src/app/api/words/**`、`src/lib/sm2.ts`、`package.json`、lockfile、任何生产源码、任何数据集转储或二进制资产。

---

## 4. 关键结论（评审重点）

### 4.1 目标领域模型（ADR-019 提案；**v4**）

```
A 词汇底座      Word（词形身份：wordKey + headword）+ 共享词汇内容（音标 / 通用释义 / 搭配 / 图片，带来源）
                ※ Word **不是** SRS 归属单位；其内容**不是**正式词书卡片的规范内容（B-07）
B 词书域        VocabularyBook + VocabularyBookEntry（**学习单位 + SRS 归属**：
                **entryKey（稳定身份）+ position（仅排序）**、目标词性 / 用法、层级、书目元数据、来源、状态）
                ├─ BookEntryMeaning（从属，1..N：**规范的目标释义 / 目标词性 / 义项级音标 /
                │   书内搭配 / 翻译** + 来源 / 生成元数据 / 校验状态）※ 不是 SRS 归属
                └─ BookEntryExample（从属，0..N：例句，逐条来源，可绑定义项）※ 不是 SRS 归属
C 词包域        VocabularyPack(kind=default|user) + VocabularyPackEntry（状态语义由 Phase 10 定义）
D 学习者状态    LearnerEntryReview(userId, bookEntryId)（+ 可选、版本安全的 LearnerBookProgress）
E 来源追溯      manifest（版本受控）+ 导入记录 + 内容项级来源 / 生成元数据
```

**v4 关键变化（取代 v3）:** **`WordUsage` 移除**（其唯一剩余价值是跨书共享，而 v4 明确不要求跨书共享）；
来源条目区分改由 `BookEntryMeaning` 的**来源引用**承载；上游 N 条来源行可映射为 **1 条**策划条目（N:1 合法），
但**每条来源行都必须有归属**。是否把上游的多条 POS / 义项拆成学习者可见卡片，是**该书策划决定**。

**不引入**（附触发条件）：`Lexeme` / `WordForm` / `WordSense`、独立 `WordContent` 表、
独立 `VocabularyBookVersion` 表、向量库、Redis、队列。**合并 Books 与 Packs 被明确拒绝**（ADR-016）。

### 4.2 重叠词语义（ADR-020 提案；**v4 结论已更改**）

- **结论:** 学习状态属于 **`User + BookEntry`**（`(userId, bookEntryId)`）。
  同一拼写在不同书里是**不同条目**，各有各的状态。
- **换书:** 新书条目从"未学习"开始；旧书状态保留；**不**传播、**不**合并、**不**做迁移评分；
  用户若已掌握，可**自行**在新书按"已掌握"（现有产品能力）。
- **词书版本更新:** 条目集合按新版本重建；**仍存在的条目**其状态保留。
- **明确拒绝:** 全局跨书 SRS 同步、自动掌握度传播、跨书复习状态合并、transfer scoring、
  合成的"全局熟悉度调度器"。
- **代价（诚实记录）:** 同一个词可能在不同书里被重复练习；"跨书总掌握数"必须作为**统计口径**显式定义，
  而不是 SRS 状态。

### 4.3 已核实的数据现实（本阶段新增证据）

| 指标 | 数值 | 意义 |
|------|------|------|
| 数据行数（IELTS 2000 + 主题 849） | 2,849 | 当前"一户一行"的记录数 |
| 不同词形 | 2,704 | 目标模型中真正的词条数 |
| 重复行 | 145 | 归并对象 |
| **跨 IELTS 与主题包的重叠词** | **119** | 目前会被"学两遍" |
| **跨多个主题的词** | **26** | 同一词在多主题重复 |

### 4.4 数据来源与遗留 AI 数据（ADR-021 提案 + 来源文档）

| 数据族 | 分类 |
|--------|------|
| IELTS 词书成员资格（内联 + ECDICT tag 过滤） | **unresolved pending evidence**（倾向 replace） |
| 内联词条内容 / ECDICT 派生内容 / ECDICT 音标副本 | **unresolved pending evidence** |
| DeepSeek 生成的搭配、例句 | **preserve**（必须标注为生成内容） |
| **AI 富化的学习者可见内容**（v4 口径） | **preserve / regenerate（明确允许）** —— 需 provenance（`sourceType` / provider / model / generatorVersion / generatedAt）+ **校验门**；不得伪造官方来源归属 |
| 主题词表（默认包成员资格） | **regenerate 或 migrate**（需产品决策） |
| 用户自建词包 | **preserve**（label / emoji 应改服务端持久化） |
| 对话生成（ai-train，不落库） | **preserve**（UI 标注 AI 生成即可） |
| Wikipedia 图片 | **unresolved pending evidence**（许可 / 署名待核实） |

**外部数据集结论（v5 口径：两个正交问题）:** 采用**四类来源分离**，并把
**许可适用性**（`ELIGIBLE` / `CONDITIONAL` / `INSUFFICIENT EVIDENCE`）与
**项目导入批准**（`APPROVED FOR PRODUCTION IMPORT` / `PENDING PROJECT DECISION` / `NOT APPROVED`）分开。
**当前没有任何来源达到 `APPROVED FOR PRODUCTION IMPORT`** ——
下列来源均为 `ELIGIBLE + PENDING PROJECT DECISION`（署名 / ShareAlike 义务尚未落实）：
**NGSL 1.2 与 BSL 1.2（CC BY-SA 4.0）**、CEFR-J（研究 + 商用，需正确引用；允许改変须引用）、
Tatoeba（CC BY 2.0 FR）、Wiktextract（CC BY-SA + GFDL）、**Open English WordNet（CC BY 4.0，需双署名）**；
`CONDITIONAL / INCOMPLETE`：FreeDict（逐词典许可待核实）、COCA / BNC（条款未读）；
`INSUFFICIENT EVIDENCE`（因此 `NOT APPROVED`）：官方四六级大纲、官方 IELTS 词表、Oxford 3000/5000、
Princeton WordNet 原版（许可页 403）、`mahavivo` 与 `kajweb` 仓库
（自述来源为商业词典 / 爬取商业 App）、商业词典内容（需授权）。
**候选 ≠ 已批准导入**；是否作为某本考试的**成员资格**来源需单独判断。

### 4.5 技术决策摘要（详见设计文档 §8）

| 技术 | 决定 |
|------|------|
| SQL / PostgreSQL / Neon / Prisma / 多对多建模 / 迁移 / 确定性 SRS | **keep / adopt** |
| PostgreSQL 文本与检索能力 | **investigate later**（需要搜索需求时优先评估它） |
| embeddings | **defer** |
| pgvector / 向量检索 | **defer**（安装扩展 ≠ 需要 RAG） |
| RAG | **defer**（Phase 12 拥有该工程调查） |
| Redis | **reject**（无被证明的用例） |
| 队列 / 后台任务 | **defer**（当前导入均为 CLI） |
| DeepSeek | **keep**（仅用于派生内容，**不得**作为成员资格权威） |

### 4.6 Phase 8 拆分决策（**显式**，ADR-022 提案）

> **结论：建议拆分。** 把原 Phase 8 拆为 **A. Migration Chain Repair & Reproducible Baseline**
> 与 **B. Vocabulary Books Implementation**（Themed Packs 顺延），因为两者的失败模式、
> 证据类型与回滚特性不同，且 A 是 B 的前置条件。

若治理流程选择**不拆分**，必须满足：两类高风险变更各自产出可独立审核的证据、各自有回滚剧本、
且外部评审显式接受该取舍。**Phase 7 未修改路线图**；拆分须走任务书 + 外部评审 + 用户批准。

---

## 5. 复现与验证（设计阶段专属）

按 Phase 7 任务书 Part 9：设计阶段**不**机械运行昂贵的实现验证。本阶段实际执行的检查：

| 命令 | 结果 |
|------|------|
| `git status --short` | 见 §7（仅文档变更；无未跟踪的数据 / 二进制产物） |
| `git diff --stat` | 见 §7 |
| `git diff --check` | 通过（无空白 / 冲突标记错误） |
| 变更文件白名单核对 | 仅 `docs/refactor/**`（3 个新增设计文档 + `DECISIONS.md` + `PHASE_STATUS.md` + handoff） |
| 未变更文件核对 | `prisma/schema.prisma`、`prisma/migrations/**`、`src/app/words/**`、`src/app/api/words/**`、`src/lib/sm2.ts`、`package.json`、lockfile、生产源码：**均未变更** |

**未运行（如实声明）:** 本阶段**未**运行 `npx vitest run` / `npx tsc --noEmit` / `npx next build`，
原因是本阶段（含 v1 → v2 修正）不含任何代码 / schema 变更，运行它们不能为设计结论提供证据；
**不得**据此声称这些命令已通过。（v1 审核也明确说明：本次修正**不要求**运行构建 / 测试。）

**外部研究取证方式:** 使用 `curl` 抓取第一方页面 / 文件，保存到**仓库之外**的临时目录
（`tmp/phase-7-research/`，不进入仓库、不进入审核包）；页面中的关键陈述以 **OBSERVED（外部）**
标注并附访问日期（2026-09-21）；无法访问的一律标 **UNRESOLVED**。

**环境限制（诚实记录）:**

1. 沙箱内默认无网络；外网访问通过显式批准的 `curl` / `git fetch` 执行。
2. 不背单词官网 TLS 握手失败（`SEC_E_ILLEGAL_MESSAGE`）→ 其产品行为**未验证**。
3. WordNet 许可页两次返回 403 → **未验证**。
4. 墨墨论文页返回 200 但内容为空（前端渲染）→ 细节 **未验证**。
5. ~~NGSL 站点仅写 "Creative Commons"，具体变体未确认~~ → **v2 已解决**：NGSL 1.2 与 BSL 1.2 官方页
   均写明 **Creative Commons Attribution-ShareAlike 4.0 International**（第一方原文已读）。
   ~~CEFR-J"修改版词表"条款未核实~~ → **v3 已解决**：官方页免責事項 4) 原文允许改変并须正确引用；
   ① 说明正确引用即可免费用于研究教育及商用；③ 涉及其监修参与的商业使用需另行协商（可能收费）。
   **仍待取证：** 同站其它子表（如 ASL）；**仍属产品 / 法务未决：** 改変后派生词表的许可与署名方式、
   "监修参与"是否适用于本项目。
6. 本阶段**未连接生产数据库**（遵守禁止事项）→ 生产数据分布属未决（U-2）。

---

## 6. 未改动 / 刻意不做的

- 未修改 `prisma/schema.prisma`；未新增 / 修复任何 migration；未执行任何迁移。
- 未导入任何外部词汇数据集；未删除任何遗留数据；未做任何数据回填。
- 未修改 Words UI、Vocabulary API、SRS 行为；未实现 user-scoped `WordReview`。
- 未创建 `VocabularyBook` / `VocabularyBookEntry` 等生产表。
- 未安装 pgvector / 向量库；未引入 RAG / Redis / 队列 / LangChain / LangGraph / Agent / MCP。
- 未新增依赖；未做无关清理或机会主义重构。
- 未提交、未推送（等待后续明确的收尾命令）。

---

## 7. 变更与状态明细（交接时快照）

**变更文件（git 视角）:**

```
docs/refactor/VOCABULARY_PLATFORM_DESIGN.md        (new)
docs/refactor/VOCABULARY_DATA_PROVENANCE.md        (new)
docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md     (new)
docs/refactor/handoffs/phase-7-handoff.md          (new)
docs/refactor/reviews/phase-7-review.md            (new — v1 Changes Requested 记录 + 修正对照表)
docs/refactor/DECISIONS.md                         (modified — append ADR-019…ADR-022)
docs/refactor/PHASE_STATUS.md                      (modified — Phase 7 → In Review + 执行记录)
```

| 项目 | 结果 |
|------|------|
| Phase 7 | 🔄 **In Review / Awaiting External Review** |
| Phase 8 | **Not Started**（未启动） |
| ADR-019…ADR-022 | **Proposed**（未自批 Accepted） |
| 是否提交 / 推送 | ❌ 否 |
| 审核包 | **`phase-7-review-pack-v5.zip`**（v1 的 manifest 控制字符问题已在 v2 修复；v3 / v4 / v5 继续使用干净 manifest + 控制字符扫描 + 哈希校验；v4 含 "v3 → v4 product clarification"、v5 含 "v4 → v5 correction" 摘要） |

---

## 8. 外部审核记录

> 完整记录（含 v1 结论原文与修正对照表）见 `docs/refactor/reviews/phase-7-review.md`。

### v1（2026-09-21）

| 项目 | 结果 |
|------|------|
| Review Status | 🔴 **Changes Requested** |
| Phase 7 Release Decision | ❌ **Not Approved**（Phase 8 保持 **Not Started**） |
| Blocking Issues | **B-01** 迁移 squash 策略（新 baseline 与后续历史迁移会重复创建同一结构）；**B-02** 目标模型丢失来源条目语义（CEFR-J 同一 headword 的不同词性可带不同等级）；**B-03** 多值例句仍以标量字段 + 字段级来源表示；**B-04** 复习状态合并会由多条记录拼接字段、合成不存在的调度状态 |
| 其它要求 | 重新核实 NGSL / BSL / CEFR-J 第一方许可证据并收紧法律措辞；书内进度持久化必须版本安全；v2 审核包 manifest 不得含控制字符；ADR 保持 Proposed；**不得**抹除 v1 历史 |

### v2（2026-09-21）

| 项目 | 结果 |
|------|------|
| Review Status | 🔴 **Changes Requested** |
| Phase 7 Release Decision | ❌ **Not Approved**（Phase 8 保持 **Not Started**） |
| B-01…B-04 | ✅ **accepted as resolved**（不得回退） |
| 新增阻断项 | **B-05** 词条身份 / 书内条目 / 导入管线必须端到端一致：v2 的 `by-wordKey-keep-first` 与 `no-duplicate-wordKey` 会丢弃 CEFR-J 式合法来源条目（`record` noun B1 / verb A2）；并要求内容解析、例句作用域、学习者状态后果显式化，以及 handoff 中 NGSL / CEFR-J 过时表述的修正 |

**v2 修正（执行者，2026-09-21）:** §4.6 重写为 A / B / C 对比并**选定 C**（`Word` + 轻量 `WordUsage` +
条目指向 usage）；新增三层身份与去重判定（`Word` / `WordUsage` / `BookEntry`），
manifest 与导入流程**移除** `wordKey` 级别的条目去重；新增 §4.8 内容解析规则
（`entry → usage → word`，含 `record` 名词 / 动词音标差异）；新增 §4.7.5 例句作用域
（`WordExample.wordUsageId` 可空 = 用法中立）；新增 §6.4 学习者状态后果（词级掌握度 + 用法级状态触发条件）；
CEFR-J 证据逐字取证并移除过时未决项。**未回退** v2 已接受的 B-01…B-04 或其它 v2 结论。

### 当前（v3 待复审）

| 项目 | 结果 |
|------|------|
| Review Status | ⏳ **Awaiting v3 external review**（B-05 修正已完成） |
| Phase 8 Release Decision | ⏳ 待定 |
| 已接受方向 | 按 v1 / v2 明确要求**保持不变**（分区模型、Books / Packs 分离、PostgreSQL + Prisma、单一 user-scoped 学习状态、技术调查 ≠ 生产采纳、延后向量 / RAG / Redis / 队列、**Phase 8 拆分建议**、v2 的 B-01…B-04 修正、保守法律措辞、干净 manifest） |

**建议复审重点（执行者建议）:**

1. **B-05 模型选择**：A / B / C 对比与"选定 C（轻量 `WordUsage`，非 WordSense）"的理由是否成立；
   `WordUsage` 的边界（`posKey` 闭集含 `multi` / `unknown`）是否足够最小。
2. **B-05 导入一致性**：三层身份与去重判定、`by-wordKey-keep-first` 的废弃、
   条目层唯一约束（`UNIQUE(bookId, position)` + `sourceEntryId` 部分唯一、禁止 `UNIQUE(bookId, wordUsageId)`）
   是否满足"保留真实来源条目"的要求。
3. **B-05 内容解析**：`entry → usage → word` 的逐字段回退与"回退 ≠ 拼接 / 不跨用法回退"是否清楚；
   `record` 的名词 / 动词音标差异是否被正确处理。
4. **B-05 例句作用域**：S-1（可选 `wordUsageId`）是否为最简单自洽方案。
5. **B-05 学习者状态**：词级掌握度 + 其四项后果（书内进度 / 队列 / 重叠条目 / UI）是否被显式接受；
   用法级状态的触发条件是否合理。
6. **Phase 8 拆分建议（ADR-022）**是否被接受；若接受，编号与顺序如何确定（需治理流程）。

---

## 9. 后续阶段交接

### 9.1 可依赖的已批准资产（沿用 Phase 6，不变）

`ExecutionContext.userId` 权威身份、`UserRepositoryPort` / `MemoryRepositoryPort`、
`GetUserContextUseCase` / `UpdateLearningProfileUseCase` / `RememberUserFactUseCase`、
有界确定性 Memory 选择、canonical State vs Memory 所有权、Phase 5 Trace 基础设施、
Phase 3 `AIClientPort`、Phase 4 参考确定性 Workflow、Phase 2 SM-2 受保护基线。

### 9.2 后续阶段（Phase 8 / 9）的硬性 guardrails

| # | 规则 |
|---|------|
| A | 归属身份只能来自 `ExecutionContext.userId`；payload 不携带 `userId`（Phase 6 B-01 不变式继续有效） |
| B | 任何 Vocabulary 数据导入 PR 必须引用 ADR-016 第 4 条**与** ADR-021，并附来源 / 许可证据，否则视为超出范围 |
| C | **AI 富化被允许**（v4），但生成内容必须带 provenance 与**校验状态**、可标注、可替换；**不得**伪造"来自官方来源"的归属，也**不得**把 AI 作为第三方考试词表成员资格的唯一依据 |
| D | SM-2 行为不得改变（Phase 2 的 32 个表征测试不得放宽） |
| E | 修复迁移链 / 变更 schema 的阶段**必须自行**通过真实数据库的迁移正确性与可复现性验收（迁移验证门） |
| F | 生产迁移部署在迁移链被独立修复与验证之前保持 **BLOCKED** |
| G | 不得仅因"上游 GitHub 仓库是公开的"导入数据；不得在没有证据时宣称数据"合法"或"不合法" |
| H | Books 与 Packs 保持概念分离（ADR-016）；合并需要新 ADR 与证据 |
| **I**（v4） | **SRS 归属键 = `(userId, bookEntryId)`**；换书不得传播、合并或转移掌握度；实现中**不得**出现跨书同步 / "全局熟悉度调度器" |
| **J**（v4） | 上游来源行**不得**因 `wordKey` 相同而丢弃；每条来源行必须在 `BookEntryMeaning` 上有归属；是否拆成学习者可见条目由**该书 curation 规则**决定并写入 manifest |
| **K**（v4） | 内容来源必须能区分 `source-derived` / `curated` / `ai-assisted` / `ai-generated`；AI 内容未通过校验门不得进入发布态 |
| **L**（v5） | **`BookEntry` 的身份是稳定 `entryKey`**（`UNIQUE(bookId, entryKey)`）；`position` 仅排序；重新导入**按 `entryKey` 协调**，**不得** delete + recreate，**不得**因为重排 / 内容修订而换键 |
| **M**（v5） | **正式词书卡片的内容必须来自 `BookEntryMeaning` / `BookEntryExample`**（含义项级音标与书内搭配）；**不得**隐式回退到共享 `Word` 内容；需要回退时必须显式声明 `fallbackPolicy` 并校验 |
| **N**（v5） | **许可适用性 ≠ 项目导入批准**：只要署名 / ShareAlike / 再分发义务未落实，来源只能是 `PENDING PROJECT DECISION`；来源派生内容必须能保留 `attributionText` |
| **O**（v5） | **Books 阶段不得破坏或提前实现 Packs**：保留词包依赖的 `theme` / `source` / `difficulty` 与其遗留运行时 / review 路径；跨域 `Word` 合并与遗留语义移除留到 Phase 10 |

### 9.3 已知部署门禁（继续保持）

`prisma/migrations/20260609000001_baseline/migration.sql` 仍是损坏历史文件
（UTF-16LE BOM，PowerShell 错误转储，SHA-256 前缀 `6B90BC5ACD5A94A8`）。
**未经独立修复与真实验证，不得声称完整迁移链可部署。** Phase 7 **未**修复它。

### 9.4 本阶段产出但**未**执行的事项（留给后续已批准阶段）

1. 迁移链修复（处置方向已给出：**路线 B（整链 squash 为一份 baseline）倾向**，见迁移策略 §6.2）。
2. 词形身份归并 + **来源条目 → 策划条目**的映射（含 `wordKey` 归一化与内容优先级规则）。
3. `WordReview` → **`LearnerEntryReview(userId, bookEntryId)`** 的迁移与回填。
4. 导入管线 + manifest 的实现与许可门禁。
5. 外部数据集的实际选择与授权（需要产品 / 商务动作）。
6. 主题 / 用户词包的服务端持久化与归属。
7. （v4）**AI 富化流水线 + 校验门**的实现（含 `validationStatus` / `validationVersion`）。
8. （v5）**`entryKey` 命名规则**的落地与导入协调实现（含 `inactive` / `superseded` 处置与报告）。
9. （v5）**词包侧的迁移与遗留语义移除**（Phase 10：成员迁移、词包状态语义、跨域 `Word` 合并、
   移除 `theme` / `source` / `difficulty` 与遗留 review 路径）。

---

## 11. "v4 → v5 correction" 摘要（供审核包引用）

**触发:** 外部复核 v4 = **Changes Requested**；v4 的架构决定被接受且不得重新打开，本轮只修 5 个阻断项。

| 阻断项 | 问题 | v5 解决 |
|--------|------|---------|
| **B-06** | SRS 以 `bookEntryId` 为键，但条目身份依赖**可变的 `position`**，更新时会破坏学习连续性 | 引入 **`entryKey`**（`UNIQUE(bookId, entryKey)`）；`position` 仅排序；导入**按 `entryKey` 协调**，缺失条目转 `inactive` / `superseded` 而**不**孤立学习状态；只有策划上换了学习单位才换键；**不**引入 `VocabularyBookVersion` 表、**不**引入跨书身份 |
| **B-07** | 目标模型要求按词性的发音 / 内容，但 `BookEntryMeaning` 存不下；搭配归属前后矛盾；正式卡片可能静默回退到通用 `Word.definition` | `BookEntryMeaning` 增加 **`phonetic?` / `collocations?`**，并被定义为**正式词书卡片的规范内容**；**禁止隐式回退**；新增显式 `fallbackPolicy`（默认 `none`，白名单 + 校验）；`record` 名词 / 动词可分别表示；搭配归属统一 |
| **B-08** | "APPROVED FOR IMPORT" 同时被当作"可生产"，而 ShareAlike / 署名义务仍未落实 | 拆成**两个正交问题**：许可适用性（ELIGIBLE / CONDITIONAL / INSUFFICIENT）与项目导入批准（APPROVED / PENDING / NOT APPROVED）；当前**无来源**达到已批准；要求保留 `attributionText` 等署名信息；保留已核实的许可事实与措辞纪律 |
| **B-09** | ADR-020 仍以"换书再学是产品缺陷"等旧理由作为现行论述 | ADR-020 重构：**置顶唯一的现行决定 + 现行理由**；历史 v1–v3 理由显式标注 **superseded** 并声明不得作为现行引用 |
| **B-10** | 迁移策略在全局层面移除 `theme` / `source` / `difficulty` 并要求全局去重，而词包运行时仍依赖它们 | 过渡期范围：Books 阶段**只迁正式词书侧**，**保留**词包遗留字段与运行时 / review 路径（标注 transitional / deprecated）；Packs 阶段再做成员迁移、状态语义、跨域合并与遗留语义移除；**V-15 修正**；新增 V-31（词包运行时回归）与 R-19 |

**未变的硬性约束:** 不实现生产代码 / schema / migration / 数据导入；SM-2 行为不变；
Phase 7 = **In Review**（非 Approved）；Phase 8 = **Not Started**；ADR-019…022 = **Proposed**。

---

## 10. "v3 → v4 product clarification" 摘要（供审核包引用）

**触发:** 产品澄清（2026-09-23）在 Phase 7 收尾之前改变了核心设计前提；Phase 7 被**有意重新打开**。

| 维度 | v3（历史） | **v4（当前）** |
|------|-----------|---------------|
| 学习 / SRS 单位 | 共享 `Word`（状态 `(userId, wordId)`） | **`BookEntry`**（状态 **`(userId, bookEntryId)`**） |
| 中间层 | 轻量 `WordUsage`（跨书共享锚点） | **移除**（无消费者） |
| 一个学习单位能含多个义项吗 | 不行（靠多个 entry） | **能**（`BookEntryMeaning` 1..N） |
| 上游 POS / 义项分行 | 保留为多条条目 | 保留为**来源引用**；是否为每条建学习者可见条目 = **该书策划决定** |
| 换书 | 自动视为已掌握（全局状态） | **不传播**；用户可自行标记 |
| 例句归属 | `WordExample`（+ 可选 `wordUsageId`） | **`BookEntryExample`**（+ 可选绑定义项） |
| AI 的定位 | 仅"派生学习内容"，且不作为成员资格权威 | **允许富化学习者可见内容**（须 provenance + 校验门）；仍**不得**作为第三方考试词表成员资格的唯一依据 |
| 来源分类 | 三类（成员资格 / 内容 / AI） | **四类**（成员资格来源 / 词汇证据 / AI 富化 / 最终策划条目）+ **审批三态** |
| 迁移链拆分 | 建议拆分 | **保持**（Phase 8 修复 / Phase 9 Books / Phase 10 Packs） |

**未变的硬性约束:** 不实现生产代码 / schema / migration / 数据导入；SM-2 行为不变；
"绝不拼接复习状态"的不变式保留（适用范围收窄）。

---

## 12. 最终交接（**Phase 7 Completed / Approved，2026-09-23**）

### 12.1 最终设计（已批准，v5）

| 主题 | 最终结论 |
|------|---------|
| 领域模型 | `Word`（词形身份 + 共享词汇内容，**不是** SRS 归属）→ `VocabularyBook` → **`VocabularyBookEntry`**（学习单位与 SRS 归属；**稳定 `entryKey`，`UNIQUE(bookId, entryKey)`**；`position` **仅排序**）→ 从属 `BookEntryMeaning`（1..N 规范内容：目标释义 / 目标词性 / **义项级音标** / **书内搭配** / 翻译 + 来源 / 生成元数据 / 校验状态）与 `BookEntryExample`（0..N 例句，可绑定义项）。`BookEntryMeaning` / `BookEntryExample` **从属**、**不是** SRS 归属。 |
| SRS 归属 | **`(userId, bookEntryId)`**（`LearnerEntryReview`）；SM-2 算法与返回值语义不变（Phase 2 的 32 个表征测试为受保护基线） |
| 重叠词 / 换书 | 同一拼写在多本书中是**不同条目、各自独立状态**；**不**传播、**不**合并、**不**做迁移评分、**不**存在"全局熟悉度调度器"；用户在新书可自行按"已掌握" |
| 明确不引入 | `WordUsage`（v4 移除）、`WordSense` / `Lexeme` / `WordForm` 本体、`VocabularyBookVersion` 表（除非将来确有需求）、跨书身份 / 同步 |
| 内容契约 | 正式词书的规范内容**必须**在 `BookEntryMeaning` / `BookEntryExample` 上显式存在；**禁止隐式回退**到 `Word.definition` / `Word.phonetic` / `Word.collocations`；需要回退时必须显式声明 `fallbackPolicy`（默认 `none`，白名单 + 校验 + 报告可见） |
| AI 富化 | **允许**（释义简化 / 中文解释 / 例句 / 搭配 / 辨析 / 练习 / 记忆提示），但必须带 `sourceType` / provider / model / `generatorVersion` / `generatedAt` / `validationStatus`，经**校验门**；**不得**伪造官方来源归属，**不得**作为第三方考试词表成员资格的唯一依据，**不得**存 prompt / 私有数据 / 完整响应 |
| 数据来源与导入 | **四类来源分离**（成员资格来源 / 词汇证据 / AI 富化 / 最终策划条目）；**两个正交问题**：许可适用性（`ELIGIBLE` / `CONDITIONAL` / `INSUFFICIENT EVIDENCE`）与项目导入批准（`APPROVED FOR PRODUCTION IMPORT` / `PENDING PROJECT DECISION` / `NOT APPROVED`）。**当前无来源达到已批准导入**；导入必须有 manifest（上游身份 / 版本 / 许可证据 / 校验和 / 转换与 curation 规则 / `entryKey` 规则），按 `entryKey` 协调（原地更新 / 新增 / 移除转 `inactive`），幂等 |
| 基础设施 | **PostgreSQL** 保持战略关系数据库；**Neon** 是当前托管 PostgreSQL 提供方；**Prisma** 是当前 TypeScript 数据访问 / 迁移工具；**不**引入第二个数据库；**不**为 Vocabulary Books 引入 Redis / 向量库 / pgvector / Python worker / 队列 / LangChain / LangGraph / MCP |
| 迁移链损坏 | `prisma/migrations/20260609000001_baseline/migration.sql` 仍是 UTF-16LE 的 PowerShell 错误转储（SHA-256 前缀 `6B90BC5ACD5A94A8`）；**未修复**，且**不得**声称完整迁移链可部署 |

### 12.2 阶段拆分（已激活）

| Phase | 名称 | 状态 |
|-------|------|------|
| 7 | Vocabulary Platform Design & Data Provenance | ✅ Completed / Approved（2026-09-23） |
| **8** | **Migration Chain Repair & Reproducible Baseline** | **Ready / Not Started** |
| 9 | Vocabulary Books Implementation | Not Started |
| 10 | Themed Packs Convergence | Not Started |
| 11 | Reliability, Ownership & Evaluation Platform Convergence | Not Started |
| 12 | AI Coach Foundation Refactor | Not Started |
| 13 | Retrieval & Knowledge Engineering | Not Started |
| 14 | Agentic AI Coach & Tool System | Not Started |
| 15 | MCP Interoperability, AgentOps & Safety | Not Started |
| 16 | Production, Benchmark & Portfolio Hardening | Not Started |

### 12.3 Phase 8 MUST / MUST NOT

**MUST:**

1. 只修复**迁移链 / 基线可复现性**：处置损坏的历史 baseline（推荐**路线 B** —— 按 Prisma ORM v7 官方
   squash 语义压缩为**一份**代表当前 schema 的 baseline，并把被移除的历史迁移**归档出活动链**）；
2. 在**空数据库**上完整执行迁移成功；在**生产形状克隆库**上 `migrate deploy` 后与
   `prisma/schema.prisma` **双向 `migrate diff` 为空**；在第二个空库上复现（幂等）；
3. 对已存在的生产形状库使用 `migrate resolve --applied` 对齐基线（**不重放**）；
4. 归档并记录被 squash / 替换迁移的**逐文件 SHA-256 与内容摘要**，以及损坏文件的原始字节与哈希；
5. 写出**前滚 / 回滚剧本**（Neon 分支或备份恢复）并演练；
6. 保持应用**可运行**，并保留 Phase 2–6 受保护测试基线全绿。

**MUST NOT:**

1. 引入任何**产品功能**（Vocabulary Books 模型 / UI / 导入管线 / 选书体验）；
2. 提前实现 Phase 9（Books）或 Phase 10（Packs）的工作；
3. 改动 SRS 行为、`WordReview` 语义或任何 Vocabulary 数据（**不迁数据、不删数据**）；
4. 声称部署就绪而未完成上述真实验证；
5. 使用破坏性 Git 操作或重写已批准提交。

### 12.4 下一步

Phase 8 保持 **Ready / Not Started**；其执行命令由下一位协调者依据仓库现状重建
（`docs/refactor/PHASE_EXECUTION_PROTOCOL.md` §4），并以**独立的已批准任务书**为依据。
本交接**不**创建 Phase 8 实现任务，也**不**启动 Phase 8。
