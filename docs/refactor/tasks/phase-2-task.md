# Phase 2 任务定义 — 建立评估基线

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 2 |
| **名称** | 建立评估基线 |
| **状态** | In Progress |
| **前置条件** | Phase 0 已完成并通过独立审核 ✅；Phase 1 已完成并通过最终复审 ✅；Git 基线已建立（工作区干净，HEAD 8891b48） |
| **开始日期** | 2026-07-29 |
| **执行工程师** | Claude Code (DeepSeek-v4-flash) |

---

## 目标

在不改变现有产品行为的前提下，为当前代码建立可重复执行的测试与质量评估基线。

本阶段要回答：
- 当前哪些核心行为必须被保护
- 哪些行为可以自动测试
- 哪些行为暂时只能人工检查
- AI 输出如何在不调用真实模型的情况下进行评估
- 后续重构完成后，如何判断功能是否保持一致
- 当前项目的测试、构建和质量状态是什么

---

## 核心原则

1. 测试当前实现，不测试尚未存在的目标架构。
2. 不移动 `src/lib/sm2.ts`。
3. 不提前创建未来的 Domain、Workflow、AI Client 实现。
4. 优先建立 characterization tests，记录当前行为。
5. 测试失败时先判断是：当前真实 Bug、测试假设错误、环境问题。
6. 不为了让测试通过而擅自修改业务逻辑。
7. 不调用 DeepSeek 或其他付费 AI 服务。
8. 不发送真实 TTS 请求。
9. 不修改 Phase 0 Audit；Phase 2 结果写入新的基线文档。
10. 选择轻量主流测试框架（Vitest），仅安装本阶段确实需要的最小依赖。

---

## 必须完成的工作

### P2-01: 测试基础设施及测试框架选择

当前项目状态：
- **无测试框架** — package.json 无 jest/vitest，无测试配置文件
- **无测试文件** — `*.test.*` 或 `*.spec.*` 文件零存在
- **Playwright** 在 devDependencies 中存在，但无配置/测试文件，且 E2E 框架对纯逻辑测试过重
- **测试 scripts** — package.json 无 test 相关命令

**选择：Vitest**

| 对比项 | Vitest | Jest |
|--------|--------|------|
| TypeScript 支持 | 原生（esbuild） | 需 ts-jest |
| ESM 支持 | 原生 | 需配置 |
| 速度 | 快（esbuild） | 中等 |
| Next.js 兼容 | ✅（vite-tsconfig-paths 处理 `@/`） | ✅（next/jest） |
| 配置复杂度 | 低 | 中 |
| 生态主流度 | 当前首选 | 传统 |

**选择理由：** Vitest 原生 TypeScript 支持、esbuild 编译速度、与项目 `moduleResolution: "bundler"` 完全兼容、通过 `vite-tsconfig-paths` 支持 `@/` 路径别名。Jest 需要 ts-jest 额外转换步骤。

**安装依赖：** `vitest` + `vite-tsconfig-paths`

### P2-02: SM-2 表征测试

直接针对 `src/lib/sm2.ts` 建立 characterization tests，角色为：

| 评分 | 含义 |
|------|------|
| 1-2 | 错误（incorrect）— 重置间隔和重复次数 |
| 3 | Good — 正确，正常推进 |
| 4 | Easy — 正确，加速推进 |
| 5 | Mastered — 正确，标记为已掌握 |

**至少覆盖：**
- 首次学习（初次调用，无 prev 参数）
- Rating 1-5 每条路径
- repetition 增量与重置
- interval 变换（新增→1→6→Math.round(interval * easiness)）
- easiness factor 公式边界（最小值 1.3）
- mastered 状态或相关边界（rating=5）
- 最小值、最大值和异常输入边界
- 当前实现已知但尚未修复的行为

### P2-03: 纯逻辑测试

当前项目中可独立测试的纯函数：

| 函数 | 文件 | 说明 | 是否依赖 |
|------|------|------|---------|
| `formatPhonetic` | `src/lib/utils.ts` | 音标格式化，修整 + 添加 `/` 分隔符 | 无 |
| `sm2` | `src/lib/sm2.ts` | SM-2 间隔重复算法（见 P2-02） | 无 |
| `clearWordCaches` | `src/lib/word-cache.ts` | 清除模块级缓存 | 无（仅修改模块级对象） |

不创建额外的 mock 测试，本项目当前无独立的纯验证/校验/格式化逻辑。

### P2-04: API / 页面冒烟基线

选择方案：由于测试不连接真实数据库、不启动 Next.js dev server 也能验证部分行为，因此：
- **自动化测试** — 创建纯函数测试覆盖可隔离的逻辑
- **脚本化 HTTP 检查** — 创建独立冒烟脚本，需在 dev server 运行时执行
- **人工冒烟清单** — 记录需要人工验证的关键路径

**最低冒烟覆盖：**
- `/api/warmup` — 数据库健康检查端点（自动化 + 人工）
- Reading 页面的只读取业务（`GET /api/reading`）
- Words Queue 统计（`GET /api/words/queues`）
- Words 学习提交（`/words/study` 页面入口）
- AI Assistant 入口（`/api/assistant` POST，mock 代替）

### P2-05: AI 输出离线评估基线

**设计原则：**
- 不调用真实 DeepSeek 或其他付费 AI 服务
- 基于现有 Prompt、返回结构和 Phase 0 审计结果
- 使用 synthetic fixture 模拟 AI 输出

**覆盖范围：**
- 结构化输出 JSON schema 校验
- 必填字段检查
- 英语学习内容的基础质量检查（含目标词检测）
- 格式异常处理（markdown fence 剥离、空内容）

### P2-06: 质量基线记录

运行并记录：
- TypeScript 检查（`npx tsc --noEmit`）
- Production Build（`npx next build`）
- 新增测试结果
- ESLint 实际结果（已知历史问题）

### P2-07: 测试策略文档

在 TEST_STRATEGY.md 中明确：
- Unit Test 测什么
- Characterization Test 测什么
- Contract Test 测什么
- Integration Test 后续测什么
- AI Evaluation 测什么
- Manual Smoke Test 测什么
- 后续 Phase 3/4 重构时如何使用这些测试

---

## 允许修改

- 测试配置文件（`vitest.config.ts`）
- package.json 中与测试有关的 scripts（`test`）
- 测试文件
- Fixture 文件
- Phase 2 文档
- 必要的最小开发依赖（`vitest`, `vite-tsconfig-paths`）
- PHASE_STATUS.md
- DECISIONS.md（仅在产生新的长期测试决策时）

## 原则上禁止修改

- 当前业务实现
- API Route 业务逻辑
- 页面产品逻辑
- Prisma schema
- 数据库数据
- AI Prompt 业务内容
- Phase 0 Audit
- Phase 1 架构成果

## 禁止事项

- 不实现统一 AI Client
- 不创建 Provider Adapter
- 不进行四层架构迁移
- 不移动 SM-2 文件
- 不重构 Route
- 不创建 Agent
- 不创建 Memory 或 RAG
- 不调用真实 AI 或 TTS 服务
- 不修复与本阶段无关的技术债
- 不进入 Phase 3
- 不自行宣布审核通过

---

## 交付物

| # | 文档/文件 | 说明 |
|---|----------|------|
| 1 | `docs/refactor/tasks/phase-2-task.md` | **本文件** — Phase 2 任务定义 |
| 2 | `docs/refactor/EVALUATION_BASELINE.md` | 评估基线完整文档 |
| 3 | `docs/refactor/TEST_STRATEGY.md` | 测试分层策略与后续使用方法 |
| 4 | `vitest.config.ts` | Vitest 测试配置 |
| 5 | `src/lib/__tests__/sm2.test.ts` | SM-2 表征测试 |
| 6 | `src/lib/__tests__/utils.test.ts` | 工具函数测试（formatPhonetic） |
| 7 | `src/lib/__tests__/word-cache.test.ts` | 单词缓存测试 |
| 8 | `tests/eval/fixtures/` | AI 评估 fixture 样本 |
| 9 | `tests/eval/structured-output.test.ts` | 结构化输出合法性测试 |
| 10 | `tests/eval/content-quality.test.ts` | 内容基础质量测试 |
| 11 | `tests/smoke/api-smoke.sh` 或等效脚本 | API 冒烟检查 |
| 12 | `docs/refactor/handoffs/phase-2-handoff.md` | Phase 2 交接文档 |
| 13 | `docs/refactor/PHASE_STATUS.md`（更新） | 更新 Phase 2 状态 |
| 14 | `docs/refactor/DECISIONS.md`（可选更新） | 如有新的测试决策 |

---

## 验收标准

1. ✅ SM-2 所有核心行为有测试覆盖
2. ✅ 可测试的纯函数有测试覆盖
3. ✅ AI 结构化输出有离线评估框架
4. ✅ 评估基线文档明确记录当前状态
5. ✅ 测试策略文档明确各层测试职责
6. ✅ 新增测试全部通过
7. ✅ TypeScript 检查通过
8. ✅ Build 不受影响
9. ✅ 未修改业务代码
10. ✅ 未调用真实 AI / TTS
11. ✅ 未进入架构迁移
12. ✅ Phase 3 仍为 Not Started
