# Evaluation Baseline — Phase 2

**日期:** 2026-07-29
**状态:** 生效（修正版）
**用途:** 记录 Phase 2 建立的测试与质量评估基线，供后续 Phase 判断功能是否被破坏。

---

## 目录

1. [评估维度概览](#1-评估维度概览)
2. [SM-2 算法基线](#2-sm-2-算法基线)
3. [纯逻辑函数基线](#3-纯逻辑函数基线)
4. [AI 输出评估基线](#4-ai-输出评估基线)
5. [API 冒烟基线](#5-api-冒烟基线)
6. [质量基线](#6-质量基线)
7. [未覆盖行为与原因](#7-未覆盖行为与原因)
8. [后续 Phase 使用方式](#8-后续-phase-使用方式)

---

## 1. 评估维度概览

| 维度 | 覆盖方式 | 当前状态 | 自动化程度 |
|------|---------|---------|-----------|
| SM-2 算法正确性 | Characterization Tests | ✅ 32 个测试 | 全自动 |
| 工具函数正确性 | Unit Tests | ✅ 10 个测试 | 全自动 |
| 缓存管理正确性 | Unit Tests | ✅ 6 个测试 | 全自动 |
| AI 结构化输出合法性 | 离线 Schema 校验 | ✅ 35 个测试 | 全自动 |
| AI 输出基础质量 | 离线质量检查 | ✅ 12 个测试 | 全自动 |
| ESLint | 静态分析 | ⚠️ 35 errors, 36 warnings（历史） | CI 检查 |
| TypeScript | 类型检查 | ✅ 通过 | CI 检查 |
| Production Build | 编译 | ✅ 通过 | CI 检查 |
| API 冒烟 | HTTP 检查脚本 | ✅ 已实测（jq: 14 passed / 无 jq: 12 passed + 2 skipped） | 半自动 |
| 端到端功能 | 人工检查 | ⏳ 需手动验证 | 人工 |

> **说明：** Build 验证项目可编译（compile），HTTP 冒烟验证端点可访问（reachability），人工交互验证页面功能可用。三者层级不同，不可互换。

---

## 2. SM-2 算法基线

### 测试文件
`src/lib/__tests__/sm2.test.ts` — 32 个测试

### 覆盖的行为

| 分组 | 测试项 | 个数 | 说明 |
|------|-------|------|------|
| 首次学习 | rating 1-5 所有评分路径 | 7 | 初始状态下的行为 |
| 首次学习 | 默认参数检查 | 1 | 不传 prev 时的默认值 |
| EF 计算 | rating 1-5 的精确公式 | 6 | 含最小限制 1.3 |
| 正确响应路径 | interval 变换 (0→1→6→n) | 6 | 包含 easiness 先更新的特性 |
| 错误响应路径 | interval/repetitions 重置 | 4 | rating<3 的全面重置 |
| nextReviewAt | 日期计算 | 4 | 含 midnight 对齐 |
| 完整周期模拟 | 学习→遗忘→重学 | 8 | 真实场景模拟 |
| 边界输入 | rating 0/6/负数/空参数 | 6 | 异常值处理 |

### 当前实现的关键行为（已记录）

1. **easiness 先于 interval 更新** — 在 interval 公式中使用的是更新后的 easiness
2. **rating 1-2 = 错误，3-5 = 正确** — rating=0 和负数也走错误路径；rating=6 也走正确路径
3. **interval 路径**：repetitions=0 → interval=1；repetitions=1 → interval=6；repetitions≥2 → `Math.round(interval * easiness)`
4. **nextReviewAt**：当前日期 + interval 天，对齐到午夜（`setHours(0,0,0,0)`）
5. **easiness 公式**：`easiness + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))`，最小 1.3
6. **没有独立的 mastered 逻辑** — rating=5 和 rating=3 在当前实现中仅有 easiness 差异，interval 变化路径相同。当前实现真正的 mastered 逻辑在 API Route 的 `mastered` 参数中，而非 SM-2 算法内部

### 当前实现已知行为（非 Bug，需确认是否期望）

- rating=0 走错误路径（重置），rating=5 和 rating=3 使用同一 interval 计算路径
- `formatPhonetic` 对空白字符串返回 `//`（`''.trim()` → `''` → `/${t}/` → `//`）

---

## 3. 纯逻辑函数基线

### formatPhonetic (`src/lib/utils.ts`)
- **测试文件:** `src/lib/__tests__/utils.test.ts` — 10 个测试
- **覆盖:** null 输入、空格处理、已有斜杠保护、无斜杠添加

### clearWordCaches (`src/lib/word-cache.ts`)
- **测试文件:** `src/lib/__tests__/word-cache.test.ts` — 6 个测试
- **覆盖:** 初始状态、写入读取、清除指定主题、清除不存在的 key、缓存独立性

### 当前项目中未独立测试的纯逻辑

| 函数 | 位置 | 不测试原因 |
|------|------|-----------|
| `lookupPhonetic` | `src/app/api/reading/[id]/route.ts` | 依赖文件系统（JSON 读取 + 模块级缓存） |
| `getPhoneticMap` | 同上 | 依赖文件系统 |
| `shuffleArray` | `src/app/api/words/route.ts` | 内部辅助函数，依赖 Math.random |
| `mapWord` | 同上 | 内部辅助函数 |
| `voiceForSpeaker` | `src/features/listening/lib/listening.ts` | 内部辅助函数，仅常量映射 |
| `getSystemPrompt` | `src/features/listening/lib/listening-prompts.ts` | 仅常量查找表 |

---

## 4. AI 输出评估基线（离线契约校验）

### ⚠️ 重要声明

当前 AI Evaluation 是**离线契约和评估基线**。它使用 synthetic fixture（合成数据），不调用真实模型，**尚未接入生产代码的解析路径**。

Phase 3 实现统一 AI Client 后，相关测试必须接入真实的 `chatStructured()` 解析和 Structured Output 处理代码，届时才能验证生产 Route 的 AI 输出解析。

### 评估文件

- `tests/eval/fixtures/ai-responses.ts` — Synthetic AI 响应样本
- `tests/eval/structured-output.test.ts` — 结构化输出合法性测试（35 个测试）
- `tests/eval/content-quality.test.ts` — 内容基础质量测试（12 个测试）

### Fixture 统计

- **33 个静态 fixture** — 覆盖有效响应、结构缺失、类型错误、空值、边界值、角色不匹配
- **1 个动态生成函数** — `buildLongTextResponse()`
- 所有数据为纯合成，不代表真实模型输出分布

### 覆盖的响应类型（离线契约校验）

| 类型 | 校验维度 | 测试数 |
|------|---------|--------|
| enrichWord（词汇富化） | JSON schema + 嵌套字段逐项校验 | 8 |
| generateScene — 对话 (A1-A5/B) | 场景类型特定校验 (title, speakerA/B, lines, speaker 归属) | 7 |
| generateScene — C1 叙述 | 场景类型特定校验 (title, titleZh, type, lines) | 3 |
| generateScene — C2 访谈 | 场景类型特定校验 (title, titleZh, type, host, guest, lines, speaker 归属) | 5 |
| coachAnalysis（Coach 分析） | 必填字段 + 类型校验 | 3 |
| JSON 安全提取 | markdown fence 剥离 + safeJsonParse | 4 |
| themeWordList（主题词表） | 可复用校验函数 + 嵌套校验 | 5 |

### Schema 字段契约（基于当前 Prompt 输出格式）

**enrichWord（词汇富化）：**
| 字段 | 类型 | 必填 | 嵌套校验 |
|------|------|------|---------|
| phonetic | string | ✅ | 以 `/` 包围的非空字符串 |
| partOfSpeech | string | ✅ | 非空 |
| definition | string | ✅ | 非空 |
| collocations | string[] | ✅ | 每项为非空字符串 |
| exampleSentences | Array<{sentence, translation}> | ✅ | 每项为对象，sentence 和 translation 均为非空字符串 |

**generateScene（听力场景，基于 listening-prompts.ts 的 Prompt 输出格式）：**

A1-A5 / B 对话类型：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✅ | Prompt 明确要求返回简短有吸引力的标题 |
| titleZh | string | 可选 | Prompt 要求返回，但对话类型无 titleZh → 标记可选 |
| speakerA | string | ✅ | A1-A5/B 对话类型 |
| speakerB | string | ✅ | A1-A5/B 对话类型 |
| lines | SceneLine[] | ✅ | 最少 2 行，每行含非空 speaker/english/chinese；speaker 必须属于 speakerA / speakerB |

C1 叙述类型：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✅ | C1_NARRATIVE Prompt 要求 |
| titleZh | string | ✅ | C1_NARRATIVE Prompt 要求 |
| type | string | ✅ | 固定为 "narrative" |
| lines | SceneLine[] | ✅ | 最少 2 行，无 speaker 字段约定 |

C2 访谈类型：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✅ | C2_INTERVIEW Prompt 要求 |
| titleZh | string | ✅ | C2_INTERVIEW Prompt 要求 |
| type | string | ✅ | 固定为 "interview" |
| host | string | ✅ | 主持人名字 |
| guest | string | ✅ | 嘉宾名字和头衔 |
| lines | SceneLine[] | ✅ | 最少 2 行，speaker 必须属于 host / guest |

> **角色归属校验说明：** `listening-prompts.ts` 的 Prompt 契约使用固定角色 token
> （对话用 `"A"`/`"B"` 映射 `speakerA`/`speakerB` 显示名；C2 用 `"host"`/`"guest"`）。
> 校验允许集合 = 标准角色 token ∪ 已声明的显示名，任何第三方角色（如 `"C"`、`"narrator"`）判为无效。

**coachAnalysis（Coach 第二步分析）：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| translation | string | ✅ | 中文翻译 |
| nextPrompt | string | ✅ | 下一轮提示 |
| grammarCorrection | string\|null | ✅ | 可为 null（表示无纠正） |
| endDialog | boolean | ✅ | 是否结束对话 |

**themeWordList（主题词包 Step 1）：**
| 字段 | 类型 | 必填 | 嵌套校验 |
|------|------|------|---------|
| theme | string | ✅ | 非空 |
| words | ThemeWord[] | ✅ | 至少 1 项 |
| word | string | ✅ | 每项的非空字段 |
| definition | string | ✅ | 每项的非空字段 |

### 质量保障限制

当前评估只能覆盖：

| 可自动化检查 | 暂时不能自动化 |
|------------|-------------|
| JSON 结构完整性 | 语义正确性（定义是否准确） |
| 字段类型正确性 | 教学适当性（例句难度是否合适） |
| 基础格式（非空、非纯标点） | 深层幻觉检测（看似合理但错误的定义） |
| 音标基本格式 | 音标与单词是否匹配 |
| 例句包含目标词 | 翻译质量 |
| JSON 编码/解码稳定性 | 文化适当性 |

### 后续真实模型评估需要记录的指标

当 Phase 3+ 允许真实 AI 调用后，应追踪：

| 指标 | 方式 |
|------|------|
| JSON 解析成功率 | % 响应可安全解析 |
| Schema 验证通过率 | % 响应通过结构校验 |
| 空/null 响应率 | % 无内容响应 |
| 平均响应 Token 数 | 成本基线 |
| 语法错误率 | % 包含语法错误的文本 |
| 目标词缺失率 | % enrich/theme 输出未包含目标词 |

---

## 5. API 冒烟基线

### 自动化检查

**脚本:** `tests/smoke/api-smoke.sh`
**运行方式:** 在 `npx next dev` 启动后执行
**请求约束:** `check` / `check_json` 每次调用只发送 **1 个 HTTP 请求**
（`curl -o <tmpfile> -w "%{http_code}"` 一次拿到 body + status），
不存在"先取 body 再取 status"的重复请求。

**覆盖的检查（需 dev server 运行，共 14 项）：**

| 端点 | 方法 | 检查方式 | 预期 / 实测行为 |
|------|------|---------|------|
| `GET /api/warmup` | GET | JSON key | ✅ 200，`status` 存在 |
| `GET /api/reading` | GET | HTTP 200 | ✅ 200 |
| `GET /api/words/queues` | GET | JSON key | ✅ 200，`reviewQueue` 存在 |
| `GET /api/listening/categories` | GET | HTTP 200 | ✅ 200 |
| `GET /api/listening/scenes` | GET | HTTP 200 | ✅ 200 |
| `GET /`、`/words`、`/words/dashboard`、`/words/study`、`/reading`、`/listening`、`/coach` | GET | HTTP 200 | ✅ 7 个页面全部 200 |
| `POST /api/words` | POST | HTTP 404 | non-existent wordId → ✅ 实测 404 |
| `POST /api/words` | POST | HTTP 500 | missing wordId → ⚠️ 实测 500（技术债，见下） |

**API 行为基线（dev server 实际启动后实测）**

| 请求 | 实测结果 | 定性 |
|------|---------|------|
| `POST /api/words` `{"wordId":99999,"rating":3}` | **404** | 期望行为 — word 不存在时返回 `Word not found` |
| `POST /api/words` `{"rating":3}` | **500** | ⚠️ 当前遗留行为 / 输入校验技术债 — **不是**理想 API 设计 |

**注意事项：**
- `POST /api/words missing wordId → 500` 是当前遗留行为：API Route 先执行 `findUnique(undefined)` 后抛出未捕获异常。这是输入校验技术债，Phase 2 仅作为 characterization baseline 记录，**不修改生产 Route**，也不把 500 描述为正确 API 设计。
- `/api/assistant` 发 POST 请求会调用真实 DeepSeek，Phase 2 跳过
- **无 jq 时**：HTTP 状态仍会校验，但 JSON 结构校验会明确输出 `SKIP` 并计入 skipped 计数，**绝不会被记为 PASS**
- 所有 POST 请求使用无效或不存在的数据，不触发真实 AI、不写入正式数据

### 手动冒烟清单

以下路径需要人工验证（需要 JavaScript 渲染）：

| 路径 | 验证内容 |
|------|---------|
| `/` | 首页加载正常，4 个功能入口可见 |
| `/words/dashboard` | 仪表盘加载正常，显示队列统计 |
| `/words/study` | 学习页面加载正常（有或没有数据） |
| `/reading` | 阅读列表加载正常 |

---

## 6. 质量基线

### TypeScript 检查

| 项目 | 结果 |
|------|------|
| `npx tsc --noEmit` | ✅ 通过（0 errors）— Phase 2 已重新运行确认 |

### ESLint 检查

| 项目 | 结果 |
|------|------|
| `npx eslint src/` | ⚠️ **35 errors, 36 warnings**（全为 Phase 0 已知历史问题） |
| `npx eslint src/lib/__tests__/` | ✅ 0 errors, 0 warnings |
| `npx eslint tests/` | ✅ 0 errors, 0 warnings |

> **说明：** 新测试文件零 ESLint 错误。现有 src/ 下的历史错误（React 19 新 lint 规则、no-explicit-any、no-img-element）非本阶段引入，Phase 2 不要求修复。

### 测试结果（Phase 2 重新运行确认）

| 测试套件 | 文件数 | 测试数 |
|---------|--------|--------|
| SM-2 表征测试 | 1 | 32 |
| 工具函数测试 | 1 | 10 |
| 缓存管理测试 | 1 | 6 |
| 结构化输出合法性 | 1 | 35 |
| 内容基础质量 | 1 | 12 |
| **总计** | **5** | **95** |

| 命令 | 结果 |
|------|------|
| `npx vitest run` | ✅ **95 passed**（5 files） |

### Production Build

| 命令 | 结果 | 说明 |
|------|------|------|
| `npx next build` | ✅ **通过** | Phase 2 最终修正后重新运行，41 routes 编译成功 |
| TypeScript 阶段 | ✅ 通过 | — |
| 静态页面生成 | ✅ 33/33 pages | — |
| 警告 | ⚠️ 2 条 | `public/listening/` 文件模式过宽（Phase 0 已知） |

> **说明：** Build 验证项目可编译。HTTP 冒烟验证端点可达性（需 dev server）。人工交互验证页面功能可用。三者层级不同。

---

## 7. 未覆盖行为与原因

| 行为 | 未覆盖原因 | 建议覆盖 Phase |
|------|-----------|---------------|
| 学习队列计算（combined queue 的 review/new 混合逻辑） | 依赖 Prisma 数据库查询，不易隔离测试 | Phase 10 |
| API Route 的请求处理（words POST, reading GET 等） | 依赖 Next.js API 运行时和数据库 | Phase 10 |
| `/api/assistant` API Route 自动化测试 | 缺少可注入 AI Client | Phase 3 |
| refillSubCategory 补货逻辑 | 依赖 DB + AI + TTS，全部外部依赖 | Phase 4+ |
| Pronunciation / TTS 功能 | 依赖外部 TTS 服务和文件系统 | Phase 4+ |
| AI Coach 两步对话流程 | 冻结模块，且依赖真实 AI 调用 | Phase 11（AI Coach Foundation Refactor） |
| Reading Pipeline（rss-parser → AI → DB） | 依赖外部 RSS 和 AI 服务 | Phase 4 |
| UI 组件渲染行为 | E2E 测试需要 Playwright 配置和浏览器 | Phase 10 |
| 页面级交互（路由、状态、滚动恢复） | E2E 测试 | Phase 10 |
| 模块级缓存过期行为 | 当前实现不过期 | Phase 6 |
| 数据库迁移正确性 | 需要可写数据库连接；且 `20260609000001_baseline` 迁移链本身损坏 | **修复 / 变更迁移的那个已批准 Phase（当前规划为 Phase 8，或其拆分后继阶段）——同阶段验收**；Phase 15 只做全新环境复验 |

> **2026-09-16 说明：** 上表的「建议覆盖 Phase」是**未来指向**，已按 post-Phase-6
> 路线重新基线更新（旧值 Phase 8 / Phase 9 / Phase 7+ 分别对应现在的 Phase 10 /
> Phase 15 / Phase 11）。已经发生过的历史指向（Phase 3 / Phase 4 / Phase 6）保持原样。
>
> **2026-09-20 补充（第二次路线修订 — 已批准 / 生效）：** 评估已被提升为
> **系统级跨领域能力**（ADR-017，**Accepted**；2026-09-20 外部评审 Approved）。
> 评估 harness / golden-set 约定 / 实验记录约定的**基础设施**归 Phase 10；确定性 Coach
> 基线归 Phase 11；检索评估归 Phase 12；Agent / tool 评估归 Phase 13；基准 / 实验汇总归
> Phase 15。逐条标准见 `PORTFOLIO_ENGINEERING_CRITERIA.md`。

### 迁移验证门（2026-09-16 复审修正 R-02）

只要某个**已批准 Phase** 修复迁移链、或变更 `prisma/schema.prisma` / `prisma/migrations/**`，
该 Phase 的验收门禁**必须包含**迁移正确性与可复现性验证：

1. **同阶段验收。** 迁移链修复与 schema 变更在**同一个已批准 Phase** 内完成验证；
   正确性的**首次建立点不得晚于该 Phase 的收尾**，不得顺延到后续阶段。
2. **真实数据库验证属于该 Phase 的证据。** 与该 schema 变更相称的真实 DB / 集成验证
   （在隔离或临时数据库上跑完整迁移链、`prisma validate`，以及必要的迁移回放 /
   可复现性检查）是该 Phase 的验收证据，**不得**推迟到 Phase 15 才第一次执行。
3. **Phase 15 的定位是复验。** Phase 15 可以在**全新环境**上复验部署、迁移执行、
   备份 / 回滚与生产就绪，但**不是**迁移正确性第一次被建立的地方。
4. **历史不被改写。** 本门禁只约束**未来**的迁移变更；Phase 2–6 的历史记录保持不变。

> 与 R-01 的关系：若 Phase 7 判定需要拆分 Phase 8，则迁移链修复与 Books 实现各自作为
> 独立可审核的 Phase，**各自**承担本门禁（见 `MASTER_PLAN.md` 的 Phase 7 出口决策门）。

---

## 8. 后续 Phase 使用方式

### Phase 3（统一 AI Client）

- **回归测试**: 运行所有现有测试 — 必须全部通过
- **AI 评估升级**: `chatStructured()` 实现需能处理所有 fixture 中的响应格式；结构化输出测试需接入真实解析代码，而不仅是当前的安全提取模拟函数
- **Assistant Route**: 需建立可注入 AI Client 的测试接缝
- **Fixture 更新**: 修改 Prompt 内容后，`content-quality.test.ts` 的 fixture 可能需要同步更新

### Phase 4（Pipeline 重构）

- **SM-2 测试**: 如果 SM-2 未从 `src/lib/` 移动，测试应继续全部通过
- **迁移验证**: 重构 Reading API 后，API 冒烟脚本应继续通过
- **行为一致性**: SM-2 测试确保算法行为不变；AI 评估 fixture 验证输出格式不变

### Phase 10（Reliability, Ownership & Evaluation Platform Convergence）

- 本阶段是所有测试的起点和基线
- 当前的 `characterization test` 需要在重构后升级为 `contract test`
- 纯逻辑覆盖可以进一步扩展到新增的 Domain Service
- 新增**评估 / 实验基础设施**：评估 harness、golden-set / fixture 约定、实验记录约定、
  trace / metrics 导出策略、延迟 / 错误 / token / 成本测量口径

### Phase 11（AI Coach Foundation Refactor）

- 建立**确定性 Coach 评估基线**（golden set + 基线测量），供 Phase 12 / 13 对比

### Phase 12（Retrieval & Knowledge Engineering）

- 定义检索评估数据集，并对检索候选（结构化 / 词法 / 语义 / hybrid / rerank）做对照评估；
  记录检索指标、延迟与成本影响，并产出架构决策

### Phase 13（Agentic AI Coach & Tool System）

- 定义 Agent / tool 评估数据集与指标；把 Agentic Coach 行为与 Phase 11 的确定性基线对照

### Phase 15（Production, Benchmark & Portfolio Hardening）

- 汇总基准表与实验报告；复验部署与迁移；产出作品集 / 面试材料
