# Vocabulary 迁移策略与阶段拆分决策 — Phase 7

**日期:** 2026-09-21
**Phase:** 7 — Vocabulary Platform Design & Data Provenance
**状态:** 设计产出，**待外部评审**（Phase 7 = In Review；执行者**不**自批 Approved）
**归属:** 本文件拥有 Phase 7 的 **迁移策略设计**与 **阶段拆分决策**
（已于 2026-09-23 经外审 Approve 并由行政收尾**激活**：Phase 8 = 迁移链修复 / Phase 9 = Books /
Phase 10 = Packs；原 Phase 10–15 顺延为 Phase 11–16）。
平台设计归 `VOCABULARY_PLATFORM_DESIGN.md`；数据来源与许可归 `VOCABULARY_DATA_PROVENANCE.md`。

**本阶段性质:** **只设计，不执行**。本文件**不**修改 `prisma/schema.prisma`、**不**新增 / **不**修复 migration、
**不**对任何数据库执行迁移或写入、**不**删除任何数据。

---

## 1. 迁移原则

1. **渐进迁移**（`ARCHITECTURE_RULES.md` MIG-001）：一次只移动一个模块，迁移后保持行为一致。
2. **SM-2 行为不可放宽**：Phase 2 对 `src/lib/sm2.ts` 的 32 个表征测试是**受保护基线**；
   迁移只改变"状态属于谁"，不改变算法与返回值语义。
3. **不猜、不破坏**：数据来源不清的部分标为 unresolved，**不**在 Phase 7 / Phase 9 顺手删除。
4. **可回滚优先**：任何高风险变更（迁移链修复、唯一约束重建）都必须有备份 / 回滚方案与真实验证。
5. **迁移正确性同阶段验收**（`EVALUATION_BASELINE.md` 迁移验证门）：修复或变更迁移的那个已批准 Phase
**必须自行**通过真实数据库的迁移正确性与可复现性验收，**不得**推迟到 Phase 16。

---

## 2. 当前模型 → 目标概念（映射表，不执行）

| # | 当前（OBSERVED） | 目标概念 | 迁移动作（设计） | 风险 |
|---|-----------------|---------|-----------------|------|
| M-1 | `Word`（`source='ielts'`, `theme IS NULL`） | `Word`（词形身份）+ `VocabularyBook(slug='ielts')` + **`VocabularyBookEntry`（学习单位 / SRS 归属）** + 其 `BookEntryMeaning`（来源 / 词性 / 释义 / 音标 / 搭配） | 按 `wordKey` 归并词形身份；成员资格转为条目；**每条条目获得稳定 `entryKey`**（现网 1:1，推荐 `curated:ielts:<wordKey>`）；`partOfSpeech` 原文进入 meaning 的目标词性字段；顺序写入 `position`（**仅排序**）；内容（音标 / 搭配）**显式写入 meaning**（B-07） | 低 — 中 |
| M-2 | `Word`（`source='theme'`, `theme=X`） | **本阶段保持原样**（`Word.theme` / `source` / `difficulty` + 现有 pack 运行时）→ 在 **Phase 10（Packs）** 才迁到 `VocabularyPack` / `VocabularyPackEntry` | **B-10：不提前实现词包收敛**。当前 Theme 功能依赖这些遗留字段，Books 阶段必须保持其行为不变 | 低（前提：不碰） |
| M-3 | `Word`（`source='generated'`, `theme=X`） | **本阶段保持原样** → Phase 10 再迁到 `VocabularyPack(kind='user', ownerUserId=…)` | 用户归属需要产品决策（当前**没有** ownerUserId）；Books 阶段**不**改动用户自建词包与其遗留状态 | 低（前提：不碰） |
| M-4 | `Word.difficulty`（`IELTS` / `THEME` / `CUSTOM`） | **删除该语义**；书的 `target` / `level` 落在 `VocabularyBook` | 不迁移为难度字段（它从来不是难度） | 低 |
| M-5 | `Word.source`（`built-in` / `ielts` / `theme` / `generated`） | 内容字段来源标记 + entry / import 元数据 | 语义拆分：内容来源 → 内容字段标记；产品域 → membership | 中（需要逐字段处理） |
| M-6 | `Word.theme` | `VocabularyPack.themeKey` | 迁移到 pack；`Word` 不再带主题 | 低 |
| M-7 | `Word.phonetic` / `partOfSpeech` / `definition` | `Word` 内容字段 + **来源标记** | 逐字段标注来源（built-in / ECDICT / generated） | 中（来源需按规则推断，属 unresolved 的部分要标注） |
| M-8 | `Word.collocations`（有界文本）与 `Word.example` / `Word.exampleZh`（` ||| ` 拼接的多值） | 同上，标为 **AI 富化内容** | 搭配：保留（preserve）+ 字段级来源标记；**例句（v4 定锚）：按条拆分并迁移到 `BookEntryExample`**（属于词书条目 / 目标义项；`position` + `sourceType` + 生成元数据 + 校验状态），支持逐条替换（旧条转 `superseded`） | 中（需要拆分与来源标注，见 `VOCABULARY_PLATFORM_DESIGN.md` §4.7） |
| M-9 | `Word.imageUrl`（Wikipedia） | 同上，标为第三方内容 | 保留 + 标注来源与许可待核实（U-7） | 低 |
| M-10 | `WordReview`（`@@unique([wordId])`，全局单份） | **`LearnerEntryReview`（`@@unique([userId, bookEntryId])`）**，**仅针对正式词书（IELTS）侧** | 既有 IELTS 词行 → 书目条目（1:1，`entryKey` 稳定），状态随之迁移到对应条目；**Theme / generated 侧的既有 `WordReview` 行在 Books 阶段保持原样**（B-10），其语义在 Phase 10 处理 | **高**（生产数据归属 + 约束重建） |
| M-11 | 重复词条（同一 `wordKey` 多行） | **正式词书侧：单一 `Word`（词形身份）+ 条目 / 义项**；**词包侧：本阶段不动** | **v5 修正（B-06 / B-10）**：归并只发生在**词形身份层**，且**只对正式词书侧**执行；`BookEntry` 由**多条来源行**映射而来（N:1 合法），但每条来源行都必须有归属；**跨域（书 + 包）的全局 `Word` 合并推迟到 Phase 10**，避免破坏仍在使用遗留字段的词包运行时 | **中 — 高**（内容冲突需确定性规则；来源条目不得被吞） |
| M-12 | `ArticleVocab`（Reading 侧，`addedToReview` 全局） | 不在本策略范围 | 记录依赖（Reading 也受"无用户归属"影响） | 中（属 Phase 11 的归属收敛） |
| M-13 | `prisma/ecdict_phonetic.json`（运行时音标） | 不在本策略范围 | 记录依赖：替换数据源时 Reading 会受影响 | 中 |

---

## 3. 重复词条与身份归并（迁移中风险最高的部分）

### 3.1 已核实的数据现实（OBSERVED（仓库产物））

对 `prisma/complete_seed_data.json` 的实测统计（2026-09-21）：

| 指标 | 数值 |
|------|------|
| 总行数（IELTS 2000 + 主题 849） | **2,849** |
| 去重后的不同词形（`wordKey`） | **2,704** |
| 重复行数 | **145** |
| IELTS 池与主题包**重叠**的词 | **119**（例如 accelerate / climate / compete / lecture / monitor / purchase / schedule / stress…） |
| 出现在**多个主题**中的词 | **26**（例如 hood / trunk / clutch / battery 同属 car 与 automotive；belt 同属 clothing 与 mechanical-engineering；season 同属 kitchen 与 weather；spicy 同属 kitchen 与 restaurant） |

**结论（OBSERVED + INFERENCE）:**

- **OBSERVED:** 当前数据里同一个词形在**不同池 / 不同主题**中重复出现，并且种子脚本把它们写成**不同的 `Word` 行**
  （IELTS 行 `theme=null`，主题行 `theme=X`），因此"同一词"在系统里是**多条记录**。
- **INFERENCE:** 因为 `WordReview` 的键是 `wordId`，**掌握度会被切碎**：在雅思池里掌握 `climate`，
  不会影响主题包里的 `climate` 副本（需要把它们学两遍）。
- **INFERENCE（未在生产库核实，见 U-2）:** 生产库很可能已经存在这批重复行；
  实际行数与分布必须在隔离环境用只读查询确认后才能定迁移脚本。

### 3.2 `wordKey` 归一化规则（设计）

当前词形包含多词短语与混合大小写（OBSERVED）：
`air conditioner`、`T-shirt`、`Wi-Fi`、`T/T`、`API`、`CAD`、`LiDAR`、`Conservative`、`get dressed` 等。

| 规则 | 决定 | 理由 |
|------|------|------|
| 大小写 | **归一化为小写**用于 `wordKey`；保留原始展示词形（`headword`） | `LiDAR` / `Conservative` 需要正确展示，但身份判定应大小写不敏感 |
| 首尾与内部空白 | 裁剪 + 折叠连续空白 | 数据中存在多词短语 |
| 连字符 / 撇号 / 斜杠 | **保留**（不删除） | 删除会把 `T-shirt` 与 `T shirt`、`T/T` 与 `TT` 混为一谈（ECDICT 的 `sw` 字段就做了这种激进 strip，本项目**不**采用） |
| 词形变化（复数 / 时态） | **不**在 Phase 9 做词形归并（不做 lemmatization） | 需要词形数据库与语言决策；当前没有产品需求（U-4） |

### 3.3 内容冲突的确定性规则（设计）

归并同一 `wordKey` 的多行时，内容可能不同（不同释义 / 不同例句）。推荐的**确定性**优先级：

```
1. 内联（built-in）内容          —— 人工 / 项目自有
2. 非生成的结构化内容（如 ECDICT 派生）
3. AI 生成内容（generated）      —— 只在前两者缺失时使用
```

并且：

- **所有**被舍弃的变体必须写入**导入报告**（不静默丢弃），以便评审事后回溯；
- 归并**不改变**成员资格：若 `climate` 既属雅思书又属两个主题包，归并后必须仍属这三处；
- 该规则只决定"哪条内容进入目标字段"，**不**删除任何源数据（源数据在迁移前以备份 / 导出形式保留）。

### 3.4 学习状态归并规则（设计 —— **v2 修正：禁止拼接状态**）

> **v1 外部复核 B-04（绑定）。** v1 曾建议"选一条主状态，必要时从另一条取 `nextReviewAt`"。
> 这是**错误**的：`interval` / `easiness` / `repetitions` / `lastReviewedAt` / `nextReviewAt`
> 是同一条**调度状态**的不同侧面，把不同历史的字段拼在一起会得到一个**数学上不存在**的状态。
> 没有完整的复习事件历史（`revlog` 之类的逐次记录）时，**无法**重建一个"正确的合并状态"。

> **v4 适用范围（重要）:** v4 把 SRS 状态改为**按书内条目**（`(userId, bookEntryId)`）之后，
> **跨书 / 跨集合的状态合并根本不会发生**（不同书的条目各自持有状态，见 §4 与设计文档 §5.4）。
> 因此本节规则**只在一种情形下适用**：**多条旧 `WordReview` 行被映射到同一个新条目**。
> 对现网的 IELTS 池而言，每条旧词行 → 一条书目条目（1:1），因此**预期冲突数为 0**（仍需在迁移前只读测量确认）。
> 这条例程**必须保留**，因为它是"绝不允许合成非法状态"的硬性不变式。

**不变式（硬性）:**

> **绝不**通过混合多条复习记录的字段来构造**混合状态**，除非存在不变量 / 证明说明该组合是有效的。

因此重复词条的学习状态按**三种情况**分别处理（执行前必须先用**只读**查询测出各自数量）：

| 情况 | 判定 | 处理 |
|------|------|------|
| **C-0 无状态** | 被归并的重复行**都没有** `WordReview` | 归并后不产生学习状态；无需迁移 |
| **C-1 单一状态（常见）** | 重复行中**恰有一条**有 `WordReview` | 把该条**完整**状态复制到存活词条：`interval` / `easiness` / `repetitions` / `nextReviewAt` / `lastReviewedAt` / `isMastered` **全部**来自同一条记录。**不修改任何字段值** |
| **C-2 冲突（多条都有状态）** | 重复行中**两条或以上**都有 `WordReview` | **不自动合并**。标记为**迁移冲突（migration conflict）**，走下面的显式保守处置流程 |

**C-2 的处理原则（保守 + 可审计）:**

1. **先隔离、后决策。** 冲突组先导出**完整原始行**（含 id、全部字段、`createdAt` / `updatedAt`），
   产出一份**冲突报告**（每组包含哪些行、各自的完整状态、来源 `wordKey`）。
2. **默认策略（推荐）: 保留一条完整状态。** 按**确定性**规则选定一条，并**整条采用**，
   另外**不取任何字段**：

   ```
   优先级（全部基于同一条记录自身，不跨记录）:
     1. isMastered = true                       （已掌握者优先）
     2. lastReviewedAt 较新
     3. repetitions 较大
     4. interval 较大
     5. id 较小（保证确定性）
   ```

   被舍弃的状态**不删除**，而是完整保留在**导出 / 审计证据**中（见第 3 步），
   并在迁移报告中逐条列出"采用哪条、舍弃哪条"。
3. **保守备选策略（当冲突组内部严重不一致时，例如一条 `isMastered=true` 而另一条已长期逾期）:
   把存活词条重置为"全新学习"状态** —— `interval=0`、`easiness=2.5`、`repetitions=0`、
   `isMastered=false`、`nextReviewAt=今天`。
   这是一个**合法且完整的新状态**（不是两条历史的混合）：它**只**会带来"多复习一次"的代价，
   而误判为"已掌握"会带来"该学的没学"的代价。取舍理由：**宁可多复习，不可假掌握**。
4. **审计可追溯（硬性）: 在破坏性归并之前，所有原始行必须已经完整存在于
   备份 / 导出 / 审计证据中。** 导出内容至少包含：表名、全部列、行 id、导出时间、SHA-256；
   导出物**不进入仓库**（避免数据集转储），其路径与哈希写进迁移报告。
5. **冲突是门禁，不是细节。** 冲突组数量必须在迁移**执行前**测量并报告；
   若冲突数超过预先约定的阈值（建议默认 `0`，即在受控试点中若出现任何 C-2，
   先人工复核处理规则，再继续），则**暂停迁移**并请求明确决议。
6. **不得**为了"看起来更好"而把两条状态做平均 / 取极值 / 拼接 —— 这属于 §3.4 的不变式禁止项。

**为什么不能拼接（给初学者）:** SM-2 的 `interval` 是由 `repetitions` 与 `easiness` 的历史
**推导**出来的。若一条记录说"第 5 次复习、间隔 30 天"，另一条说"第 1 次复习、间隔 1 天"，
那么"取较长间隔 + 较少次数"描述的是一个**从未存在过**的学习者状态，会让调度器产生错误的后续行为。
安全做法只有两种：**整条采用**某一条真实历史，或**明确地重新开始**。

### 3.5 身份层 / 来源层 / 策划条目层的区分（**v3 新增 B-05 → v4 简化**）

> **v2 的缺陷:** v2 把"重复"当成一个概念，于是导入规则里出现了
> `by-wordKey-keep-first` 与 `no-duplicate-wordKey`。这些规则作用在书内条目上时，
> 会把合法的来源条目（`record` 名词 / 动词）当成重复丢掉。
> **v4 的进一步修正:** 既然学习单位是 `BookEntry`（v4 §5），就不需要 v3 的 `WordUsage` 中间层；
> 来源的区分由 **`BookEntryMeaning` 上的来源引用**承载，并允许**上游 N 行 → 1 条策划条目**。

| 层 | 身份键 | 去重行为 | 对本项目现网数据的含义 |
|----|-------|---------|----------------------|
| **词形身份（`Word`）** | `wordKey` | 同词形的多行来源 → 归并为**一个** `Word` | 现网 2,849 行 → **2,704 个词形身份**（145 行是同一词形的重复，见 §3.1） |
| **来源条目身份** | `sourceEntryId`，缺失时用来源顺序 | 只有**同一来源条目被导入两次**才算重复 | 现网没有来源条目 id（自造数据），迁移时以"来源顺序 / 书内位置"表达；**未来导入真实数据集时按来源 id 判定** |
| **策划条目（`BookEntry`）** | **`entryKey`（稳定策划身份，`UNIQUE(bookId, entryKey)`）** + `position`（**仅排序**）；内容由 1..N 个 `BookEntryMeaning` 组成 | **不按词形去重**；上游 N 行可映射为 1 条或 N 条策划条目；**重新导入按 `entryKey` 协调**（原地更新 / 新增 / 旧条目转 `inactive`） | 现网 2,000 条 IELTS 词 → 2,000 条书目条目（1:1），每条 1 个 meaning（携带原 `partOfSpeech`）；`entryKey` 推荐 `curated:ielts:<wordKey>` |

**迁移期必须遵守的四条:**

1. **归并只发生在词形身份层**；来源条目与策划条目**逐条保留**。
2. 现网的 145 行重复是**本项目自己造成的词形重复**（同一词同时出现在 IELTS 池与主题包、
   或出现在多个主题），因此它们归并到**同一个 `Word`**、但保留**全部 membership**。
3. 若将来导入的数据集在同一 `wordKey` 下给出**不同词性 / 不同等级**的条目，
   每一条来源行都必须在某个 `BookEntryMeaning` 上有归属（**不得**只保留一条）。
4. **是否把上游多条来源行合并为一个学习者可见条目**，是**该书策划决定**（见设计文档 §4.6.3）；
   迁移与导入都必须把这一决定记录在 manifest 的 curation 规则里。
5. **条目身份是 `entryKey`，不是 `position`（v5，B-06）**：重排（改 `position`）与内容修订
   （改释义 / 音标 / 搭配 / 例句）**不得**改变 `entryKey`；只有**策划上确实是另一个学习单位**
   （拆分 / 合并 / 语义变化）才分配新 `entryKey`，并把旧条目置为 `inactive` / `superseded`。

---

## 4. 学习状态归属迁移（`WordReview` → `LearnerEntryReview`）

### 4.1 目标形状（设计）

```
LearnerEntryReview
  id, userId, bookEntryId,          // ← v4：学习状态属于"这本书的这个条目"
                                    //    v5（B-06）：bookEntryId 的连续性由该条目的
                                    //    **稳定 entryKey** 保证（UNIQUE(bookId, entryKey)）
  interval, easiness, repetitions, nextReviewAt, lastReviewedAt, isMastered,
  createdAt, updatedAt
  @@unique([userId, bookEntryId])   // 由 @@unique([wordId])（全局单份）演进而来
  @@index([userId, nextReviewAt])   // 复习队列的查询模式
```

### 4.2 回填策略

| 步骤 | 内容 | 备注 |
|------|------|------|
| B-1 | 既有全局 `WordReview` 行归属到**过渡默认用户**（Phase 6 已建立 `DEFAULT_USER_ID = 'local-default-user'`） | 与 Phase 6 的过渡身份策略一致；**不**发明新身份 |
| B-2 | 建立**旧词 → 新条目**的映射（IELTS 池 → 雅思书条目，1:1，**由 `entryKey` 承载**），把状态落到对应条目上；若出现"多旧行 → 同一条目"，按 §3.4 的 C-0 / C-1 / C-2 处置 | 需要确定性规则与审计记录；**预期 0 冲突**，但必须实测。**映射必须记录 `entryKey`**，因为它是后续版本更新的锚点（B-06） |
| B-3 | 重建唯一约束：`UNIQUE(wordId)` → `UNIQUE(userId, bookEntryId)` | 需要可回滚的迁移脚本（先加列 → 回填 → 建新约束 → 删旧约束） |
| B-4 | 新索引 `(userId, nextReviewAt)` 支撑复习队列 | 队列查询形态来自当前 `route.ts` 的查询 |
| B-5 | **词包（主题 / generated）侧**：Books 阶段**完全不改**——保留 `Word.theme` / `source` / `difficulty`、保留 pack 运行时、保留其遗留 `WordReview` 读取路径；只**记录**映射缺口 | **B-10：不在 Books 阶段擅自决定词包状态语义**，也不删除其依赖的遗留字段；Phase 10 再处理（U-7） |
| B-6 | **过渡期双路径**：Books 侧走新模型（`LearnerEntryReview`），Packs 侧继续走遗留路径（`WordReview` 按 `wordId`） | 两条路径必须**并存且互不干扰**；迁移脚本不得删除或改写 Packs 侧仍需要的数据 |

**不可逆风险:** 约束重建与数据归并**在语义上是不可逆的**（原行被合并后无法还原唯一形状）。
因此迁移前必须有：数据库备份 / 分支快照 + 可重放的导出 + 明确回滚剧本。

### 4.3 与队列 / 统计的兼容

当前的队列查询（新词 `source='ielts' AND theme IS NULL`；复习按 `nextReviewAt <= today AND isMastered=false`）
在目标模型下应改为**按当前所选书的条目 + 该用户在这些条目上的状态**：

```
新条目 = 属于当前词书的 BookEntry，且 (userId, bookEntryId) 在 LearnerEntryReview 中不存在
复习   = 属于当前词书的 BookEntry，且存在 (userId, bookEntryId) 状态，
         nextReviewAt <= today，isMastered = false
（❌ 不合并其它词书 / 词包的条目或状态 —— v4 明确拒绝跨书同步）
```

**行为保真要求:** 在**单用户 + 单本 IELTS 书**的情况下，迁移后的队列内容应与迁移前**逐条一致**
（除随机化顺序外）。这是可写成回归测试的强约束（见 §8）。

---

## 5. 内容与成员资格的迁移分类（与来源文档一致）

| 数据族 | 分类 | 迁移动作（设计） |
|--------|------|-----------------|
| IELTS 成员资格（当前 2000 条） | **unresolved pending evidence**（倾向 replace） | 先把现状**原样**迁入 `VocabularyBook(slug='ielts')` 作为"legacy 版本"，标注来源不明；**替换**为有许可的数据集需要独立的许可证据与批准 |
| 内联词条内容 | unresolved pending evidence | 迁移并标注来源为 `built-in（来源未证明）` |
| ECDICT 派生内容 | unresolved pending evidence | 迁移并标注来源 `ECDICT-derived（上游许可未证明）` |
| DeepSeek 派生内容（搭配 / 例句） | **preserve**（v4 明确允许 AI 富化） | 搭配：迁为 `Word` 上的有界文本 + 字段级来源标记；例句：迁为 **`BookEntryExample`**（逐条 `sourceType` + `provider` / `model` / `generatorVersion` / `generatedAt` + `validationStatus`） |
| **AI 富化的学习者可见内容**（v4 新增口径） | **preserve / regenerate（允许）** | 允许 AI 参与释义简化、中文解释、例句、搭配、辨析、练习、记忆提示；但**必须**经校验门、带 provenance，且**不得**伪造"来自官方来源"的归属（来源文档 §4.1） |
| Wikipedia 图片 | unresolved pending evidence | 迁移并标注第三方来源，许可待核实 |
| 主题词包（default，20 个） | regenerate 或 migrate | 若产品认为默认包应由人工策划，则**重新策划 / 重新生成**；若保留，则标注 `generated` |
| 用户自建词包 | preserve | 迁移并补 `ownerUserId`；label / emoji 从 localStorage 迁到服务端（**需要新字段**） |

**明确的边界:** 本文件**不**决定是否替换 IELTS 词表 —— 那是需要许可证据 + 产品批准的动作。

### 5.1 过渡期范围：Books 阶段**只迁正式词书侧**，词包保持可用（**v5 新增，B-10**）

> **v4 的缺陷（B-10）。** v4 的映射表在**全局**层面写"2,849 行 → 2,704 个共享身份"，
> 并要移除 `Word.theme` / `source` / `difficulty` —— 但当前的 **Theme / generated 功能仍依赖这些字段**
> 以及遗留 `WordReview` 路径，而词包收敛被推迟到后面的阶段。这会造成**阶段边界与运行时矛盾**。

**Books 阶段（本次范围）:**

1. **只迁正式词书侧**：当前 IELTS 池（`source='ielts' AND theme IS NULL`）→
   `VocabularyBook` + `VocabularyBookEntry`（含稳定 `entryKey`）+ `BookEntryMeaning` / `BookEntryExample`
   + `LearnerEntryReview`；
2. **保留**当前 Theme / generated 行、其遗留运行时（`src/app/api/words/themes/**` 等）与遗留 `WordReview` 路径；
3. 保留 `Word.theme` / `Word.source` / `Word.difficulty` 字段，并在文档中**明确标注为过渡 / 已弃用**
   （transitional / deprecated），**不是**目标架构；
4. **不做**跨域（书 + 包）的全局 `Word` 合并；
5. **不得**声称 Books 阶段会把全部 2,849 行收敛为 2,704 个生产 `Word` 行（见 §8.2 的 V-15 修正）。

**Themed Packs 阶段（后续范围）:**

1. 把 default / generated 主题成员迁移到 `VocabularyPack` / `VocabularyPackEntry`；
2. 定义并迁移词包的学习状态语义（U-7）；
3. **在安全时**执行剩余的跨域 `Word` 身份合并；
4. **只有在词包不再依赖**遗留 `theme` / `source` / `difficulty` 与遗留 review 路径**之后**，
   才移除这些遗留语义。

**若确实需要"最小词包兼容迁移"（异常情况）:** 必须在修复 / 实现阶段的任务书中写明**为什么必须做**、
并保证**行为不变**（behavior-preserving）；**不得**借此悄悄提前实现 Phase 10。

---

## 6. 迁移链损坏：现状、风险与处置方向（**不修复**）

### 6.1 现状（OBSERVED）

| 迁移目录 | 状况 |
|---------|------|
| `20260609000001_baseline/migration.sql` | **损坏**：3060 字节，UTF-16LE BOM（`FF FE`），内容是 PowerShell 的报错输出（`--to-schema-datamodel was removed` 等），**不是 SQL**。SHA-256 前缀：`6B90BC5ACD5A94A8` |
| `20260609000002_add_published_at/migration.sql` | 合法（`ALTER TABLE "Article" ADD COLUMN "publishedAt"`） |
| `20260609000003_add_favorited_at/migration.sql` | 合法（`ALTER TABLE "Article" ADD COLUMN "favoritedAt"`） |
| `20260913000001_add_user_state_and_memory/migration.sql` | 合法（Phase 6 纯增量：建 3 表 + 索引 + 外键） |

**后果（OBSERVED + INFERENCE）:** 任何**全新环境**按顺序执行迁移都会在第一步失败，
因此"完整迁移链可复现"目前**不成立**；生产部署门禁处于 **BLOCKED**（Phase 6 已记录）。

### 6.2 处置方向（设计 —— **v2 修正：区分"A 只重建损坏 baseline"与"B 整链 squash"**）

> **v1 外部复核 B-01（绑定）。** v1 的措辞（"用 `prisma migrate diff` 从空库生成一份新的 baseline 替换损坏文件"）
> **没有**说明后续历史迁移（`20260609000002` / `...0003` / `20260913000001`）应当如何处置。
> 若只替换第一个文件而保留后续迁移，则新的 baseline 已经包含"当前 schema"的结构，
> 后续迁移会**重复创建 / 重复新增**同一结构，产生一条**非法**的迁移链。
> 本节按 Prisma ORM v7 官方文档的**两种不同语义**重写。

#### 6.2.1 官方语义基线（Prisma ORM v7，2026-09-21 访问）

| 概念 | 官方定义（摘录） | 适用场景 |
|------|-----------------|---------|
| **Baselining（基线化）** | "initializing a migration history for a database that **existed before you started using Prisma Migrate**" 且 "contains data that must be maintained (like production), which means that the database cannot be reset"；做法是把已有 `prisma/migrations` 目录删除 / 移动 / 重命名 / 归档，新建 `0_` 前缀目录，用 `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` 生成 SQL，再用 `prisma migrate resolve --applied <dir>` 标记"已应用"（该命令把目标迁移写入 `_prisma_migrations` 表并标记为 applied） | **已有数据库**要为迁移历史建立起点 |
| **Squashing（压缩历史）** | 官方给出两个场景；**生产环境场景**（"Creating a clean history in a production environment"）的前置条件是：所有迁移已应用在生产库、datamodel 与迁移历史一致；步骤是：清空 `./prisma/migrations` 目录内容 → 新建一个排序最靠前的目录（如 `000000000000_squashed_migrations`）与空 `migration.sql` → 用 `prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script > ./prisma/migrations/000000000000_squashed_migrations/migration.sql` 生成**一份**"空库 → 当前 schema"的迁移 → 用 `prisma migrate resolve --applied 000000000000_squashed_migrations` 在**已有数据库**上标记该迁移已应用 | **清空并重建迁移历史**（新环境只得到**一份** baseline） |
| 官方注意事项 | "any manually changed or added SQL in your `migration.sql` files will not be retained"（手工改动 / 追加的 SQL 在 squash 后**不会保留**）；旧文件"can get them back from version control history in a pinch"（可从版本控制历史取回） | 影响归档与证据策略 |

引用出处（本次实际访问）：

- Prisma ORM v7 · Baselining a database：`https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining`
- Prisma ORM v7 · Squashing migrations：`https://www.prisma.io/docs/orm/prisma-migrate/workflows/squashing-migrations`

> **顺带发现（证据）:** 本项目损坏的 baseline 文件内容正是 `prisma migrate diff --to-schema-datamodel` 被移除的报错
> （"`--to-schema-datamodel` was removed. Please use `--[from/to]-schema` instead."），
> 与官方 v7 语法一致 —— 说明该文件是**用已废弃参数调用**后把 PowerShell 报错直接重定向进 `migration.sql` 的产物。

#### 6.2.2 两条互斥的处置路线

**路线 A — 只重建损坏的 baseline，使它对应"当时的历史 schema 点"**

- 内容：重写 `20260609000001_baseline/migration.sql`，使其等于**引入 Prisma Migrate 之前**的数据库结构；
  后续迁移（`...0002` / `...0003` / `20260913000001`）**原样保留**并继续依次执行。
- 结果链形态：`baseline(历史结构) → 0002 → 0003 → 20260913000001 → (未来迁移)`。
- **必须先承认的证据风险:** 我们**没有**原始 baseline 的真实内容（它是报错转储），
  因此"历史 schema 点"只能**由当前 schema 反推**（当前 schema 减去后续三个迁移的效果）。
  这是**推断**，不是历史证据；必须在文档中如此标注。反推在本项目具体可行，因为后续迁移都很简单
  （两个 `Article` 列 + Phase 6 的三张表），但**仍需**用"空库执行整链 → 与 `prisma/schema.prisma` 比对为空差异"来验证。
- 适合：希望保留"迁移历史形态"、并且接受 baseline 内容为**推断重建**的情形。

**路线 B — 有意 squash 整条历史，压缩到"当前已批准 schema"的一份干净 baseline**（**推荐**）

- 内容：按官方"生产环境清空历史"步骤执行：
  1. 把现有 `prisma/migrations/` **全部**目录（含损坏的 baseline 与后续三个迁移）**移出活动迁移链**，
     放入**归档位置**（见 6.2.3）；
  2. 新建排序最靠前的单目录（如 `000000000000_squashed_migrations/`）与 `migration.sql`，
     用 `prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script` 生成
     "空库 → 当前 schema"的**唯一** baseline；
  3. 对**已存在的生产形状数据库**执行 `prisma migrate resolve --applied 000000000000_squashed_migrations`，
     把新 baseline 标记为**已应用**（不重放）；
  4. 之后所有 schema 变更都以 `migrate dev` 生成的正常迁移**追加在 baseline 之后**。
- 结果链形态：`000000000000_squashed_migrations → (未来迁移…)`。
  **新环境只会得到一份 baseline**，不会再执行任何历史步骤。
- **必须显式声明（B-01 要求）:** 被 squash 的迁移目录已**归档并从活动链中移除**；
  它们**不再**参与任何新环境的执行。
- 优点：可验证（空库可完整执行）、可复现、**不需要**发明历史内容、从根上消除"重复建表"风险。
- 代价：迁移历史的**形态**被有意改写（必须留痕，见 6.2.3）；且官方提醒手工 SQL 不会保留 ——
  本项目需在 squash 前确认各迁移文件除注释外**没有**手写 DDL（已核对：`...0002` / `...0003` 为单条 `ALTER TABLE`；
  `20260913000001` 为注释头 + 生成的建表语句，无手写语句）。

**路线 C（拒绝）— 放弃迁移链改用 `db push`**

- 理由：失去可审计的 schema 变更历史，与作品集级 "Production" 标准（`PORTFOLIO_ENGINEERING_CRITERIA.md` §3.12）冲突。

#### 6.2.3 历史证据如何保留（两条路线都必须做）

| # | 要求 | 说明 |
|---|------|------|
| H-1 | **归档损坏文件的原始字节 + SHA-256** | 损坏 baseline 的字节内容（UTF-16LE + BOM）与哈希 `6B90BC5ACD5A94A8…` 写入修复阶段的文档与审核材料；**不再**放在 `prisma/migrations/` 内 |
| H-2 | **归档被移除 / 被替换的迁移文件** | 路线 B 下，被 squash 的目录整体归档（**建议**位置：`migration-history-archive/<date>/`，具体目录由修复阶段决定；**本阶段不创建任何归档目录**），或至少在文档中记录其**逐文件 SHA-256 与内容摘要**；Git 历史本身也是证据（官方也以"版本控制历史"作为取回手段） |
| H-3 | **记录 squash 的原因与授权** | 修复阶段的提交信息与文档必须写明"因历史 baseline 损坏，经批准 squash"，并引用本策略与 ADR-022 |
| H-4 | **记录被 squash 的迁移清单** | 目录名、原 SHA-256、原用途（如"给 `Article` 加 `publishedAt`"） |
| H-5 | **说明生产库 `_prisma_migrations` 的行为** | 官方说明：squash 后生产库**仍保留**其已应用迁移的历史记录；Phase 7 不改动该表 |

#### 6.2.4 已有生产形状数据库的对齐（两条路线都要回答）

1. **先只读检查**生产库 `_prisma_migrations`：已记录哪些迁移、是否有失败记录
   （本阶段**不**连接生产库，属未决 U-2）。
2. **路线 A：** 若生产库已有全部历史记录，则只需确保重建后的 baseline 名与已记录者一致（同名目录），
   不得重复应用；若生产库缺少某条迁移，则正常 `migrate deploy` 补齐。
3. **路线 B：** 用 `prisma migrate resolve --applied 000000000000_squashed_migrations`
   把新 baseline 标记为已应用（**不重放**），随后 `migrate deploy` 只处理 baseline 之后的新迁移。
4. **回滚 / 备份：** 任何一步前先做 Neon 分支快照或备份；回滚剧本必须写明"恢复到快照"的具体操作。
5. **验收门（不变）:** 空库整链执行成功；生产形状克隆库 `migrate deploy` 后与 `prisma/schema.prisma`
   双向 `prisma migrate diff` 差异为空；可复现性（第二个空库结果一致）；证据归档。

**Phase 7 的推荐:** **路线 B**（官方 squash 语义），并在修复阶段的任务书中逐条落实 6.2.3 / 6.2.4。
若修复阶段选择路线 A，则必须显式承认 baseline 内容为**推断重建**，并同样通过上述验收门。

> **必须强调:** 以上是**设计建议**，最终内容与验收标准由**修复阶段的已批准任务书**确定；
> **Phase 7 不执行任何修复**。

---

## 7. 阶段拆分决策（**显式结论 —— 已于 2026-09-23 激活**）

### 7.1 问题

`MASTER_PLAN.md` 的 R-01 决策门要求 Phase 7 判定：

> "迁移链修复（A）"与"Vocabulary Books 实现（B）"能否安全地留在**同一个有界 Phase** 内？

### 7.2 分析

| 维度 | A. 迁移链修复 | B. Vocabulary Books 实现 |
|------|--------------|------------------------|
| 变更性质 | 交付 / 运维 + schema 历史治理 | 领域模型 + 产品功能 + 数据导入 |
| 失败模式 | **无法部署 / 迁移失败 / 数据库损坏**（影响面最大） | 功能错误、数据语义错误（影响面可控、可回滚） |
| 证据类型 | **真实数据库**上的迁移执行、schema 比对、回滚演练 | 领域单元测试、导入管线测试、UI 行为验证 |
| 审核关注点 | "这个迁移链在新环境与生产形状库上都成立吗？" | "这个模型与语义正确吗、SM-2 是否保持？" |
| 可回滚性 | 低（涉及历史与基线） | 中 — 高（功能可迭代） |
| 前置依赖 | 无（可独立进行） | **依赖 A**：不修复迁移链就无法安全演进 schema |

**结论（明确）:** **二者应拆分为两个独立可审核的阶段。**

理由：它们的高风险来源**不同**（一个是"数据库历史与部署正确性"，另一个是"领域语义与产品行为"），
需要的**证据类型不同**，并且 A **是 B 的前置**而非 B 的一部分。把它们绑在一个阶段里，
会让评审在同一份证据里同时面对两类风险，违反"有界范围 + 风险隔离"的既有原则（R-01）。

### 7.3 建议的阶段划分（**建议**，需走治理流程）

| 建议阶段 | 名称 | 内容 | 出口证据 |
|---------|------|------|---------|
| **新 Phase 8** | Migration Chain Repair & Reproducible Baseline | 处置损坏 baseline（**§6.2.2 路线 B：按官方 squash 语义压缩为一份 baseline，并归档被移除的历史**）、空库 + 生产形状克隆验证、`migrate resolve --applied` 对齐、回滚剧本；**不含**产品功能 | 空库上**单份 baseline** 可完整执行；生产形状克隆 `migrate deploy` 后双向 schema diff 为空；`_prisma_migrations` 对齐记录；归档与 SHA-256；回滚演练记录 |
| **新 Phase 9** | Vocabulary Books Implementation | **只做正式词书侧**（§5.1）：词形身份归并（书侧）、`VocabularyBook` / `BookEntry`（稳定 `entryKey`）+ 从属 `BookEntryMeaning`（含音标 / 搭配）+ `BookEntryExample`、**`LearnerEntryReview(userId, bookEntryId)`** 归属、导入管线 + manifest（含 curation 规则与 `entryKey` 规则）、AI 富化 + 校验门、选书体验；**词包字段与其遗留路径保持不变** | 领域 / 导入 / 归属测试；单用户单书队列行为保真回归；SM-2 受保护基线全绿；V-20…V-31（含 V-31 词包运行时回归） |
| **新 Phase 10** | Themed Packs Convergence | default / user packs、label / emoji 服务端化、自定义包经 `AIClientPort`、pack 进度语义；**此时**才迁移主题成员、定义词包状态、执行剩余跨域 `Word` 合并、移除遗留 `theme` / `source` / `difficulty` 与遗留 review 路径 | 词包归属与生成路径测试；跨域合并的行为保真；遗留字段移除的前置检查 |
| （顺延） | 原 Phase 10–15 | 意图、出口条件、安全要求与评估义务**全部保留**，编号 +1 顺延为 **Phase 11–16**（已于 2026-09-23 由行政收尾同步） | — |

**治理要求（必须）:**

- 本次拆分**不是**由 Phase 7 执行；它必须通过**任务书 + 外部审核 + 用户明确批准**的常规流程；
- **Phase 编号不受保护**（`MASTER_PLAN.md`：有界范围与可审核性优先于编号连续性）；
- 若用户 / 评审选择**不拆分**，则必须满足以下前提（否则应视为违反 R-01）：
  1. 在同一阶段内**同时**完成迁移链修复的**真实数据库验证**与 Books 实现，
     并分别产出可独立审核的证据包；
  2. 明确列出两者的回滚剧本与失败处置；
  3. 外部评审在结论中显式接受"两类高风险变更合并"的取舍。

**v5 补充（B-10）：拆分的另一个理由是"不要把 Packs 提前实现"。**
Books 阶段**只**引入正式词书侧的新模型，并**保留**词包当前的遗留字段（`theme` / `source` / `difficulty`）
与既有运行时 / review 路径；词包收敛（成员迁移、状态语义、跨域 `Word` 合并、遗留字段移除）
全部留到 **Phase 10**。这使每个阶段都保持**可运行、可独立审核、可回滚**（见 §5.1）。

---

## 8. 验证策略（设计；由各阶段任务书最终确定）

### 8.1 迁移链修复阶段（建议 Phase 8）

| # | 验证 | 方法 |
|---|------|------|
| V-1 | 空库完整迁移 | 在隔离数据库上从零执行全部 migration；必须成功 |
| V-2 | schema 一致性 | `prisma migrate diff` 双向比对：迁移后结构 ↔ `prisma/schema.prisma`，差异必须为空 |
| V-3 | 生产形状克隆 | 用生产数据的**脱敏克隆**验证迁移可执行、数据无损（行数、关键约束、抽样记录） |
| V-4 | 可复现性 | 同一迁移链在**第二个**空库上重复执行，结果一致（幂等 / 可重放） |
| V-5 | 回滚剧本 | 备份 / 恢复演练：明确 RPO / RTO 与操作步骤 |
| V-6 | 归档证据 | 损坏文件的字节内容 + SHA-256 作为历史证据保留在评审材料中 |

### 8.2 Vocabulary Books 阶段（建议 Phase 9）

| # | 验证 | 方法 |
|---|------|------|
| V-7 | 领域规则 | 纯函数测试（身份归一化、成员资格查询、队列组装规则） |
| V-8 | 导入管线幂等 | 同一 manifest 导入两次 → 结果一致（成员集合、顺序、计数） |
| V-9 | manifest 许可门禁 | 缺失许可字段的 manifest → **导入被拒绝**（负向测试） |
| V-10 | 成员快照 | 导入后成员集合哈希与 manifest 中的 `expected.wordlist_sha256` 一致 |
| V-11 | 归属隔离 | 用户 A 无法读到用户 B 的学习状态（`ExecutionContext.userId` 权威） |
| V-12 | **行为保真回归** | 单用户 + 单本 IELTS 书场景下，迁移前后队列**逐条一致**（顺序除外） |
| V-13 | SM-2 受保护基线 | Phase 2 的 32 个表征测试**不加放宽**仍然全绿 |
| V-14 | 重复归并审计 | 归并报告解析测试：所有被舍弃变体都被记录 |
| ~~V-15~~（**v5 修正，B-10**） | 计数校验（**仅正式词书侧**） | 断言 IELTS 池的 2,000 条词行 → 2,000 条书目条目（1:1，`entryKey` 稳定）+ 全部成员资格；**不得**在 Books 阶段要求"2,849 → 2,704"的跨域全局去重（那属于 Phase 10） |
| **V-16** | **同一 headword 的多条来源行都不得被丢弃**（v3 B-05 → v4） | fixture manifest：`record(n, B1)` + `record(v, A2)` → 断言两条来源行都有归属：或 2 条 `BookEntry`（各 1 meaning），或 1 条 `BookEntry` + 2 个 `BookEntryMeaning`；等级 B1 / A2 必须可查 |
| **V-17** | **禁止按 `wordKey` 丢弃来源条目 / 条目** | 负向测试：断言导入器**没有**执行 `by-wordKey-keep-first` / `no-duplicate-wordKey`；断言"来源行保留数 = 上游合法行数" |
| **V-18** | **内容解析规则**（设计文档 §4.8） | 名词条目的卡片**不得**出现只属于动词义项的例句；`record` 名词显示 `/ˈrekɔːd/`、动词显示 `/rɪˈkɔːd/`（条目 / 义项级音标优先于词级） |
| **V-19** | **去重层次正确性**（§3.5） | 同一 `(book, sourceEntryId)` → 去重并记 rejected；不同 `sourceEntryId` / 不同词性 → 全部保留 |
| **V-20**（v4） | **SRS 归属键** | 断言学习状态唯一键为 `(userId, bookEntryId)`；同一用户在两本书中的同一拼写条目各自独立（改 A 书状态**不**影响 B 书） |
| **V-21**（v4） | **禁止跨书同步** | 负向测试：断言不存在"掌握度传播 / 状态合并 / 迁移评分"的任何代码路径（换书后新书条目仍为未学习） |
| **V-22**（v4） | **一个条目可含多个目标义项** | fixture：一条 `BookEntry` + 2 个 `BookEntryMeaning`（不同词性 / 不同来源）→ 断言卡片能分别展示、且各自来源可追溯 |
| **V-23**（v4） | **AI 富化的 provenance 与校验门** | 断言 AI 生成的 meaning / example 均带 `sourceType` / provider / model / generatorVersion / generatedAt / validationStatus；未通过校验的内容**不得**进入发布态 |
| **V-24**（v4） | **不得伪造来源归属** | 负向测试：断言 AI 生成内容不会被标注为 `source-derived`，也不会被计入"第三方考试词表成员资格"的权威依据 |
| **V-25**（v5 / B-06） | **`entryKey` 稳定身份** | 重排（改 `position`）与内容修订（改释义 / 音标 / 搭配 / 例句）后，`entryKey` 集合**不变**；`UNIQUE(bookId, entryKey)` 生效；重新导入走"原地更新"路径（断言没有 delete + insert） |
| **V-26**（v5 / B-06） | **学习状态连续性** | 词书更新后，既有 `(userId, bookEntryId)` 状态仍指向**同一个学习单位**；本次未出现的旧条目 → `inactive` / `superseded`（**不**物理删除），其 `LearnerEntryReview` 行**仍在** |
| **V-27**（v5 / B-07） | **规范内容契约** | 正式词书卡片的释义 / 目标词性 / 音标 / 搭配**全部来自 `BookEntryMeaning`**；负向测试：缺失时不回退到 `Word.definition` / `Word.phonetic` / `Word.collocations`（除非 manifest 显式声明 `fallbackPolicy` 且字段在白名单内） |
| **V-28**（v5 / B-07） | **`record` 名词 / 动词可表示** | fixture：一个条目 + 两个 meaning（`n.` `/ˈrekɔːd/` 与 `v.` `/rɪˈkɔːd/`，各自搭配与来源）→ 断言卡片按义项展示正确音标 / 搭配，且不跨义项借用 |
| **V-29**（v5 / B-08） | **许可适用性 ≠ 项目批准** | 断言 manifest 的两个字段分别存在；`share_alike_decision: pending` 时 `project_approval` **不得**为 `approved-for-production-import`（负向测试） |
| **V-30**（v5 / B-08） | **署名信息可保留** | 来源派生内容带 `attributionText` / `sourceName` / `licenseName`；缺署名信息的来源派生内容在导入时被拒绝或标记 |
| **V-31**（v5 / B-10） | **词包遗留运行时保持可用** | Books 阶段验收必须在**同一环境**验证：Theme 列表 / 生成 / 删除 / 学习路径与其遗留 `WordReview` 行为**不变**（回归）；断言 Books 迁移**没有**删除 / 改写词包依赖的字段与行 |

### 8.3 迁移验证门（不可推迟）

按 `EVALUATION_BASELINE.md` 的迁移验证门：**修复迁移链 / 变更 schema 的那个已批准 Phase 必须自行**
通过上述真实数据库验收；Phase 16 只做**全新环境复验**。

---

## 9. 风险登记（设计层面）

| # | 风险 | 影响 | 缓解 |
|---|------|------|------|
| R-1 | 归并重复词条时内容冲突 | 学习者看到错误释义 | 确定性优先级（§3.3）+ 审计报告 + 抽样人工复核 |
| R-2 | 归并时丢失或**错误合并**学习状态 | 学习者进度倒退 / 得到一个历史上不存在的调度状态（严重体验问题） | §3.4 的三情况分类（C-0 / C-1 / C-2）：单状态整条复制、冲突组**整条采用**或**显式重置**；**禁止拼接字段**；迁移前全量导出 + 冲突报告 + 冲突数门禁 |
| R-3 | 唯一约束重建失败（并发写入 / 重复数据） | 迁移中断 | 迁移窗口内停止写入；先在克隆库演练；准备回滚 |
| R-4 | 生产库实际数据与本地产物不一致 | 迁移脚本基于错误假设 | 迁移前用**只读**查询核实（U-2），以生产数据为准 |
| R-5 | 成员资格来源不合规 | 产品合规风险 | 在拿到许可证据前，legacy 词书标注为 `legacy / unresolved`；替换走独立批准 |
| R-6 | 内容来源标注错误 | 后续许可审查失真 | 逐字段规则 + 明确 unresolved 标注，不猜测 |
| R-7 | Reading 侧依赖 ECDICT 音标产物 | 替换数据源会连带影响 Reading | 在替换方案的验收中包含 Reading 回归 |
| R-8 | 随机化队列（`ORDER BY RANDOM()`）导致不可测试 | 回归无法比对 | Books 阶段引入可注入的确定性顺序策略（U-5） |
| R-9 | squash 时丢失手写 SQL | 静默丢失手工改动 | squash 前逐文件核对（官方明确提示该风险）；本项目三个后续迁移已核对为生成语句，仅含注释头 |
| R-10 | C-2 冲突组数量超出预期 | 迁移中途需要人工决策 | 迁移前只读测量冲突数并报告；阈值（建议默认 0）一旦超出即**暂停**并请求决议 |
| R-11 | 归档缺失导致历史不可追溯 | 无法回答"历史迁移当时是什么" | 6.2.3 的 H-1…H-5 作为修复阶段验收项 |
| R-12（v4） | 用户在多本书里重复练习同一拼写 | 体验上"以为已掌握却又出现" | **这是 v4 有意接受的产品行为**；缓解：UI 明确显示所属词书与条目词性；用户可在新书自行按"已掌握"（§5.5） |
| R-13（v4） | 跨书统计口径不清 | 指标误导（把两本书的进度相加） | 统计口径必须显式定义（U-8）；**SRS 状态不跨书**，统计可以按 `wordKey` 去重但必须标注口径 |
| R-14（v4） | AI 富化内容质量或归属标注出错 | 合规风险 + 学习质量下降 | §4.1 的 provenance 与**校验门**；负向测试 V-23 / V-24；不得伪造官方来源 |
| R-15（v4） | 上游来源行被"策划合并"时静默丢失 | 来源不可追溯 / 许可审查失败 | §3.5 规则 3 + V-16 / V-17；导入报告必须列出合并样例 |
| R-16（v5） | `entryKey` 不稳定导致学习状态错位 | 学习者进度错位 / 丢失（最严重的体验问题之一） | §4.6.6（设计文档）与 §3.5 规则 5；V-25 / V-26；导入器按 `entryKey` 协调、禁止 delete + recreate |
| R-17（v5） | 正式词书卡片被通用 `Word` 数据"顶替" | 学习内容与本书策划目标不符（正确性问题） | §4.8 内容契约（设计文档）+ V-27；缺内容时显式缺失；`fallbackPolicy` 默认 `none` |
| R-18（v5） | 署名 / ShareAlike 义务未落实却已导入内容 | 合规风险 | §2.1 / §6.3.1（来源文档）的**两个独立问题**；V-29 / V-30；未落实则保持 `PENDING PROJECT DECISION` |
| R-19（v5） | Books 阶段破坏词包运行时 | 现有主题 / 自建词包功能回归（跨阶段事故） | B-10 的过渡期范围（§5.1）；V-31；Books 阶段不碰词包字段与其遗留 review 路径 |

---

## 10. 未决问题

| # | 未决 | 需要谁决定 |
|---|------|-----------|
| U-1 | ~~是否采纳"拆分 Phase 8"的建议~~ → **已决定并激活（2026-09-23）**：Phase 8 = 迁移链修复 / Phase 9 = Books / Phase 10 = Packs，原 Phase 10–15 顺延为 Phase 11–16 | ✅ 已完成（外部评审 + 用户批准 + 行政收尾） |
| U-2 | 生产库真实数据分布（重复行、`WordReview` 行数、主题包归属）**以及 `_prisma_migrations` 的已应用 / 失败记录** | 迁移阶段用只读查询核实（路线 A / B 的对齐方式取决于它） |
| U-3 | 用户自建词包的归属（当前无 `ownerUserId`，只有过渡默认用户） | 产品决策 + 认证路线 |
| U-4 | 是否需要词形归并（复数 / 时态视为同一词） | 产品决策（本阶段不做） |
| U-5 | 学习队列的确定性 / 随机化策略 | **Phase 9**（Books）任务书 |
| U-6 | legacy IELTS 词书是否替换、替换成哪个数据集 | 许可证据 + 产品批准 |
| U-7 | Wikipedia 图片的许可与署名处理 | 产品 / 法务 |
| U-8（v4） | 词包（Themed Packs）的学习状态语义 | Phase 10 任务书（本策略只保留原样，见 §4.2 的 B-5） |
| U-9（v4） | 跨书统计口径（是否存在"跨书去重后的总掌握数"这类指标） | 产品决策（统计 ≠ SRS 状态） |
| U-10（v4） | 各书的 curation 规则（上游 N 行 → 1 条还是 N 条策划条目）由谁定义、写在哪 | 各书的策划 / 导入规则；必须写进 manifest（§3.5 规则 4） |
| U-11（v4） | AI 富化校验门的具体规则集与版本化方式 | 后续阶段的产品 / 工程决策（本策略只要求"有校验门 + 可追溯版本"） |
| U-12（v4） | 词书版本更新后，被移除条目的状态是否清理 / 归档 | 产品决策（设计文档 U-3） |
| U-13（v5） | 各书的 `entryKey` 命名规则由谁定义、写在哪（manifest 的 `entry_key_scheme`） | 各书的策划 / 导入规则；必须写进 manifest（§3.5 规则 5） |
| U-14（v5） | 正式词书是否允许任何 `fallbackPolicy`（默认 `none`）；若允许，哪些字段可列入白名单 | 产品 / 内容决策（设计文档 §4.8 要求显式申报与校验） |
| U-15（v5） | 署名 / ShareAlike 义务的落实方式（署名文本、展示位置、是否接受 ShareAlike 对派生数据许可的影响） | 产品 / 法务 + 内容运营；**未落实前来源只能是 `PENDING PROJECT DECISION`**（来源文档 §2.1 / §6.3.1） |
| U-16（v5） | 词包侧学习状态语义与其遗留 `WordReview` 数据的处置 | Phase 10 任务书（本策略只要求 Books 阶段保持其行为不变） |

---

## 11. 相关文档

- `docs/refactor/tasks/phase-7-task.md` —— 本阶段范围权威（Part 4.13 的拆分决策要求）
- `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md` —— 领域模型与重叠词语义
- `docs/refactor/VOCABULARY_DATA_PROVENANCE.md` —— 来源、许可与导入 / 版本化设计
- `docs/refactor/MASTER_PLAN.md` —— R-01 决策门（已关闭）与 Phase 8/9/10 的现行范围
- `docs/refactor/EVALUATION_BASELINE.md` —— 迁移验证门
- `docs/refactor/PHASE_STATUS.md` —— 阶段状态（Phase 7 = In Review）
- `docs/refactor/handoffs/phase-7-handoff.md` —— 本阶段交接
