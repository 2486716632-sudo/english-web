# Phase 2 交接文档

**日期:** 2026-07-29（修正版）
**Phase 状态:** ✅ Completed / Approved — 已通过最终外部审核（Blocking Issues: None）
**下一阶段:** Phase 3 — 统一 AI Client（Ready / Not Started）
**前置条件:** ✅ 已满足 — Phase 2 已通过外部独立最终审核并正式关闭

---

## Phase 2 目标回顾

在不改变现有产品行为的前提下，为当前代码建立可重复执行的测试与质量评估基线。

---

## 已创建的文件

### 文档

| # | 文档 | 说明 |
|---|------|------|
| 1 | `docs/refactor/tasks/phase-2-task.md` | Phase 2 任务定义 |
| 2 | `docs/refactor/EVALUATION_BASELINE.md` | 评估基线完整文档（8 章节，修正版） |
| 3 | `docs/refactor/TEST_STRATEGY.md` | 测试分层策略与后续使用方法（修正版） |
| 4 | `docs/refactor/reviews/phase-2-review.md` | 审核记录（Changes Requested） |
| 5 | **本文件** | Phase 2 交接文档（修正版） |

### 测试配置

| # | 文件 | 说明 |
|---|------|------|
| 6 | `vitest.config.ts` | Vitest 配置 + vite-tsconfig-paths 插件 |

### 测试文件

| # | 文件 | 测试数 | 类型 |
|---|------|--------|------|
| 7 | `src/lib/__tests__/sm2.test.ts` | 32 | Characterization |
| 8 | `src/lib/__tests__/utils.test.ts` | 10 | Unit |
| 9 | `src/lib/__tests__/word-cache.test.ts` | 6 | Unit |
| 10 | `tests/eval/structured-output.test.ts` | 35 | Schema Validation |
| 11 | `tests/eval/content-quality.test.ts` | 12 | Quality Check |

### 评估数据

| # | 文件 | 说明 |
|---|------|------|
| 12 | `tests/eval/fixtures/ai-responses.ts` | 33 个静态合成 AI 输出样本 + 1 个动态生成函数 |
| 13 | `tests/smoke/api-smoke.sh` | API 冒烟脚本（支持 GET/POST + body + jq/no-jq） |

---

## 已安装的依赖

| 包名 | 类型 | 用途 | 版本 |
|------|------|------|------|
| `vitest` | devDependencies | 测试框架 | ^4.1.10 |
| `vite-tsconfig-paths` | devDependencies | Vitest `@/` 路径解析 | ^6.1.1 |

### 选择 Vitest 的理由

| 对比项 | Vitest | 其他选项 |
|--------|--------|---------|
| TypeScript 支持 | 原生（esbuild） | Jest 需 ts-jest |
| ESM 支持 | 原生 | Jest 需额外配置 |
| 配置复杂度 | 低（10 行配置） | jest.config.ts 需更多配置 |
| Next.js 兼容 | ✅（vite-tsconfig-paths） | ✅（next/jest） |
| 速度 | 快（~3s 内跑完 95 tests） | 较慢 |

---

## 新增测试覆盖的行为

### SM-2 算法（32 tests）

| 分组 | 覆盖行为 |
|------|---------|
| 首次学习 | rating 1-5 全部路径，默认参数验证 |
| EF 计算 | 5 种 rating 的精确公式值，1.3 最小限制 |
| 正确路径 | interval: 0→1→6→`Math.round(i*ef)`，包含 easiness 先更新特性 |
| 错误路径 | interval/repetitions 重置，easiness 仍更新 |
| nextReviewAt | 日期对齐到午夜，正确/错误路径差异 |
| 完整周期 | 学习→遗忘→重学的真实场景 |
| 边界 | rating=0, -1, 6, 空参数 |

**关键发现：** 当前实现的 master 逻辑不在 SM-2 算法内部，而在 API Route 的 `mastered` 参数分支中。rating=5 仅导致 easiness 更高，interval 计算路径与 rating=3 相同。

### 工具函数（10 tests）

| 函数 | 覆盖行为 |
|------|---------|
| `formatPhonetic` | null/空/空白/已有斜杠/无斜杠/含特殊字符 |
| 重要发现 | 空白字符串返回 `//`（当前实际行为已记录） |

### 缓存管理（6 tests）

| 函数 | 覆盖行为 |
|------|---------|
| `listWordCache` | 初始状态/写入/读取 |
| `studyWordCache` | 初始状态/写入/读取 |
| `clearWordCaches` | 清除指定主题/不存在的 key/不影响其他主题 |

### AI 结构化输出合法性（35 tests）

| 类型 | 覆盖 |
|------|------|
| enrichWord 词汇富化 | Schema 完整校验 + 嵌套字段逐项（collocations 每一项、exampleSentences 每一项的 sentence/translation） |
| generateScene 对话 (A1-A5/B) | 场景类型特定校验：title/speakerA/speakerB/lines 每行 speaker/english/chinese，且 speaker 必须属于 speakerA/speakerB |
| generateScene C1 叙述 | 场景类型特定校验：title/titleZh/type==="narrative"/lines english+chinese |
| generateScene C2 访谈 | 场景类型特定校验：title/titleZh/type==="interview"/host/guest/lines，且 line speaker 必须属于 host/guest |
| coachAnalysis | 必填字段/null grammarCorrection |
| JSON 提取 | markdown fence 剥离/干净 JSON/非法文本/空字符串 |
| theme 生成 | 独立校验函数 + theme/words/word/definition 嵌套校验 |

### 内容基础质量（12 tests）

| 类型 | 覆盖 |
|------|------|
| 词汇富化 | 例句包含目标词/音标格式/空 collocations |
| AI Assistant | 有效回复/空回复/纯标点 |
| 听力场景 | 行结构/标题质量/叙述格式 |
| 通用 | UTF-8 编码/字段命名约定 |

---

## 自动测试结果（Phase 2 重新运行确认）

```
 Test Files  5 passed (5)
      Tests  95 passed (95)
   Duration  3.14s
```

---

## TypeScript / Build / ESLint 结果

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `npx tsc --noEmit` | ✅ 通过 | 0 errors |
| `npx next build` | ✅ 通过 | 41 routes 编译成功，33/33 静态页面（验证项目可编译） |
| `npx eslint src/lib/__tests__/` | ✅ 通过 | 0 errors, 0 warnings |
| `npx eslint tests/` | ✅ 通过 | 0 errors, 0 warnings |
| `npx eslint src/` | ⚠️ 35 errors, 36 warnings | 全为 Phase 0 已知历史问题 |

> **验证层级说明：**
> - **Build** = 项目可编译（`npx next build` 验证）
> - **HTTP 冒烟** = 端点可达性（需 dev server，通过 `tests/smoke/api-smoke.sh` 验证）
> - **人工交互** = 页面功能可用（手动浏览器验证）
> 三者层级不同。Phase 2 **确实启动了 dev server**（`npx next dev -p 3456`）并**实际执行了 API 冒烟脚本**：
> jq 可用时 14 passed / 0 failed / 0 skipped。人工浏览器交互仍引用 Phase 0 基线，本阶段未重新手动验证。

---

## 人工冒烟状态

| 路径 | 状态 | 说明 |
|------|------|------|
| `/` | ✅ 引用 Phase 0 | 首页 — Phase 0 确认可达，本阶段未重新验证 |
| `/words` | ✅ 引用 Phase 0 | 词汇入口 |
| `/words/dashboard` | ✅ 引用 Phase 0 | 仪表盘 |
| `/words/study` | ✅ 引用 Phase 0 | 学习页面 |
| `/reading` | ✅ 引用 Phase 0 | 阅读列表 |
| `/listening` | ✅ 引用 Phase 0 | 听力入口 |
| `/coach` | ✅ 引用 Phase 0 | Coach 入口（冻结模块） |
| `/api/warmup` | ✅ 引用 Phase 0 | `{"status":"ok"}` |
| `/api/reading` | ✅ 引用 Phase 0 | 50 篇文章 |
| `/api/words/queues` | ✅ 引用 Phase 0 | 队列统计：review=12, new=1967, mastered=21, total=2000 |

> **说明：** 上表中"人工交互"一列仍引用 Phase 0 基线 —— Phase 2 **没有**重新做人工浏览器验证。
> Phase 2 建立并**实际执行**了自动化冒烟脚本 `tests/smoke/api-smoke.sh`（dev server 确实启动，端口 3456）：
> - jq 可用：`14 passed, 0 failed, 0 skipped`
> - 无 jq：`12 passed, 0 failed, 2 skipped`（结构校验明确记为 SKIP，不记为 PASS）
>
> 上表 3 条 API 行（`/api/warmup`、`/api/reading`、`/api/words/queues`）已由脚本重新验证可达；页面级功能行为仍留待 Phase 8 的 E2E 覆盖。

---

## 未覆盖的行为及原因

| 行为 | 原因 | 计划 Phase |
|------|------|-----------|
| 学习队列计算（combined queue 混合逻辑） | 依赖 Prisma DB 查询 | Phase 8 |
| API Route 请求处理 | 依赖 Next.js 运行时 + DB | Phase 8 |
| `/api/assistant` API Route 自动化测试 | 缺少可注入 AI Client | Phase 3 |
| refillSubCategory 补货 | 依赖 DB + AI + TTS | Phase 4 |
| TTS 功能 | 依赖外部服务 + 文件系统 | Phase 4 |
| AI Coach 对话 | 冻结模块 + 真实 AI | Phase 7 |
| Reading Pipeline | 依赖 RSS + AI | Phase 4 |
| UI 渲染 | 需要 Playwright | Phase 8 |
| 页面交互 | 需要 Playwright | Phase 8 |

---

## 是否修改业务代码

**否。** 未修改任何 `src/app/`、`src/lib/`（不含测试目录）、`src/features/`、`src/components/` 下的业务代码。

仅修改的文件：
- `package.json` — 新增 `test` 和 `test:watch` scripts
- `vitest.config.ts` — 新建测试配置
- 所有 `__tests__/` 和 `tests/` 下的文件 — 新建测试
- `docs/refactor/` 下的文档 — 新增/更新

---

## 是否调用真实 AI / TTS

**否。** 所有测试使用的 AI 输出样本均为合成数据（synthetic fixture），不调用 DeepSeek、Edge TTS 或其他外部服务。冒烟脚本中的 POST 请求使用无效或不存在的数据。

---

## 尚未解决的问题

| # | 问题 | 说明 | 建议 |
|---|------|------|------|
| 1 | ESLint 35 errors / 36 warnings | 全为 Phase 0 已知历史问题，未修复 | Phase 2 不要求修复，后续 Phase 逐步处理 |
| 2 | `formatPhonetic` 空白字符串行为 | 当前返回 `//`，可能不是期望行为 | 可在适当 Phase 修复（需先确认） |
| 3 | SM-2 master 逻辑不在算法内部 | mastered 状态由 API Route 的 `mastered=true` 分支处理，rating=5 并不标记 mastered | Phase 4 重构时需注意 |
| 4 | API 冒烟脚本需手动运行 | 需要 dev server 环境，未纳入 CI | Phase 8 建立 CI 时需集成 |
| 5 | AI Eval 未接入生产代码 | 当前为离线校验，未连接真实 Route 解析逻辑 | Phase 3 实现 AI Client 后升级 |
| 6 | `/api/assistant` 无自动化测试 | POST 会调用真实 DeepSeek，缺少可注入 AI Client | Phase 3 |

---

## Git 变更汇总

### 修改的文件
```
 M docs/refactor/PHASE_STATUS.md
 M package.json
 M package-lock.json
```

### 新建的文件
```
 A docs/refactor/EVALUATION_BASELINE.md
 A docs/refactor/TEST_STRATEGY.md
 A docs/refactor/handoffs/phase-2-handoff.md
 A docs/refactor/reviews/phase-2-review.md
 A docs/refactor/tasks/phase-2-task.md
 A vitest.config.ts
 A src/lib/__tests__/sm2.test.ts
 A src/lib/__tests__/utils.test.ts
 A src/lib/__tests__/word-cache.test.ts
 A tests/eval/fixtures/ai-responses.ts
 A tests/eval/structured-output.test.ts
 A tests/eval/content-quality.test.ts
 A tests/smoke/api-smoke.sh
```

---

## 后续 Phase 输入参考

| Phase | 可用的测试/文档 | 用途 |
|-------|---------------|------|
| Phase 3 | `structured-output.test.ts`, `content-quality.test.ts` | AI Client 实现后接入真实 `chatStructured()` 代码 |
| Phase 3 | `tests/eval/fixtures/` | `chatStructured()` 的测试数据 |
| Phase 3 | — | 建立 `/api/assistant` 的可测试接缝 |
| Phase 4 | `sm2.test.ts`, `utils.test.ts` | 行为一致性验证 |
| Phase 4 | `api-smoke.sh` | API 可达性验证 |
| Phase 8 | 所有测试 | 全量回归测试基线 |

---

## 最终审核结论与交接状态（2026-07-29）

**最终外部审核结果**

| 项目 | 结果 |
|------|------|
| Review Status | ✅ **Approved** |
| Blocking Issues | ✅ **None** |
| Phase 3 Release Decision | ✅ **Approved** — Phase 2 正式关闭后可启动 Phase 3 |
| 是否需要进一步的 Phase 2 技术改动 | 不需要 |

**最终证据（Final evidence）**

| 证据项 | 结果 |
|--------|------|
| Vitest | ✅ 95 passed（5 files） |
| TypeScript | ✅ passed（`npx tsc --noEmit`，0 errors） |
| Build | ✅ passed（41 routes，33/33 静态页面） |
| ESLint（Phase 2 测试范围：`tests/`、`src/lib/__tests__/`） | ✅ passed（0 errors, 0 warnings） |
| Smoke test | ✅ 14 passed / 0 failed / 0 skipped（jq 可用） |
| 业务逻辑修改 | ✅ 无 |
| 真实 AI / TTS 调用 | ✅ 无 |

### 基线保护 — 给后续 Phase 的关键约束

- Phase 2 建立的测试与评估基线现在是**受保护基线（protected baseline）**：后续重构不得删除、跳过或放宽这些测试。
- **Phase 3 必须用这些测试检测回归**：任何 AI Client 相关改动之后，`npx vitest run` 必须保持全绿。
- `structured-output.test.ts` 与 `content-quality.test.ts` 需要在 Phase 3 接入真实的 `chatStructured()` 解析代码（当前仅为离线契约校验）。
- `tests/smoke/api-smoke.sh` 是端点可达性的回归入口，需在 dev server 启动后运行。

### 已知遗留行为（Phase 2 关闭后仍然存在）

| 遗留项 | 说明 |
|--------|------|
| `POST /api/words` 缺少 wordId → **500** | API Route 先执行 `findUnique(undefined)` 再抛出未捕获异常。这是**技术债，不是期望的 API 行为**。Phase 2 仅作为 characterization baseline 记录，未修改生产 Route；修复属于后续 Phase 的输入校验工作。 |
| `/api/assistant` 的 Route 级自动化测试 | **推迟到 Phase 3** — 需要先提供可注入的 AI Client 接缝（当前 POST 会调用真实 DeepSeek）。 |

---

## 本阶段声明

- ✅ Phase 2 任务定义的交付物全部完成
- ✅ 禁止事项均未违反
- ✅ 新增 95 个测试全部通过（5 个文件）
- ✅ TypeScript 检查通过（0 errors）
- ✅ Production Build 通过
- ✅ 未修改业务代码
- ✅ 未调用真实 AI / TTS
- ✅ 未进入架构迁移
- ✅ Phase 3 仍为 Not Started
- ✅ 最终外部审核通过（Review Status: Approved，Blocking Issues: None，Phase 3 Release Decision: Approved）
