# Migration Plan — English Learning PWA

**日期:** 2026-07-29 (修正版)
**状态:** 定稿（基于 Phase 1 架构设计）

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
Phase 7  ─→  学习路径 Agent
   │
Phase 8  ─→  测试与可靠性加固
   │
Phase 9  ─→  部署与作品集包装
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

## Phase 7：学习路径 Agent

### 目标

引入 Agent 驱动个性化学习路径推荐。

| # | 任务 | 涉及文件 |
|---|------|---------|
| P7-01 | 设计 Agent 运行时 | 评估 LangChain vs 自研 |
| P7-02 | 创建 `application/agents/` | Agent 实现 |
| P7-03 | 实现 Learning Path Agent | 动态学习路径规划 |

---

## Phase 8：测试与可靠性加固

### 目标

补齐全栈测试覆盖，处理边界情况，加固安全。

| # | 任务 | 涉及位置 |
|---|------|---------|
| P8-01 | Domain Service 测试全覆盖 | 所有 `domain/` |
| P8-02 | Workflow 测试覆盖 | `application/workflows/` |
| P8-03 | API Route 集成测试 | `api/*/route.ts` |
| P8-04 | AI Client 测试（mock） | `infrastructure/ai/` |
| P8-05 | 边界情况测试 | SM-2 边界、空数据、并发 |
| P8-06 | 安全审计 | 输入验证、SQL 注入、XSS |

---

## Phase 9：部署与作品集包装

### 目标

完成生产就绪的最后步骤，包含部署配置、安全边界、演示数据和项目展示材料。

### 任务清单

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| P9-01 | 部署与环境配置 | `Dockerfile`, `.env.example`, `vercel.json` 等 | 根据目标平台配置部署 |
| P9-02 | 安全边界加固 | API 路由、环境变量、CORS | 防止未授权访问 |
| P9-03 | 演示数据准备 | 种子脚本或 fixture | 方便审查者快速体验 |
| P9-04 | README 完善 | `README.md` | 项目简介、架构、快速开始 |
| P9-05 | 架构图生成 | `docs/architecture-diagram.png` | 基于 TARGET_ARCHITECTURE.md 的可视化 |
| P9-06 | 作品集说明 | `docs/portfolio/` | 项目亮点、技术决策、难点解决方案 |
| P9-07 | 面试讲解材料 | `docs/interview-guide.md` | 可口头讲解的架构要点和权衡 |

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
| Words | 2 | ⚠️ | 中 | P3 | 需授权，UI 冻结限制 |
| Coach | 2 | 🔒 | 中 | **P4** | 严格冻结，最后处理 |
| Scripts | 2 | 否 | 低 | P2 | 种子脚本可最后迁移 |

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
