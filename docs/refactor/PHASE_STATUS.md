# Phase Status

## 当前阶段

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

**状态:** Ready / Not Started（等待用户明确批准；启动前必须复用 Phase 2 受保护测试与 Phase 3 AI Client 测试）
**开始日期:** —
**完成日期:** —
**审核:** ⏳

---

## Phase 5：Trace 与可观测性

**状态:** Not Started
**开始日期:** —
**完成日期:** —
**审核:** ⏳

---

## Phase 6：用户状态与记忆系统

**状态:** Not Started
**开始日期:** —
**完成日期:** —
**审核:** ⏳

---

## Phase 7：学习路径 Agent

**状态:** Not Started
**开始日期:** —
**完成日期:** —
**审核:** ⏳

---

## Phase 8：测试与可靠性加固

**状态:** Not Started
**开始日期:** —
**完成日期:** —
**审核:** ⏳

---

## Phase 9：部署与作品集包装

**状态:** Not Started
**开始日期:** —
**完成日期:** —
**审核:** ⏳
