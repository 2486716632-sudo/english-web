# Phase 1 审核记录

**日期:** 2026-07-29
**审核方式:** 外部独立文档审核（审核包 v1）

---

## 审核对象

- `docs/refactor/tasks/phase-1-task.md` — 任务定义
- `docs/refactor/TARGET_ARCHITECTURE.md` — 目标架构设计
- `docs/refactor/ARCHITECTURE_RULES.md` — 架构规则
- `docs/refactor/MIGRATION_PLAN.md` — 迁移计划
- `docs/refactor/handoffs/phase-1-handoff.md` — 交接文档
- `docs/refactor/PHASE_STATUS.md` — 阶段状态
- `docs/refactor/DECISIONS.md` — 架构决策
- `tmp/phase-1-review-pack/` — 审核包（含 Git 快照）

---

## 最终结论

**Review Status: Approved**

**Phase 2 Release Decision: Approved, pending Git baseline establishment**

- 架构设计通过最终复审，8 项阻断问题及 4 项文档一致性问题已全部修正
- 源码工作区基线问题经核实不是 Phase 1 架构缺陷，但必须在 Phase 2 开始前处理（见 phase-1-source-changes-baseline.md）

---

## 阻断问题

### B-01: 依赖模型矛盾

**问题:** 文档同时声称"Domain 通过接口注入 Infrastructure 服务"和"Infrastructure 不能 import Domain"，这在 TypeScript 中相互矛盾——如果 Domain 定义了接口，Infrastructure 的实现必须 import 该接口。

**要求:** 统一改为 Port/Adapter 模式，区分源码依赖与运行时调用，并增加 Composition Root 设计。

---

### B-02: Domain 层不纯

**问题:** Domain 层设计中包含了 `EnrichWordService`（直接注入 AIClient）、构建 Prompt、编排 AI/TTS/Storage 等职责，违反了 Domain 层纯逻辑原则。

**要求:** Domain 只保留领域计算、状态转换、规则校验。AI 调用、Prompt 构建和外部服务编排归 Application/Workflow。Prompt 目录移至 Application 层。

---

### B-03: Application Service 与 Workflow 的硬性规则

**问题:** 存在"3 步以下用 Service，3 步以上用 Workflow，有 AI 调用用 Workflow"的硬性规则，与实际场景矛盾（如 AI Assistant 只有 1 步 AI 调用但被标记为 Service）。

**要求:** 删除硬性步数/调用规则。Application Service 是入口，Workflow 是复杂用例内部的可选编排机制。仅当需要步骤级状态、Trace、恢复、局部重试、补偿时才引入 Workflow。

---

### B-04: Phase 3 迁移计划与架构规则矛盾

**问题:** Phase 3 计划"Route 直接替换 fetch 为 AIClient"，但架构规则禁止 API Route 直接调用 AIClient。

**要求:** Phase 3 需要建立最小 Application Use Case 边界，Route 只调用 Application Use Case。不要求一个 Phase 内迁移全部 10 个文件。

---

### B-05: 纯 CRUD 例外过宽

**问题:** 将 `/api/words/queues`（有业务语义）和 `/api/reading/[id]/read`（有业务语义）列为纯 CRUD 示例。

**要求:** 简单业务通过轻量 Application Handler 完成。纯 CRUD 例外仅限 warmup 等无产品语义的技术端点。

---

### B-06: Phase 2 设计越界

**问题:** Phase 2 要求在 `src/domain/vocabulary/` 建测试和移动代码，而不是针对当前 `src/lib/sm2.ts` 建立 characterization baseline。

**要求:** Phase 2 必须针对当前代码位置建基线，不移动业务代码，不提前创建未来 Domain 实现。结果写入新文档。

---

### B-07: 缺少 Phase 9

**问题:** MASTER_PLAN.md 定义了 Phase 0-8，但缺少部署、作品集与面试包装阶段。

**要求:** 恢复 Phase 9（部署/作品集包装），更新 MIGRATION_PLAN.md 和 PHASE_STATUS.md。

---

### B-08: 文档矛盾与 Git 范围说明

**问题:**
- `AIClient.chatFresh` 未定义 AI Client 的缓存职责
- `invalid_response` 与网络重试混为一谈
- 未解决问题标注为"由 Phase 2 决定"而非对应后续 Phase
- 存在"用户日常 \| 查阅 memory"的引用问题
- 存在重复的 `src/app/(pages)/` 目录
- `git status` 中 `src/` 下的未提交变更被误称为"仅 docs/refactor"
- 当前工作树 `src/` 下的多份未提交修改无法在现有审核证据下归因于 Phase 1

**要求:** 修正所有矛盾，诚实说明 Git 范围。

---

## 已完成的修正

以下修正对应以上 8 项阻断问题，已同步更新到所有文档：

| # | 修正内容 | 涉及文档 |
|---|---------|---------|
| 1 | 依赖模型改为 Port/Adapter + Composition Root | TARGET_ARCHITECTURE.md §1-3, ARCHITECTURE_RULES.md §1, DECISIONS.md ADR-004/ADR-006 |
| 2 | Domain 层去掉 AI Client 注入、Prompt 构建；移至 Application | TARGET_ARCHITECTURE.md §5, §7, §10; ARCHITECTURE_RULES.md DOM-001; 目录结构调整 |
| 3 | 删除 Workflow/Service 硬性步数规则；Use Case 作为入口 | TARGET_ARCHITECTURE.md §5-6; ARCHITECTURE_RULES.md APP-001~APP-003; DECISIONS.md ADR-005 |
| 4 | Phase 3 加入 Application Use Case 边界，不要求全量迁移 | MIGRATION_PLAN.md Phase 3 |
| 5 | 纯 CRUD 例外限缩为仅运维端点 | TARGET_ARCHITECTURE.md §2; ARCHITECTURE_RULES.md API-003; DECISIONS.md ADR-008 |
| 6 | Phase 2 修正为 characterization baseline，不移动代码 | MIGRATION_PLAN.md Phase 2 |
| 7 | 恢复 Phase 9（部署/作品集包装） | MIGRATION_PLAN.md; PHASE_STATUS.md |
| 8 | 修正 chatFresh、invalid_response、TBD 归属、目录重复、Git 范围说明 | 全部文档 |

## 第二次复审修正

以下修正对应 v2 复审提出的 4 项文档一致性问题：

| # | 修正内容 | 涉及文档 |
|---|---------|---------|
| 9 | TARGET_ARCHITECTURE.md §1 核心依赖模型：统一表述为"Output Port 只定义在 Application Layer；Infrastructure 实现 Application 定义的 Port；Domain 不定义 Port" | TARGET_ARCHITECTURE.md §1 |
| 10 | ADR-007 修正："AIClientPort 定义在 Application Layer，Infrastructure 层提供实现" | DECISIONS.md ADR-007 |
| 11 | ADR-008 修正：轻量 Use Case 通过 Repository Port 访问 DB；仅运维端点直接调用 Prisma | DECISIONS.md ADR-008 |
| 12 | ADR-010 理由修正：Phase 1 v1 遗漏了原有 Phase 9 | DECISIONS.md ADR-010 |
| 13 | 创建 phase-1-source-changes-baseline.md 如实记录 src/ 源码变更 | 新建文档 |

## 当前状态

**Phase 1: ✅ Completed — Approved**
**Phase 2: Not Started (等待用户确认并建立 Git 基线)**

所有 8 项阻断问题 + 4 项文档一致性修正已完成。最终复审通过，Phase 1 正式关闭。

Phase 2 前置条件：用户确认当前 `src/` 下源码变更的来源，建立干净、可追踪的 Git 基线。
