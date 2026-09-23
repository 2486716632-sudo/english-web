# Migration Plan — English Learning PWA

**日期:** 2026-07-29 (修正版)
**状态:** 定稿（基于 Phase 1 架构设计）；**Phase 7 及以后已于 2026-09-16 重新基线**。
**2026-09-20 第二次路线修订（作品集级工程要求 + 重建 Phase 11 之后路线）已于 2026-09-20
经外部评审 Approved（Blocking Issues: None）并生效**（该修订此前以提案状态送审）；
**2026-09-23 行政收尾激活阶段拆分**：原 Phase 8 拆分为 Phase 8（迁移链修复）/ Phase 9（Books），
Phase 10 = Themed Packs；原 Phase 10–15 的**意图与出口条件全部保留**，编号 +1 顺延为 **Phase 11–16**，
本文件下方章节已按新编号同步

**归属:** 本文件拥有渐进迁移路径。Phase 路线图与核心原则归 `docs/refactor/MASTER_PLAN.md`，
阶段状态与批准历史归 `docs/refactor/PHASE_STATUS.md`，已接受决策归 `docs/refactor/DECISIONS.md`。

> **历史边界。** Phase 2–6 章节是**已批准的历史迁移记录**，保持原样，不因未来计划变化而改写。
> **Phase 7 及以后的迁移路径由 post-Phase-6 路线重新基线确定**
> （2026-09-16；见 `DECISIONS.md` ADR-015 / ADR-016）。**2026-09-20 的第二次路线修订已于
> 2026-09-20 经外部评审 Approved 并生效**（此前以提案状态送审），见 `DECISIONS.md`
> ADR-017 / ADR-018（`Accepted`）与 `docs/refactor/PORTFOLIO_ENGINEERING_CRITERIA.md`
> （`生效 / Active`）。

---

## 概述

本迁移计划定义了从当前架构到目标架构（TARGET_ARCHITECTURE.md）的渐进迁移路径。迁移遵循**一次一个模块、每阶段检验**的原则，项目始终保持可运行。

---

## 迁移顺序总览

```
Phase 2  ─→  建立评估基线（针对当前代码位置的 characterization baseline）
   │
Phase 3  ─→  统一 AI Client + 首个纵向 Use Case
   │         ├─ 实现 AI Client + Provider Adapter
   │         ├─ 建立最小 Application Use Case 边界
   │         └─ 选择非冻结入口纵向迁移
   │
Phase 4  ─→  重构一条 Pipeline 样板（Reading Pipeline）
   │         ├─ 创建 Workflow
   │         ├─ 抽取 Domain
   │         └─ 验证架构模式
   │
Phase 5  ─→  Trace 与可观测性
   │
Phase 6  ─→  用户状态与记忆系统
   │
Phase 7  ─→  Vocabulary 平台设计与数据来源合规（仅证据与设计；不改 schema / 不导入数据）
   │         ├─ 审计当前 Vocabulary 实现、数据与 IELTS 中心语义
   │         ├─ 定义 Vocabulary Books 与 Themed Packs 两个独立产品域模型
   │         ├─ 候选词书数据集调研 + provenance / 许可 / 质量审查
   │         └─ 设计安全迁移策略（含 Prisma 迁移链前置阻塞的处置方向）
   │
Phase 8  ─→  迁移链修复与可复现基线（**只做迁移治理，不含产品功能**）
   │         └─ 处置损坏 baseline（路线 B：squash 为一份 baseline + 归档）+ 空库 / 克隆库验证
   │
Phase 9  ─→  Vocabulary Books 实现（在已修复的迁移链之上演进 schema）
   │
Phase 10 ─→  Themed Packs 收敛（含跨域 Word 收敛与遗留语义移除）
   │
Phase 11 ─→  可靠性、归属与评估平台收敛（评估 / 实验基础设施）
   │
Phase 12 ─→  AI Coach 基础重构（并建立确定性 Coach 评估基线）
   │
Phase 13 ─→  检索与知识工程（设计、实现并评估检索层；RAG 是否进生产由证据决定）
   │
Phase 14 ─→  Agentic AI Coach 与工具系统（相对确定性基线做对照评估）
   │
Phase 15 ─→  MCP 互操作、AgentOps 与硬化（安全边界已在 Phase 13 / 14 内建立）
   │
Phase 16 ─→  生产、基准与作品集加固
```

> **2026-09-23 行政收尾（Phase 7 → Completed / Approved）已激活阶段拆分**：
> 原 Phase 8 拆分为 **Phase 8 = 迁移链修复 / 可复现基线** 与 **Phase 9 = Vocabulary Books 实现**，
> **Phase 10 = Themed Packs 收敛**；原 Phase 10–15 的意图与出口条件**全部保留**，编号 +1 顺延为 11–16。
> 历史（Phase 2–7）记录不改写。

---

## Phase 2：建立评估基线

### 目标

在当前代码位置建立 characterization baseline，确保后续每次修改可衡量效果。**不移动业务代码，不提前创建未来 Domain 实现。**

### 任务清单

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| P2-01 | 设计评估指标框架 | 新建 `docs/refactor/EVALUATION_BASELINE.md` | 定义评估维度、指标和数据集 |
| P2-02 | 为 SM-2 算法创建表征测试 | 新建 `src/lib/__tests__/sm2.test.ts` | 测试当前 `src/lib/sm2.ts`（不移动位置） |
| P2-03 | 为 AI 调用创建评估数据集 | 新建 `tests/eval/` 目录 | 不消耗 API 额度的样本数据集 |
| P2-04 | 为关键 API 创建集成测试（mock AI） | 新建 `src/app/api/reading/__tests__/` 等 | 使用 mock 外部依赖 |
| P2-05 | 建立 CI 基础 | 更新 `package.json` scripts | 类型检查 → lint → test |
| P2-06 | 记录当前功能行为基线 | 写入 `EVALUATION_BASELINE.md` | 不继续修改 `phase-0-audit.md` |

### 不涉及

- ❌ **不移动** `src/lib/sm2.ts` 到 `src/domain/`
- ❌ **不创建** `src/domain/vocabulary/` 等未来目录
- ❌ **不创建** AI Client 实现
- ❌ **不修改** 业务代码
- ❌ **不安装** 大型测试框架（Playwright 已存在）

---

## Phase 3：统一 AI Client + 首个纵向迁移

### 目标

建立统一的 AI Client 层，并通过首个纵向迁移验证 Route → Use Case → AI Client 的完整链路。

### 任务清单

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| P3-01 | 定义 `AIClientPort` 接口 | `application/ports/ai-client.ts` | Application 层，无实现 |
| P3-02 | 定义 `AIProviderAdapter` 接口 | `infrastructure/ai/adapters/types.ts` | Adapter 模式 |
| P3-03 | 实现 `DeepSeekAdapter` | `infrastructure/ai/adapters/deepseek.ts` | 第一个 Provider |
| P3-04 | 实现结构化输出 + 解析恢复 | `infrastructure/ai/structured-output.ts` | 消除 JSON 提取重复 |
| P3-05 | 实现网络重试 + 超时 | `infrastructure/ai/retry.ts` | 指数退避 + jitter |
| P3-06 | 实现 Token 统计 + 错误映射 | `infrastructure/ai/` | — |
| P3-07 | **建立第一个 Application Use Case** | `application/use-cases/` + 对应 route.ts | 选择非冻结、低风险入口纵向迁移 |
| P3-08 | 抽取对应 Prompt | `application/prompts/` | 同步迁移 |
| P3-09 | 迁移后续 AI 调用（按优先级） | 逐个文件 | 不要求一个 Phase 内全部完成 |
| P3-10 | 冻结模块 AI 调用迁移**（需授权）** | coach, scene 路由 | 获得授权后方可执行 |

### 迁移步骤（每条 AI 调用）

```
Step 1: 抽取 Prompt → application/prompts/{domain}/{name}.prompt.ts
Step 2: 创建 Application Use Case（Route 调用入口）
Step 3: Route 只调用 Use Case（不再直接 fetch）
Step 4: Use Case 通过 AIClientPort 调用 AI
Step 5: 验证行为一致性
Step 6: 删除旧 fetch + 超时样板 + JSON 提取代码
```

### 架构规则引用

- ARCHITECTURE_RULES.md APP-001（Use Case 定义）
- ARCHITECTURE_RULES.md INFRA-001（AI Client 职责）
- ARCHITECTURE_RULES.md SO-001~SO-003（Structured Output + 重试分工）

---

## Phase 4：重构一条 Pipeline 样板（Reading）

### 目标

选择 Reading Pipeline 完整迁移到新架构，建立 Workflow 模式模板。

**选择 Reading Pipeline 的理由：**
1. 不受冻结约束
2. 包含多步 AI/DB 操作，适合展示 Workflow
3. 规模适中

### 任务清单

| # | 任务 | 涉及文件 |
|---|------|---------|
| P4-01 | 创建 `application/workflows/` | 新建目录 |
| P4-02 | 创建 `domain/reading/` Domain Service | 音标、词汇提取规则 |
| P4-03 | 创建 Reading Pipeline Workflow | `application/workflows/reading-pipeline.workflow.ts` |
| P4-04 | 抽取 Reading Prompt | `application/prompts/reading/` |
| P4-05 | 创建 Infrastructure 服务 | rss-parser + Readability 封装 |
| P4-06 | 薄化 `api/reading/` 路由 | 只留调用 Use Case |
| P4-07 | 迁移 `scripts/reading-push.ts` 共享 Use Case | 服务端和 CLI 共享逻辑 |
| P4-08 | 创建 `infrastructure/storage/` 抽象 | 文件存储 |
| P4-09 | 端到端验证 + 回归测试 | 验证行为一致 |

---

## Phase 5：Trace 与可观测性

### 目标

建立分布式 Trace 系统，使每次请求的完整调用链可追溯。
依赖：Phase 3 (AI Client) + Phase 4 (Workflow)。

| # | 任务 | 涉及文件 |
|---|------|---------|
| P5-01 | 设计 Trace ID 生成和传递方案 | 新建 `docs/telemetry.md` |
| P5-02 | 创建 Logger 基础设施 | `infrastructure/telemetry/logger.ts` |
| P5-03 | 实现逐层 Trace 传递 | AI Client + Use Case + API Route |
| P5-04 | 实现 AI 调用耗时/Token 记录 | `infrastructure/ai/` |
| P5-05 | 实现 Workflow 步骤耗时记录 | `application/workflows/` |

---

## Phase 6：用户状态与记忆系统

### 目标

引入 User 模型和跨会话状态管理，建立长期记忆系统。

| # | 任务 | 备注 |
|---|------|------|
| P6-01 | 设计 User 数据模型 | **需授权修改 schema** |
| P6-02 | 创建 `domain/user/` | User 实体、Profile |
| P6-03 | 创建用户数据迁移 | **需授权** |
| P6-04 | 为 WordReview/Article/ListeningScene 添加 userId | **需授权** |
| P6-05 | 创建 Memory domain | 记忆模型 |
| P6-06 | 清理 `DailyProgress` 表 | **需授权** |

---

## Phase 7：Vocabulary Platform Design & Data Provenance

### 目标

建立 Vocabulary 的**目标产品 / 领域设计**，并完成**数据来源合规审查**。
本阶段以**证据与设计**为主：**不做** schema 重写、**不做**多书生产功能、**不导入**任何数据集。

### 任务清单（设计 / 证据阶段）

| # | 任务 | 涉及位置 | 说明 |
|---|------|---------|------|
| P7-01 | 审计当前 Vocabulary 实现与数据 | `src/app/api/words/**`, `src/app/words/**`, `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/*.json` | 只读审计：当前单一 IELTS 池（`source='ielts' AND theme IS NULL`）+ AI 生成 theme pack（`source='generated'`）如何承载词书语义 |
| P7-02 | 定义 Vocabulary Books 目标模型 | 新建设计文档 | `Word` / `VocabularyBook` / `VocabularyBookEntry` 与用户学习状态的关系 |
| P7-03 | 定义 Themed Packs 目标模型 | 同上 | Default Packs vs 用户创建 Custom Packs；与 Books 保持独立概念，只共享词汇基础设施 |
| P7-04 | 候选词书数据集调研 | 同上 | CET-4 / CET-6、IELTS 取向、General English、Business English **仅为候选**，不构成导入批准 |
| P7-05 | 数据来源与许可审查 | 同上 | 逐数据集记录 provenance / 上游来源 / 许可与使用条件 / 转换方法 / 版本 / 质量检查 |
| P7-06 | 现有 IELTS 词库的归属映射方案 | 同上 | 现网数据的迁移映射与保真要求（不执行迁移） |
| P7-07 | 安全迁移策略前置条件 | 同上 | 记录 `prisma/migrations/20260609000001_baseline/migration.sql` 损坏历史迁移（UTF-16 PowerShell 错误转储）对 schema 演进的阻塞，以及可选的修复路径方向 |
| P7-08 | 用户学习状态归属设计 | 同上 | `WordReview`（当前 `@@unique([wordId])`，全局单份）的 user-scoped 归属方案（只设计） |
| P7-09 | **Phase 8 范围 / 拆分决策门** | 同上 | 判定「迁移链修复」与「Vocabulary Books 实现」能否安全留在同一个有界 Phase；**结果：判定为可独立审核的高风险变更 → 拆分已激活**（复审修正 R-01） |

### 出口条件（Phase 7 → Phase 8）—— **已于 2026-09-23 满足并激活**

Phase 7 的出口**不是**"设计文档写完"，而是一个显式的架构决策：

> Phase 7 must determine whether migration-chain repair and Vocabulary Books implementation can
> safely remain in one bounded Phase. If they are independently reviewable high-risk changes, the
> roadmap must be split again before Phase 8 implementation starts. Phase numbering is not
> protected; bounded scope and reviewability take priority.

- ✅ **判定结果：应当拆分。** 已在 **Phase 8 实现开始之前**完成拆分（走任务书 + 外部审核 + 用户批准 +
  2026-09-23 行政收尾）：
  **Phase 8 = Migration Chain Repair & Reproducible Baseline**（Ready / Not Started）、
  **Phase 9 = Vocabulary Books Implementation**、**Phase 10 = Themed Packs Convergence**；
  原 Phase 10–15 顺延为 **Phase 11–16**（意图与出口条件全部保留）。
- 无论是否拆分，**迁移链修复 / schema 变更所在的那个已批准 Phase 必须自行通过迁移正确性验收**
（见 `EVALUATION_BASELINE.md` 的迁移验证门），不得把首次验证推迟到 **Phase 16**。

### 不涉及

- ❌ 不修改 `prisma/schema.prisma`、不新增 migration
- ❌ 不创建 `VocabularyBook` / `VocabularyBookEntry` / user-scoped `WordReview`
- ❌ 不导入任何外部词表数据集
- ❌ 不修改 Words UI / API 行为

---

## Phase 8：Migration Chain Repair & Reproducible Baseline

### 目标

**只做迁移链修复与可复现基线**：处置损坏的历史 baseline，使任何新环境都能从零执行到当前 schema，
并让已存在的生产形状数据库能够被安全对齐。**本阶段不含任何产品功能**（Books / Packs / UI / 导入都不做）。

**前置条件：** Phase 7 Completed / Approved（2026-09-23）。
**设计输入：** `VOCABULARY_MIGRATION_STRATEGY.md` §6（含 Prisma ORM v7 baselining / squashing 官方语义与两条路线）。

### 预期方向（精确内容以未来 Phase 8 任务书为准）

| # | 方向 | 说明 |
|---|------|------|
| P8-01 | 处置损坏 baseline | 推荐**路线 B**：按官方 squash 语义把整条历史压缩为**一份**代表当前 schema 的 baseline；被移除的历史目录**归档出活动迁移链** |
| P8-02 | 历史证据保留 | 归档被 squash / 替换迁移的**逐文件 SHA-256 与内容摘要**；保留损坏文件的原始字节与哈希（`6B90BC5ACD5A94A8…`） |
| P8-03 | 空库验证 | 在隔离空库上从零执行全部迁移并成功；在第二个空库复现（可重放 / 幂等） |
| P8-04 | 生产形状克隆验证 | 在脱敏克隆库上 `migrate deploy` 后与 `prisma/schema.prisma` **双向 `migrate diff` 为空** |
| P8-05 | 基线对齐 | 对已存在的生产形状库使用 `migrate resolve --applied` 标记基线已应用（**不重放**）；核对 `_prisma_migrations` 状态 |
| P8-06 | 回滚剧本 | 前滚 / 回滚步骤（Neon 分支或备份恢复）与演练记录 |
| P8-07 | **迁移正确性验收门（本阶段内）** | 上述验证即本阶段验收门禁；**不得**推迟到 Phase 16 |

### 不涉及

- ❌ 不引入任何产品功能（Vocabulary Books 模型 / UI / 导入管线 / 选书体验）
- ❌ 不改 SRS 行为、不迁移或删除任何 Vocabulary / Review 数据
- ❌ 不提前实现 Phase 9 或 Phase 10 的工作
- ❌ 不声称部署就绪而未完成上述真实验证

---

## Phase 9：Vocabulary Books Implementation

### 目标

在 Phase 7 已批准的设计与 Phase 8 已修复的迁移链之上，落地 **Vocabulary Books** 的生产能力。
**前置条件：** Phase 8 Approved（迁移链可复现）。
**设计输入：** `VOCABULARY_PLATFORM_DESIGN.md`（v5）、`VOCABULARY_DATA_PROVENANCE.md`（v5）、
`VOCABULARY_MIGRATION_STRATEGY.md` §5.1（过渡期范围）。

### 预期方向（精确 schema 与 UI 变更以未来 Phase 9 任务书 / 设计文档为准）

| # | 方向 | 说明 |
|---|------|------|
| P9-01 | `VocabularyBook` / `BookEntry` 模型 | 条目必须有**稳定 `entryKey`**（`UNIQUE(bookId, entryKey)`）；`position` **仅排序** |
| P9-02 | 条目内容 | 从属 `BookEntryMeaning`（规范释义 / 目标词性 / 义项级音标 / 书内搭配 / 翻译 + 来源 / 校验）与 `BookEntryExample`；**禁止隐式通用回退**（`fallbackPolicy` 默认 `none`） |
| P9-03 | user-scoped 学习归属 | `LearnerEntryReview(userId, bookEntryId)`；**不做**跨书同步 / 传播 / 合并 / 迁移评分 |
| P9-04 | 已批准的数据导入管线 | 只导入通过 provenance / 许可**与项目批准**审查的数据集；manifest 记录 `entryKey` 规则、curation 规则、署名信息；按 `entryKey` 协调（不删除重建） |
| P9-05 | 选书体验 | 用户可选择的词书入口 |
| P9-06 | 保持已验证的 SM-2 行为 | Phase 2 受保护基线不得放宽 |
| P9-07 | 跨词书重叠条目语义 | 同一拼写在不同书里是**不同条目、各自独立状态**；用户可自行标记已掌握 |
| P9-08 | **过渡期范围（B-10）** | **只迁正式词书侧**；**保留** Theme / generated 行、其遗留运行时与遗留 `WordReview` 路径（标注 transitional / deprecated） |
| P9-09 | **迁移正确性与可复现性验收门（本阶段内）** | 若本阶段变更 `schema.prisma` / migrations，必须在同一阶段用真实数据库验证；**不得**推迟到 Phase 16 |

---

## Phase 10：Themed Packs Convergence

### 目标

把 Themed Packs 收敛到已批准的架构，同时**保持 Default Packs 与用户创建 Custom Packs
是两种不同的产品行为**；并在此阶段完成**跨域 `Word` 收敛**与**遗留语义移除**。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P10-01 | 保持 Default / Custom 产品差异 | 不把两类 pack 压成一个通用抽象 |
| P10-02 | 主题 / 生成成员迁移 | default / generated 成员迁移到 `VocabularyPack` / `VocabularyPackEntry` |
| P10-03 | 自定义 pack 的用户归属 | 自定义 pack 需要正确的所有权语义（`ownerUserId`） |
| P10-04 | 遗留 AI 调用经已批准 AI 基础设施 | 通过 `AIClientPort`，不得在业务代码中直接 `fetch` provider |
| P10-05 | pack 学习状态语义 | 定义并迁移词包的学习状态语义（不与书同步） |
| P10-06 | 跨域 `Word` 收敛 | 在安全时执行剩余的跨域 `Word` 身份合并（**长期目标，增量达成**） |
| P10-07 | 遗留语义移除 | **只有**在词包不再依赖之后，才移除 `Word.theme` / `source` / `difficulty` 与遗留 review 路径 |
| P10-08 | 迁移期间保持现有功能可用 | 渐进迁移，不推倒重写；行为保真回归 |

---

## Phase 11：Reliability, Ownership & Evaluation Platform Convergence

> **编号说明（2026-09-23 行政收尾）:** 本节原为 Phase 10；阶段拆分激活后顺延为 **Phase 11**。
> 任务编号前缀由 `P10-xx` 改为 **`P11-xx`**，内容与出口条件**逐条保留**。

### 目标

处理剩余的遗留归属缺口、加深真实测试覆盖、改善 CI、加固安全 / 授权边界，并建立
**项目级评估 / 实验基础设施**——使后续 Retrieval 与 Agent 阶段的可比较测量在
**工程上可行**，而不是事后补做。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P11-01 | 剩余 learner ownership 缺口 | 例如 `Article.readAt/favoritedAt`、`ListeningScene.playedAt`、`DailyProgress`、localStorage 偏好 |
| P11-02 | 真实数据库 / 集成 / E2E 测试 | 用隔离数据库 + Playwright，而非脚本化冒烟 |
| P11-03 | CI 质量门禁 | 把类型检查 / 测试 / lint / build 纳入可重复的门禁 |
| P11-04 | 安全与授权边界 | 输入验证、鉴权、CORS、未配置 API Key 的 pre-flight 校验 |
| P11-05 | 有理由的遗留架构收敛 | 只在有真实理由时收敛遗留代码 |
| P11-06 | **评估 harness 基础设施** | 可复用的 golden-set / fixture 运行器与报告约定，供后续 Phase 复用 |
| P11-07 | **golden-set / fixture 约定** | 固定评估数据集的组织、命名、版本与不变量 |
| P11-08 | **实验记录约定** | Hypothesis → Baseline → Candidate → Dataset → Metrics → Result → Limitation → Decision |
| P11-09 | **生产风格 trace / metrics 导出策略** | 在 Phase 5 已批准 Trace 之上，明确持久化 / 聚合 / 导出的**策略与边界**（具体实现按需） |
| P11-10 | **延迟 / 错误 / token / 成本测量约定** | 统一可测量的调用指标口径，供 Retrieval / Agent 对比 |

### 范围 / 拆分决策门（R-03，本阶段内）

加强后的 Phase 11（原 Phase 10）同时承担两条**互相独立的高风险工作流**：

- **A. Reliability / Ownership / Architecture convergence**（P10-01…P10-05）；
- **B. Evaluation Platform foundation**（P10-06…P10-10）。

> Phase 11 must determine whether (A) Reliability / Ownership / Architecture convergence and
> (B) Evaluation Platform foundation can safely remain one bounded Phase. If they are
> independently reviewable high-risk workstreams, the roadmap must be split before Phase 11
> implementation starts. Phase numbering is not protected; bounded scope and reviewability
> take priority.

该判定由 **Phase 11 的已批准任务书 / 外部评审**产出（本次修订不新增 Phase 编号、不预先拆分）；
若判定应拆分，则在 Phase 11 实现开始前走正常治理流程后拆分。

### 不涉及

- ❌ 不做机会主义式的大范围重写
- ❌ **不**在本阶段构建最终 Agent（本阶段的目的是让**后续 AI 实验可测量**）
- ❌ **不**在本修订中预先拆分 Phase 11（拆分由上述决策门判定）

---

## Phase 12：AI Coach Foundation Refactor

> **编号说明（2026-09-23 行政收尾）:** 本节原为 Phase 11；顺延为 **Phase 12**，
> 任务编号前缀由 `P11-xx` 改为 **`P12-xx`**，内容与出口条件**逐条保留**。

### 目标

在引入任何高级 Agent 基础设施**之前**，先把既有 AI Coach 重构到已批准架构，
并产出**确定性 Coach 评估基线**，供 Phase 13（检索）与 Phase 14（Agent）对比。
**原则不变：先重构 Coach，再 Agent 化 Coach。**

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P12-01 | 明确 Application / Domain 边界 | 把业务规则与编排从 Route / 组件中分离 |
| P12-02 | durable Coach session / state 语义 | 仅在确有理由时建立 |
| P12-03 | 遗留直连模型调用迁移 | 经已批准的 `AIClientPort` 路径 |
| P12-04 | 过大的 UI / Application 职责拆分 | 按职责分解，不改变产品行为 |
| P12-05 | 保持当前 Coach 行为可用 | 重构期间行为保持；不再依赖「冻结」作为唯一保护 |
| P12-06 | **显式 Tool 契约 / 能力边界（若有用）** | 在有意义处定义清晰的 capability 边界，供后续阶段复用 |
| P12-07 | **Coach 评估数据集 / golden set** | 建立确定性 Coach 基线数据集 |
| P12-08 | **确定性基线测量** | 产出 Phase 13 / Phase 14 可与之对比的确定性基线测量 |

### 不涉及

- ❌ Phase 12 **不得**悄悄实现完整的 Agent runtime

---

## Phase 13：Retrieval & Knowledge Engineering

> **编号说明（2026-09-23 行政收尾）:** 本节原为 Phase 12；顺延为 **Phase 13**，
> 任务编号前缀由 `P12-xx` 改为 **`P13-xx`**，内容、安全门与出口条件**逐条保留**。

### 目标

作为**独立可审核**的工程 Phase，设计、实现并**评估** AI Coach（以及潜在其它学习体验）
所需要的知识检索层。

**不预设**向量检索一定必要。必须先建立至少一个更简单的基线。

### 候选递进（按证据推进，不必全部实现）

| 阶段 | 候选 |
|------|------|
| A | 结构化 / 数据库 / 词法 / 关键词检索 |
| B | 语义 embedding 检索 |
| C | 混合检索（hybrid） |
| D | 重排（reranking） |

### 评估要求

本 Phase 必须定义评估数据集，并对适当候选做对比。指标**根据真实检索任务选择**，
而不是因为时髦。候选指标包括：Recall@K、Precision@K、MRR、nDCG、context precision、
context recall、answer groundedness / faithfulness、task usefulness、
P50 / P95 检索延迟、token 影响、可测量的金钱成本。

### 必须产出的架构决策

- 哪种检索方法胜出、为什么、其被测量的 trade-off；
- RAG 是否属于生产；
- 在哪些场景下更简单的检索仍然更优。

> **合法的负面结论。** “语义 / 向量检索对某个语料不值得其复杂度”**不是**失败的 Phase，
> 只要它由证据支持。RAG 在这里是一次严肃的工程调查 / 作品集目标；生产采纳仍由证据决定。

### 检索最小安全验收标准（R-02，本阶段内）

只要本阶段引入检索，就同时引入了新的风险，因此**检索的最小安全边界必须在同一 Phase 内建立**
（这是最小正确性 / 安全门，**不是**把 Phase 13 变成完整安全 Phase）：

- 检索到的内容被当作**不可信数据（untrusted data）**，而非系统权威（system authority）；
- 记录 **provenance / 来源元数据**；
- 定义 **prompt-injection / 间接注入边界**；
- 覆盖**恶意 / “指令式”检索内容**的测试用例；
- **检索证据与治理性 system 指令之间的隔离**（evidence vs governing instructions）。

### 不涉及

- ❌ 不预设 Agent；确定性 Workflow + 检索是合法形态
- ❌ 不因“本阶段是检索阶段”就把向量库设为强制交付物
- ❌ 不把本阶段扩展为完整安全 Phase（只建立上面这组检索最小安全门）

---

## Phase 14：Agentic AI Coach & Tool System

> **编号说明（2026-09-23 行政收尾）:** 本节原为 Phase 13；顺延为 **Phase 14**，
> 任务编号前缀由 `P13-xx` 改为 **`P14-xx`**，内容、入口门与安全要求**逐条保留**。

### 目标

只有在以下前提满足之后，才把**真正的模型驱动动态行为**引入 AI Coach：

- Coach 架构已经干净（Phase 12）；
- 已有基线评估（Phase 12）；
- 检索行为已经被理解（Phase 13）。

默认先做**有界的单一 Agent**。**不**为了架构外观引入 Multi-Agent。

### 入口门：真实动态决策需求（R-06，本阶段内）

在实现任何 Agent 之前，本阶段必须先建立：

1. 无法充分预定的**具体决策 / 路径 / 工具 / 动作选择**；
2. 为什么**确定性 Workflow 不足以**支撑该有界行为；
3. 用于对比的**确定性基线**（来自 Phase 12）。

若 AI Coach **不存在**合法的动态决策问题：**不得制造虚假的 Agent 自主性**——
要么识别另一个与产品一致的有界 Agent 用例，要么通过正常治理流程提出路线图 / 标准修订。
作品集目标**不得**凌驾于架构正确性（APP-004）之上。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P14-01 | 只做真正动态的决策 | 确定性步骤继续用 Workflow |
| P14-02 | allowlisted tool registry | 只暴露已批准的能力 |
| P14-03 | tool schemas / tool-result 处理 | 工具契约明确、可审核 |
| P14-04 | loop / stopping conditions | 明确的循环与停止条件 |
| P14-05 | retry / failure 行为 | 有界的重试与失败处理 |
| P14-06 | budgets / limits | 预算与上限（步数 / 时间 / token / 成本） |
| P14-07 | context management | 有界的上下文管理 |
| P14-08 | safe read/write 区分 | 读 / 写能力边界清晰 |
| P14-09 | 保留非 Agent / 手动 Coach 体验 | 用户可见功能不依赖 Agent |

### 评估要求

适当的指标包括：task success rate、tool-selection accuracy、tool-argument / schema validity、
unnecessary-tool-call rate、trajectory length、recovery from tool / model failure、
latency、token / cost impact。

**最重要的要求：把 Agentic Coach 行为与 Phase 12 的确定性 Coach 基线做对比。**
目标是回答：**“Agent 自主性究竟改善了什么，又让什么变差了？”**

> 若 Agent 自主性并未改善某个 workflow，就保留确定性 workflow。

### 最小 Agent / tool 安全（R-02，本阶段内）

这些最小控制**必须在 Phase 14 内建立**，**不得**推迟到 Phase 15：

- allowlisted tools（allowlist 工具注册表）；
- 权威用户身份 / **user isolation**；
- 显式 **permission** 边界；
- **read vs write** 区分；
- 实质性高风险写入 / 动作的 **confirmation / HITL**；
- 有界**预算 / 循环上限**；
- **tool 失败隔离**（failure containment）；
- 足以重建关键工具决策的 **audit / trace 钩子**。

### 不涉及

- ❌ 不承诺 Multi-Agent、LangGraph、向量数据库或 fine-tuning 作为必需交付物
- ❌ 不设立网站级 / master Learning Path Agent
- ❌ 不把上述最小 Agent / tool 安全推迟到 Phase 15

---

## Phase 15：MCP Interoperability, AgentOps & Safety

> **编号说明（2026-09-23 行政收尾）:** 本节原为 Phase 14；顺延为 **Phase 15**，内容**逐条保留**。

### 目标

作为**自有边界的独立 Phase**，展示一个**合法的 MCP 互操作边界**以及生产风格的
Agent 运行控制。

**MCP 不得仅因为内部已有函数就被引入。** 首选架构方向：

```
Application Use Cases
   ↓
多个 adapter
   ├─ Web / API
   ├─ 内部 AI Coach tool adapter
   └─ MCP adapter
```

Domain / Application 核心**不得**依赖 MCP。只暴露**刻意选定**的能力子集；
除非确有写入需求，优先安全 / 只读能力。候选示例（**具体工具不由本次修订决定**）：
vocabulary search、word details、learner-profile lookup、reading-material search、
knowledge retrieval。

### 互操作故事

MCP 必须有一个真实的互操作故事，例如：
“外部 MCP 兼容客户端可以通过标准协议复用选定的学习能力。”
**不必**为了证明 MCP 而强行拆出外部微服务；只要互操作边界真实，单进程 MCP adapter 是可接受的。

### MCP 专属与生产风格硬化（安全硬化，**不是**首次安全边界）

检索最小安全（Phase 13）与最小 Agent / tool 安全（Phase 14）已在**引入风险的同一 Phase**
内建立。本阶段**不**承担这些安全边界的首次建立，而是做 MCP 专属与生产风格硬化，例如：

- 外部客户端 / **协议授权**（external-client / protocol authorization）；
- **MCP 能力暴露策略**（capability exposure policy）；
- 传输 / 协议边界关注点；
- 更丰富的 **audit / replay / debugging**；
- **运行监控**（operational monitoring）；
- 在确有理由时的 **red-team / adversarial 硬化**；
- 跨外部互操作边界的**策略执行**（policy enforcement）。

---

## Phase 16：Production, Benchmark & Portfolio Hardening

> **编号说明（2026-09-23 行政收尾）:** 本节原为 Phase 15；顺延为 **Phase 16**，
> 任务编号前缀由 `P15-xx` 改为 **`P16-xx`**，内容与出口条件**逐条保留**。

### 目标

完成生产就绪、基准 / 实验汇总与作品集展示的最后步骤。**本阶段不是正确性第一次建立的地方**——
它校验并打包前面 Phase 已经证明的能力。

### 任务清单

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| P16-01 | 部署与环境配置 | `Dockerfile`, `.env.example`, `vercel.json` 等 | 根据目标平台配置部署 |
| P16-02 | 认证 / 授权的**生产化复验与最终加固** | API 路由、环境变量、CORS、身份边界 | 基础安全 / 授权边界由 **Phase 11** 建立；本阶段只做部署级复验与加固，**不得**成为这些基础控制的首次实现点 |
| P16-03 | CI/CD | 流水线配置 | 可重复的构建 / 测试 / 部署 |
| P16-04 | 生产可观测性 | Trace / 日志 / metrics 的持久化或外部平台接入 | 仅在确有需要时 |
| P16-05 | 迁移完整性**复验** | `prisma/migrations/**` | 在**全新环境**上复验部署、迁移执行、备份 / 回滚与生产就绪；这是**复验**，正确性首次建立点必须早于本阶段（见 `EVALUATION_BASELINE.md` 迁移验证门） |
| P16-06 | 备份 / 回滚就绪（适当处） | 运维文档 / 脚本 | 生产风险控制 |
| P16-07 | 演示 / 种子数据准备 | 种子脚本或 fixture | 方便审查者快速体验 |
| P16-08 | README 完善 | `README.md` | 项目简介、架构、快速开始 |
| P16-09 | 架构图生成 | `docs/architecture-diagram.png` | 基于 TARGET_ARCHITECTURE.md 的可视化 |
| P16-10 | 威胁 / 安全文档（适当处） | `docs/` | 记录并汇总各 Phase 已建立的安全 / 权限模型（不是首次建立） |
| P16-11 | **基准 / 实验汇总** | `docs/` | 汇总 Phase 13 / 14 / 15 的实验结论与基准表 |
| P16-12 | 作品集案例研究 + 面试指南 + demo 脚本 | `docs/portfolio/`, `docs/interview-guide.md` | 架构、trade-off、失败与测量 |
| P16-13 | 最终端到端验证 | — | 全量回归 + 真实环境验证 |

### 不涉及

- 不引入新功能
- 不修改架构
- 不移除尚未迁移的旧代码（如 `lib/` 中仍有未迁移内容）

---

## 模块迁移优先级矩阵

| 模块 | AI 调用数 | 冻结 | 复杂度 | 迁移优先级 | 理由 |
|------|----------|------|--------|-----------|------|
| AI Client + Port | — | 否 | **高** | **P0** | 所有 Phase 的基础设施依赖 |
| Reading | 2 | 否 | 中 | **P1** | 最佳 Pipeline 样板候选 |
| Listening | 1 | ⚠️ | **高** | P2 | 耦合严重但在开发中 |
| AI Assistant | 1 | 否 | 低 | P2 | 简单，可快速验证纵向迁移 |
| Words / Vocabulary | 2 | ⚠️ | 中 | **P1（见下方说明）** | 需授权；`WordReview` 归属尚未 user-scoped |
| Coach | 2 | ⚠️ | 中 | P4 | 见下方说明：不再以"永久冻结"表达 |
| Scripts | 2 | 否 | 低 | P2 | 种子脚本可最后迁移 |

> **post-Phase-6 说明（2026-09-16）。** 上表的"迁移优先级"列表达的是 **Phase 1 视角的
> AI 调用迁移优先级**，它**不等于**产品优先级。产品优先级已重新基线：
> **Vocabulary 是下一个产品优先级（Phase 7–9）**，而 **AI Coach 的 Agentic 工作被延后
> 到 Phase 12（基础重构）/ Phase 14（Agentic）**。冻结模块的保护语义也随之明确为"默认冻结，需当前已批准 Phase 任务书
> 加用户明确授权才可限定修改"，见 `CLAUDE.md` 与 `DECISIONS.md` ADR-015。

---

## 迁移原则

1. **不推倒重写** — 文件逐步迁移，新旧代码可共存
2. **先基础设施，再业务逻辑** — AI Client + Port 先于 Workflow
3. **先非冻结，后冻结** — 冻结模块等待授权
4. **边迁移边验证** — 每个迁移步骤后执行回归确认
5. **每个 Phase 独立审核** — 完成后暂停等待确认
6. **不提前实现** — 不在当前 Phase 实现后续内容

---

## 迁移风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Migration 期间功能回归 | 用户感知到错误 | 每个步骤后执行现有测试 + 手动验证 |
| AI Client 迁移导致 Prompt 行为变化 | AI 输出质量不匹配 | 保持 Prompt 内容完全一致 |
| 冻结模块无法及时迁移 | 架构碎片化 | 冻结模块标记为"待迁移" |
| 未预料到的架构缺陷 | 需调整设计 | Phase 4 Pipeline 样板验证后及时修正 |
