# Phase 1 交接文档

**日期:** 2026-07-29 (修正版)
**Phase 状态:** ✅ Completed — Approved
**下一阶段:** Phase 2 — 建立评估基线
**前置条件:** 用户确认当前 `src/` 下源码变更的来源并建立干净、可追踪的 Git 基线

---

## Phase 1 目标回顾

设计项目的目标架构（Target Architecture），为后续渐进式重构提供明确、可执行的架构蓝图。

---

## 已创建/修改的文档

| # | 文档 | 操作 | 说明 |
|---|------|------|------|
| 1 | `docs/refactor/TARGET_ARCHITECTURE.md` | ✅ 新建 → 修正 | 目标架构完整设计，已根据审核意见修正 |
| 2 | `docs/refactor/ARCHITECTURE_RULES.md` | ✅ 新建 → 修正 | 12 类可执行的架构规则，已根据审核意见修正 |
| 3 | `docs/refactor/MIGRATION_PLAN.md` | ✅ 新建 → 修正 | 迁移计划（Phase 2-9），已根据审核意见修正 |
| 4 | `docs/refactor/handoffs/phase-1-handoff.md` | ✅ **本文件** | 交接文档 |
| 5 | `docs/refactor/tasks/phase-1-task.md` | ✅ 新建 | 任务定义（未修改，仍有效） |
| 6 | `docs/refactor/PHASE_STATUS.md` | ✅ 已更新 | Phase 1 标记为"修正完成，等待复审" |
| 7 | `docs/refactor/DECISIONS.md` | ✅ 已更新 | 修正 ADR-004/005/006/007/008/010 |
| 8 | `docs/refactor/reviews/phase-1-review.md` | ✅ 新建 | 审核记录（Changes Requested + 两次修正） |
| 9 | `docs/refactor/phase-1-source-changes-baseline.md` | ✅ 新建 | 源码变更基线记录 |

> 所有文件位于 `docs/refactor/` 目录下，仅包含文档内容。

---

## 核心架构决策（修正版）

### ADR-004: 四层架构 + Port/Adapter + Composition Root

**决定:** 采用四层架构，层间通过 Port（接口）交互，具体实现（Adapter）在 Composition Root 中装配。
**关键区别（修正版）：** 区分源码依赖（import 方向）和运行时调用（方法调用方向）；Port 定义在 Application 层；增加 Composition Root。

### ADR-005: Application Use Case 为入口，Workflow 为可选

**决定:** 每个 API 端点对应一个 Application Use Case；Workflow 是复杂 Use Case 内部的可选步骤编排机制。
**关键区别（修正版）：** 删除硬性步数/调用规则。是否有 AI 调用和步骤数量只是参考。

### ADR-006: Domain 纯计算原则（修正版）

**决定:** Domain 只包含纯计算、状态转换和规则校验。不包含 AI 调用、Prompt 构建、外部服务编排。
**关键区别（修正版）：** 移除了注入 AIClient 的 Domain Service 设计；Prompt 归 Application 层。

### ADR-007: AI Client 单一职责

**决定:** AI Client 只负责模型调用（超时、重试、结构化输出、Token 统计），不负责业务编排。

### ADR-008: 纯运维端点例外（替代原"纯 CRUD 例外"）

**决定:** 移除通用 CRUD 例外。仅限无产品语义的运维端点（如 `/api/warmup`）可直接调用 Prisma。有业务含义的简单读写通过轻量 Application Use Case（通过 Repository Port 访问 DB，不直接调用 Prisma）。

### ADR-009: Reading Pipeline 作为首个迁移样板

**决定:** Phase 4 选择 Reading Pipeline。

### ADR-010: 恢复 Phase 9

**决定:** 在 Phase 8 后增加 Phase 9（部署与作品集包装）。

---

## 17 项设计内容完成情况

| # | 设计内容 | 完成 | 位置 |
|---|---------|------|------|
| 1 | 定义四层各自的职责 | ✅ 已修正 | TARGET_ARCHITECTURE.md §2 |
| 2 | 定义允许的依赖方向与禁止的反向依赖 | ✅ 已修正 | TARGET_ARCHITECTURE.md §3 + ARCHITECTURE_RULES.md §1 |
| 3 | 将当前代码模块映射到目标架构 | ✅ | TARGET_ARCHITECTURE.md §4 |
| 4 | 设计薄 API Route 的职责边界 | ✅ 已修正 | TARGET_ARCHITECTURE.md §2 + ARCHITECTURE_RULES.md §2 |
| 5 | 区分 Application/Workflow/Domain/Infra Service | ✅ 已修正 | TARGET_ARCHITECTURE.md §5 |
| 6 | 明确 Workflow 与 Agent 的边界 | ✅ 已修正 | TARGET_ARCHITECTURE.md §6 + ARCHITECTURE_RULES.md APP-003 |
| 7 | 设计统一 AI Client 接口和职责边界 | ✅ 已修正 | TARGET_ARCHITECTURE.md §7 + ARCHITECTURE_RULES.md §5 |
| 8 | 设计 Provider Adapter | ✅ | TARGET_ARCHITECTURE.md §8 |
| 9 | 定义超时/重试/错误/Token/Trace 归属 | ✅ 已修正 | TARGET_ARCHITECTURE.md §9 + ARCHITECTURE_RULES.md §8 |
| 10 | 定义 Prompt 组织/版本/调用方式 | ✅ 已修正 | TARGET_ARCHITECTURE.md §10 (Application 层) |
| 11 | 定义 Structured Output 统一处理边界 | ✅ 已修正 | TARGET_ARCHITECTURE.md §11 + ARCHITECTURE_RULES.md §7 |
| 12 | 明确外部依赖架构位置 | ✅ | TARGET_ARCHITECTURE.md §12 |
| 13 | 分析四大模块迁移方式 | ✅ | TARGET_ARCHITECTURE.md §13 |
| 14 | 预留 User/State/Memory/RAG/Evaluation/Agent 空间 | ✅ | TARGET_ARCHITECTURE.md §14 |
| 15 | 设计目标目录结构及职责 | ✅ 已修正 | TARGET_ARCHITECTURE.md §15 |
| 16 | 给出后续 Phase 推荐迁移顺序 | ✅ 已修正 | TARGET_ARCHITECTURE.md §16 + MIGRATION_PLAN.md (Phase 2-9) |
| 17 | 记录关键权衡/风险/替代方案/未决定问题 | ✅ | TARGET_ARCHITECTURE.md §17 |

---

## 本阶段禁止事项检查

| 禁止事项 | 状态 | 说明 |
|---------|------|------|
| ❌ 不修改任何核心业务代码 | ✅ 未违反 | 仅修改了 `docs/refactor/` 下的文档 |
| ❌ 不创建 AI Client 实现 | ✅ 未违反 | 仅设计接口，无实现代码 |
| ❌ 不创建 Service/Workflow/Agent 的实现文件 | ✅ 未违反 | 无 `.ts` 文件修改 |
| ❌ 不安装新依赖 | ✅ 未违反 | `package.json` 未修改 |
| ❌ 不修改 schema.prisma | ✅ 未违反 | `prisma/` 目录未修改 |
| ❌ 不执行数据库迁移 | ✅ 未违反 | 无迁移操作 |
| ❌ 不提前实现 Phase 2/3/4 | ✅ 未违反 | 仅产出设计文档 |
| ❌ 不修改冻结模块 | ✅ 未违反 | 冻结模块无任何改动 |
| ❌ 不因发现技术债而顺手修复 | ✅ 未违反 | 无代码修改 |

---

## 当前 Git 工作树说明

### 本阶段实际修改的文件（仅 `docs/refactor/`）

```
 M docs/refactor/DECISIONS.md                (修正 ADR)
 M docs/refactor/PHASE_STATUS.md             (更新状态 + 恢复 Phase 9)
?? docs/refactor/ARCHITECTURE_RULES.md       (新文件)
?? docs/refactor/MIGRATION_PLAN.md            (新文件)
?? docs/refactor/TARGET_ARCHITECTURE.md       (新文件 → 修正版重写)
?? docs/refactor/handoffs/phase-1-handoff.md  (新文件 → 修正版重写)
?? docs/refactor/tasks/phase-1-task.md        (新文件)
?? docs/refactor/reviews/                     (新目录，含 phase-1-review.md)
```

### 当前工作树中存在的其它修改（非 Phase 1 产出）

`git status` 显示以下 `src/` 文件有未提交的修改：

```
 M src/app/api/assistant/route.ts
 M src/app/reading/[id]/page.tsx
 M src/app/reading/favorites/page.tsx
 M src/app/reading/history/page.tsx
 M src/app/reading/page.tsx
 M src/app/words/dashboard/page.tsx
 M src/app/words/study/page.tsx
 M src/app/words/themes/[theme]/page.tsx
 M src/components/AIAssistant.tsx
 M src/lib/prisma.ts
```

**重要说明：** 这些 `src/` 下的修改在当前审核证据下**无法归因于 Phase 1**。这些文件的修改时间早于本阶段，或来自 Phase 0 未提交的工作内容。本阶段审核包未对其来源作确定结论。

**详细基线记录：** 详见 `docs/refactor/phase-1-source-changes-baseline.md`

**建议：** Phase 2 开始前，用户应确认这些源码变更的来源，并建立 Git 基线（commit 或 stash）以便后续追踪。

---

## 尚未决定的问题

| # | 问题 | 需要决策的 Phase | 建议 |
|---|------|-----------------|------|
| TBD-1 | Repository 模式是否必须 | Phase 4 | Pipeline 样板中试用后决定 |
| TBD-2 | AI Client 降级策略 | Phase 3 | 统一接口但允许 Workflow 指定 |
| TBD-3 | Token 统计持久化位置 | Phase 5 | 根据 Trace 方案决定 |
| TBD-4 | Prompt 版本管理自动化程度 | Phase 3 | 先用人工方式 |
| TBD-5 | 音频存储长期方案 | Phase 4 | 本地 vs CDN vs S3 |
| TBD-6 | 用户模型 ID 策略 | Phase 6 | UUID vs cuid |
| TBD-7 | Agent 运行时框架 | Phase 7 | LangChain vs 自研 |
| TBD-8 | ECDICT 音标数据迁移到 DB | Phase 4 | 当前 JSON 读取性能可接受 |

---

## 后续 Phase 输入范围

| Phase | 输入 |
|-------|------|
| **Phase 2** | `ARCHITECTURE_RULES.md` TEST-001；`phase-0-audit.md` §运行基线；当前技术债 |
| **Phase 3** | `TARGET_ARCHITECTURE.md` §7 (AI Client)；§8 (Provider Adapter)；`ARCHITECTURE_RULES.md` §5 |
| **Phase 4** | `TARGET_ARCHITECTURE.md` §5 (Workflow)；§10 (Prompt)；`MIGRATION_PLAN.md` Phase 4 |
| **Phase 5** | `TARGET_ARCHITECTURE.md` §9 (Trace/Telemetry) |
| **Phase 6** | `TARGET_ARCHITECTURE.md` §14 (User/Memory) |
| **Phase 7** | `TARGET_ARCHITECTURE.md` §14.6 (Agent) |
| **Phase 8** | 全架构验证 |
| **Phase 9** | `TARGET_ARCHITECTURE.md` 整体架构描述 |

---

## 本阶段声明

- ✅ **17 项设计内容全部有明确归属**
- ✅ **所有"必须避免"的四条均未违反**
- ✅ **本阶段禁止事项均未越界**
- ✅ **仅修改了文档文件**
- ✅ **已根据审核 Changes Requested 完成全部 8 项阻断问题修正**
- ✅ **已根据 v2 复审完成 4 项文档一致性修正**
- ✅ **工作树中 src/ 下的修改已如实注明非本阶段产出，并创建独立基线记录**
- ✅ **最终外部审核通过 — Phase 1 正式关闭**
- ✅ **架构文档已冻结为 Phase 2 的设计输入**
- ✅ **未进入 Phase 2**
- ✅ **当前源码变更需在 Phase 2 开始前由用户确认并建立 Git 基线**
