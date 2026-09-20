# Migration Plan — English Learning PWA

**日期:** 2026-07-29 (修正版)
**状态:** 定稿（基于 Phase 1 架构设计）；**Phase 7 及以后已于 2026-09-16 重新基线**

**归属:** 本文件拥有渐进迁移路径。Phase 路线图与核心原则归 `docs/refactor/MASTER_PLAN.md`，
阶段状态与批准历史归 `docs/refactor/PHASE_STATUS.md`，已接受决策归 `docs/refactor/DECISIONS.md`。

> **历史边界。** Phase 2–6 章节是**已批准的历史迁移记录**，保持原样，不因未来计划变化而改写。
> **Phase 7 及以后的迁移路径由 post-Phase-6 路线重新基线确定**
> （2026-09-16；见 `DECISIONS.md` ADR-015 / ADR-016）。

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
Phase 8  ─→  Vocabulary Books 实现（先解除迁移链前置阻塞，再演进 schema）
   │
Phase 9  ─→  Themed Packs 收敛
   │
Phase 10 ─→  可靠性、归属与架构收敛
   │
Phase 11 ─→  AI Coach 基础重构
   │
Phase 12 ─→  Agentic AI Coach
   │
Phase 13 ─→  生产与作品集加固
```

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
| P7-09 | **Phase 8 范围 / 拆分决策门** | 同上 | 判定「迁移链修复」与「Vocabulary Books 实现」能否安全留在同一个有界 Phase；若属可独立审核的高风险变更，必须在 Phase 8 实现开始前再次拆分路线图（复审修正 R-01） |

### 出口条件（Phase 7 → Phase 8）

Phase 7 的出口**不是**"设计文档写完"，而是一个显式的架构决策：

> Phase 7 must determine whether migration-chain repair and Vocabulary Books implementation can
> safely remain in one bounded Phase. If they are independently reviewable high-risk changes, the
> roadmap must be split again before Phase 8 implementation starts. Phase numbering is not
> protected; bounded scope and reviewability take priority.

- 若判定**可以留在同一个有界 Phase**：Phase 8 保持单阶段，但必须把迁移正确性验收纳入该阶段门禁。
- 若判定**应当拆分**：在 **Phase 8 实现开始之前**重新拆分路线图（走任务书 + 外部审核 + 用户批准），
  本次修订**不预先新增 Phase 编号**。
- 无论是否拆分，**迁移链修复 / schema 变更所在的那个已批准 Phase 必须自行通过迁移正确性验收**
  （见 `EVALUATION_BASELINE.md` 的迁移验证门），不得把首次验证推迟到 Phase 13。

### 不涉及

- ❌ 不修改 `prisma/schema.prisma`、不新增 migration
- ❌ 不创建 `VocabularyBook` / `VocabularyBookEntry` / user-scoped `WordReview`
- ❌ 不导入任何外部词表数据集
- ❌ 不修改 Words UI / API 行为

---

## Phase 8：Vocabulary Books Implementation

### 目标

在 Phase 7 已批准的设计之上，落地 **Vocabulary Books** 的生产能力。
**前置条件：** 先处置阻塞安全 schema 演进的 Prisma 迁移链问题（方向见 Phase 7 P7-07），
并建立正确的 user-scoped 词汇复习归属。
**范围门禁（复审修正 R-01）：** 本阶段只有在 Phase 7 判定"迁移链修复 + Books 实现可留在同一个
有界 Phase"之后才按单阶段执行；否则先按 Phase 7 的出口决策拆分路线图。

### 预期方向（精确 schema 与 UI 变更以未来 Phase 8 任务书 / 设计文档为准）

| # | 方向 | 说明 |
|---|------|------|
| P8-01 | 解除 Prisma 迁移链前置阻塞 | 在独立修复被验证之前，不得声称生产迁移链可用 |
| P8-02 | user-scoped 词汇复习归属 | `WordReview` 从全局单份演进为按用户归属 |
| P8-03 | 已批准的 Vocabulary Book 模型 | 只实现 Phase 7 已批准的形状 |
| P8-04 | 已批准的数据导入管线 | 只导入通过 provenance / 许可 / 质量审查的数据集 |
| P8-05 | 选书体验 | 用户可选择的词书入口 |
| P8-06 | 保持已验证的 SM-2 行为 | Phase 2 受保护基线不得放宽 |
| P8-07 | 跨词书重叠词的处理 | 同一 `Word` 出现在多本词书时的行为必须有明确语义 |
| P8-08 | **迁移正确性与可复现性验收门（本阶段内）** | 只要本阶段修复迁移链或变更 `schema.prisma` / migrations，就必须在同一阶段用真实数据库验证迁移正确性与可复现性；**不得**推迟到 Phase 13 |

---

## Phase 9：Themed Packs Convergence

### 目标

把 Themed Packs 收敛到已批准的架构，同时**保持 Default Packs 与用户创建 Custom Packs
是两种不同的产品行为**。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P9-01 | 保持 Default / Custom 产品差异 | 不把两类 pack 压成一个通用抽象 |
| P9-02 | 自定义 pack 生成迁移到已批准架构 | 当前 `words/themes/generate` 的三步内联 DeepSeek 调用是遗留直连调用 |
| P9-03 | 自定义 pack 的用户归属 | 自定义 pack 需要正确的所有权语义 |
| P9-04 | 遗留 AI 调用经已批准 AI 基础设施 | 通过 `AIClientPort`，不得在业务代码中直接 `fetch` provider |
| P9-05 | pack 进度语义 | 确定 durable progress 语义（只实现已被批准的语义） |
| P9-06 | 迁移期间保持现有功能可用 | 渐进迁移，不推倒重写 |

---

## Phase 10：Reliability, Ownership & Architecture Convergence

### 目标

处理剩余的遗留归属缺口、加深真实测试覆盖、改善 CI，并加固安全 / 授权边界。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P10-01 | 剩余 learner ownership 缺口 | 例如 `Article.readAt/favoritedAt`、`ListeningScene.playedAt`、`DailyProgress`、localStorage 偏好 |
| P10-02 | 真实数据库 / 集成 / E2E 测试 | 用隔离数据库 + Playwright，而非脚本化冒烟 |
| P10-03 | CI 加固 | 把类型检查 / 测试 / lint / build 纳入可重复的门禁 |
| P10-04 | 安全与授权边界 | 输入验证、鉴权、CORS、未配置 API Key 的 pre-flight 校验 |
| P10-05 | 有理由的遗留收敛 | 只在有真实理由时收敛遗留代码 |

### 不涉及

- ❌ 不做机会主义式的大范围重写

---

## Phase 11：AI Coach Foundation Refactor

### 目标

在引入任何高级 Agent 基础设施**之前**，先把既有 AI Coach 重构到已批准架构。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P11-01 | 明确 Application / Domain 边界 | 把业务规则与编排从 Route / 组件中分离 |
| P11-02 | durable Coach session / state 语义 | 仅在确有理由时建立 |
| P11-03 | 遗留直连模型调用迁移 | 经已批准的 `AIClientPort` 路径 |
| P11-04 | 过大的 UI / Application 职责拆分 | 按职责分解，不改变产品行为 |
| P11-05 | 保持当前 Coach 行为可用 | 重构期间行为保持；不再依赖「冻结」作为唯一保护 |

---

## Phase 12：Agentic AI Coach

### 目标

只在**产品行为确实需要动态决策**时，引入有界的 Agent 能力。

### 预期方向

| # | 方向 | 说明 |
|---|------|------|
| P12-01 | 只做真正动态的决策 | 确定性步骤继续用 Workflow |
| P12-02 | 定义有界 tools | 工具边界明确、可审核 |
| P12-03 | 先建立 Agent 评估 | 在声称"变好"之前先有度量方式 |
| P12-04 | 检索能力（若需要） | RAG / 语义检索按**自身**门槛评估（见 APP-004），**不因本阶段是 Agent 阶段而成为义务**；确定性 Workflow + 检索也是合法形态 |
| P12-05 | 互操作 / 服务边界（若需要） | MCP 与外部服务边界按**自身**门槛评估，可能**不需要 Agent** 即成立 |
| P12-06 | 保留非 Agent / 手动 Coach 体验 | 用户可见功能不依赖 Agent |

### 不涉及

- ❌ 不承诺 MCP、LangGraph、向量数据库或 fine-tuning 作为必需交付物
- ❌ 不设立网站级 / master Learning Path Agent

---

## Phase 13：Production & Portfolio Hardening

### 目标

完成生产就绪与作品集展示的最后步骤。

### 任务清单

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| P13-01 | 部署与环境配置 | `Dockerfile`, `.env.example`, `vercel.json` 等 | 根据目标平台配置部署 |
| P13-02 | 认证 / 安全 | API 路由、环境变量、CORS、身份边界 | 防止未授权访问 |
| P13-03 | 生产可观测性 | Trace / 日志的持久化或外部平台接入 | 仅在确有需要时 |
| P13-04 | 迁移完整性**复验** | `prisma/migrations/**` | 在**全新环境**上复验部署、迁移执行、备份 / 回滚与生产就绪；这是**复验**，正确性首次建立点必须早于本阶段（见 `EVALUATION_BASELINE.md` 迁移验证门） |
| P13-05 | 演示数据准备 | 种子脚本或 fixture | 方便审查者快速体验 |
| P13-06 | README 完善 | `README.md` | 项目简介、架构、快速开始 |
| P13-07 | 架构图生成 | `docs/architecture-diagram.png` | 基于 TARGET_ARCHITECTURE.md 的可视化 |
| P13-08 | 作品集说明 | `docs/portfolio/` | 项目亮点、技术决策、难点解决方案 |
| P13-09 | 面试讲解材料 | `docs/interview-guide.md` | 可口头讲解的架构要点和权衡 |
| P13-10 | 最终端到端验证 | — | 全量回归 + 真实环境验证 |

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
> 到 Phase 11–12**。冻结模块的保护语义也随之明确为"默认冻结，需当前已批准 Phase 任务书
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
