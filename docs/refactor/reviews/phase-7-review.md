# Phase 7 审核记录 — Vocabulary Platform Design & Data Provenance

**审核对象:** Phase 7 设计 / 证据包（`phase-7-review-pack-v1.zip`）
**审核方式:** 外部独立审核（planning / review assistant），由用户转达结论
**当前审核状态:** 🟠 **Changes Requested**（v1）→ 修正已完成，等待 **v2 外部复审**
**Phase 7 Release Decision:** ❌ **Not Approved yet**（v1）
**完整轨迹:** v1 Changes Requested → （待 v2）

> **历史保留声明。** v1 的结论原文与阻断问题**原样保留**在本文件中，不因后续修正而改写或删除。

---

## 提交记录（执行者，v1）

**日期:** 2026-09-21
**审核包:** `phase-7-review-pack-v1.zip`

| 项目 | 内容 |
|------|------|
| 交付范围 | 三份设计 / 证据文档（`VOCABULARY_PLATFORM_DESIGN.md` / `VOCABULARY_DATA_PROVENANCE.md` / `VOCABULARY_MIGRATION_STRATEGY.md`）、Phase 7 handoff、`DECISIONS.md` 的 ADR-019–022（Proposed）、`PHASE_STATUS.md` 更新 |
| 生产代码 / schema / migration 变更 | **无**（设计阶段；未改 schema、未新增 / 修复 migration、未导入数据、未删数据） |
| 受保护基线 | Phase 2–6 全量 544 tests 与受保护基线 442 tests 未被触碰（本阶段未运行测试，原因是无代码 / schema 变更） |
| 本阶段执行的外部取证 | `curl` 抓取第一方页面（Anki 手册、ECDICT 仓库文件、FSRS、产品官网、数据集许可页），保存在**仓库之外**的临时目录 |
| Phase 状态（送审时） | Phase 7 = In Review / Awaiting External Review；Phase 8 = Not Started |
| 是否自批 | ❌ 否 |

---

## 外部审核记录（v1）

**日期:** 2026-09-21
**结论:** 🔴 **CHANGES REQUESTED** —— Phase 7 **未获批准**；**Phase 8 保持 NOT STARTED**。
审核方同时明确要求：**只做聚焦的文档修正，不实现生产代码，不改 schema / migration / API / UI / SRS 代码 / 依赖 / 数据库数据，不提交、不推送。**

### 1) 必须保留的已接受方向（不得因修正而重新设计）

- lexical identity / Books / Packs / learner state / provenance 的**分离**；
- Books 与 Packs 是两个**不同产品域**；
- **PostgreSQL + Prisma** 作为既有数据基础；
- **一个 user-scoped 学习者词汇状态**，而不是按词书复制的 SRS 状态；
- "技术调查 ≠ 生产采纳"原则；
- embeddings / pgvector / RAG / Redis / queues 继续**延后**，除非后续证据证明必要；
- **Phase 8 拆分建议**：迁移链修复应与 Vocabulary Books 实现保持**可独立审核**。

### 2) Blocking Issue B-01 — 迁移 squash 策略（Migration squash strategy）

审核方指出：`VOCABULARY_MIGRATION_STRATEGY.md` 推荐"空库 → 当前 schema"生成新 baseline，
但措辞**没有清楚说明**如何处置已被该 schema 覆盖的后续迁移。这会产出一条**非法的干净迁移链**：
新 baseline 已经建立当前结构，而后续历史迁移还会再次创建 / 新增同样的结构。

要求：

- 按**当前 Prisma v7 的 baselining / squashing 语义**修正设计，并**引用官方文档**；
- 必须区分至少两种不同语义：
  **A. 只把损坏的历史 baseline 重建到"当时的历史 schema 点"**，
  **B. 有意把整条迁移历史 squash 到"当前已批准 schema"的一份干净 baseline**；
- 若推荐 B，必须**显式说明**：被 squash 的迁移已**归档 / 移出活动迁移链**，
  新环境只获得**一份**代表当前状态的 baseline，其后只有未来迁移；
- 对**已存在的生产形状数据库**，说明新 baseline 如何被对齐 / 标记为已应用，以及**既有迁移历史证据如何保留**；
- **不得**执行修复。ADR-022 仅在必要处更新引用；"拆分迁移修复与 Books 实现"的决定可以保留。

### 3) Blocking Issue B-02 — 目标模型丢失真实来源语义

审核方指出：目标模型以归一化 headword 标识 `Word`、把 `partOfSpeech` 当作共享内容，
但 Phase 7 研究本身已发现反例：**CEFR-J Wordlist 明确把同一 headword 的不同词性当作不同条目，
并可能赋予不同 CEFR 等级**。

要求：

- 修正目标模型，使未来的 `VocabularyBookEntry` 能**忠实表达来源条目语义**，
  同时**不**提前要求完整的 `WordSense` 本体；
- 对比最小方案（例如：共享 `Word` 身份 + 条目级 POS / 来源条目元数据；`Word` 身份包含 POS；其它最小表示），
  说明取舍，并选出**能保留真实来源信息的最小模型**；
- 具体回答：`record`（noun，一个等级 / 分类）与 `record`（verb，另一个等级 / 分类）出现时，
  **什么在全局共享、什么属于 `VocabularyBookEntry`**；
- 复核 CEFR 等级、来源条目 ID / 分类 / 排名等属性是否应落在 `VocabularyBookEntry` 而不是 `Word`；
- 除非证据确实需要，**不得**引入 `Lexeme` / `WordSense`。

### 4) Blocking Issue B-03 — 多值例句与来源标记

审核方指出：审计已正确识别 `Word.example` / `Word.exampleZh` 用 ` ||| ` 在一个字符串里编码多条例句，
但目标设计仍把 `example` / `exampleZh` 当作**标量 `Word` 字段 + 字段级来源**。
这无法正确表达：多条例句、**逐条例句来源**、以及"某条 AI 例句可被独立替换 / 重新生成"。

要求：

- 修正该不一致，设计**最小正确表示**；
- 至少对比：`Word` 上一个 canonical 例句 + 其它地方存放派生 / 生成例句；
  轻量的 `WordExample` 子关系 / 值概念（带逐条来源）；以及仍能保留多值与来源的更简单替代；
- **不得**创建 schema、**不得**过度规范化无关内容；
- 同时说明 AI 派生内容所需的 provenance：生成方 / 模型身份、生成或导入路径与版本，
  以及**足以区分生成内容与授权 / 导入内容**的元数据，且**不**存储不必要的 prompt / 私有数据。

### 5) Blocking Issue B-04 — SRS 状态合并不得合成非法状态

审核方指出：迁移策略建议"选一条主 `WordReview`，再可能从另一条取 `nextReviewAt`"。
`interval` / `easiness` / `repetitions` / `lastReviewedAt` / `nextReviewAt` 构成**一个**调度状态；
在没有完整复习事件历史时，**无法**可靠重建数学上正确的合并状态。

要求：

- 重新设计重复复习冲突策略；**不得**通过混合多条记录的字段构造混合状态，
  除非存在不变量 / 证明说明该组合有效；
- 对比安全选项（按确定性策略保留**一条完整状态**；把"多条都有状态"的重复词标记为
  **需要显式保守处置的迁移冲突**；其它有证据支撑的做法）；
- 保留可审计性：在破坏性归并之前，所有原始行 / 状态必须已存在于备份 / 导出 / 审计证据中；
- 设计必须清楚区分：**常见情形**（只有一个重复行有复习状态）与**冲突情形**（多个重复行都有复习状态）；
- **不得**执行迁移。

### 6) 来源 / 证据修正（Provenance corrections）

审核方要求重新核实第一方来源，至少修正 NGSL 系列证据：

- **NGSL 1.2**：官方页面声明 **Creative Commons Attribution-ShareAlike 4.0 International**；
- **Business Service List（BSL）1.2**：官方页面同样声明 **CC BY-SA 4.0 International**；
- **CEFR-J Wordlist**：官方页面明确允许研究与商业用途（需正确署名），并允许在正确引用前提下发布修改版词表；

并要求：

- 相应更新数据集证据层级：若第一方 CC BY-SA 4.0 文本已核实，**BSL 不应继续停留在 E2 / 许可不完整**；
  NGSL 核心列表应记录**已核实的具体 CC 变体**；
- 保持"**候选 ≠ 已批准导入**"；
- **收紧全文法律措辞**：优先使用
  "not eligible for project import under current evidence"、
  "no verified redistribution permission found"、
  "requires further permission/license evidence"；
  **不得**把"未观察到许可"写成 "legally impossible to redistribute" 这类绝对法律结论，
  除非权威条款明确支持；来源明确允许或禁止某项用途时，**逐字说明来源写了什么**。

### 7) 非阻塞澄清 — 书内进度的版本安全

若 `LearnerBookProgress.lastStudiedEntryPosition` 仍作为可选的持久化概念保留，
必须说明其语义**必须版本安全**：位置游标在词书成员 / 顺序变化后会失效。
可选做法：推迟持久化位置进度；或绑定到某个词书版本；或使用其它稳定的进度表示。
本项**不**要求在 Phase 7 建立生产模型。

### 8) 审核包清单（manifest）损坏

审核方指出 v1 审核包的 `review-manifest.md` 中的**分支 / 路径引用**（如
`refactor/…`、`fa1f3e6…`、file-hash、tmp 等字符串）含有**控制字符**（回车 / 换页 / 制表符转义）。
要求：重新生成 **v2 的审核包清单**，**不得**复制这些畸形字符串；并**重新执行哈希校验**。

### 9) 需要更新的文档与历史记录要求

- 只更新本次修正所需的 Phase 7 文档：三份设计 / 证据文档、`DECISIONS.md`、`PHASE_STATUS.md`、Phase 7 handoff；
- **ADR-019 … ADR-022 保持 `Proposed — Pending External Review`**；**不得**把任何 ADR 标记为 Accepted；
- 按前几个阶段的历史风格，把 **v1 审核结论与历史**加入 Phase 7 的审核 / 状态记录：
  `v1 = Changes Requested`、`Phase 7 = In Review`、`Phase 8 = Not Started`；**不得**抹除 v1 历史。

### 10) 验证与审核包 v2

- 运行 `git status --short` / `git diff --stat` / `git diff --check`；
- 显式确认 `prisma/schema.prisma`、`prisma/migrations/**`、`src/**`、`package.json`、lockfile、
  生产数据**均未变更**；不得有数据集转储或二进制产物进入仓库；
- 未实际运行构建 / 测试时**不得**声称其通过；本次修正**不要求**运行构建 / 测试；
- 生成 **`phase-7-review-pack-v2.zip`**，内容遵循 `PHASE_EXECUTION_PROTOCOL.md`：
  已批准的 Phase 7 任务书、修正后的三份文档、Proposed ADR、`PHASE_STATUS`、Phase 7 handoff、
  完整 Phase diff、验证证据、**干净**的审核清单、文件哈希校验；
  排除密钥 / 私有数据 / 数据集转储 / 二进制。

---

## 修正记录（执行者，2026-09-21）

> 修正范围**仅限文档**；未实现任何生产代码，未改 schema / migration / API / UI / SRS / 依赖 / 数据。

| # | 修正 | 落点 |
|---|------|------|
| **B-01** | 按 Prisma ORM v7 官方语义重写迁移处置：新增 §6.2 的**路线 A（只重建历史 baseline，属推断重建）**与**路线 B（有意 squash 整条历史为一份 baseline，推荐）**对比；明确 squash 后**被压缩的历史目录归档并移出活动链**、**新环境只执行一份 baseline**、生产形状库用 `prisma migrate resolve --applied` 对齐（不重放）、生产库 `_prisma_migrations` 保留既有历史；新增官方文档引用与"手工 SQL 不会保留"的核对要求；新增 H-1…H-5 归档 / 证据要求与 6.2.4 对齐 / 回滚 / 验收门；风险表新增 R-9 / R-10 / R-11；未决项 U-2 扩展为含 `_prisma_migrations` 状态 | `VOCABULARY_MIGRATION_STRATEGY.md` §6.2（重写）、§7.3、§9、§10；`VOCABULARY_PLATFORM_DESIGN.md` §8.6（迁移条目 Evidence 更新）；`DECISIONS.md` ADR-022 |
| **B-02** | 目标模型修正：`Word` 身份**仅**由 headword 决定，来源词性 / 等级 / 条目 id / 分类 / 排名等**来源特定属性**落到 `VocabularyBookEntry`；新增 §4.6（O-1…O-4 方案对比、选定 O-1、`record`（noun/verb）的共享 vs 条目归属逐项回答、entry vs `Word` 字段归属表）；明确**不引入** `WordSense`，并把"按 POS 切分学习者状态（`posScope`）"登记为有触发条件的后续升级 | `VOCABULARY_PLATFORM_DESIGN.md` §4.2（模型表）、§4.4（触发条件表）、**新增 §4.6**；`DECISIONS.md` ADR-019（v2 修正） |
| **B-03** | 例句表示修正：新增 §4.7（E-1/E-2/E-3 方案对比，选定 **E-2 `WordExample` 子关系**；字段表含 `position` / `source` / `provider` / `model` / `generatorVersion` / `generatedAt` / `sourceManifestRef` / `status`；明确 AI provenance 的最低要求与"不存 prompt / 私有数据 / 完整响应"；说明搭配**不**拆表的理由与触发条件）；数据来源文档的字段归因与 L-4 分类同步更新为"迁移到可逐条标注的表示" | `VOCABULARY_PLATFORM_DESIGN.md` §4.2、§4.4、**新增 §4.7**；`VOCABULARY_DATA_PROVENANCE.md` §4、§5、§8.2；`DECISIONS.md` ADR-019（v2 修正） |
| **B-04** | 复习状态合并修正：重写 §3.4，引入硬性不变式"**绝不**拼接多条记录字段构造混合状态"；区分 **C-0（无状态）/ C-1（单一状态 → 整条复制）/ C-2（冲突 → 不自动合并）**；C-2 给出"按确定性规则**整条采用**一条"或"显式**重置为全新学习状态**（宁可多复习、不可假掌握）"两种保守处置；要求迁移前全量导出 + 冲突报告 + 冲突数门禁（建议默认 0）；风险表 R-2 / R-10 相应更新 | `VOCABULARY_MIGRATION_STRATEGY.md` §3.4（重写）、§9；`DECISIONS.md` ADR-020（v2 修正） |
| **来源 / 措辞** | 重新核实并更新：NGSL 1.2 与 BSL 1.2 均为 **CC BY-SA 4.0 International**（第一方原文已读，证据层级升至 **E1**）；CEFR-J 记录其"研究 + 商业用途、需正确署名"与引用格式（"修改版词表"条款未逐字读到 → 列入未决）；新增 §7.0 **措辞纪律**（"not eligible for project import under current evidence" 等），改写 CET 仓库、爬取仓库、Oxford 等处的绝对化措辞；数据集分层 Tier A/B/C 更新；未决清单更新（新增 ShareAlike 含义、CEFR-J 修改条款、同站其它子表） | `VOCABULARY_DATA_PROVENANCE.md` §6.1、§6.3、§6.4、§6.5、**新增 §7.0**、§7.2、§8.2、§9(U-4)、§10、§11；`DECISIONS.md` ADR-021（v2 修正） |
| **非阻塞（书内进度）** | 明确书内进度若持久化必须**版本安全**：推迟持久化 / 绑定 `bookVersion` / 使用稳定引用（如 `lastStudiedWordId`），禁止裸位置游标；`LearnerBookProgress` 模型行同步更新 | `VOCABULARY_PLATFORM_DESIGN.md` §4.2、§6.2；`DECISIONS.md` ADR-019（v2 修正） |
| **审核包清单** | 已定位根因：v1 的 manifest 是用 PowerShell **双引号 here-string** 写入的，而文本里的反引号包裹写法（如反引号 + `f` + `a1f3e6`、反引号 + `t` + `mp/...`）被 PowerShell 解释成**转义序列**，产生了 `0x0C`（换页）与 `0x09`（制表符）控制字符 —— 实测 v1 manifest 中有 **3 处**（2×`0x0C`、1×`0x09`）。v2 改用**单引号 here-string**（不做转义解释）生成 manifest，并对 pack 内全部文本文件执行**控制字符扫描**后再发布；重新执行哈希校验 | v2 pack：`review-manifest.md`、`evidence/control-character-scan.txt`、`file-hash-verification.txt` |

**未做（明确声明）:** 未重新设计已接受方向（§1 列表）；未把任何 ADR 标为 Accepted；
未修改任何生产代码 / schema / migration / API / UI / SRS / 依赖 / 数据；未运行构建 / 测试（本次修正不含代码变更）；
未提交、未推送。

### 修正后状态

| 项目 | 结果 |
|------|------|
| Phase 7 | 🔄 **In Review**（corrections complete, awaiting external re-review v2） |
| Phase 8 | **Not Started**（未启动） |
| ADR-019 … ADR-022 | **Proposed — Pending External Review**（未自批） |
| Review Status | ⏳ Awaiting v2 external review（v1 = Changes Requested，历史保留于本文件） |
| 审核包 | `phase-7-review-pack-v2.zip` |

---

## 外部审核记录（v2）

**日期:** 2026-09-21
**审核对象:** `phase-7-review-pack-v2.zip`
**结论:** 🔴 **CHANGES REQUESTED** —— Phase 7 **仍未获批准**；**Phase 8 保持 NOT STARTED**。

### v1 blocking issues —— 接受为已解决

| # | 结论 |
|---|------|
| B-01 迁移 baseline / squash 策略 | ✅ **accepted as resolved** |
| B-02 来源特定的 BookEntry 语义 | ✅ **accepted as resolved** |
| B-03 `WordExample` 逐条 provenance | ✅ **accepted as resolved** |
| B-04 非拼接式 SRS 迁移策略 | ✅ **accepted as resolved** |

### B-05 — WORD IDENTITY / BOOK ENTRY / IMPORT PIPELINE MUST BE END-TO-END CONSISTENT

v2 架构已允许 `VocabularyBookEntry` 保留来源特定语义（`sourcePos` / `sourceCefrLevel` / `sourceEntryId` /
`sourceCategory` / `sourceRank`）。但**导入 / 版本化设计仍写着** `dedupe by wordKey / keep first`
与 `no duplicate wordKey` —— 这与 Phase 7 自己已经识别出的真实来源数据**不一致**：
CEFR-J 明确把同一 headword 的不同词性当作不同条目，并可能赋予不同 CEFR 等级
（例：`record / noun / B1` 与 `record / verb / A2`）。未来的导入器**不得**因为两者都归一化为
`wordKey = "record"` 就丢弃其中一条。要求**端到端**修正，具体包括：

1. **对比最小模型**：A. 共享 `Word(headword)` + 多个 `VocabularyBookEntry` 携带来源特定 POS / 内容；
   B. `Word` 身份包含归一化 POS；C. 共享 `Word(headword)` + 轻量中间概念（如
   `WordUsage` / `WordVariant`，代表 noun vs verb 这类**教学相关用法**），`BookEntry` 指向该用法。
   **不得**引入完整 Lexeme / WordSense 本体，除非确有必要；选出对真实数据集与产品行为**仍然正确的最小模型**；
   并**用初学者能理解的方式**解释结果。
2. **导入器必须保留来源条目**：修正 manifest / 导入设计；规范化 / 去重规则**不得**合并因 POS / 等级
   等来源语义而不同的合法条目。必须显式定义：**词汇身份去重**、**来源条目身份**、
   **什么情况是真正的重复**、**什么情况是同 headword 的不同用法 / 条目**、
   以及**未来 BookEntry 需要的唯一性约束**；并**移除或限定**任何等价于
   `by-wordKey-keep-first` / `no-duplicate-wordKey` 的规则（当其作用于书内条目时）。
3. **定义内容解析**：必须明确回答"学习者在学习某个 BookEntry 时显示什么内容"
   （`record` 名词 vs 动词），至少覆盖词性、释义、音标、例句、（相关时）搭配；
   **不得**假设全局 `Word.phonetic` 永远正确（有些 headword 的发音依赖词性）；
   给出明确优先级（例如 `BookEntry / Usage 级 → 共享 Word 级`），且该模型必须被论证。
4. **定义例句作用域**：核查 `WordExample(wordId, …)` 是否需要 usage / 语境作用域
   （名词条目**不得**误显示动词例句）；对比"可选 usage / POS 作用域""关联轻量 `WordUsage`"
   "BookEntry 专属例句""仅在用法中立时共享例句"等最小方案，并选出**最简单且自洽**的设计。
5. **学习者状态后果必须显式**：v2 选择 `(userId, wordId)` 一条状态；若目标模型区分同一 headword 的
   多个用法，必须明确说明其含义（例：用户把 `record` 作为**名词**掌握后，`record` 作为**动词**
   是否自动计为已掌握）。可以保留为**有意的简化产品规则**，但必须**显式**且与
   书内进度、队列行为、重叠条目、UI 行为**一致**；若有证据表明需要用法级状态，
   对比一个轻量用法级状态模型；**不得**仅为语言学纯粹性增加复杂度。
6. **文档一致性修正**：修正 handoff 中 v2 的过时表述 —— NGSL 1.2 与 BSL 1.2 现已从第一方页面
   核实为 **Creative Commons Attribution-ShareAlike 4.0 International**，删除"NGSL 的 CC 变体仍待确认"；
   修正 CEFR-J 来源表述 —— 官方页明确允许**研究与商业用途（须正确署名）**，
   并**允许在正确引用的前提下改変出另一份词表**，因此**移除**"修改版词表条款尚未核实"的条目，
   改为准确记录第一方证据；其它法律 / 产品问题保持**明确标注为未决**。
7. **保留 v2 已接受的修正**（不得回退）：B-01 迁移 baseline / squash 修正、B-02 来源特定 BookEntry 语义、
   B-03 `WordExample` 逐条 provenance、B-04 非拼接式 SRS 迁移策略、NGSL / BSL 第一方许可证据、
   保守法律措辞、版本安全的书内进度、干净的审核包 manifest。

### 其它要求

- **审核历史**：追加 v2 历史（v1 = Changes Requested；v2 = Changes Requested；
  B-01…B-04 = accepted as resolved；B-05 = blocking）；Phase 7 保持 **In Review**，Phase 8 保持 **Not Started**；
  **不得**抹除更早的历史。
- **验证**：运行 `git status --short` / `git diff --stat` / `git diff --check`，确认
  `prisma/schema.prisma`、`prisma/migrations/**`、`src/**`、`package.json`、lockfile、生产数据**未变更**。
- **审核包**：生成 **`phase-7-review-pack-v3.zip`**（含常规审核证据与干净 manifest / 哈希校验；
  不含密钥、私有数据、数据集转储、二进制）。

---

## 修正记录（执行者，2026-09-21 v3）

> 修正范围**仅限文档**；未实现任何生产代码，未改 schema / migration / API / UI / SRS / 依赖 / 数据。

| # | 修正 | 落点 |
|---|------|------|
| **B-05-1 / 模型对比** | 在 §4.6 重写为 **A / B / C 三方案对比**（A 共享 Word + entry 携带来源语义；B Word 身份含 POS；C 共享 Word + 轻量 `WordUsage` + entry 指向 usage），**选定 C**，并给出**初学者可读的图示解释**（为什么"多一层反而更简单"）；同时保留 v2 的"不引入 WordSense"边界 | `VOCABULARY_PLATFORM_DESIGN.md` §4.2（模型表）、§4.4（触发条件）、**§4.6 重写** |
| **B-05-2 / 导入保留来源条目** | 新增**三层身份与去重判定**：`Word`（`wordKey`）/ `WordUsage`（`(wordId, posKey)`）/ `BookEntry`（`sourceEntryId` 或书内 `position`）；manifest 的 `dedupe` 拆为三层并**显式禁止** `by-wordKey-keep-first` 与 `no-duplicate-wordKey` 作用于书内条目；导入流程改为"身份解析 → 只对真重复去重 → 校验 → 幂等落库"；给出**真重复 / 非重复 / `multi` 未区分词性**的判定表与**条目层唯一约束** | `VOCABULARY_DATA_PROVENANCE.md` **§8.2.1 新增**、§8.3 manifest、§8.4 流程；`VOCABULARY_MIGRATION_STRATEGY.md` **§3.5 新增**、§2 映射表（M-1/M-2/M-3/M-11） |
| **B-05-3 / 内容解析** | 新增**内容解析规则** `BookEntry → WordUsage → Word` 逐字段回退表（词性 / 释义 / 音标 / 例句 / 搭配 / 图片），明确"回退 ≠ 拼接"、"不得回退到**另一个用法**的内容"，并以 `record` 名词 `/ˈrekɔːd/` 与动词 `/rɪˈkɔːd/` 说明**发音依赖词性** | `VOCABULARY_PLATFORM_DESIGN.md` **§4.8 新增** |
| **B-05-4 / 例句作用域** | 对比 S-1…S-4 四个最小方案，**选定 S-1**（`WordExample` 可选引用 `WordUsage`：非空 = 该用法例句，空 = 用法中立例句），给出解析式"该用法例句 ∪ 用法中立例句，按 `position`"，并说明为何不采用条目级例句 | `VOCABULARY_PLATFORM_DESIGN.md` **§4.7.5 新增**、§4.7.2 字段表 |
| **B-05-5 / 学习者状态后果** | 新增专节**显式**说明：掌握度保持"一个词一条"，因此名词条目上的掌握会让动词条目**同样显示已掌握**；逐项列出对**书内进度 / 复习队列 / 跨书重叠条目 / UI** 的影响与必须做的事；给出用法级状态（`(userId, wordUsageId)`）的**对比与触发条件**，并明确"不为语言学纯粹性提前加复杂度" | `VOCABULARY_PLATFORM_DESIGN.md` **§6.4 新增**；`DECISIONS.md` ADR-020 v3 修正 |
| **B-05-6 / 文档一致性** | 核实并更新 CEFR-J 第一方证据（研究 / 教育 / 商用可免费使用须引用；**允许改変但须正确引用**；监修参与需另行协商）并**移除**"修改版词表条款未核实"条目；修正 handoff 与 `PHASE_STATUS` 中 NGSL / BSL 许可的过时表述 | `VOCABULARY_DATA_PROVENANCE.md` §6.3、§10、§11(P-6)；`handoffs/phase-7-handoff.md`；`PHASE_STATUS.md` |
| **验证补充** | 迁移验证清单新增 **V-16**（同 headword 不同 POS 必须保留两条条目）、**V-17**（禁止按 `wordKey` 丢弃条目）、**V-18**（内容解析 / 音标作用域）、**V-19**（去重层次正确性） | `VOCABULARY_MIGRATION_STRATEGY.md` §8.2 |

**未做（明确声明）:** 未回退任何 v2 已接受修正（B-01…B-04 保持）；未把任何 ADR 标为 Accepted；
未修改任何生产代码 / schema / migration / API / UI / SRS / 依赖 / 数据；未运行构建 / 测试；
未提交、未推送。

### 修正后状态（v3）

| 项目 | 结果 |
|------|------|
| Phase 7 | 🔄 **In Review**（corrections complete, awaiting external re-review v3） |
| Phase 8 | **Not Started**（未启动） |
| ADR-019 … ADR-022 | **Proposed — Pending External Review**（未自批） |
| Review Status | ⏳ Awaiting v3 external review（v1 / v2 = Changes Requested，历史保留于本文件） |
| 审核包 | `phase-7-review-pack-v3.zip` |

---

## 外部审核记录（v3）与"产品澄清后重新打开"（2026-09-21 → 2026-09-23）

**记录方式:** 本节由执行者按**架构 / 评审渠道的结论**如实转录；**未**抹除 v1 / v2 的任何历史。

| 项目 | 结果 |
|------|------|
| v3 提交 | `phase-7-review-pack-v3.zip`（B-05 修正完成，等待 v3 复审） |
| v3 复审结论（按渠道） | **当时的阻断项（B-05）已解决**；Phase 7 未被批准为 Completed |
| 随后发生 | **产品澄清改变了核心设计前提**，因此 Phase 7 在**收尾（closeout）之前被有意重新打开**，进入 **v4 修正** |
| Phase 状态 | **In Review**（**不是** Completed / Approved）；Phase 8 = **Not Started** |

> **本地证据差异（诚实记录）。** 工作区中存在 v1 / v2 的完整审核记录与 v1 / v2 / v3 三个审核包，
> 但**不存在**本地独立的 "v3 verdict" 文件（v3 包是在等待复审时生成的）。
> 因此 v3 复审结论以**渠道结论**为准记录在此；执行者**没有**据此重写任何历史结论，
> 也没有把 v3 标为"已批准"。

### 产品澄清的实质内容（v3 → v4）

1. **学习与 SRS 的单位是「词书条目」**：产品原则是"**先选一本词书，然后学习与 SRS 作用于这本书的条目**"；
2. **不得**为了同步同一个拼写在多本书之间的状态而引入复杂度；
3. **`BookEntry` 可以包含多个目标义项 / 用法**（按该书的策划形态），
   上游数据集把同一 headword 的不同词性当作不同条目，**不**自动意味着我们要把它们拆成多张学习者可见卡片；
4. **AI 可以富化学习者可见的释义 / 内容**（因为这是我们自己的结构化数字词书），但必须带 provenance 与校验；
5. **明确拒绝**：跨书 SRS 同步 / 自动掌握传播 / 跨书状态合并 / transfer scoring / "全局熟悉度调度器"。

---

## v4 修正记录（执行者，2026-09-23）

> 范围**仅限文档**；未实现任何生产代码，未改 schema / migration / API / UI / SRS / 依赖 / 数据。

| # | 修正 | 落点 |
|---|------|------|
| **v4-1 / SRS 归属** | 状态键由 `(userId, wordId)` 改为 **`(userId, bookEntryId)`**；`LearnerWordReview` → **`LearnerEntryReview`**；换书不传播、不合并；显式列出被拒绝的五种跨书机制 | `VOCABULARY_PLATFORM_DESIGN.md` §4.1/§4.2/§5（重写）/§6.2–§6.4（重写）；`VOCABULARY_MIGRATION_STRATEGY.md` §2(M-10)/§4（重写）；`DECISIONS.md` ADR-020（v4 修正，明确"标题为历史、决定已更改"） |
| **v4-2 / 领域模型** | `WordUsage` **移除**；模型改为 `Word`（词形身份，非 SRS 归属）→ **`BookEntry`（学习单位 + SRS 归属 + 策划目标）** → 从属 `BookEntryMeaning`（1..N 目标义项，逐条来源）→ 从属 `BookEntryExample`（0..N 例句，逐条来源）；上游 N 行 → 1 条策划条目**合法**，但每条来源行必须有归属 | `VOCABULARY_PLATFORM_DESIGN.md` §4.1/§4.2/§4.4/§4.6（新增 v4 决策；旧 v3 方案保留于 §4.6b）/§4.7（例句重新定锚）/§4.8（内容解析简化）；`DECISIONS.md` ADR-019（v4 修正） |
| **v4-3 / 导入与身份** | 身份层次由"三层（含 usage）"改为"词形身份 + 来源条目身份 + 策划映射"；manifest 的 `identity` / `dedupe` / `validation` / `expected` 更新；导入流程新增"每条来源行都要有归属"与"内容富化 + 校验门"步骤 | `VOCABULARY_DATA_PROVENANCE.md` §8.2/§8.2.1（重写）/§8.3（manifest）/§8.4（流程）；`VOCABULARY_MIGRATION_STRATEGY.md` §3.5（重写） |
| **v4-4 / 来源与许可** | 数据分类由三类改为**四类**（成员资格来源 / 词汇证据 / AI 富化 / 最终策划条目）；新增**来源审批三态**与两类适配性判断（member-list vs lexical-enrichment；英文证据 vs 中文面向学习者内容）；新增 **Open English WordNet（CC BY 4.0，需双署名）** 与 **FreeDict（项目级 copyleft，逐词典待核实）** 的第一方证据；NGSL/BSL 维持 CC BY-SA 4.0；CEFR-J"允许改変须引用"已逐字核实 | `VOCABULARY_DATA_PROVENANCE.md` §2（重写）/§4.1（新增 AI 富化 provenance 与校验门）/§5/§6.3.1（新增审批口径表）/§10/§11；`DECISIONS.md` ADR-021（v4 修正） |
| **v4-5 / AI 富化政策** | 明确"允许 AI 富化学习者可见内容"，并给出流水线（证据 → 富化 → 校验门 → 版本化条目）、必填 provenance 字段与四条硬性禁止（不得伪造来源、不得作为第三方词表成员资格唯一依据、不得存 prompt / 私有数据、不得跳过校验门） | `VOCABULARY_DATA_PROVENANCE.md` §4.1；`VOCABULARY_PLATFORM_DESIGN.md` §8.14；`DECISIONS.md` ADR-021 |
| **v4-6 / 迁移策略** | 状态迁移改为"旧 `WordReview` → 按映射落到新条目"；冲突策略（禁用拼接）**保留**但**适用范围收窄**为"多旧行映射到同一条目"（现网 IELTS 池 1:1 → **预期冲突 0**，仍需只读测量）；验证清单新增 **V-20…V-24**（SRS 键 / 禁止跨书同步 / 条目多义项 / AI provenance 与校验门 / 不得伪造归属）；风险新增 R-12…R-15；未决新增 U-8…U-12 | `VOCABULARY_MIGRATION_STRATEGY.md` §3.4/§3.5/§4/§5/§8.2/§9/§10 |
| **v4-7 / 路线图拆分** | **保持** v3 结论：迁移链修复与 Books 实现应拆分（Phase 8 = 修复 / Phase 9 = Books / Phase 10 = Packs）；并说明 v4 的产品澄清**没有**削弱该理由 | `DECISIONS.md` ADR-022（v4 确认）；`VOCABULARY_MIGRATION_STRATEGY.md` §7 |

### v4 质量检查（任务书要求逐项回答）

| # | 问题 | 答案 | 落在哪 |
|---|------|------|--------|
| 1 | SRS 归属键是什么？ | **`(userId, bookEntryId)`** —— `LearnerEntryReview`，`@@unique([userId, bookEntryId])` | 设计 §6.2；迁移 §4.1；ADR-020 |
| 2 | 换书会自动同步掌握度吗？ | **不会**。不传播、不合并、不评分转移；用户可在新书自行按"已掌握" | 设计 §5.1/§5.4/§5.5；ADR-020 |
| 3 | 一个 `BookEntry` 能含多个目标义项 / 用法吗？ | **能** —— 通过 1..N 条 `BookEntryMeaning`（该书策划决定） | 设计 §4.2/§4.6.3/§4.6.5 |
| 4 | 上游分开的 POS / 义项行如何既保留又不强行拆卡？ | 每条来源行在 `BookEntryMeaning` 上有来源引用（`sourceEntryId` / `sourcePosRaw` / `sourceCefrLevel` / …）；是否拆成学习者可见条目由**该书 curation 规则**决定，并写进 manifest | 设计 §4.6.3；来源 §8.2.1/§8.3；迁移 §3.5 |
| 5 | `WordUsage` 还需要吗？ | **移除**（keep/remove/simplify 裁决 = **remove**）。原作用（跨书共享锚点、用法级状态升级路径）在 v4 的"按条目归属 + 不跨书共享"前提下**没有消费者**；若保留则必须是内部从属概念，但结论是移除 | 设计 §4.6.1/§4.6.2（旧方案保留于 §4.6b） |
| 6 | 什么来源可以进入生产导入？（**v4 时期的三态口径；已在 v5 拆分为两个正交问题，见下**） | 三态：**APPROVED FOR IMPORT** / **RESEARCH-ONLY** / **REJECTED / INSUFFICIENT EVIDENCE**；并分别判断 member-list 与 lexical-enrichment 适配性 | 来源 §2.1/§6.3.1（v5 更新） |
| 7 | 三类 provenance 如何区分？ | 现在是**四类**：成员资格来源 / 词汇证据 / AI 富化 / 最终策划条目；落点是 manifest + `Word` 共享内容标记 + `BookEntryMeaning` / `BookEntryExample` 的来源字段 | 来源 §2/§4/§4.1/§8.2 |
| 8 | AI 能富化释义吗？ | **能**（产品口径允许），但必须带 provenance 与校验状态；**不得**伪造官方来源归属 | 来源 §4.1；设计 §8.14；ADR-021 |
| 9 | 会整本复制商业出版的备考书吗？ | **不会**。商业词典 / 考试机构资料在现有证据下**不具备导入资格**（需明确授权） | 来源 §6.3.1/§7.3/§7.4 |
| 10 | 生产 Vocabulary 数据存在哪里？ | 现有 **PostgreSQL**（当前由 **Neon** 托管，经 **Prisma** 访问与迁移）；**不**引入第二个数据库 | 设计 §7.3/§8.2/§8.3/§8.4；ADR-019/021 |
| 11 | 需要 Redis / 向量库 / Python worker 吗？ | **不需要**（无当前证据）；这些仍是后续阶段的**候选**，不得为架构外观引入 | 设计 §8.9–§8.13；`MASTER_PLAN.md` 后续阶段 |
| 12 | 迁移链拆分决策仍然成立吗？ | **成立**，且 v4 的产品澄清没有削弱理由 | 迁移 §7；ADR-022（v4 确认） |
| 13 | 这个设计能在不引入 WordSense 本体或跨书同步系统的前提下实现吗？ | **能**：模型是 `Word` + `BookEntry` + 从属 `BookEntryMeaning` / `BookEntryExample`；无义项本体、无跨书同步 | 设计 §4.2/§4.6/§5.4 |
| 14 | 另一位工程师能复现每个生产 `BookEntry` 是怎么来的吗？ | **能**：manifest（上游身份 / 版本 / 许可 / 校验和 / 转换规则 / curation 规则）+ 导入运行记录 + 每条 meaning / example 的来源或生成元数据 + 校验状态 | 来源 §8.2–§8.4；迁移 §8.2（V-23/V-24） |

### 修正后状态（v4）

| 项目 | 结果 |
|------|------|
| Phase 7 | 🔄 **In Review**（v4 修正完成，等待外部复审；**未** Completed / Approved） |
| Phase 8 | **Not Started**（未启动） |
| ADR-019 … ADR-022 | **Proposed — Pending External Review**（未自批；ADR-020 的历史标题保留，决定已按 v4 更改并在正文声明） |
| Review Status | ⏳ Awaiting v4 external review（v1 / v2 记录保留；v3 结论按渠道记录；**不得**抹除任何历史） |
| 审核包 | `phase-7-review-pack-v4.zip` |

---

## 外部审核记录（v4）

**日期:** 2026-09-23
**审核对象:** `phase-7-review-pack-v4.zip`
**结论:** 🔴 **CHANGES REQUESTED** —— Phase 7 **仍未获批准**；**Phase 8 保持 NOT STARTED**。

### v4 决策 —— **接受，且不得重新打开**

审核方明确声明以下 v4 决定**已接受**，本轮修正**不得**改动：
`VocabularyBook` 是所选学习集合；`BookEntry` 是学习者可见的学习单位；
SRS 归属为 `(userId, bookEntryId)`；**不做**跨书掌握度传播 / 同步 / 转移算法；
`WordUsage` 保持移除；一个 `BookEntry` 可以包含多个策划义项 / 用法；
AI 可以在**明确 provenance + 校验**前提下富化我们自己的词书内容；
PostgreSQL 保持战略数据库、Neon 保持当前托管、Prisma 保持 TypeScript 访问 / 迁移工具；
Redis / 向量库 / Python worker / LangGraph 等对 Vocabulary Books **不是必需**；
迁移链修复与 Vocabulary Books 实现**保持分离**。

### v4 阻断项（B-06 … B-10）

| # | 阻断项 | 要求（审核方原文要点） |
|---|--------|----------------------|
| **B-06** | **稳定的 `BookEntry` 身份** | SRS 以 `bookEntryId` 为键，但条目的身份实际上依赖**可变的 `position`**，而导入 / 版本更新又被描述为"替换条目集合"——这会在词书更新时**破坏学习者的 SRS 连续性**。要求：引入**稳定的策划身份 `entryKey`**，目标不变式 `UNIQUE(bookId, entryKey)`；`position` **仅排序**、**不得**作为语义身份；导入 / 重新导入 / 更新**按 `entryKey` 协调**；**不得**盲目删除重建仍然存在的条目；新的学习单位获得新的 `entryKey`；被移除的条目可以转为 `inactive` / `superseded`，使既有 `LearnerEntryReview` 行**不被静默孤立**；**材料性的策划变更**（确实产生不同的学习单位）必须获得新的 `entryKey`；**不得**引入跨书身份 / 同步；**不**引入完整的 `VocabularyBookVersion` 表，除非确实必需（优先最小稳定方案）；并相应更新导入器 / 版本化 / 幂等性措辞 |
| **B-07** | **规范的书内内容归属** | v4 的目标模型要求"按词性的发音 / 内容"，但 `BookEntryMeaning` **实际存不下**这些；文档对"搭配属于共享 `Word` 还是书 / 义项"自相矛盾；正式词书卡片还可能**静默回退**到通用 `Word.definition`。要求把学习者可见的契约做成**内部一致**的：`BookEntry` → `BookEntryMeaning`（1..N：目标义项、翻译 / 解释、目标词性、**可选音标**、**可选有界搭配**、provenance / AI 元数据 / 校验）→ `BookEntryExample`（0..N：可绑定义项 + provenance）；`BookEntryMeaning` **从属**且**不是** SRS 归属；**不得**重新引入 `WordUsage` 或 `WordSense` 本体；**正式出版的词书学习卡片必须使用经过校验的 `BookEntryMeaning` 内容作为规范释义 / 内容**；当回退可能改变本书的策划目标时，**不得**静默回退到通用 `Word.definition` / `collocations` / `phonetic`；共享 `Word` 词法数据可以保留（身份 / 通用查询 / 策划素材），但**书内学习内容是显式的**；确保 `record` 名词 / 动词发音**真的能被目标模型表示**；并对齐所有搭配 / 音标 / 例句 / AI 富化 / 内容解析章节 |
| **B-08** | **来源资格 vs 项目导入批准** | 来源文档把 "APPROVED FOR IMPORT" 定义为"可生产"，同时又说明部分来源仍有未解决的 ShareAlike / 署名义务 —— 自相矛盾。要求把两个问题分开：① 现有来源 / 许可证据在**给定条件下**是否看起来允许设想的复用；② **本项目**是否已经**接受并落实**了那些条件，从而使生产导入获得批准。用**最简单的表示**（允许使用文档状态，**不**新增领域模型）。要求：`APPROVED FOR PRODUCTION IMPORT` 必须意味着所有材料性的项目义务**已被理解并接受**；若署名 / ShareAlike / 再分发处理仍未落实，**不得**把来源标为完全批准；保留已核实的许可事实；**不**做无依据的法律结论；在适当处保留 "not approved for production import under current evidence" 一类措辞；对**许可要求署名**的来源派生例句 / 内容，确保 provenance 能保留履行署名所需的来源记录 / 署名信息；**不**添加不必要的法律架构 |
| **B-09** | **ADR-020 的现行理由与 v4 矛盾** | ADR-020 仍保留 v1–v3 的旧理由（例如"换书后再学一遍是产品缺陷"、"按书隔离状态劣于全局状态"），**与当前 v4 决定相矛盾**。要求：把历史 v1–v3 理由**显式标注为历史 / 已被取代**；现行 v4 理由必须说明：所选词书语义是**有意的**；每本书拥有自己的 `BookEntry` SRS；**没有**隐藏的跨书同步；跨书重复出现**可以接受**；学习者可以使用**现有的知识 / 掌握按钮**（如 Mastered）；**简单与可预测的行为优先于转移逻辑**；并确保最终 Proposed ADR 只有**一个无歧义的现行决定与理由** |
| **B-10** | **Books 阶段不得破坏 / 提前实现 Packs** | 迁移策略在**全局**层面把当前 2,849 行 `Word` 映射为 2,704 个共享身份，并移除 `Word.theme` / `source` / `difficulty`，而词包成员 / 状态收敛被推迟到后面的阶段 —— 这造成**阶段边界与运行时矛盾**，因为当前 Theme / generated 功能仍依赖这些遗留字段与 `WordReview`。要求修正过渡性迁移计划：Books 阶段**只**迁移正式词书 / 当前 IELTS 词书侧所需的部分；引入 Books 侧的 `VocabularyBook` / `BookEntry` / `BookEntryMeaning` / `BookEntryExample` / `LearnerEntryReview`；**保留**当前 Theme / generated 行及其遗留运行时 / 复习行为；**保留** `Word.theme` / `source` / `difficulty` 与遗留 `WordReview` 路径，直到 Packs 收敛；把它们明确标注为**过渡 / 已弃用**而非目标架构。随后在 Packs 阶段：把 default / generated 主题成员迁移到 Pack / PackEntry；迁移 / 定义词包学习状态语义；在安全处执行剩余的跨域 `Word` 合并；**只有**在 Packs 不再依赖之后才移除遗留的 theme / source / difficulty 语义与遗留复习路径。后果：**不得**声称 Books 阶段本身必然把全部 2,849 行收敛为 2,704 个生产 `Word` 行；调整 V-15 或等价验证，使**全局 Book + Pack 去重不被过早要求**；保留共享 `Word` 身份的**长期**目标，但**增量**达成且不破坏当前冻结的词包行为；若 Books 阶段确实需要最小词包兼容迁移，必须**写明原因**并**保持行为不变**，**不得**悄悄提前实现 Packs |

### 其它要求（v4）

- 只更新受影响的 Phase 7 工件；**B-01…B-05 保持 resolved**（不得回退）；
- 把 **B-06…B-10 记录为 v4 外部评审阻断项**，并记录其 **v5 解决方式**；
- Phase 7 保持 **In Review**；ADR-019…ADR-022 保持 **Proposed**（直到外部批准 / 收尾）；
- 验证清单（见下）与生成 `phase-7-review-pack-v5.zip`。

---

## v5 修正记录（执行者，2026-09-23）

> 范围**仅限文档**；未实现任何生产代码，未改 schema / migration / API / UI / SRS / 依赖 / 数据。
> v4 已被接受的决策**未被重新打开**。

| # | 修正 | 落点 |
|---|------|------|
| **B-06 / 稳定身份** | 引入 **`entryKey`**：目标不变式 `UNIQUE(bookId, entryKey)`；`position` **仅排序**；导入**按 `entryKey` 协调**（原地更新 / 新增 / 缺失转 `inactive` / `superseded`，**不物理删除**）；只有策划上是另一个学习单位才换键；**不**引入 `VocabularyBookVersion` 表；**不**引入跨书身份；导入幂等性与报告同步更新 | 设计 §4.1 / §4.2 / §4.6.6（重写）/ §5.5 / §6.3；来源 §8.2 / §8.2.1 / §8.3 / §8.4；迁移 §2(M-1/M-11) / §3.5 / §4.1 / §4.2；`DECISIONS.md` ADR-019 v5 / ADR-021 v5 / ADR-020 当前决定第 5 条 |
| **B-07 / 内容归属** | `BookEntryMeaning` 增加 **`phonetic?`** 与 **`collocations?`**；重写内容契约为"**正式词书卡片以 `BookEntryMeaning` 为规范内容**"；**禁止隐式回退**到 `Word.definition` / `Word.phonetic` / `Word.collocations`；新增**显式 `fallbackPolicy`**（默认 `none`，白名单 + 校验 + 导入报告可见）；给出 `record` 名词 / 动词（`/ˈrekɔːd/` vs `/rɪˈkɔːd/`）的可表示示例；搭配归属统一（§4.7.4） | 设计 §4.2 / §4.7.4 / §4.8（重写）；来源 §8.2 / §8.3（`content_contract`）/ §8.4；`DECISIONS.md` ADR-019 v5 |
| **B-08 / 两个独立问题** | 把"许可适用性"与"项目导入批准"拆成两个正交的文档状态；明确 **当前没有任何来源达到 `APPROVED FOR PRODUCTION IMPORT`**（全部为 `ELIGIBLE + PENDING PROJECT DECISION`）；要求来源派生内容保留 `attributionText` / `sourceName` / `licenseName`；保留已核实的第一方许可事实与措辞纪律 | 来源 §2.1（重写）/ §4.1（署名保留）/ §6.3.1（重写为两列）/ §8.2 / §8.3 / §10；`DECISIONS.md` ADR-021 v5 |
| **B-09 / ADR-020** | ADR-020 重构为**一个现行决定 + 现行理由**（置顶）与**历史决定 / 理由（v1–v3，明确标注已被取代）**；历史内容中与 v4 相反的论断（"换书是产品缺陷"等）显式保留在历史区块内并标注**不得**作为现行引用 | `DECISIONS.md` ADR-020（结构重写） |
| **B-10 / 阶段边界** | 新增"过渡期范围"章节：Books 阶段**只迁正式词书侧**，**保留** Theme / generated 行、遗留运行时与遗留 `WordReview` 路径，遗留 `theme` / `source` / `difficulty` 标注为 transitional / deprecated；Packs 阶段才迁移成员、定义状态、执行跨域合并、移除遗留语义；**V-15 修正**为"仅正式词书侧计数"，禁止过早要求全局去重；新增验证 V-31（词包运行时回归）与风险 R-19 | 迁移 §2(M-2/M-3/M-11) / §3.5 / §4.2(B-5/B-6) / **§5.1（新增）** / §7 / §7.3 / §8.2(V-15 修正 + V-25…V-31) / §9(R-16…R-19) / §10；设计 §11；`DECISIONS.md` ADR-019 v5 / ADR-022 v5 |
| **验证补充** | 新增 V-25（`entryKey` 稳定）/ V-26（状态连续性）/ V-27（规范内容契约、无隐式回退）/ V-28（`record` 名词动词可表示）/ V-29（eligibility ≠ approval）/ V-30（署名信息可保留）/ V-31（词包遗留运行时保持可用） | 迁移 §8.2 |

### v5 质量检查（任务书要求逐项验证）

| 检查项 | 结果 |
|--------|------|
| SRS 归属引用一律为 `(userId, bookEntryId)` | ✅（设计 §4.2/§5/§6；迁移 §4.1；ADR-020 现行决定） |
| `WordUsage` 未被重新引入为目标实体 | ✅（仅出现在历史区块 §4.6b 与"已移除"说明中） |
| `BookEntry` 稳定身份不再是 `position` | ✅（`entryKey` + `UNIQUE(bookId, entryKey)`；`position` 仅排序） |
| `BookEntryMeaning` 能表示按词性音标与书内搭配 | ✅（`phonetic?` / `collocations?`；`record` 示例） |
| 正式词书释义解析无**不安全的隐式**通用回退 | ✅（规范内容 = `BookEntryMeaning`；`fallbackPolicy` 默认 `none`） |
| 来源资格与项目导入批准不再混淆 | ✅（§2.1 两个正交问题；§6.3.1 两列状态） |
| ADR-020 不再含与 v4 矛盾的**现行**理由 | ✅（历史理由被显式标注为 superseded） |
| Books 迁移保留词包遗留运行时直到 Packs 收敛 | ✅（§5.1 + V-31 + R-19） |
| 审核包 manifest 为纯 UTF-8、无控制字符、哈希与归档内容已核对 | ✅（`phase-7-review-pack-v5.zip` 的 `evidence/control-character-scan.txt` 与 `file-hash-verification.txt`） |
| 现有 Phase 7 文档验证（status / diff / check / 范围 / 链接 / 无数据集转储） | ✅（见 `evidence/validation-results.txt`） |

### 修正后状态（v5）

| 项目 | 结果 |
|------|------|
| Phase 7 | 🔄 **In Review**（v5 修正完成，等待外部复审；**未** Completed / Approved） |
| Phase 8 | **Not Started**（未启动） |
| ADR-019 … ADR-022 | **Proposed — Pending External Review**（未自批） |
| B-01…B-05 | **保持 resolved**（v5 未回退） |
| Review Status | ⏳ Awaiting v5 external review（v1 / v2 / v3 / v4 历史全部保留） |
| 审核包 | `phase-7-review-pack-v5.zip` |

---

## 外部审核记录（v5）— 最终

**日期:** 2026-09-23
**审核对象:** `phase-7-review-pack-v5.zip`
**结论:**

| 项目 | 结果 |
|------|------|
| Review Status | ✅ **Approved** |
| Blocking Issues | **None** |
| B-01 … B-10 | **全部 resolved**（B-01…B-05 保持 resolved；B-06…B-10 由 v5 解决） |
| Phase 7 Release Decision | ✅ **Approved**（由 user 下达的行政收尾命令执行） |
| 进一步的 Phase 7 设计改动 | **不需要** |

审核轨迹（完整保留，未改写）：

```
v1 Changes Requested → v2 Changes Requested（B-01…B-04 resolved；B-05 新增）
→ v3 当时阻断项 resolved → 产品澄清在收尾前重新打开
→ v4 Changes Requested（v4 架构被接受且冻结；B-06…B-10 新增）
→ v5 ✅ Approved（Blocking Issues: None）
```

### 批准时的工作树一致性项（审核判定为 **non-blocking**，已在收尾中归一化）

| # | 项 | 处理 |
|---|----|------|
| A | `VOCABULARY_PLATFORM_DESIGN.md` §11 仍使用拆分前的标签（Phase 8 = Vocabulary Books / Phase 9 = Themed Packs） | 已更新为 **Phase 8 = Migration Chain Repair & Reproducible Baseline / Phase 9 = Vocabulary Books Implementation / Phase 10 = Themed Packs Convergence**（设计含义未改） |
| B | 当前规范性摘要中仍有旧的单轴 `APPROVED FOR IMPORT` 措辞 | 已统一为**两轴**表述：许可 / 复用证据 = `ELIGIBLE` / `CONDITIONAL` / `INSUFFICIENT EVIDENCE`；**项目决定** = `APPROVED FOR PRODUCTION IMPORT` / `PENDING PROJECT DECISION` / `NOT APPROVED`。已核实许可事实未改动；历史引用保留并明确标注 |

---

## 行政收尾记录（2026-09-23）

| 项目 | 结果 |
|------|------|
| Phase 7 | ✅ **Completed / Approved**（2026-09-23，外审 v5 Approved，Blocking Issues: None） |
| Phase 8 | **Migration Chain Repair & Reproducible Baseline** — **Ready / Not Started** |
| Phase 9 | **Vocabulary Books Implementation** — **Not Started** |
| Phase 10 | **Themed Packs Convergence** — **Not Started** |
| Phase 11–16 | 原 Phase 10–15 顺延；**意图、出口条件、安全要求与评估义务全部保留** —— **Not Started** |
| ADR-019 … ADR-022 | 由本次收尾命令转为 **Accepted**（含义以 **v5** 设计为准） |
| 历史 | Phase 0–7 的已批准含义、编号与历史审核记录**未改写**；历史文档中的旧编号在明确属于历史叙述时保留 |
| 是否自批 | 否 —— Approved 由**外部评审**给出；收尾命令由用户在批准后下达 |
| 审核包 | `phase-7-review-pack-v5.zip`（收尾前的最终证据包）。注意：本次行政收尾的**已批准基线提交**是收尾的产物，不在该包内 |
