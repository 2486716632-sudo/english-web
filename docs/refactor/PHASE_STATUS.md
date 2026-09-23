# Phase Status

## 当前阶段

**上一个已关闭阶段：Phase 4 — ✅ Completed / Approved（2026-09-13 外部复审通过；Blocking Issues: None）**
- 审核轨迹：v1 Changes Requested → v2 Minor Changes Requested → v3 **Accepted / Approved**
- Reading 内容摄取管线现在是**已批准的参考确定性 Content Pipeline**（Use Case + Workflow + Ports + Domain 纯规则）
- 统一 AI Client（Phase 3，89 tests）与 Phase 2 受保护测试基线（95 tests）均保持不变并全绿
- 任务定义：`docs/refactor/tasks/phase-4-task.md`；设计文档：`docs/refactor/CONTENT_PIPELINE_DESIGN.md`
- 交接：`docs/refactor/handoffs/phase-4-handoff.md`；审核记录：`docs/refactor/reviews/phase-4-review.md`
- ✅ 基线已提交（`feat: establish reading content pipeline architecture`）；临时审核 ZIP 已删除
- **Phase 5 — ✅ Completed / Approved（2026-09-13 外部复审 v3 通过；Blocking Issues: None）**
  在两个已批准的参考目标上建立了应用级 Trace / 可观测性
  （Phase 3 `/api/assistant` + Phase 4 Reading 内容摄取管线）。任务定义见
  `docs/refactor/tasks/phase-5-task.md`，设计见 `docs/refactor/TRACE_DESIGN.md`，
  交接见 `docs/refactor/handoffs/phase-5-handoff.md`，审核轨迹见
  `docs/refactor/reviews/phase-5-review.md`（v1 Changes Requested → v2 Changes Requested → **v3 Approved**）
- **Phase 6 — ✅ Completed / Approved（2026-09-14 外部最终复审 v3 通过；Blocking Issues: None）**
  审核轨迹：v1 **Changes Requested**（Phase 7 Not Approved）→ v2 **Minor Changes Requested**
  （B-01–B-04 接受为已解决；新增 B-05）→ v3 **✅ Approved**（B-05 接受为已解决；
  Phase 7 Release Decision = **Approved after administrative closeout**）。完整历史见
  `docs/refactor/reviews/phase-6-review.md`。
  在 Phase 5 已批准的 `TracePort` / `ExecutionContext` / `TraceScope` 生命周期契约之上，
  引入了**持久化的用户状态 + 记忆**基础设施（`User` / `UserProfile` / `UserMemory`），
  并以已批准的 Phase 3 `POST /api/assistant` 作为唯一参考集成证明
  "身份 → 有界上下文读取 → 既有 prompt → AIClientPort"。
  已批准不变式要点：`ExecutionContext.userId` 为权威归属（B-01）；canonical profile 语义键
  保留给 User State、不得写成 Memory（B-02）；非法 `memoryKinds` 过滤绝不扩大为 select-all，
  且 Port 层 `[]` = 零结果（B-03 / B-05）；learner-context 静态处理策略位于 system 权威、
  内容仍在独立 user 数据消息内（B-04）。
  任务定义：`docs/refactor/tasks/phase-6-task.md`；设计文档：`docs/refactor/MEMORY_DESIGN.md`；
  决策：`DECISIONS.md` ADR-014；交接：`docs/refactor/handoffs/phase-6-handoff.md`；
  审核记录：`docs/refactor/reviews/phase-6-review.md`。
  ✅ 最终验证：40 files / **544 tests passed**（Phase 2 95 + Phase 3 89 + Phase 4 108 +
  Phase 5 150 + Phase 6 **102**）；受保护基线 442 全绿。
  ✅ 基线已提交（`feat: establish durable user state and memory baseline`）；临时审核 ZIP 已删除。
  Phase 7 交接规则：Phase 6 的保留键机制只覆盖 Domain 当前已知的 canonical 语义
  （`english_level` / `explanation_language` 及归一化变体）；Phase 7 的 Agent/tool 设计**不得**
  用同义 Memory 键绕过 canonical User State 所有权，修改 canonical 事实必须走 profile/state 操作。
  已知部署门禁：`prisma/migrations/20260609000001_baseline/migration.sql` 是 Phase 6 之前的
  损坏历史迁移（UTF-16 PowerShell 错误转储）；**完整迁移链的生产部署在独立修复前保持 BLOCKED**。
- **上个阶段：Phase 7 — Vocabulary Platform Design & Data Provenance — ✅ Completed / Approved（2026-09-23）**
  （v5 外部评审 **Approved，Blocking Issues: None**；B-01…B-10 全部 resolved。
  审核轨迹：v1 Changes Requested → v2 Changes Requested（B-01…B-04 resolved，B-05 新增）
  → v3 当时阻断项 resolved → 产品澄清在收尾前重新打开 → v4 Changes Requested（B-06…B-10）
  → **v5 Approved**。产出：`VOCABULARY_PLATFORM_DESIGN.md` / `VOCABULARY_DATA_PROVENANCE.md` /
  `VOCABULARY_MIGRATION_STRATEGY.md` / `handoffs/phase-7-handoff.md` /
  `reviews/phase-7-review.md`；`DECISIONS.md` 的 ADR-019–ADR-022 已由本次收尾转为 **Accepted**。
  最终设计要点：`Word` 仅词形身份 / 共享词汇内容（非 SRS 归属）；`BookEntry`（**稳定 `entryKey`**，
  `position` 仅排序）是学习单位与 **SRS 归属 `(userId, bookEntryId)`**；从属
  `BookEntryMeaning` / `BookEntryExample` 承载规范书内内容（含义项级音标与书内搭配）；
  **不**做跨书同步 / 传播 / 迁移评分；**允许**带 provenance 与校验门的 AI 富化；
  数据导入要求 documented provenance 与**项目批准**。）
- **当前阶段：Phase 8 — Migration Chain Repair & Reproducible Baseline — Ready / Not Started**
  （2026-09-23 阶段拆分激活：Phase 8 = 迁移链修复 / 可复现基线，**不含**产品功能；
  **Phase 9 = Vocabulary Books Implementation**，**Phase 10 = Themed Packs Convergence**；
  原 Phase 10–15 顺延为 Phase 11–16，意图与出口条件全部保留。见 `DECISIONS.md` ADR-022 与
  `MASTER_PLAN.md` 的 2026-09-23 收尾记录。）
  标题于 2026-09-16 路线图重新基线时更新；
  **2026-09-20 第二次路线修订（当时编号为 Phase 10–15）已于 2026-09-20 经外部评审 Approved 并生效**；
  该次修订的**意图与出口条件**在 2026-09-23 拆分激活后顺延为 **Phase 11–16**（编号变了，内容不变）。
  下方历史记录中"Phase 7 仍为 Ready / Not Started"是**当时**的事实陈述，保留不改写。）

### 路线图重新基线记录（2026-09-16，post-Phase-6 行政 / 权威规划修订）

这是一次**文档 / 治理层面的行政修订（administrative / canonical planning amendment）**，
**不是 Phase 实现**：

- **没有启动任何 Phase 7 实现。** 没有 Phase 7 任务书、没有 Phase 7 handoff、
  没有 Phase 7 review，也没有源码 / schema / migration / 依赖 / 测试变更。
- 旧的 **「Phase 7 = 学习路径 Agent」** 方向在实现开始前被**退役**；取代范围见
  `DECISIONS.md` ADR-015。历史 ADR 与历史阶段记录中的相关叙述**保留为历史证据**，不予改写。
- **网站级 / master Learning Path Agent 不会建立**（不横跨 Vocabulary / Reading /
  Listening / AI Coach 做学习路径编排）。
- **Vocabulary 成为下一个产品 / 领域优先级**（Phase 7–9）；**AI Coach 的 Agentic 工作
  被刻意延后**到独立的后继阶段（`MASTER_PLAN.md` 现行编号：**Phase 12 基础重构 / Phase 14 Agentic**；
  2026-09-23 拆分激活前为 Phase 11 / Phase 13）。
- Vocabulary Books 与 Themed Packs 是**两个不同的产品域**，只共享词汇基础设施（ADR-016）。
- 外部 Vocabulary 数据集的引入以 **provenance / 上游来源 / 许可 / 转换方法 / 版本 /
  质量检查**为前置条件（ADR-016）；CET-4 / CET-6、IELTS 取向、General English、
  Business English 目前只是 Phase 7 的**候选调研对象**，不是已批准的导入。
- 修订后的路线图归 `MASTER_PLAN.md`；迁移路径归 `MIGRATION_PLAN.md`；
  Phase 7 的详细执行任务书将在本修订经外部评审后**单独重建**。

### 第二次路线修订记录（2026-09-20，portfolio 工程成功契约 — **已批准 / 生效**）

这是一次**文档 / 治理层面的行政修订（administrative / canonical planning amendment）**，
于 **2026-09-20 经外部评审 Approved（Blocking Issues: None，R-01–R-07 已全部 resolved）**，
并由行政收尾命令生效（此前以提案状态送审）。它**不是 Phase 实现**，也不是 Phase 7 启动；
> **编号提示（2026-09-23 拆分激活后）：** 本记录下方按**当时编号（Phase 10–15）**叙述的内容，
> 其**意图、出口条件、安全要求与评估义务**现已顺延为 **Phase 11–16**；
> 现行权威编号见本文件下方的 Phase 11–16 章节与 `MASTER_PLAN.md`。

下面的 Phase 10–15 内容（**当时编号**）现为**已批准的权威路线图**：

- **前置基线。** 上一次 post-Phase-6 路线重新基线（提交
  `docs: rebaseline post-phase-6 refactor roadmap`）已提交并推送到远端，成为本次修订的
  **干净父基线**；本次修订在其之上新建独立分支。
- **成功标准升级。** “作品集级 AI 应用工程证据”成为**显式的项目成功要求**；完整契约见
  新文档 `docs/refactor/PORTFOLIO_ENGINEERING_CRITERIA.md`（`MASTER_PLAN.md` 拥有
  **执行顺序**，该文件拥有**完成时必须存在的证据**；状态为 `生效 / Active`）。
- **Phase 10 / 11 出口加强。** Phase 10 更名并扩展为
  `Reliability, Ownership & Evaluation Platform Convergence`；Phase 11 增加**确定性 Coach 评估基线**。
- **Phase 11 之后的路线重建。** 新增 Phase 12（Retrieval & Knowledge Engineering）、
  Phase 13（Agentic AI Coach & Tool System）、Phase 14（MCP Interoperability, AgentOps & Safety）；
  旧的终止阶段被加强为 Phase 15（Production, Benchmark & Portfolio Hardening）。
- **安全在引入风险的 Phase 内建立最小边界（R-02）。** Phase 12 建立检索最小安全；
  Phase 13 建立最小 Agent / tool 安全；Phase 14 只做 MCP 专属与生产风格硬化，
  **不得**成为安全边界的首次建立点。
- **决策门（R-03 / R-06）。** Phase 10 实现前有范围 / 拆分决策门；Phase 13 实现前有
  **真实动态决策需求**入口门（缺失则不得制造虚假 Agent 自主性）。
- **实验义务 ≠ 生产义务。** RAG / Agent / MCP / 向量库 / fine-tuning **仍是条件性生产采纳**；
  对其中重要的 AI 应用工程技术，路线图要求一次可测量的工程调查或有证据的工程决策，
  而不是静默跳过。允许的负面结论包括“检索不值得其复杂度”“确定性 Workflow 优于 Agent”。
- **Phase 7 状态不变。** Phase 7 仍为 **Ready / Not Started**；本次修订**没有**创建 Phase 7
  任务书、源码、schema、migration、handoff 或 review。
- **fine-tuning 门槛与 Phase 数量原则**见 `DECISIONS.md` ADR-017 / ADR-018 与
  `MASTER_PLAN.md` 的“Portfolio 工程成功契约”一节。
- **状态转换（已完成）。** 2026-09-20 的外部批准已由本次行政收尾命令把 ADR-017 / ADR-018
  从 `Proposed — Pending External Review` 转为 `Accepted`，并把
  `PORTFOLIO_ENGINEERING_CRITERIA.md` 转为 `生效 / Active`；本记录保留“先提案、后批准”的可追溯性。

### 上一阶段（Phase 3）归档

**Phase 3 — ✅ Completed / Approved（2026-09-13 外部复审通过，Blocking Issues: None）**
- Phase 2 已正式关闭（Review Status = Approved，Blocking Issues = None）；其测试与评估基线是**受保护基线（protected baseline）**
- Phase 3 目标：建立统一 AI Client 基础设施 + 唯一一条受控纵向迁移（`POST /api/assistant`）
- 任务定义：`docs/refactor/tasks/phase-3-task.md`；设计文档：`docs/refactor/AI_CLIENT_DESIGN.md`；交接：`docs/refactor/handoffs/phase-3-handoff.md`
- 审核记录：`docs/refactor/reviews/phase-3-review.md`（历史轨迹：v1 Changes Requested → 修正 → v2 **Approved**）
- 统一 AI Client 现在是**已批准的 AI 基础设施基线**；`/api/assistant` 是**已批准的参考纵向迁移**
- ✅ Git 基线问题已在本次行政收尾中解决（唯一一个基线提交，包含已批准的 Phase 2 + Phase 3 状态）
- 下一阶段：**Phase 4 — Ready / Not Started**（需用户明确批准后启动；必须先复用 Phase 2 受保护测试与 Phase 3 AI Client 测试）

---

## Phase 0：项目现状盘点

**状态:** ✅ Completed
**开始日期:** 2026-07-27
**完成日期:** 2026-07-29
**审核:** ✅ 已通过

### 产出文档
- `docs/refactor/phase-0-audit.md` — 完整项目现状审计
- `docs/refactor/handoffs/phase-0-handoff.md` — Phase 0 交接文档
- `docs/refactor/reviews/phase-0-review.md` — 外部独立审核记录

### 审计摘要
- 分析 4 大功能模块（Vocabulary / Reading / Listening / AI Coach）
- 识别 10 个独立 AI 调用文件，全部使用 DeepSeek Chat
- 发现 7 个数据模型，关键问题：无 User 模型、WordReview 无历史
- 记录 18 项技术债（P0-P3）
- 绘制当前架构图和模块依赖链
- 分析 4 条内容 Pipeline 的执行流程
- 建立运行基线（tsc ✅ / eslint ⚠️ / build ✅ / dev ✅ / DB ✅）

---

## Phase 1：设计目标架构

**状态:** ✅ Completed — Approved
**开始日期:** 2026-07-29
**完成日期:** 2026-07-29
**审核:** ✅ 外部最终复审通过

### 产出文档
- `docs/refactor/TARGET_ARCHITECTURE.md` — 目标架构完整设计（17 个章节，第二次修正版）
- `docs/refactor/ARCHITECTURE_RULES.md` — 12 类可执行的架构规则（修正版）
- `docs/refactor/MIGRATION_PLAN.md` — 渐进迁移计划（Phase 2-9，修正版）
- `docs/refactor/handoffs/phase-1-handoff.md` — Phase 1 交接文档（第二次修正版）
- `docs/refactor/tasks/phase-1-task.md` — Phase 1 任务定义
- `docs/refactor/reviews/phase-1-review.md` — 审核记录（Changes Requested + 两次修正）
- `docs/refactor/phase-1-source-changes-baseline.md` — 源码变更基线记录

### 核心决策（第二次修正）
- ADR-004: 四层架构 + Port/Adapter + Composition Root
- ADR-005: Application Use Case 为入口，Workflow 为可选内部机制
- ADR-006: Domain 纯计算原则
- ADR-007: AIClientPort 定义在 Application Layer，Infrastructure 层实现（已修正）
- ADR-008: 纯运维端点例外；轻量 Use Case 通过 Repository Port 访问 DB（已修正）
- ADR-009: Reading Pipeline 作为首个迁移样板
- ADR-010: 恢复 Phase 9（部署与作品集包装）（理由已修正）

### 修正内容（v2）
- TARGET_ARCHITECTURE.md §1 核心依赖模型：统一 Port/Adapter 表述
- DECISIONS.md ADR-007：AIClientPort 归属 Application 层
- DECISIONS.md ADR-008：轻量 Use Case 通过 Repository Port；仅运维端点直接 Prisma
- DECISIONS.md ADR-010：理由改为"Phase 1 v1 意外遗漏"
- 创建 phase-1-source-changes-baseline.md 记录 src/ 源码变更

### 禁止事项检查
- ✅ 仅修改了文档文件，未修改 `.ts`/`.tsx`/`.prisma`/`package.json`
- ✅ 未创建 AI Client 实现、Service 实现、Workflow 实现
- ✅ 未安装新依赖、未执行数据库迁移
- ✅ 未修改冻结模块
- ✅ 未提前实现 Phase 2/3/4

---

## Phase 2：建立评估基线

**状态:** ✅ Completed / Approved
**开始日期:** 2026-07-29
**完成日期:** 2026-07-29
**审核:** ✅ 最终外部审核通过（Approved，no blocking issues）
（历史轨迹：v1 Changes Requested → v3 复审 → 最终修正 → 最终外部审核通过）

### 前置条件检查
- ✅ Phase 0 已完成并通过审核
- ✅ Phase 1 已完成并通过最终复审
- ✅ Git 基线已建立（工作区干净，HEAD 8891b48）

### 产出文档
- `docs/refactor/tasks/phase-2-task.md` — Phase 2 任务定义
- `docs/refactor/EVALUATION_BASELINE.md` — 评估基线完整文档（修正版）
- `docs/refactor/TEST_STRATEGY.md` — 测试分层策略与后续使用方法（修正版）
- `docs/refactor/reviews/phase-2-review.md` — 审核记录（v1 Changes Requested → 最终外部审核 Approved）
- `docs/refactor/handoffs/phase-2-handoff.md` — Phase 2 交接文档（修正版）
- `vitest.config.ts` — Vitest 测试配置
- `src/lib/__tests__/sm2.test.ts` — SM-2 表征测试（32 tests）
- `src/lib/__tests__/utils.test.ts` — 工具函数测试（10 tests）
- `src/lib/__tests__/word-cache.test.ts` — 缓存测试（6 tests）
- `tests/eval/fixtures/ai-responses.ts` — AI 评估 fixture（33 静态 + 1 动态）
- `tests/eval/structured-output.test.ts` — 结构化输出合法性测试（35 tests）
- `tests/eval/content-quality.test.ts` — 内容质量测试（12 tests）
- `tests/smoke/api-smoke.sh` — API 冒烟脚本（支持 GET/POST + body + jq/no-jq）

### 新增依赖
- `vitest` (dev) — 测试框架
- `vite-tsconfig-paths` (dev) — Vitest TypeScript 路径解析

### 禁止事项检查
- ✅ 未修改业务代码
- ✅ 未移动 `src/lib/sm2.ts`
- ✅ 未创建未来 Domain/Workflow/AI Client 实现
- ✅ 未调用真实 AI / TTS
- ✅ 未进入架构迁移
- ✅ 未修改 Phase 0 Audit
- ✅ 未进入 Phase 3

### 验证结果
- ✅ 5 个测试文件，95 个测试，全部通过
- ✅ TypeScript 检查通过
- ✅ Production Build 通过
- ✅ 新测试文件 ESLint 零错误
- ⚠️ ESLint 历史错误（35 errors, 36 warnings）未修复（符合 Phase 2 规则）
- ✅ Dev server 实际启动，API 冒烟脚本实际执行（14 passed / 0 failed / 0 skipped）
- ✅ check_json 单次请求已验证（服务端日志计数确认）

### 关闭记录（2026-07-29 最终外部审核）

- ✅ **Review Status: Approved** — 无阻断问题（Blocking Issues: None）
- ✅ **Phase 3 Release Decision: Approved** — Phase 2 正式关闭后可启动 Phase 3
- ✅ 不需要进一步的 Phase 2 技术改动
- 📌 本阶段建立的测试与评估基线为**受保护基线（protected baseline）**，后续重构不得随意删除或放宽
- ⏳ Phase 3 必须用这些测试检测回归
- ⚠️ 已知遗留行为：`POST /api/words` 缺少 wordId → **500**（技术债，非期望的 API 行为；Phase 2 仅记录未修改）
- ⏳ `/api/assistant` 的 Route 级自动化测试推迟到 Phase 3（需要可注入的 AI Client 接缝）

---

## Phase 3：统一 AI Client

**状态:** ✅ **Completed / Approved**（2026-09-13 外部复审通过：Review Status = Approved，Blocking Issues = None）
**开始日期:** 2026-09-12
**实现完成日期:** 2026-09-12
**修正完成日期:** 2026-09-12（v2）
**完成日期:** 2026-09-13
**审核:** ✅ 外部审核通过（v1 Changes Requested → v2 Approved，Blocking Issues: None）

### 参考迁移目标
- `POST /api/assistant`（`src/app/api/assistant/route.ts`）— 未冻结、单步 AI 调用、Phase 2 明确把其 Route 级自动化测试推迟到本阶段

### Phase 3 基线与约束
- 开始前基线：`npx vitest run` → 5 files / 95 tests 全绿；`npx tsc --noEmit` → 0 errors；`npx eslint tests/`、`src/lib/__tests__/` → 0 errors
- 只迁移**一个** AI 调用；其余 10 个调用点保持在原处
- 不调用真实 AI 进行自动化测试

### 实现产出
- Application：`ports/ai-client.ts`（AIClientPort + AIError + provider-neutral 类型）、`ports/word-lookup.ts`、`prompts/assistant/qa.prompt.ts`、`use-cases/assistant/reply-to-assistant-query.use-case.ts`
- Infrastructure：`ai/ai-client.ts`、`ai/errors.ts`、`ai/retry.ts`、`ai/structured-output.ts`、`ai/adapters/{types,deepseek.adapter}.ts`、`db/word-lookup.ts`
- Composition Root：`src/bootstrap/index.ts`
- 迁移：`src/app/api/assistant/route.ts`（120 行 → 20 行薄 Route）
- 决策：`DECISIONS.md` ADR-011（统一 AI Client 契约：Port 归属 / 超时双约束 / 三重重试区分 / 错误模型）
- 审核包：`phase-3-review-pack-v2.zip`（v1/v2 均为**临时审核产物**，已在行政收尾中从仓库根目录删除，不作为提交内容）

### v2 修正（外部审核 v1 = Changes Requested）

| # | 阻断问题 | 修正 |
|---|---------|------|
| 1 | 参考迁移继承统一层默认重试（`maxAttempts = 3`），改变了"只发一次请求"的既有行为 | Use Case 显式 `retry: { maxAttempts: 1 }`；统一层默认重试能力与语义不变 |
| 2 | `chatStructured()` 每次解析修复重置 `totalBudgetMs`，最坏约两倍预算 | 单一 deadline：修复与网络重试共享剩余预算；预算耗尽不发请求并归一化为 `timeout` |
| 3 | HTTP 200 畸形响应体被归为 `unknown` | 改为 `AIError('invalid_response')`（不可重试，`cause` 保留解析错误，不回显响应体） |

### 回归结果
| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ 11 files / **184 tests passed**（Phase 2 基线 95 + 新增 89） |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面；仅 2 条 Phase 2 既有警告） |
| `npx eslint tests/`、`src/lib/__tests__/`、所有新增 Phase 3 文件 | ✅ 0 errors, 0 warnings |
| `tests/smoke/api-smoke.sh`（实际启动 dev server，jq 可用） | ✅ 14 passed / 0 failed / 0 skipped |
| 真实 AI 调用 | ✅ 无（自动化测试与冒烟脚本均未调用 provider） |

### 本阶段遗留（留给后续 Phase）
- 其余 10 个 AI 调用点未迁移（清单见 phase-3-task.md Part 1）
- `chatStructured()` 已实现并有测试，但尚无生产调用方（计划 Phase 4 接入）
- `src/lib/prisma.ts` 仍为过渡依赖（Phase 6 搬迁）

---

## Phase 4：重构一条 Pipeline 样板

**状态:** ✅ **Completed / Approved**（2026-09-13 外部复审 v3：Accepted / Approved，Blocking Issues: None）
**开始日期:** 2026-09-13
**实现完成日期:** 2026-09-13
**完成日期:** 2026-09-13
**审核:** ✅ 通过（v1 Changes Requested → v2 Minor Changes Requested → v3 Accepted / Approved）

### 参考 Pipeline
- **Reading 内容摄取管线**：`npm run push:reading` → `scripts/reading-push.ts`
- 链路：The Conversation Atom feeds → RSS 解析 → Readability 抽取 → DeepSeek 结构化输出 → 校验 → Prisma 持久化 → 裁剪

### 约束
- 只迁移这一条管线；不新增依赖；不改 `schema.prisma`
- 必须复用 Phase 3 的 `AIClientPort`，不得直接调用 provider
- 不调用真实 AI/TTS 进行自动化验证

### 实现产出
- Domain：`domain/reading/{types,content-rules,ai-response-rules}.ts`
- Application：`application/errors.ts`、`ports/{feed-source,article-extractor,reading-article-repository}.ts`、`prompts/reading/process-article.prompt.ts`、`workflows/reading-pipeline.workflow.ts`、`use-cases/reading/ingest-reading-articles.use-case.ts`
- Infrastructure：`rss/rss-feed-source.ts`、`article-extraction/readability-article-extractor.ts`、`db/{reading-article.repository,standalone-prisma}.ts`
- Composition Root：`bootstrap/reading-composition.ts`（与 assistant 面分离）
- 交付层：`scripts/reading-push.ts`（330 行 → 约 110 行，只做配置 + 日志映射）
- 决策：`DECISIONS.md` ADR-012（Content Pipeline 样板 + 迁移行为保真原则）
- 新增测试：104（Domain 46 / Workflow 27 / Use Case 14 / Repository 6 / Extractor 7 / RSS 4）
- 审核记录：`docs/refactor/reviews/phase-4-review.md`（v1 Changes Requested + 修正记录）

### v2 修正（外部审核 v1 = Changes Requested）

| # | 阻断问题 | 修正 |
|---|---------|------|
| 1 | 严格 validator 丢弃全部 AI 字段；非法嵌套负载被静默降级 | 恢复旧管线**逐字段兜底**语义（Domain 归一化）；不可安全恢复的负载 → 该条 failed（不入库）；JSON 提取仍走 Phase 3 边界 |
| 2 | 原始/归一化类型不一致（`type: string` 但允许 undefined） | 拆分 `RawReadingVocabItem`（`type?`）与 `ReadingVocabItem`（`type: string`），归一化补 `'word'`，无类型断言 |
| 3 | `persistence_failed` 无生产路径 | 运行级仓储操作（去重查询/统计/取最旧/裁剪）→ `ApplicationError('persistence_failed')`；单条 `createArticle` 失败仍隔离 |

其余变化：C 清单更新为 C1–C6（新增 C5 配置校验快速失败、C6 `null` 负载边界）；措辞修正为"日志分类与控制流一致，底层错误文案可能不同"；ADR-011 过期状态订正；新增 `RssFeedSource` 适配器测试。

### v3 修正（外部审核 v2 = Minor Changes Requested）

| # | 小修正 | 修正 |
|---|--------|------|
| 1 | `type` / `partOfSpeech` 的 falsy 兜底语义未对齐旧实现 `\|\|` | falsy（`undefined`/`""`/`null`/`false`/`0`）→ 兜底（`'word'` / `null`）；truthy 非字符串 → 失败；新增 20 个对照测试 |
| 2 | 归一化边界仍含类型断言 | 改为局部变量 + 控制流收窄 + 类型守卫；该文件已无任何 `as` 断言 |
| 3 | C6 未用真实 Phase 3 边界验证 | 新增真实 `AIClient` + 内存假 provider 的测试：JSON `null` → `invalid_response` → 降级入库（Phase 3 实现未改）。**v4 更正：该结果与旧管线（内层抛错 → 外层 catch 降级 → 文章入库）一致，故 C6 = 行为保持，已移出变更清单** |

### 回归结果
| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ 19 files / **292 tests passed**（Phase 2 基线 95 + Phase 3 89 + Phase 4 108） |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面；仅既有警告） |
| Phase 3 lint 范围 + Phase 4 新增文件 | ✅ 0 errors, 0 warnings |
| `tests/smoke/api-smoke.sh`（实际启动 dev server） | ✅ 14 passed / 0 failed / 0 skipped |
| 真实 AI 调用 | ✅ 无（管线测试全部使用 fake Ports） |

### 本阶段遗留（留给后续 Phase）
- 其余 9 个 AI 调用点与 5 条其它管线未迁移（见 CONTENT_PIPELINE_DESIGN §10）
- `chatStructured()` 的解析修复能力仍未启用（需显式授权）
- Trace/指标持久化属 Phase 5（本阶段只预留步骤事件边界）

---

## Phase 5：Trace 与可观测性

**状态:** ✅ **Completed / Approved**（2026-09-13 外部复审 v3 通过：Review Status = Approved，
Blocking Issues = None，Phase 6 Release Decision = Approved after administrative closeout）
外部审核 v1 = Changes Requested（B-01 `label.*` 元数据 redaction 绕过、B-02 孤儿 span 生命周期契约不一致），
两项已在 v2 修正并被外部审核接受；外部审核 v2 = Changes Requested
（B-03 终态 TraceState 未释放导致进程内存增长、B-04 遥测输出失败可逃逸到业务流），两项已在 v3 修正并补充测试。
在两个已批准的参考目标上建立了应用级 Trace：Phase 3 `POST /api/assistant`（HTTP → Use Case → AI）
与 Phase 4 Reading 内容摄取管线（Use Case → Workflow 显式步骤 → AI / 持久化 / 抽取）。
Phase 4 已预留的 `ReadingPipelineEvent` 操作员事件流保持不变，Trace 是并列的新增结构化输出。
**开始日期:** 2026-09-13
**实现完成日期:** 2026-09-13
**完成日期:** 2026-09-13
**审核:** ✅ 通过（v1 Changes Requested → v2 Changes Requested → **v3 Approved**，Blocking Issues: None）

### 最终被接受的长期不变式

1. Trace metadata 是 metadata-first：内容 / 凭据型标签由 Application 白名单 + Infrastructure 清洗双重阻断
2. trace 在有存活后代 span 时不得视为正常完成；生命周期违规单独显式记录
3. 可变 ACTIVE TraceState 只在执行期间存在，终态快照交付后释放
4. 可观测性 fail-open：遥测输出失败不改变业务控制流、不替换原始业务错误
5. Domain 无 Trace 依赖；6. Phase 3 AI Client 保持完整（经 Application 装饰器观测）
7. Trace 持久化与外部可观测性平台继续延后

- 任务定义：`docs/refactor/tasks/phase-5-task.md`；设计：`docs/refactor/TRACE_DESIGN.md`
- 决策：`DECISIONS.md` ADR-013（应用级 Trace 契约）
- 交接：`docs/refactor/handoffs/phase-5-handoff.md`；审核记录：`docs/refactor/reviews/phase-5-review.md`
- 新增：`application/ports/{trace,clock}.ts`、`application/observability/*`、
  `infrastructure/telemetry/*`、`infrastructure/time/system-clock.ts`、`bootstrap/trace-composition.ts`
- 结果：28 files / **442 tests passed**（Phase 2 95 + Phase 3 89 + Phase 4 108 + Phase 5 150）；
  `npx tsc --noEmit` 0 errors；`npx next build` 通过（41 routes）；HTTP 冒烟 14/14；
  未修改 `schema.prisma`、未新增依赖、未引入外部可观测性平台
- v3 长期不变式：ACTIVE state 仅在 trace 执行期间保留（终态后 `finally` 释放）；遥测输出 fail-open
  （输出失败不改变业务结果、不替换原始业务错误）
- 基线提交：`feat: establish application tracing and observability baseline`（唯一提交，工作区干净）
- 临时审核产物：`phase-5-review-pack-v1/v2/v3.zip` 与评审期打包 / 证据临时文件已在行政收尾中删除
- 非阻断的后续加固提示（审核方记录）：① `InMemoryTraceRecorder` 面向测试 / 检视，
  不得当作长时间运行的生产 trace 存储；② 未来若持久化 trace，应重新审查错误 message 策略，
  可能改为基于 code 的显式安全 message 映射
- 下一阶段：**Phase 6 — Ready / Not Started**（需用户明确批准后启动；**本会话不启动**）

---

## Phase 6：用户状态与记忆系统

**状态:** ✅ **Completed / Approved**（2026-09-14 外部最终复审 v3 通过：Review Status = Approved，
Blocking Issues: None，Phase 7 Release Decision = Approved after administrative closeout）
**目标:** 引入持久化 User State + Memory 基础设施（`User` / `UserProfile` / `UserMemory`），
以 Phase 3 `/api/assistant` 为唯一参考集成证明"身份 → 有界 profile/memory 读取 → 既有 prompt → AIClientPort"；
**不是** Agent、**不是** RAG、**不是**向量记忆、**不是**完整认证
**任务定义:** `docs/refactor/tasks/phase-6-task.md`
**设计文档:** `docs/refactor/MEMORY_DESIGN.md`
**可依赖的 Phase 5 已批准基线:** `TracePort` / `ExecutionContext` / `runInTrace` `runInSpan`（生命周期安全）/
`TracedAIClient`（AI 调用可观测性装饰器）/ fail-open 的 Trace recorder 行为；
Domain 必须保持无 Trace 依赖；trace 持久化与外部可观测性平台仍延后
**开始日期:** 2026-09-13
**实现完成日期:** 2026-09-13
**完成日期:** 2026-09-14
**审核:** ✅ 通过（v1 Changes Requested → v2 Minor Changes Requested → **v3 Approved**；
B-01–B-05 全部 resolved and accepted；Blocking Issues: None）

### 实现产出

- Domain：`src/domain/user/{types,identity-rules,profile-rules}.ts`、
  `src/domain/memory/{types,memory-rules}.ts`（纯规则：闭集、归一化、有界、去重键）
- Application Ports：`src/application/ports/{user-repository,memory-repository}.ts`
- Application 用例：`src/application/use-cases/user/{get-user-context,update-learning-profile,remember-user-fact}.use-case.ts`
- Application Prompt：`src/application/prompts/assistant/personal-context.prompt.ts`（数据段渲染 + 注入防护）
- Infrastructure：`src/infrastructure/db/{user.repository,memory.repository}.ts`（Prisma 适配器 + 纯映射函数）
- Composition / Delivery：`src/bootstrap/{identity,user-state-composition}.ts`、
  `src/bootstrap/index.ts`（装配参考集成）、`src/app/api/assistant/route.ts`（最小身份解析）
- Phase 5 加法扩展：`src/application/observability/execution-context.ts`（新增可选 `userId`）
- Prisma：`prisma/schema.prisma` 新增三个模型（**仅新增**）、
  `prisma/migrations/20260913000001_add_user_state_and_memory/migration.sql`（纯增量、非破坏性）
- 决策：`DECISIONS.md` ADR-014
- 新增测试：**12 个文件 / 102 个测试**（v1 为 11/77；v1 复核修正 +1 文件，v2 的 B-05 +3 tests）
- v1/v2 复核修正新增：`src/application/use-cases/user/ownership.ts`（B-01 权威归属）、
  `src/application/use-cases/user/__tests__/canonical-ownership.test.ts`（B-02 端到端）、
  `MemoryRepositoryPort` / `PrismaMemoryRepository` 的 B-05 空 kinds 语义与测试

### 回归结果

| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ 40 files / **544 tests passed**（Phase 2 95 + Phase 3 89 + Phase 4 108 + Phase 5 150 + Phase 6 102） |
| Phase 2 / 3 / 4 / 5 受保护基线 | ✅ 全部保留并通过 |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面，2 条既有警告） |
| Prisma | ✅ `prisma validate` 通过（exit 0）；`prisma generate` 成功（exit 0，生成物在 `.gitignore` 内） |
| ESLint（Phase 6 范围） | ✅ 0 errors / 0 warnings（domain / application / infrastructure / bootstrap / tests / 被改 Route） |
| `npx eslint src/` 全量 | ✅ 既有历史基线不变：35 errors / 36 warnings（问题文件中**无** Phase 6 文件） |
| HTTP 冒烟（等价端口） | ✅ 14 passed / 0 failed / 0 skipped |
| 真实外部调用 | ✅ 无真实 DeepSeek 调用；无真实 RSS 调用；未对生产库执行迁移或写入。（`next build` 使用普通网络访问 Google Fonts，属正常构建依赖，不改变上述结论。） |
| 生产行为变化 | 无 profile/memory 时与迁移前逐字节一致；有上下文时仅**追加**一条 user 数据消息 |

### 审核方需确认的重点

1. 记忆写入是否确实"显式且确定性"（没有消息级自动写入；source/kind 闭集）。
2. 读取是否确实有界（条数 / 单条 / 整段三层上限），且无记忆时行为保真。
3. 身份策略是否满足"Domain 不读 cookie/header/session"且过渡默认用户被如实标注。
4. Prisma 变更是纯增量且未对生产库执行；既有 7 张表语义未变。
5. Trace 是否只记录元数据（无记忆内容 / profile 值 / 用户标识）。
6. prompt 注入处理（独立 user 数据消息 + 分隔标记 + 方括号中和）是否足够。

---

## Phase 7：Vocabulary Platform Design & Data Provenance

**状态:** ✅ **Completed / Approved**（**2026-09-23 经外部评审 v5 Approved，Blocking Issues: None**；
审核轨迹：v1 Changes Requested → v2 Changes Requested（B-01…B-04 resolved、B-05 新增）
→ v3 当时阻断项 resolved → 产品澄清在收尾前重新打开 → v4 Changes Requested（B-06…B-10）
→ **v5 Approved**。完整历史见 `docs/refactor/reviews/phase-7-review.md`）
**本阶段性质:** 证据 / 设计阶段 — **不**改 schema、**不**新增 migration、**不**导入数据集、
**不**实现多书生产功能。执行范围以已批准任务书 `docs/refactor/tasks/phase-7-task.md` 为准。
**出口条件（2026-09-16 复审修正 R-01）:** ✅ **已于 2026-09-23 由本阶段判定并激活** ——
「迁移链修复」与「Vocabulary Books 实现」属于**可以独立审核的高风险变更**，因此拆分：
**Phase 8 = Migration Chain Repair & Reproducible Baseline**、
**Phase 9 = Vocabulary Books Implementation**、**Phase 10 = Themed Packs Convergence**，
原 Phase 10–15 顺延为 Phase 11–16（见 `DECISIONS.md` ADR-022）。
**可依赖的已批准资产:** `ExecutionContext.userId` 权威身份、`UserRepositoryPort` /
`MemoryRepositoryPort`、`GetUserContextUseCase` / `UpdateLearningProfileUseCase` /
`RememberUserFactUseCase`、有界确定性 Memory 选择、canonical State vs Memory 所有权、
Assistant learner-context 集成、Phase 5 Trace 基础设施（见 `handoffs/phase-6-handoff.md` §9）
**开始日期:** 2026-09-21
**设计 / 研究包完成日期:** 2026-09-21（v1）；**2026-09-23 完成 v4 / v5 修正**
**完成日期:** **2026-09-23**（外部评审 v5 Approved）
**审核:** ✅ **Approved**（v5；Blocking Issues: None）

### 执行记录（2026-09-21，In Review）

**任务定义:** `docs/refactor/tasks/phase-7-task.md`（提交 `8279dff`，Phase 7 任务基线）

**产出（全部为文档 / 证据，无任何实现）:**

| 文件 | 内容 |
|------|------|
| `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md` | 领域分区模型、重叠词语义对比与推荐、分层归属、14 项技术决策研究（含初学者解释） |
| `docs/refactor/VOCABULARY_DATA_PROVENANCE.md` | 当前 IELTS 管线重建（A/B/C 三类）、字段级归因、遗留 AI 数据分类、外部数据集候选（含许可证据分级）、导入与版本化设计 |
| `docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md` | 当前 → 目标映射、重复词条与状态归并规则、迁移链损坏处置方向、**Phase 8 拆分决策**、验证策略与风险登记 |
| `docs/refactor/DECISIONS.md` | ADR-019 / ADR-020 / ADR-021 / ADR-022（均 **Proposed**） |
| `docs/refactor/handoffs/phase-7-handoff.md` | 本阶段交接 |

**关键结论（供评审）:**

1. 目标模型 = 词条身份 / 内容（逐字段来源标记）/ 词书成员资格 / 词包成员资格 / 学习者状态 / 来源追溯**分区**。
2. 重叠词（**v4 结论，取代 v1–v3**）：**学习状态属于 `User + BookEntry`**（`(userId, bookEntryId)`）；
   同一拼写在多本书里是**不同条目、各自独立状态**；**不**传播、**不**合并、**不**做迁移评分；
   换书后新书条目从"未学习"开始，用户可自行按"已掌握"。`Word` 只保留**词形身份**与共享词汇内容。
3. 已核实的数据现实：2,849 行仅 2,704 个不同词形；**119 个词跨 IELTS 与主题包**、**26 个词跨多个主题**。
4. 遗留 AI / ECDICT 数据的成员资格被判定为 **unresolved pending evidence**（倾向 replace），
   DeepSeek 派生学习内容为 **preserve（须标注为生成内容）**；**未删除任何数据**。
5. 外部数据集：CET-4/6、官方 IELTS、Oxford 3000/5000 等**无可用许可证据**；
   CEFR-J / Tatoeba / Wiktextract 有第一方条款可读；NGSL 仅声明 "Creative Commons"（变体待确认）。
6. **Phase 8 拆分决策：建议拆分**（迁移链修复与 Books 实现分离），并已作为 ADR-022 提案提交评审；
   Phase 7 **未**修改路线图。

**外部审核轨迹（v1 → v2 修正）:**

| 版本 | 日期 | 结论 | 说明 |
|------|------|------|------|
| **v1** | 2026-09-21 | 🔴 **Changes Requested**（Phase 7 Not Approved；Phase 8 保持 Not Started） | B-01 迁移 squash 策略 / B-02 目标模型丢失来源语义 / B-03 多值例句与来源标记 / B-04 复习状态合并不得合成非法状态；另含来源证据修正（NGSL / BSL / CEFR-J）与措辞要求、非阻塞项（书内进度版本安全）、审核包 manifest 控制字符问题。完整记录见 `docs/refactor/reviews/phase-7-review.md` |
| v1 修正 | 2026-09-21 | 修正已完成（v2 送审） | 全部为**文档修正**：B-01 重写迁移处置（新增 Prisma v7 baselining / squashing 两条路线 + 归档与对齐要求）；B-02 新增 §4.6（来源词性 / 等级 / 条目 id 归属 entry，`record` 案例逐项回答）；B-03 新增 §4.7（`WordExample` 子关系 + 逐条 provenance）；B-04 重写 §3.4（禁止拼接状态，C-0 / C-1 / C-2 三情形）；来源证据与措辞修正（NGSL 1.2 / BSL 1.2 = CC BY-SA 4.0，新增措辞纪律 §7.0）；书内进度版本安全要求 |
| **v2** | 2026-09-21 | 🔴 **Changes Requested**（Phase 7 Not Approved；Phase 8 保持 Not Started） | **B-01 / B-02 / B-03 / B-04 = accepted as resolved**（不得回退）；新增阻断项 **B-05**：词条身份 / 书内条目 / 导入管线必须端到端一致 —— v2 的 `by-wordKey-keep-first` 与 `no-duplicate-wordKey` 会丢弃 CEFR-J 式的合法来源条目（`record` noun B1 / verb A2）；另要求内容解析规则、例句作用域、学习者状态后果显式化，并修正 handoff 中 NGSL / CEFR-J 的过时表述 |
| v2 修正 | 2026-09-21 | 修正已完成，**待 v3 外部复审** | 全部为**文档修正**：§4.6 重写为 A / B / C 方案对比并**选定 C**（共享 `Word` + 轻量 `WordUsage` + 条目指向 usage）；新增三层身份与去重判定（`Word` / `WordUsage` / `BookEntry`），manifest 与导入流程移除 `wordKey` 级别的条目去重；新增 §4.8 内容解析规则（entry → usage → word，含 `record` 名词 / 动词音标差异）；新增 §4.7.5 例句作用域（`WordExample.wordUsageId` 可空 = 用法中立）；新增 §6.4 学习者状态后果（词级掌握度 + 用法级状态触发条件）；CEFR-J 证据逐字取证并移除过时未决项 |
| **v3** | 2026-09-21 | **当时阻断项（B-05）已解决**；Phase 7 **未**被批准为 Completed | 送审包 `phase-7-review-pack-v3.zip`。**本地无独立 v3 verdict 文件**（v3 包生成于等待复审时）→ 本行按**架构 / 评审渠道结论**如实记录（差异已在 `reviews/phase-7-review.md` 中标明） |
| **v4 / 产品澄清** | 2026-09-23 | Phase 7 **在收尾前被有意重新打开**；现为 **In Review**，等待 **v4 复审** | **产品改变核心前提**：① 学习与 SRS 的单位 = **词书条目**（状态键 `(userId, bookEntryId)`）；② 不要求跨书同步（明确拒绝传播 / 合并 / 迁移评分）；③ `BookEntry` 可含多个目标义项，上游按 POS 分行**不**自动拆成学习者可见卡片，但来源行**不得丢弃**；④ **`WordUsage` 移除**；⑤ 允许**带 provenance 与校验门的 AI 富化**；⑥ 数据来源改按**四类**分离并引入**审批三态**（含 OEWN CC BY 4.0 / FreeDict 逐词典待核实） |
| **v4 复审** | 2026-09-23 | 🔴 **Changes Requested**（Phase 7 仍未批准；Phase 8 保持 Not Started） | **v4 决策被接受且不得重新打开**；新增阻断项 **B-06**（`BookEntry` 稳定身份 `entryKey`）/ **B-07**（正式词书内容的规范归属，禁止隐式通用回退）/ **B-08**（许可适用性 vs 项目导入批准必须分离）/ **B-09**（ADR-020 现行理由与 v4 矛盾）/ **B-10**（Books 阶段不得破坏或提前实现 Packs） |
| **v5 修正** | 2026-09-23 | 修正已完成，**待 v5 外部复审** | 全部为**文档修正**：引入 `entryKey`（`UNIQUE(bookId, entryKey)`，`position` 仅排序，导入按 `entryKey` 协调、缺失条目转 `inactive` 而不孤立学习状态）；`BookEntryMeaning` 承载**义项级音标与书内搭配**、成为正式词书卡片的规范内容（禁止隐式通用回退，新增显式 `fallbackPolicy` 默认 `none`）；来源文档把**许可适用性**与**项目导入批准**拆成两个正交状态（当前无来源达到 `APPROVED FOR PRODUCTION IMPORT`）；ADR-020 重构为**一个现行决定 + 现行理由**，历史 v1–v3 理由标注为 superseded；迁移策略改为 **Books 阶段只迁正式词书侧**、保留词包遗留运行时直到 Phase 10（V-15 修正，新增 V-25…V-31、R-16…R-19） |
| **v5 复审** | 2026-09-23 | ✅ **Approved**（**Blocking Issues: None**；B-01…B-10 全部 resolved） | **Phase 7 关闭为 Completed / Approved**；ADR-019…ADR-022 由收尾命令转为 **Accepted**；**阶段拆分激活**：Phase 8 = 迁移链修复 / 可复现基线（Ready / Not Started），Phase 9 = Vocabulary Books，Phase 10 = Themed Packs，原 Phase 10–15 顺延为 Phase 11–16。完整记录见 `docs/refactor/reviews/phase-7-review.md` |

**审核包:** v1 = `phase-7-review-pack-v1.zip`（manifest 控制字符问题，已在 v2 修复）；
v2 = `phase-7-review-pack-v2.zip`；v3 = `phase-7-review-pack-v3.zip`；
**v4 = `phase-7-review-pack-v4.zip`（含 "v3 → v4 product clarification" 摘要 + 干净 manifest +
控制字符扫描 + 哈希校验）**；**v5 = `phase-7-review-pack-v5.zip`（含 B-06…B-10 修正 +
"v4 → v5 correction" 摘要 + 干净 manifest + 控制字符扫描 + 哈希校验）**。

**验证:** 见 `docs/refactor/handoffs/phase-7-handoff.md`（`git status --short` / `git diff --stat` / `git diff --check`，
并对 schema / migration / UI / API / 依赖 / 生产源码逐项确认**未**变更）。

**未决:** 不背单词第一方证据、WordNet 许可、NGSL / BSL 之外的**同站子表（如 ASL）**、生产库真实数据分布
（含 `_prisma_migrations` 状态）、用户自建词包归属、legacy IELTS 词表替换决策、
CC BY-SA / CEFR-J 改変条款带来的**产品 / 法务**问题（详见设计 / 来源文档的未决清单）。

> **方向变更记录（2026-09-16）。** 本 Phase 此前被规划为「学习路径 Agent」。
> 该方向在 Phase 7 实现开始前被退役：**不会**建立网站级 / master Learning Path Agent。
> 历史记录（Phase 1 版本的 `MIGRATION_PLAN.md` / `TARGET_ARCHITECTURE.md`、
> ADR-002 / ADR-005 的后续影响叙述、`phase-6-task.md` / `phase-6-handoff.md` /
> `phase-6-review.md` 中的 Phase 7 交接说明、`MEMORY_DESIGN.md` §19）保持原样作为历史证据。
> 取代范围与当前方向见 `DECISIONS.md` ADR-015 / ADR-016。

---

> **2026-09-23 阶段拆分激活（行政收尾）。** Phase 7 的出口决策已生效：原 Phase 8 拆分为
> **Phase 8 = Migration Chain Repair & Reproducible Baseline** 与
> **Phase 9 = Vocabulary Books Implementation**，**Phase 10 = Themed Packs Convergence**；
> 原 Phase 10–15 的**既有意图、出口条件、安全要求与评估义务全部保留**，编号 +1 顺延为 Phase 11–16。
> 历史记录（上文 Phase 0–7）不改写；历史文档中的旧编号在明确属于历史叙述时可以保留。

## Phase 8：Migration Chain Repair & Reproducible Baseline

**状态:** **Ready / Not Started**（前置条件：Phase 7 Completed / Approved，2026-09-23）
**本阶段出口:** 一条**可复现的迁移链**——处置损坏的历史 baseline（推荐路线 B：按 Prisma ORM v7 官方
squash 语义压缩为**一份** baseline，并把被移除的历史迁移归档出活动链），在**空数据库**与
**生产形状克隆库**上完成真实执行验证（`migrate deploy` 后与 `prisma/schema.prisma` 双向 diff 为空）、
`migrate resolve --applied` 对齐、以及明确的前滚 / 回滚剧本。
**本阶段 MUST:** 只做迁移链修复 / 基线可复现性与验证；保持应用可运行；保留归档与 SHA-256 证据。
**本阶段 MUST NOT:** 引入任何产品功能；实现 Vocabulary Books 模型 / UI / 导入管线；
改动 SRS 行为；把 Vocabulary 工作提前拉进本阶段。
**迁移验证门（R-02）:** 迁移正确性与可复现性（真实数据库验证）是**本阶段**的验收门禁，
不得推迟到 Phase 16。
**任务书:** 尚未创建（由下一位协调者依据 `PHASE_EXECUTION_PROTOCOL.md` §4 重建命令）。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 9：Vocabulary Books Implementation

**状态:** Not Started（前置条件：Phase 8 Approved）
**本阶段出口:** 落地已批准的 Book 模型与选书体验：`VocabularyBook` / `VocabularyBookEntry`
（**稳定 `entryKey`，`UNIQUE(bookId, entryKey)`**；`position` 仅排序）/ 从属
`BookEntryMeaning`（规范释义 / 目标词性 / 义项级音标 / 书内搭配）与 `BookEntryExample`、
**`LearnerEntryReview(userId, bookEntryId)`** 归属、导入管线 + manifest（`entryKey` 规则、
curation 规则、许可与署名证据）、AI 富化 + 校验门。
**范围门禁（B-10，v5）:** **只迁正式词书侧**；**保留**当前 Theme / generated 行、其遗留运行时与
遗留 `WordReview` 路径（标注 transitional / deprecated）；跨域 `Word` 合并留到 Phase 10。
**迁移验证门（R-02）:** 若本阶段变更 `schema.prisma` / migrations，迁移正确性验收属于**本阶段**。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 10：Themed Packs Convergence

**状态:** Not Started（前置条件：Phase 9 Approved）
**本阶段出口:** default / user packs 归位到已批准架构：主题 / 生成成员迁移到
`VocabularyPack` / `VocabularyPackEntry`、label / emoji 服务端化、自定义包经 `AIClientPort`、
定义词包学习状态语义；在安全处执行剩余的**跨域 `Word` 身份合并**；
并且**只有在词包不再依赖之后**才移除遗留 `theme` / `source` / `difficulty` 语义与遗留 review 路径。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 11：Reliability, Ownership & Evaluation Platform Convergence

**状态:** Not Started（2026-09-20 第二次路线修订中更名并加强出口；**2026-09-23 由旧 Phase 10 顺延**）
**本阶段出口:** 建立项目级评估 / 实验基础设施（评估 harness、golden-set / fixture 约定、
实验记录约定、trace / metrics 导出策略、延迟 / 错误 / token / 成本测量口径），
使后续 Phase 13 / 14 的 AI 实验**可测量**，而不是事后补做。
**范围 / 拆分决策门（R-03）:** 实现开始**之前**必须显式判定
(A) Reliability / Ownership / Architecture convergence 与
(B) Evaluation Platform foundation 能否安全留在**同一个有界 Phase**；
若属可独立审核的高风险工作流，则在 Phase 11 实现开始前拆分路线图（Phase 编号不受保护）。
该判定由 Phase 11 的已批准任务书 / 外部评审产出；本收尾不预先拆分、不新增编号。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 12：AI Coach Foundation Refactor

**状态:** Not Started（**2026-09-23 由旧 Phase 11 顺延**）
**本阶段出口:** 在 Phase 12 结束时产出**确定性 Coach 评估基线**（golden set + 基线测量），
供 Phase 13（检索）与 Phase 14（Agent）对比；**不得**在本阶段悄悄实现完整 Agent runtime。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 13：Retrieval & Knowledge Engineering

**状态:** Not Started（2026-09-20 新增的独立可审核 Phase；**2026-09-23 由旧 Phase 12 顺延**）
**本阶段出口:** 设计、实现并**评估**知识检索层；产出明确的架构决策——
哪种检索方法胜出、为什么、被测量的 trade-off，以及 **RAG 是否属于生产**。
必须先建立至少一个更简单的基线；负面结论（语义 / 向量检索不值得其复杂度）在证据支持下合法。
**检索最小安全（R-02，本阶段内）:** 因为本阶段**引入**检索风险，检索的最小安全边界必须在
同一 Phase 内建立：不可信检索内容（非系统权威）、provenance / 来源元数据、
prompt-injection / 间接注入边界、恶意 / “指令式”检索内容测试用例、
检索证据与治理性 system 指令的隔离。**不得**把首次安全边界推迟到 Phase 15。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 14：Agentic AI Coach & Tool System

**状态:** Not Started（**刻意延后**；只在产品行为确实需要动态决策时评估；**由旧 Phase 13 顺延**）
**本阶段出口:** 默认先做有界**单一 Agent**；tool registry / schemas / loop 控制 / 预算 /
context 管理 / read-write 边界；并把 Agentic Coach 行为与 Phase 12 的确定性基线做**对照评估**。
若 Agent 自主性未改善某个 workflow，则保留确定性 workflow。
**入口门：真实动态决策需求（R-06，本阶段内）:** 实现前必须指出无法充分预定的具体决策 / 路径 /
工具 / 动作选择，解释为什么确定性 Workflow 不足，并定义用于对比的确定性基线（Phase 12）。
若 AI Coach 不存在合法动态决策问题，**不得制造虚假 Agent 自主性**——要么识别另一个与产品一致的
有界 Agent 用例，要么走正常治理流程提出路线图 / 标准修订。
**最小 Agent / tool 安全（R-02，本阶段内）:** allowlist 工具、权威用户身份 / user isolation、
显式 permission 边界、read vs write 区分、高风险写入的 confirmation / HITL、
有界预算 / 循环上限、tool 失败隔离、足以重建关键工具决策的 audit / trace 钩子。
**不得**推迟到 Phase 15。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 15：MCP Interoperability, AgentOps & Safety

**状态:** Not Started（2026-09-20 新增的独立可审核 Phase；**由旧 Phase 14 顺延**）
**本阶段出口:** 一个**合法的 MCP 互操作边界**（Application Use Cases → 多个 adapter，
含 MCP adapter；Domain / Application 不依赖 MCP）**+ MCP 专属与生产风格硬化**
（外部客户端 / 协议授权、MCP 能力暴露策略、传输 / 协议边界、更丰富的 audit / replay / debugging、
运行监控、确有理由时的 red-team 硬化、跨外部互操作边界的策略执行）。
**定位（R-02）:** 安全边界已在引入风险的 Phase 13 / 14 内建立；本阶段做硬化与生产化，
**不得**成为检索 / Agent 安全边界的首次建立点。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## Phase 16：Production, Benchmark & Portfolio Hardening

**状态:** Not Started（路线图的终止阶段；**由旧 Phase 15 顺延**）
**迁移完整性定位（复审修正 R-02）:** 本阶段只做**全新环境复验**（部署、迁移执行、备份 / 回滚、
生产就绪）；迁移正确性的**首次建立点必须更早**——由修复 / 变更迁移的那个已批准 Phase 承担
（当前为 **Phase 8**）。
**本阶段出口:** 部署 + 认证 / 授权 + CI/CD + 生产可观测性 + 演示数据 + README + 架构图 +
威胁 / 安全文档 + **基准 / 实验汇总** + 作品集案例研究 / 面试指南 / demo 脚本。
本阶段**不是**正确性第一次建立的地方——它校验并打包前面 Phase 已经证明的能力。
**基础安全 / 授权边界归属（R-05）:** 缺失 API Key 的 pre-flight 校验、CORS、auth 等**基础**安全 /
授权边界由 **Phase 11** 建立 / 修复；本阶段只做部署级**复验与最终加固**。
**开始日期:** — **完成日期:** — **审核:** ⏳

---

## 历史提案（已退役 / 已取代）

以下标题曾出现在本文件中，**不是**当前路线图的一部分。保留名称仅为可追溯性：

- ~~Phase 7：学习路径 Agent~~ — 于 2026-09-16 退役，见 `DECISIONS.md` ADR-015。
- ~~Phase 8：测试与可靠性加固~~ — 由当前 Phase 11 承担，见 `MASTER_PLAN.md`。
- ~~Phase 9：部署与作品集包装~~ — 由当前 Phase 16 承担，见 `MASTER_PLAN.md`。
- ~~Phase 12：Agentic AI Coach（旧编号）~~ — 2026-09-20 第二次路线修订后，
  Agentic 工作移到 Agentic 阶段，检索改为独立阶段；**2026-09-23 拆分激活后**，
  Agentic 阶段现为 **Phase 14**（`Agentic AI Coach & Tool System`），
  检索阶段现为 **Phase 13**（`Retrieval & Knowledge Engineering`）。见 `DECISIONS.md` ADR-017 / ADR-018。
- ~~Phase 13：Production & Portfolio Hardening（旧编号）~~ — 2026-09-20 加强并移到
  终止阶段（`Production, Benchmark & Portfolio Hardening`）；**2026-09-23 拆分激活后现为 Phase 16**。
  见 `MASTER_PLAN.md`。
- ~~Phase 10 = Vocabulary Books / Phase 11 = Themed Packs（2026-09-20 编号）~~ —
  2026-09-23 行政收尾后：**Phase 9** 才是 Vocabulary Books Implementation，
  **Phase 10** 是 Themed Packs Convergence，**Phase 11** 是 Reliability / Ownership / Evaluation。
