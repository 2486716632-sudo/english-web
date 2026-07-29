# Phase 1 任务定义 — 目标架构设计

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 1 |
| **名称** | 目标架构设计 |
| **状态** | In Progress |
| **前置条件** | Phase 0 已完成并通过独立审核 ✅ |
| **开始日期** | 2026-07-29 |
| **截止日期** | 2026-07-29 |
| **执行工程师** | Claude Code (DeepSeek-v4) |

---

## 目标

设计项目的目标架构（Target Architecture），为后续渐进式重构提供明确、可执行的架构蓝图。

目标架构必须围绕以下四层展开：

```
UI / API Layer
↓
Application / Workflow Layer
↓
Domain / Learning Logic Layer
↓
Infrastructure Layer
```

---

## 必须完成的设计内容

1. **定义四层各自的职责** — 每层的边界、输入输出、允许的依赖方向。
2. **定义允许的依赖方向与禁止的反向依赖** — 下层绝不能依赖上层。
3. **将当前代码模块映射到目标架构** — 每个现有文件/模块在目标架构中的位置。
4. **设计薄 API Route 的职责边界** — API Route 只做请求验证和响应格式化。
5. **区分术语**：
   - Application Service（跨模块业务编排）
   - Workflow（确定性的多步流程编排）
   - Domain Service（领域内业务逻辑）
   - Infrastructure Service（基础设施封装）
6. **明确固定 Workflow 与动态 Agent 的边界** — 固定步骤用 Workflow，动态决策用 Agent。
7. **设计统一 AI Client 的接口和职责边界** — 只负责模型调用，不负责业务编排。
8. **设计 Provider Adapter** — 接口定义，不实现具体适配器。
9. **定义关注点归属** — 超时、重试、错误模型、Token 统计、延迟追踪和 Trace 的归属层次。
10. **定义 Prompt 的组织方案** — 组织方式、版本管理、调用方式。
11. **定义 Structured Output 的统一处理边界**。
12. **明确外部依赖架构位置** — Prisma、文件存储、TTS、RSS、外部 API。
13. **分析四大功能模块的迁移方式** — Reading、Listening、Words、Coach 的渐进迁移策略。
14. **预留架构空间** — User、State、Memory、RAG、Evaluation、Agent。
15. **设计目标目录结构** — 每个目录的职责说明。
16. **给出后续 Phase 的推荐迁移顺序**。
17. **记录关键权衡、风险、替代方案和未决定问题**。

---

## 必须避免

- **不允许**用一个笼统的 Service Layer 包住所有业务逻辑。
- **不允许**让 AI Client 承担英语学习业务编排。
- **不允许**让 Domain 直接依赖 Next.js、Prisma、DeepSeek 或文件系统。
- **不允许**为了展示技术引入不必要的框架。
- **不允许**推倒重写。
- **不允许**修改现有产品行为。

---

## 本阶段禁止事项

- ❌ 不修改任何核心业务代码。
- ❌ 不创建 AI Client 实现。
- ❌ 不创建 Service、Workflow、Agent 的实现文件。
- ❌ 不安装新依赖。
- ❌ 不修改 `schema.prisma`。
- ❌ 不执行数据库迁移。
- ❌ 不提前实现 Phase 2、Phase 3 或 Phase 4。
- ❌ 不修改冻结模块（AI Coach 场景系统、Words 页面 UI、schema.prisma）。
- ❌ 不因发现技术债而顺手修复。

---

## 交付物

| # | 文档 | 说明 |
|---|------|------|
| 1 | `docs/refactor/TARGET_ARCHITECTURE.md` | 目标架构完整设计 |
| 2 | `docs/refactor/ARCHITECTURE_RULES.md` | 架构规则与约束 |
| 3 | `docs/refactor/MIGRATION_PLAN.md` | 渐进迁移计划 |
| 4 | `docs/refactor/handoffs/phase-1-handoff.md` | Phase 1 交接文档 |
| 5 | `docs/refactor/tasks/phase-1-task.md` | **本文件** — 任务定义 |
| 6 | `docs/refactor/PHASE_STATUS.md` | 更新 Phase 1 状态 |

如内容适合合并可减少文件数，但设计内容全部必须有明确归属，不能遗漏。

---

## 验收标准

1. ✅ 上述 17 项设计内容全部在交付物中有明确定义
2. ✅ 所有"必须避免"的四条均未违反
3. ✅ 本阶段禁止事项均未越界
4. ✅ 仅修改了文档文件，未修改 `.ts`/`.tsx`/`.prisma`/`package.json` 等代码文件
5. ✅ `git status` 显示只涉及 `docs/refactor/` 目录的变化
6. ✅ 文档之间内容一致（目录结构、术语、规则不矛盾）
7. ✅ 审核前不宣布进入 Phase 2

---

## 相关文档引用

- `CLAUDE.md` — 项目配置和约束
- `VISION.md` — 设计规格和冻结模块明细
- `docs/refactor/MASTER_PLAN.md` — 重构总体规划
- `docs/refactor/PHASE_STATUS.md` — 当前阶段状态
- `docs/refactor/DECISIONS.md` — 架构决策记录
- `docs/refactor/phase-0-audit.md` — 项目现状审计
- `docs/refactor/handoffs/phase-0-handoff.md` — Phase 0 交接文档
- `docs/refactor/reviews/phase-0-review.md` — Phase 0 审核记录
