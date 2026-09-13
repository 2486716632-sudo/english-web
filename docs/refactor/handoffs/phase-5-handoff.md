# Phase 5 交接文档 — Trace 与可观测性

**日期:** 2026-09-13
**Phase 状态:** ✅ **Completed / Approved**（2026-09-13 外部复审 v3：Review Status = Approved，
Blocking Issues = None，Phase 6 Release Decision = Approved after administrative closeout）
**Phase 6 状态:** **Ready / Not Started**（本会话不启动 Phase 6）
> 版本轨迹：**v1 = Changes Requested**（B-01 `label.*` redaction 绕过、B-02 生命周期契约不一致）
> → v2 修正（两项被接受为解决）→ **v2 = Changes Requested**
> （B-03 终态 TraceState 未释放、B-04 遥测输出失败可逃逸）
> → v3 修正（两项已修复并补充测试）→ **v3 = Approved（最终）**。
> 修正明细见 §8（v2）与 §9（v3），审核记录见 `docs/refactor/reviews/phase-5-review.md`。
**Phase 6 状态:** **Not Started**
**参考目标:** Phase 3 `POST /api/assistant`、Phase 4 Reading 内容摄取管线
**设计文档:** `docs/refactor/TRACE_DESIGN.md`；任务定义：`docs/refactor/tasks/phase-5-task.md`
**审核记录:** `docs/refactor/reviews/phase-5-review.md`

---

## 1. 前置校验（Phase 5 开始前）

| 项 | 结果 |
|----|------|
| 分支 | `master` |
| HEAD | `1deca075f59ad643416c4c15a88348c5a95ef1e3`（`feat: establish reading content pipeline architecture`） |
| `git status --short` | 空（工作区干净） |
| `git diff --stat` | 空 |
| Phase 4 状态 | ✅ Completed / Approved |
| Phase 5 状态 | Ready / Not Started → 本次启动（→ In Progress） |
| 受保护基线 | ✅ `npx vitest run` → 19 files / **292 tests passed**；`npx tsc --noEmit` → 0 errors |

---

## 2. 完成报告（Phase 5 任务文档 Part 24 的 31 项）

### ① Trace 模型

`src/application/ports/trace.ts` 中的 `TraceRecord`：
`traceId` / `name` / `category` / `status` / `startedAt` / `endedAt` / `durationMs` / `metadata` /
`error` / `spans[]` / `events[]`。root span 的字段在 trace 记录上镜像一份，`spans[0]` 恒为 root span
（无独立 rootSpanId 字段，模型保持最小）。状态为归一化三态 `ok | degraded | error`。

### ② Span 模型

`SpanRecord`：`traceId` / `spanId` / `parentSpanId`（root 为 null）/ `name` / `category` / `status` /
`startedAt` / `endedAt` / `durationMs` / `metadata` / `error`。
分类使用任务给出的 8 个候选值，且**每一个都有真实用途**（http / use_case / workflow / workflow_step /
ai / persistence / external_io / validation）。

### ③ TracePort 设计

`TracePort.startTrace(name, { category, metadata }): TraceScope`（工厂 + 句柄，而不是平铺的
start/end 方法族）。`TraceScope` 提供 `startSpan` / `recordEvent` / `addMetadata` / `recordError` /
`end` / `isEnded`。设计理由：父 span 必须显式传递（无法忘记指定父节点），因此**不需要**
`AsyncLocalStorage`。Port 不依赖 DeepSeek / Prisma / Next.js / console / 文件系统。
另有最小 `ClockPort { now(): number }`。

### ④ Infrastructure Trace 实现

| 文件 | 说明 |
|------|------|
| `infrastructure/telemetry/base-trace-recorder.ts` | 共享骨架（ID / 时钟 / 生命周期 / 清洗 / 组装 / 终态写保护） |
| `infrastructure/telemetry/in-memory-trace-recorder.ts` | 结构化内存实现（`getTraces` / `getTrace` / `getLastTrace` / `openSpanCount`） |
| `infrastructure/telemetry/console-trace-recorder.ts` | 结构化 JSON 行输出（span / event / trace 各一行；sink 可注入，默认 `console.log`） |
| `infrastructure/telemetry/sanitize.ts` | redaction / 长度上限 / 类型收敛 / 错误归一化 |
| `infrastructure/time/system-clock.ts` | `ClockPort` 生产实现 |
| `bootstrap/trace-composition.ts` | Composition Root：`createTraceRecorder({mode})` / `getTraceRecorder()`（`TRACE_MODE` = console \| memory） |

**未引入**任何外部可观测性系统或新依赖。

### ⑤ context 传播策略

显式 `ExecutionContext { trace?: TraceScope }`：
Delivery（CLI / Route）创建 root trace → Use Case → Workflow → 子 span。
未提供时 `resolveTraceScope()` 返回 Null Object（`NOOP_TRACE_SCOPE`），零开销且行为不变。
**未使用 `AsyncLocalStorage`**（理由见 `TRACE_DESIGN.md` §5.2）。
Domain 零 Trace 依赖。

### ⑥ Assistant 埋点

```
http.assistant (http, Route 创建)
  └─ assistant.reply (use_case)
       ├─ assistant.word_lookup (persistence, 可选)
       └─ ai.chat (ai, 装饰器)
```

- 新增 `X-Trace-Id` 响应头；JSON 响应体结构**未变**。
- AI 失败：用户仍看到 `200` + 友好文案；trace 记为 `error`，附 `http.status=200` 与
  `http.outcome=friendly_fallback` + `assistant.fallback` 事件（可区分"用户看到成功"与"执行失败"）。
- 校验失败仍是 `400`（trace `error` + `invalid_request`）；非法 JSON 仍照旧抛出，但 trace 到达终态。
- 未改变：`maxAttempts: 1`、30s 超时、model/provider、Prompt 文本。

### ⑦ Reading Workflow 埋点

```
reading.ingest (use_case, CLI 创建)
  └─ reading.pipeline (workflow)
       ├─ reading.collect_candidates → reading.feed_fetch (× feed)
       ├─ reading.select_new_articles → reading.load_existing_index
       ├─ reading.process_articles → reading.process_article (× 文章, article.index=N)
       │     ├─ reading.extract_article
       │     ├─ ai.chat_structured
       │     ├─ reading.normalize_payload
       │     └─ reading.persist_article
       └─ reading.trim_to_limit
```

事件记录在 span 上（`run.early_exit` / `article.skipped` / `article.degraded`），
**`ReadingPipelineEvent` 操作员事件流未被修改**（Phase 4 日志行为保持不变）。
一次运行 = 一个 traceId；单篇失败可见但不影响整轮；致命失败把整轮 trace 标记为 `error`；
AI 降级用 `degraded` 与完全成功区分。业务行为零改动。

### ⑧ AI Client 埋点

用 **Application 层装饰器** `withAITracing(innerAIClient, span)`（`AIClientPort` → `AIClientPort`），
**Phase 3 已批准的 AI Client 未被修改**。每次 `chat` / `chatStructured` 产生一个 `ai` span，
记录 provider / model / latency / attempts / usage / finishReason / 结构化 schema 名 /
解析修复上限 / 参数与尺寸 / 失败时的 `AIError` 归一化码。

**局限（诚实记录）**：`AICallMeta.attempts` 把网络重试与解析修复合并计数，因此本阶段不拆分、
不伪造，只记录实际 attempts + 策略上限（延后项 see ⑮）。

### ⑨ 记录的 metadata

计数与尺寸：`reading.candidateCount` / `newCandidateCount` / `selectedCount` / `pushed` / `skipped` /
`failed` / `degraded` / `deleted` / `totalArticles` / `maxPerRun` / `maxArticles` / `feedCount` /
`feed.itemCount` / `existingUrlCount` / `existingTitleCount` / `trim.beforeCount` / `trim.deleted` /
`article.index` / `article.total` / `article.contentLength` / `article.hasImage` / `article.vocabCount` /
`article.difficulty` / `article.id` / `outcome` / `assistant.lookupKeyLength` / `assistant.messageCount` /
`ai.request.promptChars` / `ai.response.chars` / `http.status` / `http.method` / `http.route`

provider / 模型 / 用量：`ai.provider` / `ai.model` / `ai.latencyMs` / `ai.attempts` /
`ai.usage.*Tokens`（provider 暴露时才写入）/ `ai.finishReason` / `ai.schema` / `ai.repairAllowed` /
`ai.operation` / `ai.request.*`（参数）/ `label.*`（provider-neutral 调用标签）

状态与错误：`status`（ok/degraded/error）、`error.code` / `name` / `message` / `operation` /
`retryable` / `provider` / `status`

### ⑩ 刻意排除的 metadata

完整 prompt、完整模型输出、完整用户消息、任意用户文本、文章正文 / HTML、原始 provider 请求与响应、
API Key、authorization / cookie / 认证头、数据库连接串、环境变量、stack trace、`cause` 链原始对象。
（默认策略：需要 prompt/output 捕获时必须显式 opt-in，本阶段不做。）

### ⑪ 敏感数据 / redaction 策略

**两层独立防御**（v2 修正后，外部审核 v1 阻断问题 B-01）：

1. **源头白名单（Application）**：`traced-ai-client.ts` 只把**明确批准**的 provider-neutral 标签
   （`useCase` / `step` / `promptVersion`）复制为 `label.<key>`；未批准的键在加前缀之前丢弃。
2. **兜底清洗（Infrastructure）**：`sanitize.ts` 在写入前生效 ——
   键名判定 = 整体精确匹配 + 高风险片段匹配 + **命名空间逐段匹配**
   （`label.prompt` / `label.query` / `label.apiKey` / `label.databaseUrl` 等一律丢弃，
   同时不误伤 `label.useCase` / `ai.request.promptChars` / `article.contentLength` 等安全键）；
   值层面脱敏（Bearer / `sk-`/`pk-`/`rk-` 密钥 / 连接串 / `password=` / PEM 私钥）；
   字符串 ≤ 200 字符、错误 message ≤ 300 字符；非原始值一律丢弃。

完整策略与测试见 `TRACE_DESIGN.md` §6.5 / §11 与 `sanitize.test.ts`（92 tests）。

### ⑫ 错误追踪行为

AI 错误：`AIError` code / provider / retryable / status + 安全 message（`operation: 'ai.call'`）。
Application 错误：`ApplicationError` code + 安全 message + `operation`
（`reading.ingest` / `reading.ingest.validate`）。
领域归一化失败：`invalid_ai_payload` + 领域原因字符串。
基础设施失败：进入 Application trace 之前已归一化（`feed_unavailable` / `persistence_failed`）。
Stack trace **不记录**。异常路径下 scope 仍到达终态（有测试）。

### ⑬ 计时策略

`ClockPort` 注入；生产 `systemClock`（`Date.now()`），测试注入假时钟；
`durationMs = max(0, endedAt - startedAt)`（epoch ms）；**无任何真实时间依赖的断言**。

### ⑭ 新增测试（150 个，9 个新文件；v3 修正后）

| 文件 | 数量 |
|------|------|
| `src/infrastructure/telemetry/__tests__/sanitize.test.ts` | 92 |
| `src/infrastructure/telemetry/__tests__/in-memory-trace-recorder.test.ts` | 13 |
| `src/infrastructure/telemetry/__tests__/console-trace-recorder.test.ts` | 6 |
| `src/infrastructure/telemetry/__tests__/trace-emission-failure.test.ts` | 6 |
| `src/application/observability/__tests__/trace-helpers.test.ts` | 8 |
| `src/application/observability/__tests__/traced-ai-client.test.ts` | 9 |
| `src/application/workflows/__tests__/reading-pipeline.tracing.test.ts` | 7 |
| `src/application/use-cases/assistant/__tests__/reply-to-assistant-query.tracing.test.ts` | 5 |
| `src/app/api/assistant/__tests__/route.tracing.test.ts` | 4 |

### ⑮ 测试总数

```
 Test Files  28 passed (28)
      Tests  442 passed (442)
```

（Phase 2 基线 95 + Phase 3 89 + Phase 4 108 + **Phase 5 新增 150** = 442）

### ⑯ Phase 2 受保护基线状态

✅ 95 tests（sm2 32 / utils 10 / word-cache 6 / 离线结构化输出 35 / 内容质量 12）**全部保留并通过**；
`tests/smoke/api-smoke.sh` **未修改**；`POST /api/words` 缺 wordId → 500 特征化行为保持。

### ⑰ Phase 3 受保护基线状态

✅ 89 tests（route 6 / use case 13 / ai-client 20 / deepseek-adapter 21 / retry 13 / structured-output 16）
**全部保留并通过**；`application/ports/ai-client.ts`、`infrastructure/ai/**` **未修改**
（AI 可观测性经装饰器实现，未触碰已批准契约）。

### ⑱ Phase 4 受保护基线状态

✅ 108 tests 全部保留并通过；`ReadingPipelineEvent` 操作员事件流与 CLI 日志分类/控制流未变、
`ReadingPipelineResult` 结构未变、Prisma 写入路径未变。
⚠️ **两处断言同步更新**（不是放宽，见 §5）：`ingest-reading-articles.use-case.test.ts` 的两个
"配置透传" 断言新增了对第二个参数（显式 `ExecutionContext`）的断言，配置断言本身逐字未改。

### ⑲ TypeScript

`npx tsc --noEmit` → **0 errors**。

### ⑳ Build

`npx next build` → ✅ 通过（41 routes，33/33 静态页面，2 条既有警告：与 Phase 3/4 一致）。

> 附注（环境观测，非代码问题）：首次重跑 build 时曾因 `fonts.googleapis.com` 网络请求失败而报
> `next/font` 错误；重试即通过。属执行环境网络抖动，与 Phase 5 改动无关。

### ㉑ ESLint

| 范围 | 结果 |
|------|------|
| `npx eslint tests/` | ✅ 0 errors, 0 warnings |
| `npx eslint src/lib/__tests__/` | ✅ 0 errors, 0 warnings |
| `npx eslint src/domain/ src/application/ src/infrastructure/ src/bootstrap/` | ✅ 0 errors, 0 warnings |
| `npx eslint <所有被修改的 Route / script / 新增文件>` | ✅ 0 errors, 0 warnings |
| `npx eslint src/`（全量） | ⚠️ 71 problems（35 errors, 36 warnings）= **Phase 0/2 记录的既有历史问题，数量完全一致**；问题文件列表中**不含**任何 Phase 5 新增/修改文件 |

### ㉒ 冒烟结果

**14 passed / 0 failed / 0 skipped**（等价于既有 shell 套件的 14 项检查；见 §6 的执行说明）。
`/api/assistant` 依旧不发 POST（会调用真实 DeepSeek）。

### ㉓ 是否发生真实外部调用

- 自动化测试：**否**（全部使用 fake Ports / 假 AIClient / 内存 recorder；无网络、无真实 AI）。
- 冒烟运行：dev server 按既有只读基线读取了数据库（`/api/warmup`、`/api/reading`、
  `/api/words/queues`、`/api/listening/*` 与两个特征化 POST）。
- **未调用**真实 DeepSeek；**未访问**真实 RSS；**未运行** `npm run push:reading`；**未**执行任何写入型数据库操作（除既有特征化 POST 语义）。

### ㉔ 是否有产品行为变化

业务行为**无变化**。仅有两项**有意且已记录**的可观测性增量：

1. `POST /api/assistant` 响应新增 `X-Trace-Id` 头（响应体与状态码不变）；
2. Reading CLI（`npm run push:reading`）的 stdout 额外输出结构化 trace JSON 行
   （`TRACE_MODE=console` 默认；`TRACE_MODE=memory` 可关闭）。抓取/AI/入库/顺序/退出码不变。

### ㉕ 延后的 trace 持久化

未修改 `prisma/schema.prisma`、未建 Trace 表、未建 migration。
未来持久化路径：新增实现 `TracePort` 的 adapter + Composition Root 装配，Application 层无需改动。
延后清单（P1 trait 持久化 / P2 采样保留 / P3 metric 聚合 / P4 attempts 拆分 / P5 prompt 捕获 / P6 middleware traceId）见
`TRACE_DESIGN.md` §13。

### ㉖ 延后的外部可观测性集成

未引入 OpenTelemetry collector / Jaeger / Zipkin / Datadog / Sentry tracing SDK / Kafka / Elasticsearch。
输出为结构化 JSON 行 + 结构化 `TraceRecord`，未来可通过新增 adapter 转发（`TRACE_DESIGN.md` §14）。

### ㉗ 已知风险

| # | 风险 | 处置 |
|---|------|------|
| R1 | CLI stdout 新增 trace JSON 行 | 有意并已记录；`TRACE_MODE=memory` 可关闭 |
| R2 | 无法如实拆分 AI attempts（重试 vs 修复） | 不伪造；记录策略上限；延后项 P4 |
| R3 | 无 trace 持久化 | 本阶段范围；延后项 P1 |
| R4 | 仅 instrument 两个参考目标 | 任务范围；其余属后续 Phase |
| R5 | `X-Trace-Id` 新响应头 | 纯增量；不影响既有客户端 |
| R6 | 400 / 友好回退请求的 trace 状态为 `error` | 有意（观测视角），用 `http.status`/`outcome` 区分 |
| R7 | 两处 Phase 4 断言同步更新 | §5 说明；配置断言未放宽 |
| R8 | 冒烟在冷启动时曾出现瞬时 500 | 环境网络抖动；预热后 14/14，且重复 10 次 `/api/reading` 全 200（见 §6） |
| R9 | `label.*` 标签是**封闭白名单**（当前仅 `useCase` / `step` / `promptVersion`） | 有意：新增标签属显式契约变更，需更新 `TRACE_DESIGN.md` §6.5 并接受审核，避免开放式搬运再次打开 redaction 缺口 |
| R10 | 一个**从未结束**的 trace 会一直占据 ACTIVE state | 无法自动判定"被遗弃"；由 `activeTraceCount()` 暴露，生产埋点用 `runInTrace` / `runInSpan` 保证不会出现（有测试） |
| R11 | `TRACE_MODE=memory` 会保留 trace 快照 | 有意：内存 adapter 的用途就是归档快照供断言；生产默认 `console`，不保留任何 state |
| R12 | 遥测输出失败会导致**记录丢失**（不重试、不落盘、无 fallback 输出） | 这是 fail-open 的代价与本阶段的选择：观测不得影响业务；持久化 / 重试属延后工作（P1） |

### ㉘ `git diff --stat`

```
 docs/refactor/DECISIONS.md                         |  87 +++
 docs/refactor/PHASE_STATUS.md                      |  34 +-
 scripts/reading-push.ts                            |  37 +-
 src/app/api/assistant/route.ts                     |  70 +-
 .../assistant/reply-to-assistant-query.use-case.ts |  69 +-
 .../ingest-reading-articles.use-case.test.ts       |  24 +-
 .../reading/ingest-reading-articles.use-case.ts    |  63 +-
 .../workflows/reading-pipeline.workflow.ts         | 716 ++++++++++++++-------
 src/bootstrap/reading-composition.ts               |  11 +-
 9 files changed, 816 insertions(+), 295 deletions(-)
```

（`git diff` 不含未跟踪的新文件；完整清单见 §3，全量 diff 见审核包内 `git-diff-phase-5.patch`）

### ㉙ `git status --short`

```
 M docs/refactor/DECISIONS.md
 M docs/refactor/PHASE_STATUS.md
 M scripts/reading-push.ts
 M src/app/api/assistant/route.ts
 M src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts
 M src/application/use-cases/reading/__tests__/ingest-reading-articles.use-case.test.ts
 M src/application/use-cases/reading/ingest-reading-articles.use-case.ts
 M src/application/workflows/reading-pipeline.workflow.ts
 M src/bootstrap/reading-composition.ts
?? docs/refactor/TRACE_DESIGN.md
?? docs/refactor/handoffs/phase-5-handoff.md
?? docs/refactor/reviews/phase-5-review.md
?? docs/refactor/tasks/phase-5-task.md
?? phase-5-review-pack-v1.zip
?? phase-5-review-pack-v2.zip
?? src/app/api/assistant/__tests__/route.tracing.test.ts
?? src/application/observability/
?? src/application/ports/clock.ts
?? src/application/ports/trace.ts
?? src/application/use-cases/assistant/__tests__/reply-to-assistant-query.tracing.test.ts
?? src/application/workflows/__tests__/reading-pipeline.tracing.test.ts
?? src/bootstrap/trace-composition.ts
?? src/infrastructure/telemetry/
?? src/infrastructure/time/
```

> 说明：上面是**生成审核包之前**的工作区快照（与包内 `git-status.txt` 一致）。
> `phase-5-review-pack-v1.zip` / `phase-5-review-pack-v2.zip` 是前两轮审核的流程产物（已被 v3 取代）；
> `phase-5-review-pack-v3.zip`（本次提交）由打包脚本在此快照之后生成，因此只会在**实时**工作区
> 的 `git status` 中再出现一条 `?? phase-5-review-pack-v3.zip`。三者都不属于 Phase 5 的代码变更，
> 也不包含在 v3 包内（打包脚本显式排除 `*.zip`）。

**说明：** 全程**未** commit / **未** `git add` / **未**使用破坏性 Git 命令；未修改既往已批准提交。

### ㉚ Phase 5 当前状态

**In Review（v3 修正完成，等待外部复审）** —— 外部审核 v1 = Changes Requested（B-01 / B-02，已修正并被 v2 接受）；
外部审核 v2 = Changes Requested（B-03 ACTIVE state 未释放 / B-04 遥测输出可逃逸，已在 v3 修正）；
执行者**不**自行宣告 Completed / Approved。

### ㉛ Phase 6 状态确认

**Not Started**（未创建任何 Phase 6 交付物；未实现 User / Memory / RAG / Agent）。

---

## 3. 新建与修改清单

### 3.1 新建文件（生产代码 11 个 + 测试 9 个 + 文档 4 个）

| 层 | 文件 |
|----|------|
| Application | `src/application/ports/trace.ts`、`src/application/ports/clock.ts` |
| Application | `src/application/observability/execution-context.ts`、`trace-helpers.ts`、`traced-ai-client.ts` |
| Infrastructure | `src/infrastructure/telemetry/sanitize.ts`、`base-trace-recorder.ts`、`in-memory-trace-recorder.ts`、`console-trace-recorder.ts` |
| Infrastructure | `src/infrastructure/time/system-clock.ts` |
| Composition | `src/bootstrap/trace-composition.ts` |
| Test | 9 个（见 §2 ⑭） |
| Docs | `docs/refactor/tasks/phase-5-task.md`、`docs/refactor/TRACE_DESIGN.md`、`docs/refactor/handoffs/phase-5-handoff.md`、`docs/refactor/reviews/phase-5-review.md` |

### 3.2 修改文件（9 个）

| 文件 | 说明 |
|------|------|
| `src/application/workflows/reading-pipeline.workflow.ts` | 在同一批真实步骤边界上挂 trace；`run(config, context)`；不改业务逻辑 |
| `src/application/use-cases/reading/ingest-reading-articles.use-case.ts` | `execute(input, context)`；按运行结果决定 trace 终态；记录归一化错误 |
| `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` | `execute(input, context)`；`assistant.reply` / `assistant.word_lookup` / `ai.chat` span |
| `src/app/api/assistant/route.ts` | root trace `http.assistant` + `X-Trace-Id`；响应体与状态码不变 |
| `src/bootstrap/reading-composition.ts` | 装配 trace recorder 并暴露给交付层 |
| `scripts/reading-push.ts` | 创建 root trace 并显式传入 Use Case（`runInTrace` 兜底终态） |
| `src/application/use-cases/reading/__tests__/ingest-reading-articles.use-case.test.ts` | 两处断言同步新增第二个参数（见 §5） |
| `docs/refactor/DECISIONS.md` | ADR-013 |
| `docs/refactor/PHASE_STATUS.md` | Phase 5 → In Progress → In Review |

**未修改**：`prisma/schema.prisma`、`src/lib/prisma.ts`、Phase 2/3 的测试、任何 Phase 3 AI Client 文件、
`package.json`（**未新增依赖**）、其他 `/api/**` Route、UI、`src/features/**`。

---

## 4. 审核建议关注点

1. **不修改已批准基线**：Phase 3 AI Client 是否真的未被触碰；Phase 4 的业务行为是否真的不变
   （尤其 `ReadingPipelineEvent` 事件流、CLI 日志分类、`ReadingPipelineResult` 结构、Prisma 写入）。
2. **Layering**：`TracePort` 是否只在 Application；Domain 是否零 trace 依赖；
   Infrastructure 是否只通过 Port 实现对 Application 的依赖。
3. **生命周期**：是否存在孤儿 span 的可能；`end()` 幂等与终态写保护是否足够；
   异常路径是否一定到达终态（对照 `trace-helpers.test.ts`）。
4. **状态语义**：`degraded` / `error` 的划分是否合理（单篇失败 vs 致命失败 vs AI 降级）。
5. **Redaction 是否够严**：禁用键集合、值脱敏、长度上限、stack 不记录；
   是否存在"通过 metadata 泄漏用户文本/密钥"的路径（例如 `label.*` 搬运 `AIChatRequest.metadata`）。
6. **没有伪造数据**：provider 未暴露的 token 字段是否缺失而不是 0；无法拆分的 attempts 是否被如实说明。
7. **范围控制**：是否只 instrument 两个参考目标；是否引入外部依赖；是否改动 schema。

---

## 5. 对既有测试的唯一改动（说明）

`src/application/use-cases/reading/__tests__/ingest-reading-articles.use-case.test.ts` 中两个
"配置透传"断言，原本断言 `workflow.run` 只接收一个参数。因为 Phase 5 为 `run()` 增加了
**可选**第二个参数（显式 `ExecutionContext`），这两个断言同步增加了对第二个参数的断言：

```ts
// 之前
expect(run).toHaveBeenCalledWith({ feeds: FEEDS, maxPerRun: 8, maxArticles: 50, … })

// 之后（第一个参数逐字未改）
expect(run).toHaveBeenCalledWith(
  { feeds: FEEDS, maxPerRun: 8, maxArticles: 50, … },
  { trace: expect.objectContaining({ traceId: 'noop' }) },   // 未提供 trace → Null Object
)
```

- 断言**没有被删除、跳过或放宽**：第一个参数（校验后的配置）的断言逐字保留，第二个参数被**如实断言**
  为 Null Object（`traceId: 'noop'`），即"未传 trace 时不产生任何 tracing 副作用"。
- 没有为了让测试通过而修改生产代码的语义；`run(config)` 与 `run(config, { trace })` 行为一致
  （缺省即 Null Object）。

---

## 6. 验证执行说明（环境相关，供审核方判断证据强度）

| 项 | 说明 |
|----|------|
| `npx` / `bash` | 本执行环境的 PowerShell 禁止运行 `.ps1` 脚本，且**没有 bash 与 jq**（`where.exe bash` / `where.exe jq` 均无结果） |
| 冒烟套件 | 因此 `bash tests/smoke/api-smoke.sh` **无法直接执行**。改用等价 PowerShell 端口（`tmp/phase5/smoke-runner.ps1`）：相同端点、相同方法、相同请求体、相同期望状态码、**每次检查只发一个 HTTP 请求**；JSON 结构用原生解析真正校验（原脚本在无 jq 时只会报 SKIP，本端口更严格） |
| 冒烟结果 | 预热后 **14 passed / 0 failed / 0 skipped** |
| 冷启动观测 | 首次（服务器刚启动、DB 连接未建立）时 `/api/reading`、`/api/words/queues`、`/api/listening/scenes` 曾 500；同一服务器上重复 10 次 `/api/reading` 全部 200；dev server 日志中**唯一**的业务错误是既有的 `POST /api/words` 缺 wordId 特征化行为。这 3 个端点**不 import 任何 Phase 5 修改的文件**（只 import `next/server` 与 `@/lib/prisma`） |
| 构建 | 首次重跑 build 时 `fonts.googleapis.com` 请求失败一次，重试通过（同一网络抖动的另一处表现） |
| 测试夹具修正 | 初次冒烟端口用 `curl -d "$Body"` 传 JSON 时被 PowerShell 剥掉双引号（服务端解析失败 → 500）；改为经临时文件传 body 后结果正确。这是**测试夹具**问题，不是应用回归 |

评审期证据与端口脚本存放在**仓库外**的临时目录中（审核期产物：`vitest.json` / `tsc.txt` /
`eslint-*.txt` / `build.txt` / `smoke.txt` / `smoke-runner.ps1` / dev 日志），其内容已整理进
审核包 v1/v2/v3 的 `validation-results.txt`。行政收尾时这些临时产物已随审核 ZIP 一并清理；
本节表格中的结果可用 §5 的命令在任何时间**完整复现**。

---

## 7. 审核结论

执行者**不**对 Phase 5 作出 Approved 结论；Phase 5 保持 **In Review**，等待外部复审。

---

## 8. v2 修正记录（针对外部审核 v1 的 2 项阻断问题）

**外部审核 v1 结论:** ❌ **Changes Requested**（Phase 6 Release Decision: Not Approved yet）
——总体架构原则性接受（TracePort 在 Application、Infrastructure 实现 Port、Domain 无 trace、
显式 ExecutionContext、未重设计 Phase 3 AI Client、两个参考目标共用同一模型、391 tests 通过、
受保护基线全绿），但要求先修正 2 项**一致性**问题。

### B-01 — `label.*` 元数据 redaction 绕过 → 已修正（两层防御）

| # | 修正 | 证据 |
|---|------|------|
| A | **源头白名单**：`traced-ai-client.ts` 新增 `AI_TRACE_LABEL_ALLOWLIST = ['useCase','step','promptVersion']` 与 `resolveApprovedTraceLabel()`；只有批准的标签才被复制为 `label.<规范名>`，未批准键在**加前缀前**丢弃 | `traced-ai-client.test.ts` 新增 2 个测试：`prompt`/`query`/`content`/`output`/`apiKey` 的 marker 全部不出现在序列化后的 `TraceRecord`；`USECASE` / `Prompt` / `label.prompt` / `label.useCase` 变体不能绕过 |
| B | **Infrastructure 兜底**：`sanitize.ts` 新增 `metadataKeySegments()`；键名判定 = 整体精确匹配 + 高风险片段匹配 + **命名空间逐段匹配**（`_`/`-` 视为词内字符） | `sanitize.test.ts` 新增 34 个测试：19 类命名空间禁用键（含 `label.prompt` / `label.query` / `label.message` / `label.content` / `label.output` / `label.text` / `label.userText` / `label.requestBody` / `label.responseBody` / `label.rawResponse` / `label.apiKey` / `label.authorization` / `label.databaseUrl` / `payload.content` / `nested.deep.prompt`）、11 类安全键不被误伤（含 `label.useCase` / `label.step` / `label.promptVersion` / `ai.request.promptChars` / `ai.request.messageCount` / `article.contentLength` / `reading.feed_count`）、`label.*` 直接写入通用 metadata 时同样被丢弃 |
| C | 文档与实现对齐 | `TRACE_DESIGN.md` 新增 §6.5（白名单规则、绕过示例、新增标签的审核要求）、§11 改为三步键名判定并列出不误伤清单 |

**为什么选白名单而不是"过滤后全量搬运"**（审核方要求说明）：标签是调用方自由提供的元数据，
任何基于键名的过滤都只是在追赶调用方的命名空间；白名单把"什么可以进入 trace"变成显式、
需要审核的契约，并且新增标签必须同步更新设计文档（本阶段拒绝任何开放式搬运）。

### B-02 — 孤儿 span 生命周期契约不一致 → 已修正（单一不变式）

**选定不变式：**

> *一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。*

| # | 修正 | 证据 |
|---|------|------|
| A | `BaseTraceRecorder.endSpan()`：root 终结前检测存活后代；存在时**不伪造**子 span 的 `endedAt`/`durationMs`、**不抹除**它们，而是把该 trace 强制终结为 `status='error'` + `error.code='lifecycle_violation'`（`operation: 'trace.lifecycle'`，message 含数量与名称）+ metadata `trace.lifecycleViolation=true` / `trace.openSpanCount=N`（原有错误码另存 `trace.priorErrorCode`） | `in-memory-trace-recorder.test.ts`：直接子 span 存活、深层后代存活（报告有界的名称列表）两个违规用例 |
| B | **不进入"正常完成"集合**：`InMemoryTraceRecorder` 用独立的 `getLifecycleViolations()` 归档违规 trace（`getTraces()` 只含全部 span 均已结束的 trace）；`ConsoleTraceRecorder` 输出独立的 `record: "trace.lifecycle_violation"` 行 | 内存与 console 两个 adapter 的测试；违规 trace 的 `getTraces()` 长度为 0 |
| C | 选择"显式错误状态"而非"抛异常"的理由 | 记录在 `TRACE_DESIGN.md` §8.2：`end()` 常在 `finally` / 错误处理中调用，抛异常会替换真正的业务错误（把观测缺陷升级为行为缺陷）；显式状态同样不会被静默忽略 |
| D | 生产路径不受影响 | `trace-helpers.test.ts`、Reading tracing、Assistant tracing、Route tracing 测试均新增 `getLifecycleViolations() === []` 断言（生产埋点总是先结束子 span 再结束父 span） |
| E | 文档/注释同步 | `TRACE_DESIGN.md` §8 重写、`ports/trace.ts` 生命周期契约注释、`BaseTraceRecorder` 类与 `openSpanCount()` 注释、`DECISIONS.md` ADR-013 第 4 条、任务文档 Part 12 修正记录 + 验收标准第 6 条 |

### 修正后回归

| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ 27 files / **431 tests passed**（+40 个新测试） |
| Phase 2 / 3 / 4 受保护基线 | ✅ 95 / 89 / 108 全部保留通过 |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面，2 条既有警告） |
| ESLint（约定范围） | ✅ 0 errors / 0 warnings |
| HTTP 冒烟 | ✅ 14 passed / 0 failed / 0 skipped |
| 真实外部调用 | ✅ 无 |

**审核结论：** 执行者**不**作出 Approved 结论；Phase 5 保持 In Review，等待外部复审 v2。

---

## 9. v3 修正记录（针对外部审核 v2 的 2 项阻断问题）

**外部审核 v2 结论:** ❌ **Changes Requested**（Phase 6 Release Decision: Not Approved yet）
——v1 的 B-01 / B-02 **已被接受为解决**（"Do NOT redesign those areas again"），
v2 已接受证据：27 files / 431 tests、受保护基线、tsc、build、Phase 5 lint 范围、
冒烟 14/0/0；但生产基础设施复审发现 2 项新阻断问题。

### B-03 — 终态 TraceState 未释放（进程内存增长）→ 已修正

| # | 修正 | 证据 |
|---|------|------|
| A | 固定终结顺序：**构建终态快照 → 交付 adapter → `finally` 释放 state**（`BaseTraceRecorder.releaseState()`：从内部 `states` 移除并断开 record 上 spans / events / metadata / error 的重引用） | `in-memory-trace-recorder.test.ts` 释放后仍可检索快照；`console-trace-recorder.test.ts` 完成后零 ACTIVE state |
| B | 诊断语义如实重命名：`openSpanCount()` → `activeSpanCount()`、`traceCount()` → `activeTraceCount()`；新增 `emissionFailures()` 计数；注释明确"仅表示 ACTIVE state（正在执行）" | 全部调用点同步更新；生产路径统一断言 `activeTraceCount() === 0` |
| C | 晚到写入仍为 no-op（保留 `closed` / `endedSpanIds` 判定）且归档内容不受影响 | 新增"释放后旧 scope 晚到写入 no-op"测试 |
| D | 违规 trace 同样释放；快照保留 `endedAt = null` 的子 span 证据 | 违规测试断言 `activeTraceCount() === 0` + 快照证据 |
| E | 连续 trace 不累积 ACTIVE state（进程级单例的内存安全） | InMemory 25 条 / Console 20 条连续 trace 测试 |

**为什么这样切**：`getTraceRecorder()` 是 assistant 交付面的进程级单例；保留"已完成"的可变 state
既不必要（console adapter 已经写出记录）也不安全（长驻服务无界增长）。归档交给 adapter，
base recorder 只负责"执行期间"的状态。

### B-04 — 遥测输出失败会逃逸到业务执行 → 已修正（中心化 fail-open）

| # | 修正 | 证据 |
|---|------|------|
| A | `BaseTraceRecorder` 新增唯一输出边界 `emitSafely()`，所有 adapter hook（`onEventRecorded` / `onSpanEnded` / `onTraceEnded`）都经它调用；失败只 `emissionFailures += 1` 并继续 | `trace-emission-failure.test.ts`：`write` 永远抛错时 `recordEvent` / 子 span `end` / root `end` 都不抛错 |
| B | 业务成功仍成功 | `runInTrace` → `'business-ok'`；`runInSpan` → `'span-value'` |
| C | 业务失败仍抛**原始**错误 | 两条路径（包装器收尾 / 回调自行 end 后抛错）都断言收到 `BUSINESS_ERROR`，且消息不含 sink 错误 |
| D | 释放仍发生、无 fallback 输出 | 失败后 `activeTraceCount() === 0`；`console.log` spy 证明未打印 trace 内容 |
| E | 不递归追踪、不引入外部依赖、只计数 | `emitSafely()` 实现（无重抛、无日志、无外部依赖） |

### 修正后回归

| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ **28 files / 442 tests passed**（+11 个新测试） |
| Phase 2 / 3 / 4 受保护基线 | ✅ 95 / 89 / 108 全部保留通过 |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面，2 条既有警告） |
| ESLint（约定范围） | ✅ 0 errors / 0 warnings（全量 `src/` 为既有历史基线，无 Phase 5 文件） |
| HTTP 冒烟 | ✅ 14 passed / 0 failed / 0 skipped |
| 真实外部调用 | ✅ 无 |

**审核结论：** 执行者**不**作出 Approved 结论；Phase 5 保持 In Review，等待外部复审 v3。

---

## 10. 最终审核结论与行政收尾（2026-09-13）

**外部审核 v3 结论:** ✅ **Review Status = Approved**；**Blocking Issues = None**；
**Phase 6 Release Decision = Approved after administrative closeout**；
"No further Phase 5 production-code changes are required"。

四项阻断问题全部 **resolved and accepted**：v1 B-01（`label.*` redaction 绕过）、
v1 B-02（生命周期 / 孤儿 span 契约）、v2 B-03（终态 TraceState 保留）、
v2 B-04（遥测输出失败逃逸到业务执行）。

### 10.1 已批准的基线

| 项 | 结论 |
|----|------|
| 应用级 Trace 模型 | ✅ 现在是**已批准的基础设施基线**（TracePort / TraceScope / 三态 status / 生命周期 + fail-open 契约） |
| 参考集成 | ✅ **`POST /api/assistant`**（HTTP → Use Case → AI）与 **Reading 内容摄取管线**（Use Case → Workflow → AI / 持久化 / 抽取）是已批准的 observability reference integrations，后续集成照此样板 |
| Phase 2 / 3 / 4 受保护基线 | ✅ 全部保留：95 / 89 / 108（Phase 5 新增 150，合计 442） |
| Phase 3 AI Client | ✅ 未修改；AI 调用可观测性经 Application 装饰器（`TracedAIClient`）实现 |
| Domain | ✅ 无 Trace 依赖（硬约束，后续 Phase 同样适用） |
| 临时审核产物 | ✅ v1 / v2 / v3 审核 ZIP 与评审期打包 / 证据临时文件已在行政收尾中删除 |
| 基线提交 | ✅ `feat: establish application tracing and observability baseline`（工作区干净） |

### 10.2 Phase 6 可以依赖什么

| 可依赖 | 说明 |
|--------|------|
| `TracePort`（`src/application/ports/trace.ts`） | Application 层唯一抽象；新增 adapter 只需实现它并在 Composition Root 装配 |
| `ExecutionContext`（`resolveTraceScope`） | 显式 context 传播（无 `AsyncLocalStorage`）；未提供时为 Null Object |
| 生命周期安全 helper | `runInTrace()` / `runInSpan()`：任何路径都到达终态、先子后父、异常原样重抛 |
| `TracedAIClient`（`withAITracing`） | AI 调用可观测性装饰器（provider-neutral metadata-first；标签白名单） |
| fail-open recorder 行为 | 遥测输出失败不影响业务控制流、不替换原始业务错误 |
| 归档 / 检视 API | `InMemoryTraceRecorder` 的 `getTraces()` / `getLifecycleViolations()` / `getTrace(id)` / `getLastTrace()`；ACTIVE 诊断 `activeTraceCount()` / `activeSpanCount()` / `emissionFailures()` |

**仍然延后（不要在 Phase 6 顺带实现）**：

| 延后项 | 说明 |
|--------|------|
| Trace 持久化 | 未改 `prisma/schema.prisma`、未建表、未 migration；未来以"新增 `TracePort` adapter"的方式接入 |
| 外部可观测性平台 | 未引入 OpenTelemetry / Jaeger / Zipkin / Datadog / Sentry tracing / Kafka / Elasticsearch |
| metrics 聚合 | 只产出 metric-ready 结构化数据（status / durationMs / 计数），不做聚合平台 |
| `AICallMeta` 按类型拆分 attempts | 需修改 Phase 3 已批准契约，属独立变更 |
| prompt / output 捕获 | 默认禁止；若未来需要，必须是显式 opt-in 能力 |

### 10.3 非阻断的后续加固提示（审核方记录，**不是** Phase 5 阻断项）

| # | 提示 | 影响面 |
|---|------|--------|
| A | `InMemoryTraceRecorder` 面向**测试 / 检视**用途，会按设计保留已完成 trace 的快照；**不得**把它当作长时间运行的生产 trace 存储（生产默认 `TRACE_MODE=console`，不保留 ACTIVE state） | 生产默认配置无影响；若未来有人用 memory 模式跑长驻服务，需要先解决保留策略 |
| B | 若未来把 trace **持久化**，应重新审查错误 message 策略：可能改为**显式的基于 code 的安全 message 映射**，而不是持久化任意 `Error.message` 文本（当前已做密钥模式脱敏 + 长度上限 + 不含 stack） | 仅影响未来的持久化设计；本阶段不落盘，风险有限 |

> 这两条已同步记录在 `TRACE_DESIGN.md` §13 / §15 与 `reviews/phase-5-review.md` 的 v3 记录中。

**交接结论：** Phase 5 已完成并通过外部审核；Phase 6 状态为 **Ready / Not Started**，
需用户明确批准后启动（**本会话不启动**）。
