# Trace / 可观测性设计 — Phase 5

**日期:** 2026-09-13
**状态:** 已实现，等待外部审核（Phase 5 = In Review）
**范围:** **两个**已批准参考目标的应用级 Trace：Phase 3 `POST /api/assistant`、Phase 4 Reading 内容摄取管线
**复用:** Phase 3 已批准的 `AIClientPort` / `AIClient` / `DeepSeekAdapter`（**未修改**）

---

## 1. 目标与非目标

### 1.1 目标

1. 建立**第一个应用级 Trace 系统**，让 AI 调用与 Workflow 执行可见、可检查、可测试。
2. 用**同一套可复用设计**证明两类执行都可被观测：简单 AI Use Case（assistant）与确定性多步 Workflow（reading）。
3. 提供：trace 身份、执行计时、Workflow 步骤可见性、AI 调用可见性、归一化成功/失败状态、
   错误元数据、provider/model 元数据、可用时的 token usage 与 retry/repair 元数据、
   一次应用请求与其内部操作的关联。
4. **不改变任何业务行为**：不改重试语义、超时语义、响应结构、model/provider、数据库 schema、用户可见行为。
5. 保持架构不变形：Tracing 是横切关注点，Domain 零 Trace 依赖；依赖方向仍是 Delivery → Application → Domain，
   Application → `TracePort`，Infrastructure 实现 `TracePort`。

### 1.2 非目标

| 非目标 | 说明 |
|--------|------|
| 通用分布式追踪框架 | 不做 cross-process / cross-service context 传播，不做采样、baggage、trace 后端 |
| OpenTelemetry / Jaeger / Zipkin / Datadog / Sentry tracing | **不引入**（见 §14） |
| Trace 持久化 | 不改 `schema.prisma`、不建 Trace 表、不写 migration（见 §13） |
| Metrics 平台 | 不建指标聚合系统；只产出 metric-ready 的结构化数据（见 §3） |
| 全仓库埋点 | 只 instrument 两个参考目标；其余 feature 明确不做（Phase 4 已记录的延后项继续延后） |
| 内容采集 | 默认**不记录** prompt / 模型输出 / 用户文本（见 §11） |
| 修改已批准的 AI Client | Phase 3 契约不动；AI 可观测性用 Application 层装饰器实现（见 §6） |

---

## 2. Before：现有可观测性盘点（以当前仓库为准）

| 维度 | Phase 5 之前现状 | 证据 |
|------|-----------------|------|
| 自由文本日志 | 有，但无统一 logger：`scripts/reading-push.ts`（20 处）、12 个 API Route 各 1 处 `console.error`、`src/features/listening/lib/listening.ts`（7 处）、多个脚本 | `rg -c "console\.(log\|error\|warn)" src scripts` |
| AI 元数据 | `AICallMeta { provider, model, latencyMs, attempts, usage?, finishReason? }`，**只返回给调用方**，不落库不上报 | `src/application/ports/ai-client.ts` |
| 延迟测量 | 只有 AI 逻辑调用的墙钟耗时；无 HTTP 级 / Workflow 步骤级计时 | `AIClient.buildMeta()` |
| 重试尝试信息 | `AICallMeta.attempts`（网络重试与解析修复**合并计数**）；策略在 `retry.ts` 内部 | `src/infrastructure/ai/retry.ts` |
| 结构化输出修复信息 | `maxRepairAttempts` 选项存在，**实际修复次数不对外暴露** | `structured-output.ts` / `ai-client.ts` |
| Workflow 事件 | `ReadingPipelineEvent`（11 种：feed / candidates / article / trim / earlyExit）→ 交付层自由文本日志 | `reading-pipeline.workflow.ts` |
| HTTP 级请求上下文 | **无**：无 middleware、无 requestId，Route 只读 `request.json()` | `rg "middleware"` 无结果 |
| 错误归一化 | `AIError`（8 码 + `retryable`/`status`/`provider`/`cause`）、`ApplicationError`（4 码 + `cause`） | `ports/ai-client.ts`、`application/errors.ts` |
| 现有 ID / correlation ID | **无**（全仓库无 `traceId` / `requestId` / `correlationId`） | `rg "traceId\|requestId\|correlationId" src scripts tests` 无结果 |
| 日志工具 | **无** logger 模块，直接 `console.*` | — |
| DB / 日志 schema | 仅 7 张业务表（Word / WordReview / Article / ArticleVocab / ListeningScene / ListeningLine / DailyProgress），**无日志/trace 表** | `prisma/schema.prisma` |

**结论：** 迁移前不存在可复用的 Trace 系统；只有分散的自由文本日志，加上一层**已经归一化**的 AI 元数据
（Phase 3 的 `AICallMeta` 为此阶段的接入点）与 Phase 4 已经显式化的 Workflow 步骤事件边界。

---

## 3. Trace vs Log vs Metric

三者**不得混用**：

| 概念 | 定义 | 本阶段的表示 | 回答的问题 |
|------|------|-------------|-----------|
| **Trace** | 一次**逻辑执行**的完整记录，用 `traceId` 聚合相关操作，包含 spans / steps / events | `TraceRecord`（root span + 后代 span + 事件） | 这次执行**发生了什么**？ |
| **Log** | 单条**诊断记录**，可属于某个 trace | 交付层操作员日志（既有 `[reading-push] …` / `console.error`）；trace 内的结构化事件（`TraceEventRecord`） | 发出了**什么事件/消息**？ |
| **Metric** | 跨执行的**聚合数值**（平均延迟、错误率、token 总量） | Phase 5 **不建指标平台**，只产出 metric-ready 数据：每个 span 都有 `status` / `durationMs` / 结构化 metadata | 一段时间内**整体表现如何**？ |

本阶段的边界：

- Trace 是**结构化、有身份、有父子关系**的记录；Log 是它的补充信息通道，不是替代品。
- 既有的操作员日志（Phase 4 已批准的行为）**保持不变**：`ReadingPipelineEvent` → CLI 文本日志的映射没有改动。
  trace 是**新增的并列输出**，不是替换。
- 由于每个 span 都带 `status` + `durationMs` + 计数型 metadata，未来任何 metrics 适配器都可以**直接消费**它们；
  但本阶段不实现聚合、不实现采样、不做成本计算。

---

## 4. Trace 模型

定义位置：`src/application/ports/trace.ts`（Application Port；只有类型与接口，无实现）。

```
TraceRecord
  traceId        string          应用级唯一标识（内部生成，无密钥/用户内容）
  name           string          逻辑操作名（如 http.assistant / reading.ingest）
  category       SpanCategory    root span 分类
  status         TraceStatus     ok | degraded | error
  startedAt      number          epoch ms
  endedAt        number | null   epoch ms（未结束为 null）
  durationMs     number | null   endedAt - startedAt（未结束为 null）
  metadata       TraceMetadata   计数 / 尺寸 / 标识符 / 标签（已清洗）
  error          TraceErrorInfo | null
  spans          SpanRecord[]    全部 span，按开始顺序；spans[0] 是 root span
  events         TraceEventRecord[]  全部事件，按发生顺序
```

根 span 的 `name` / `category` / `status` / `startedAt` / `endedAt` / `durationMs` / `metadata` / `error`
在 `TraceRecord` 上镜像一份，便于消费者不遍历数组直接读取。

### 4.1 Span 模型

```
SpanRecord
  traceId        string
  spanId         string
  parentSpanId   string | null   root span 为 null
  name           string
  category       SpanCategory
  status         TraceStatus
  startedAt      number
  endedAt        number | null
  durationMs     number | null
  metadata       TraceMetadata
  error          TraceErrorInfo | null
```

### 4.2 分类（candidate categories → 实际使用）

| category | 本阶段实际用途 |
|----------|---------------|
| `http` | `http.assistant`（POST /api/assistant 的 root trace） |
| `use_case` | `reading.ingest`（CLI root trace）、`assistant.reply` |
| `workflow` | `reading.pipeline` |
| `workflow_step` | `reading.collect_candidates` / `reading.select_new_articles` / `reading.process_articles` / `reading.process_article` / `reading.trim_to_limit` |
| `ai` | `ai.chat` / `ai.chat_structured`（装饰器产生） |
| `persistence` | `assistant.word_lookup`、`reading.load_existing_index`、`reading.persist_article` |
| `external_io` | `reading.feed_fetch`、`reading.extract_article` |
| `validation` | `reading.normalize_payload` |

模型刻意保持小：**不**复刻 OpenTelemetry（无 resource/attribute 层级、无 links、无 span kind 体系、
无 baggage、无 sampling），**不**支持任意分布式系统。

---

## 5. traceId 生命周期与 context 传播

### 5.1 生成

- traceId / spanId 由 **Infrastructure 的 recorder 内部生成**（`createTraceId()`，优先 `crypto.randomUUID()`，
  退化为带时间戳的随机串）。
- 应用级唯一即可；**不含**密钥、用户内容或业务数据。
- 测试可注入 `createId` 获得确定性 ID。

### 5.2 传播（显式 ExecutionContext，不使用 AsyncLocalStorage）

```
Delivery（CLI / HTTP Route）
  └─ tracer.startTrace(name, {category, metadata})   ← 创建 root trace
       └─ ExecutionContext { trace }                 ← 显式参数
            ├─ Use Case（assistant.reply / reading.ingest 语义状态）
            │    └─ Workflow（reading.pipeline）
            │         └─ 步骤 span（workflow_step）
            │              ├─ 端口调用 span（persistence / external_io）
            │              └─ AI 装饰器 span（ai）
```

**为什么不用 `AsyncLocalStorage`**（Phase 5 任务文档 Part 4）：

1. 依赖方向清晰 —— trace 是**参数**，Infrastructure 通过 Port 接收 span，Domain 完全看不到它；
2. 无隐式全局状态 —— 并发请求 / 并发运行不会互相污染；
3. 可测试 —— 测试直接构造 scope 或注入内存 recorder，不需要 mock 全局 API；
4. 与仓库既有风格一致 —— Phase 3 的 `AIClient` 同样通过显式注入（`now` / `sleep` / `random` / `fetchImpl`）实现可测性；
5. 本仓库没有"跨越大量中间层才能拿到 context"的痛点：Delivery → Use Case → Workflow → Port 的调用链是显式的。

未提供 `ExecutionContext` 时使用 **Null Object**（`NOOP_TRACE_SCOPE`）：调用方无需判空，生产路径零开销，
行为与迁移前完全一致。这也让所有既有测试（不传 trace）继续通过。

### 5.3 Domain 边界

Domain（`src/domain/**`）**没有**任何 trace / logger / console / infrastructure 依赖；
tracing 只出现在 Application（ports + observability + workflow/use-case 编排）与 Infrastructure（adapter）。

---

## 6. TracePort 与 Infrastructure 实现

### 6.1 Port（Application）

`src/application/ports/trace.ts`：

```ts
interface TracePort {
  startTrace(name: string, options?: { category?: SpanCategory; metadata?: TraceMetadata }): TraceScope
}

interface TraceScope {            // root trace 与子 span 共用同一句柄类型
  readonly traceId: string
  readonly spanId: string
  readonly name: string
  readonly category: SpanCategory
  startSpan(name: string, options?: SpanStartOptions): TraceScope
  recordEvent(name: string, options?: { metadata?: TraceMetadata }): void
  addMetadata(metadata: TraceMetadata): void
  recordError(error: unknown, options?: RecordErrorOptions): void
  end(status?: TraceStatus, options?: { metadata?: TraceMetadata }): void
  isEnded(): boolean
}
```

设计取舍：

- **没有**机械照搬 `startTrace/endTrace/startSpan/endSpan/…` 的平铺 API，而是"工厂 + 句柄"：
  `startTrace()` 返回句柄，其余操作在句柄上完成。好处是**父 span 必须显式传递**，无法"忘记指定父节点"，
  也不需要 `AsyncLocalStorage` 来推断当前 span。
- `recordError` 接受 `unknown`，由 adapter 统一归一化（调用方不需要知道如何 shaping 错误），
  这样 AI 错误 / 应用错误 / 基础设施错误走同一条安全路径。
- 追加写入发生在**已结束**的 scope 上时是无害 no-op（见 §8）。
- Port 与类型**不依赖** DeepSeek / Prisma / Next.js / console / 文件系统。

配套的 `ClockPort`（`src/application/ports/clock.ts`，只有 `now(): number`）是最小的可注入时间源；
生产用真实时间（`src/infrastructure/time/system-clock.ts`），测试注入假时钟。

### 6.2 Application 组合件

| 文件 | 作用 |
|------|------|
| `src/application/observability/execution-context.ts` | `ExecutionContext { trace? }` + `resolveTraceScope()`（缺省 → Null Object） |
| `src/application/observability/trace-helpers.ts` | `runInTrace()` / `runInSpan()`：生命周期安全的包装器（try/finally 语义 + 幂等 end + 错误记录 + 原样重抛） |
| `src/application/observability/traced-ai-client.ts` | `AIClientPort` 装饰器（`withAITracing`），见 §6.3 |

> 目录说明：`src/application/observability/` 是 Phase 5 新增的 Application 子目录，
> 用于"只依赖 Application port、被 Application 编排复用"的横切组合件。
> 它不引入新的层，也不违反 D-002/D-003（不 import Infrastructure）。

### 6.3 AI 调用可观测性（装饰器而非改 AI Client）

Phase 3 的 `AIClient` 已经通过 provider-neutral 的 `AICallMeta` 暴露了 provider / model / latency /
attempts / usage / finishReason。因此 Phase 5 的接入方式是：

```
Application 编排 → withAITracing(innerAIClient, span) → 返回一个新的 AIClientPort
                     └─ 每次 chat / chatStructured 开启一个 `ai` span，
                        成功后写入 AICallMeta 的归一化字段，失败时记录归一化 AIError 后原样抛出
```

优点：

- **不需要修改已批准的 AI Client**（Phase 3 baseline 完全未动）；
- provider 细节（HTTP、认证头、原始响应）仍然只存在于 Infrastructure，不上浮；
- 装饰器是纯 Application 代码（只依赖两个 Application port），可独立测试。

**已知限制（诚实记录）：** `AICallMeta.attempts` 把**网络重试与解析修复合并计数**，
因此本阶段无法从边界**如实**拆分"网络重试几次 / 解析修复几次"。Phase 5 的选择是：

- 记录 `ai.attempts`（实际发出的 provider 请求总数，来自 Phase 3 契约）；
- 记录编排层已知的策略上限（`ai.request.retryMaxAttempts`、`ai.repairAllowed`）；
- **不伪造**拆分后的计数；把"在 `AICallMeta` 中新增按类型拆分的计数字段"列为**延后工作**
  （它需要修改 Phase 3 已批准的契约，属于独立变更）。

### 6.4 Infrastructure 实现

| 文件 | 作用 |
|------|------|
| `src/infrastructure/telemetry/base-trace-recorder.ts` | 共享骨架：ID 生成、时钟、span 生命周期、metadata 清洗、trace 组装、终态写保护 |
| `src/infrastructure/telemetry/in-memory-trace-recorder.ts` | 结构化**内存**实现（测试 / 执行期检视）：`getTraces()` / `getTrace(id)` / `getLastTrace()` / `openSpanCount()` |
| `src/infrastructure/telemetry/console-trace-recorder.ts` | **结构化 JSON 行**输出（每条 span / event / trace 一行），sink 可注入（默认 `console.log`） |
| `src/infrastructure/telemetry/sanitize.ts` | redaction / 长度上限 / 类型收敛（见 §11） |
| `src/bootstrap/trace-composition.ts` | Composition Root：`createTraceRecorder({mode})` / `getTraceRecorder()`（进程单例） |

模式选择：显式参数 → `TRACE_MODE`（`console` / `memory`）→ `NODE_ENV === 'test'` 时 `memory`，否则 `console`。

**没有引入**任何外部可观测性系统；输出格式足够结构化，未来换一个 adapter 即可转发到别处（见 §14）。

两条**长期不变式**（外部审核 v2 的 B-03 / B-04）在此实现，并在 §8.4 / §8.5 展开：

| 不变式 | 含义 |
|--------|------|
| ACTIVE state 生命周期 | recorder 只在 trace **执行期间**保留可变状态；终态快照交付 adapter 后在 `finally` 中释放 |
| fail-open 输出 | adapter 输出失败**绝不**改变业务控制流，也不替换原始业务错误 |

实现此不变式的内部诊断 helper（**不属于** `TracePort`）：
`activeTraceCount()` / `activeSpanCount()`（仅统计 ACTIVE state）与
`emissionFailures()`（被 fail-open 边界吞掉的输出失败次数，仅计数、不含内容）。

---

## 7. 状态语义与埋点设计

### 7.1 TraceStatus

| status | 含义 |
|--------|------|
| `ok` | 操作按预期完成 |
| `degraded` | 操作完成，但存在**已兜底 / 已隔离**的失败（如 AI 降级后文章仍入库、单篇失败但整轮继续） |
| `error` | 操作自身失败（抛错或无法完成职责） |

**状态不自动向上冒泡。** 理由（Phase 5 任务文档 Part 8）：一次 Reading 运行中出现单篇失败时，
该篇 span 是 `error`，但**整轮仍在完成**——把整轮 trace 直接判成 `error` 会掩盖"部分失败"与"致命失败"的区别。
因此：

- 单篇 `reading.process_article` span：`ok`（入库成功）/ `degraded`（AI 降级但仍入库）/ `error`（该篇失败）
- `reading.pipeline` workflow span 与整轮 trace：`error`（致命）/ `degraded`（有单篇失败或 AI 降级）/ `ok`
- 交替对照：`degraded` 与 `ok` 可区分，`error` 与 `degraded` 可区分

### 7.2 Assistant 埋点（Part 9）

```
http.assistant (http)                        ← Route 创建（Delivery）
  └─ assistant.reply (use_case)              ← Use Case
       ├─ assistant.word_lookup (persistence) ← 可选词卡增强
       └─ ai.chat (ai)                        ← 装饰器，含 provider/model/usage/错误码
```

- 响应头新增 `X-Trace-Id`（**纯增量**，不影响响应体与状态码）。
- 用户可见行为不变：AI 失败仍然是 `200` + 友好文案；trace 如实记为 `error`，
  且记录 `http.outcome = 'friendly_fallback'` 与 `assistant.fallback` 事件，
  以便区分"用户看到 200"与"这次执行其实失败了"。
- 校验失败（无 query）仍然是 `400`，trace 记为 `error` + `invalid_request`。
- 请求体非法 JSON 仍然照旧抛出（→ 500），但 trace 仍会到达终态。
- 不改变：重试语义（`maxAttempts: 1`）、超时语义（30s）、model/provider、Prompt 文本、JSON 响应结构。

### 7.3 Reading Workflow 埋点（Part 8）

挂点严格使用 Phase 4 已经显式化的**真实步骤边界**（不发明新步骤）：

```
reading.ingest (use_case)                     ← CLI 创建（Delivery，一次运行 = 一个 traceId）
  └─ reading.pipeline (workflow)
       ├─ reading.collect_candidates (workflow_step)
       │    └─ reading.feed_fetch (external_io) × feed（对应既有 feed:start / feed:loaded 事件边界）
       ├─ reading.select_new_articles (workflow_step)
       │    └─ reading.load_existing_index (persistence)   ← 去重所需的两次只读查询
       ├─ reading.process_articles (workflow_step)
       │    └─ reading.process_article (workflow_step, article.index=N) × 文章
       │         ├─ reading.extract_article (external_io)
       │         ├─ ai.chat_structured (ai)                 ← 装饰器
       │         ├─ reading.normalize_payload (validation)  ← 纯规则归一化
       │         └─ reading.persist_article (persistence)
       └─ reading.trim_to_limit (workflow_step)
```

事件（记录在对应 span 上，**不**改动 `ReadingPipelineEvent` 操作员事件流）：

| 事件 | 位置 | 语义 |
|------|------|------|
| `run.early_exit` | workflow span | 无候选 / 无新文章（`metadata.reason`） |
| `article.skipped` | article span | 正文过短被跳过（`metadata.article.contentLength`） |
| `article.degraded` | article span | AI 失败但文章仍入库（`metadata['ai.errorCode']` / `ai.errorName`） |

关键行为：

- **一次 Reading 运行 = 一个 traceId**（CLI 创建 root trace 并显式传给 Use Case）。
- 单篇操作通过 `parentSpanId` + `article.index` 关联到本轮运行。
- 单篇失败可见，但**不**导致整轮失败（`error` 只落在该篇 span 上，整轮为 `degraded`）。
- 致命失败（`feed_unavailable` / `persistence_failed` / 配置非法）→ 整轮 trace `error` + 归一化错误码。
- 结构化 AI 输入输出**不进入** trace（只有计数、尺寸、provider/model、错误码）。
- 业务行为零改动：日志分类与控制流与 Phase 4 一致；`ReadingPipelineResult` 结构不变；数据库写入不变。

### 7.4 AI Client 埋点（Part 7）

每个 AI 调用产生一个 `ai` span：

| 记录（可用时） | 说明 |
|---------------|------|
| `ai.operation` | `chat` / `chatStructured` |
| `ai.schema` | 结构化输出的 schema 名（`chatStructured`） |
| `ai.provider` / `ai.model` | 来自 `AICallMeta` |
| `ai.latencyMs` | 整次逻辑调用墙钟耗时（含重试与退避） |
| `ai.attempts` | 实际发出的 provider 请求次数 |
| `ai.usage.promptTokens` / `completionTokens` / `totalTokens` | provider 未暴露时**不存在**（不伪造 0） |
| `ai.finishReason` | provider 可用时 |
| `ai.repairAllowed` | 本次结构化调用的解析修复上限（策略） |
| `ai.request.model/temperature/maxTokens/responseFormat/messageCount/promptChars/retryMaxAttempts/timeoutMs/totalBudgetMs` | 参数与**尺寸**（不是内容） |
| `ai.response.chars` | 模型输出长度（`chat`） |
| `label.<key>` | `AIChatRequest.metadata` 中**已批准**的 provider-neutral 标签（见 §6.5 白名单规则） |
| 失败时 span `error` | `AIError.code` / `provider` / `retryable` / `status` + 安全 message |

### 6.5 `label.*` 标签白名单（外部审核 v1 修正 B-01）

`AIChatRequest.metadata` 的类型是自由的 `Record<string, string>`，调用方可以放入任意键值。
Phase 5 v1 曾把其中**所有**键复制为 `label.<key>`，这构成一条 redaction 绕过路径：

```
metadata = { prompt: '用户提示词' }
  → 复制为 label.prompt
  → normalizeMetadataKey('label.prompt') = 'labelprompt'
  → 与禁用键 'prompt' 的整体精确匹配**不再命中** → 内容进入 trace
```

修正（defense in depth，两层独立生效）：

1. **源头白名单（Application，`traced-ai-client.ts`）**：只有显式批准的标签会被复制，
   未批准的键**在加前缀之前**就被丢弃。当前白名单：

   | 标签 | 用途 |
   |------|------|
   | `useCase` | 调用所属用例（如 `assistant.qa` / `reading.ingest`） |
   | `step` | 用例内部步骤名（如 `process-article`） |
   | `promptVersion` | Prompt 版本标记 |

   选择白名单而不是"过滤后全量搬运"的理由：标签是**调用方自由提供的元数据**，
   任何基于键名的过滤都只是在追赶调用方的命名；白名单把"什么可以进入 trace"
   变成显式的、需要审核的契约。标签名必须与内容无关（版本号 / 用例名 / 步骤名），
   **不得**承载提示词、模型输出或用户文本。新增标签 = 显式契约变更，需更新本文件并接受审核。
   写回时使用规范名（大小写不敏感匹配），例如 `USECASE` → `label.useCase`。

2. **Infrastructure 兜底清洗（`sanitize.ts`）**：即使有人绕过装饰器直接把 `label.*`
   写进通用 trace metadata，`label.prompt` / `label.query` / `label.apiKey` / `label.databaseUrl`
   等键仍会被丢弃（见 §11 的命名空间分段规则）。

---

## 8. 生命周期（Part 12）

```
startTrace ──→ 子 span / 事件 ──→ 成功 / 失败 ──→ end(status)
```

### 8.1 唯一不变式（外部审核 v1 修正 B-02）

> **一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。**

这正是"每个已开始的 scope 都必须到达终态"这一要求的**可执行形式**：

- 生产埋点（`runInTrace` / `runInSpan`）保证在**任何**路径（正常返回、`return`、抛异常）下
  **先结束子 span，再结束父 span**，因此正常运行时永远满足该不变式；
- 若有人手工埋点、把 root 的 `end()` 放在子 span 结束之前，**不变量被显式打破**，
  系统不会假装一切正常（见 §8.2）。

### 8.2 root 在有存活后代时被终结：显式的生命周期违规

`BaseTraceRecorder` 在 root `end()` 时检测存活后代，若存在则：

| 行为 | 说明 |
|------|------|
| **不伪造** | 不修改任何子 span 的 `endedAt` / `durationMs`（它们保持 `null`，即"确实没有结束"） |
| **不抹除** | 存活子 span 仍然保留在 `spans[]` 中（可见、可诊断） |
| **显式状态** | 该 trace 状态**强制**为 `error`（覆盖调用方传入的 `ok` / `degraded`），并写入 `error.code = 'lifecycle_violation'`、`error.operation = 'trace.lifecycle'`、可读 message（含存活 span 数量与名称） |
| **显式标记** | metadata：`trace.lifecycleViolation = true`、`trace.openSpanCount = N`；若原本已有错误码，另存 `trace.priorErrorCode` |
| **不归档为正常完成** | 内存实现把它放进 `getLifecycleViolations()`，**不放进 `getTraces()`**；console 实现输出独立的 `record: "trace.lifecycle_violation"` 行，不会被误读为一次正常完成 |

**为什么选择"显式错误状态"而不是抛异常（选项 b 而非 a）**：`end()` 常常在清理路径（`finally` /
错误处理）中被调用；在那里抛异常会**替换掉真正的业务错误**，把观测缺陷升级成行为缺陷。
显式错误状态同样不会被静默忽略（两种 adapter 都会把它与正常完成区分开），但不会影响业务控制流。

**为什么"违规后不自动补齐子 span"**：自动补时间戳会伪造证据；违规的意义就在于暴露埋点缺陷。
违规 trace 的存活 span 会永久保持 `endedAt = null`，并由 `openSpanCount()` 报告。

### 8.3 其余生命周期保证

1. `runInTrace()` / `runInSpan()` 用 **try/catch（等价 try/finally）** 包住回调：
   - 正常返回 → 若回调未自行 `end()`，则以 `ok` 结束；
   - 抛异常 → 记录归一化错误 → 以 `error` 结束 → **原样重抛**（错误语义不被 tracing 改变）。
2. `end()` **幂等**：只有第一次调用生效，后续调用被忽略（不会改写耗时或状态）。
3. **终态写保护**：scope 一旦结束，其上的 `startSpan` / `recordEvent` / `addMetadata` / `recordError`
  全部为 no-op；trace root 结束后也不再接受新的子 span（返回惰性 scope），避免"已关闭的 trace 又被追加"。
4. 每个失败路径都有测试覆盖（见 §12），其中包括"root 在有存活子 span 时被终结"这一违规路径。

### 8.4 ACTIVE state 生命周期：只在执行期间保留（外部审核 v2 修正 B-03）

> **recorder 的可变 TraceState 只在 trace 执行期间保留；root 到达终态、adapter 收到终态快照后立即释放。**

为什么必须这样：`src/bootstrap/trace-composition.ts` 的 `getTraceRecorder()` 是**进程级单例**
（assistant 交付面使用），若已完成的 trace 永久留在 recorder 内部，每个请求都会泄漏
TraceRecord / spans / events / metadata / endedSpanIds，造成长驻服务的内存无限增长。

释放顺序（固定，写在 `BaseTraceRecorder.endSpan()` 中）：

```
1. 构建终态快照        snapshotSpan(root) / snapshotTrace(state)
2. 交付 adapter       emitSafely(onSpanEnded) → emitSafely(onTraceEnded(snapshot, violation))
3. finally 释放 state  states.delete(traceId) + 断开 record 上的重引用
```

- **不允许**在交付快照之前删除 state（否则 adapter 会丢失这次 trace 的证据）；
- 释放放在 `finally` 中，即使 adapter hook 出问题（见 §8.5）也一定执行；
- 释放**不破坏**任何既有语义：`end()` 仍然幂等，旧 scope 的晚到写入仍然是 no-op
  （判定依据 `state.closed` 与 `endedSpanIds` 保持不变）；
- 释放时清空内部 record 的 `spans` / `events` / `metadata` / `error` 引用，
  这样"被外部保留的旧 `TraceScope`"也不能继续持有整棵 trace 图（归档数据来自 adapter 的快照副本）。

对 adapter 的要求与能力：

| adapter | ACTIVE state | 归档 |
|---------|--------------|------|
| `ConsoleTraceRecorder` | 终态后**不保留**任何 state（只序列化并写出） | 无（记录已写出；`getTrace` 之类不属于它） |
| `InMemoryTraceRecorder` | 同样不依赖 base recorder 保留 state | 自己持有**快照副本**：`getTraces()` / `getLifecycleViolations()` / `getTrace(id)` / `getLastTrace()` 在清理后仍可用 |
| 未来的远端 adapter | 同上 | 自行负责（base 不替它保留任何东西） |

诊断语义随之明确（**不**沿用旧的误导性命名）：

- `activeTraceCount()` —— 仍在执行（尚未释放）的 trace 数；任何已终结的 trace 都应使它回到 0
- `activeSpanCount()` —— ACTIVE state 中尚未结束的 span 数
- 一个从未结束的 trace 会一直留在 ACTIVE state 中（这正是 `activeTraceCount()` 能暴露的问题）；
  生产埋点通过 `runInTrace` / `runInSpan` 保证不会出现

### 8.5 fail-open 输出边界：遥测失败不得影响业务（外部审核 v2 修正 B-04）

> **adapter 的输出失败绝不允许逃逸到业务控制流，也不允许替换原始业务错误。**

`BaseTraceRecorder` 通过单一的 `emitSafely()` 边界调用全部 adapter hook
（`onEventRecorded` / `onSpanEnded` / `onTraceEnded`），失败时只做计数并继续：

| 场景 | 结果 |
|------|------|
| 业务成功 + 输出失败 | 业务仍然成功（返回原结果）；遥测记录可能丢失 |
| 业务失败 + 输出失败 | 调用方仍收到**原始业务错误**（不会被遥测错误替换） |
| 连续输出失败 | 不抛错、不递归追踪遥测失败、不累积 ACTIVE state；仅 `emissionFailures()` 计数增长 |

明确不做：不重新抛出（否则"日志坏了"会变成"业务失败"）、不递归追踪遥测失败、
不把 TraceRecord 内容作为 fallback 打印（可能含敏感字段）、不引入外部日志依赖。
这一边界是**中心化**的：Assistant / Reading / 任何未来调用方都不需要各自包 try/catch。

---

## 9. 输出格式（Part 16）

`ConsoleTraceRecorder` 每条记录输出**一行 JSON**（机器可读、可被任何日志采集器消费）：

```json
{"record":"span","traceId":"…","spanId":"…","parentSpanId":"…","name":"reading.process_article","category":"workflow_step","status":"ok","startedAt":1757740000000,"endedAt":1757740000243,"durationMs":243,"metadata":{"article.index":1,"outcome":"persisted"},"error":null}
{"record":"event","traceId":"…","spanId":"…","name":"article.degraded","timestampMs":1757740000243,"metadata":{"ai.errorCode":"provider_error"}}
{"record":"trace","traceId":"…","name":"reading.ingest","category":"use_case","status":"degraded","startedAt":…,"endedAt":…,"durationMs":…,"metadata":{"reading.pushed":8,"reading.failed":1,"reading.degraded":1,"reading.outcome":"degraded"},"error":null,"spanCount":27,"eventCount":1}
```

说明：

- `record` 取值 `span` / `event` / `trace`；时间为 epoch ms（便于计算与断言，避免时区歧义）。
- metadata 中的空值 / 非法类型在写入前已被丢弃（见 §11），因此不会出现 `undefined` 键。
- 内存实现暴露**同一套** `TraceRecord` 结构，测试断言的是结构而不是字符串。

---

## 10. 错误可观测性（Part 10）

统一入口：`TraceScope.recordError(error, options)` → `toTraceErrorInfo()`（Infrastructure）。

| 错误来源 | 记录内容 |
|---------|---------|
| AI 失败 | `AIError.code`、`provider`、`retryable`、`status`、安全 message（`operation: 'ai.call'`） |
| Application 失败 | `ApplicationError.code`、安全 message、`operation`（如 `reading.ingest`、`reading.ingest.validate`） |
| 领域归一化失败 | `code: 'invalid_ai_payload'` + 领域原因字符串（如 `vocabItems[0].contextSentence must be a string`） |
| 基础设施失败 | **在 Application 边界之前**归一化（`ApplicationError('feed_unavailable' | 'persistence_failed')`），trace 只看到归一化后的码与安全 message |

安全约束：

- **不记录** stack trace（`TraceErrorInfo` 没有该字段；错误摘要只保留归一化字段）；
- 错误 message 先做密钥模式脱敏，再折叠空白并截断到 300 字符；
- 不记录 `cause` 链中的原始对象；
- 凭据 / 连接串 / 认证头 / cookie / 环境变量一律不进入 trace（见 §11）。

---

## 11. 敏感数据 / Redaction 策略（Part 11）

执行点：`src/infrastructure/telemetry/sanitize.ts`（两个 recorder 共用；数据离开进程的最后一道防线）。

### 11.1 绝不采集（键名命中即**整条丢弃**）

凭据：`apiKey` / `key` / `secret` / `clientSecret` / `token` / `accessToken` / `authToken` /
`refreshToken` / `sessionToken` / `bearerToken` / `password` / `passwd` / `pwd` / `credential(s)`

传输头：`authorization` / `auth` / `cookie` / `set-cookie` / `header(s)` / `requestHeaders` / `responseHeaders`

数据库 / 环境：`databaseUrl` / `dbUrl` / `connectionString` / `dsn` / `env` / `environment` / `envVars` / `processEnv`

内容：`prompt(s)` / `systemPrompt` / `message(s)` / `userMessage(s)` / `content(s)` / `body` / `raw` /
`rawRequest` / `rawResponse` / `output` / `modelOutput` / `completion` / `text` / `userText` /
`articleText` / `textContent` / `html(Content)` / `query` / `reply`

堆栈：`stack` / `stackTrace` / `cause`

键名判定分三步（任一步命中即整条丢弃），外部审核 v1 修正 B-01 后为：

1. **整体精确匹配**：`normalizeMetadataKey('api_key')` = `apikey` → 命中禁用集合；
2. **高风险片段匹配**：`DEEPSEEK_API_KEY` → `deepseekapikey` 含片段 `apikey` → 丢弃
   （片段：`apikey` / `authorization` / `authheader` / `password` / `passwd` / `secret` /
   `connectionstring` / `databaseurl` / `privatekey` / `sessiontoken` / `accesstoken` /
   `bearertoken` / `cookie`）；
3. **命名空间逐段匹配**：键按命名空间分隔符（`.` / 空格 / `/` / `:` 等；`_` 与 `-` 视为词内字符）
   切段并逐段规范化，任一段命中禁用集合即丢弃。因此 `label.prompt` / `label.query` /
   `label.content` / `label.output` / `label.text` / `label.userText` / `label.requestBody` /
   `label.rawResponse` / `label.apiKey` / `label.authorization` / `label.databaseUrl` 都会被丢弃。

同时**不误伤**安全键：`label.useCase` / `label.step` / `label.promptVersion` /
`ai.request.promptChars` / `ai.request.messageCount` / `article.contentLength` /
`assistant.lookupKeyLength` / `reading.feed_count` 全部保留（有测试）。
`label.*` 标签进入 trace 的第一道关是 §6.5 的 Application 白名单，本文件是第二道防线。

### 11.2 值层面的脱敏（即使键名看起来无害）

`Bearer <token>`、`sk-` / `pk-` / `rk-` 前缀密钥、`postgres(ql)://…` / `mysql://…` / `mongodb://…` /
`redis://…` 连接串、`password=` / `api_key=` / `token=` / `secret=` 赋值、PEM 私钥头 → 替换为 `[redacted]`。

### 11.3 默认不采集内容

- 不存完整 prompt、不存完整模型输出、不存任意用户文本；
- 只记录**尺寸 / 计数 / 标识符 / 内容类型 / 操作名 / model / provider / 错误码**；
- 未来若需要 prompt/output 捕获做调试，必须作为**显式 opt-in 能力**另行设计与授权（本阶段不做）。

### 11.4 上限

- metadata 字符串 ≤ 200 字符（超长截断并加 `…`）；
- 错误 message ≤ 300 字符；
- 非原始值（对象 / 数组 / 函数 / `BigInt` / `NaN` / `Infinity`）一律丢弃；`undefined` 键不写入。

### 11.5 测试

`sanitize.test.ts`（92 个测试）覆盖：禁用键（含 `DEEPSEEK_API_KEY` / `api_key` / `set-cookie` /
`processEnv`）、**命名空间键**（`label.prompt` / `label.query` / `label.content` / `label.output` /
`label.apiKey` / `label.authorization` / `label.databaseUrl` / `payload.content` / `nested.deep.prompt` 等）、
允许键不误伤（`contentLength` / `promptVersion` / `ai.request.promptChars` / `reading.feed_count` 等）、
值脱敏、类型收敛、长度上限、错误归一化（含"不泄漏连接串"与"不含 stack"）、非 Error 抛出物。

---

## 12. 计时与测试策略（Part 13 / Part 14）

### 12.1 计时

- 所有时间来自 `ClockPort`；生产用 `systemClock`（`Date.now()`），测试注入假时钟；
- `durationMs = max(0, endedAt - startedAt)`（epoch ms）；
- **没有任何实时依赖的断言**：计时测试使用假时钟，不做真实 sleep 比较。

### 12.2 测试分层（全部离线，不访问网络 / 真实 AI / 真实数据库）

| 文件 | 数量 | 覆盖 |
|------|------|------|
| `src/infrastructure/telemetry/__tests__/sanitize.test.ts` | 92 | redaction 策略（Part 11）、命名空间键（B-01）、错误归一化、不泄漏密钥 |
| `src/infrastructure/telemetry/__tests__/in-memory-trace-recorder.test.ts` | 13 | 生命周期与**违规不变式**（B-02）、**ACTIVE state 释放后仍可检索快照**（B-03）、计时、状态、终态写保护 |
| `src/infrastructure/telemetry/__tests__/console-trace-recorder.test.ts` | 6 | JSON 行格式与顺序、输出前脱敏、`trace.lifecycle_violation` 独立记录类型、**完成后零 ACTIVE state**（B-03） |
| `src/infrastructure/telemetry/__tests__/trace-emission-failure.test.ts` | 6 | **fail-open 输出边界**（B-04）：write 抛错时 event / span / trace end 均不抛错、业务结果与原错误不受影响、ACTIVE state 仍释放 |
| `src/application/observability/__tests__/trace-helpers.test.ts` | 8 | 成功/失败生命周期、异常仍达终态、嵌套父子关系、Null Object |
| `src/application/observability/__tests__/traced-ai-client.test.ts` | 9 | AI 元数据记录、AI 失败记录、**标签白名单（B-01）**、不记录 prompt/output、密钥不外泄、无 usage 时不伪造 |
| `src/application/workflows/__tests__/reading-pipeline.tracing.test.ts` | 7 | Reading trace 关联、步骤 span、单篇失败可见、致命失败、降级可区分、无内容泄漏 |
| `src/application/use-cases/assistant/__tests__/reply-to-assistant-query.tracing.test.ts` | 5 | Assistant Use Case trace 关联、AI 失败、Null Object |
| `src/app/api/assistant/__tests__/route.tracing.test.ts` | 4 | `X-Trace-Id`、成功/失败/400/非法 JSON 的 trace 终态 |

Phase 5 新增测试合计 **150** 个（292 受保护基线 + 150 = 442）。

对照 Phase 5 任务文档 Part 13 的 13 项要求：① 成功生命周期 ✅ ② 失败生命周期 ✅ ③ span 计时/状态 ✅
④ 错误记录 ✅ ⑤ AI 调用元数据 ✅ ⑥ AI 失败记录 ✅ ⑦ Assistant trace 关联 ✅ ⑧ Reading trace 关联 ✅
⑨ 单篇失败仍可见 ✅ ⑩ 致命失败标记整轮失败 ✅ ⑪ 不记录密钥字段 ✅ ⑫ 默认不记录 prompt/output ✅
⑬ 抛异常时 trace 仍 end ✅

---

## 13. 延后：持久化（Part 15）

Phase 5 **不做**持久化：

- 未修改 `prisma/schema.prisma`；未创建 Trace 表；未创建 migration；
- trace 目前可以：结构化 JSON 行输出（console adapter）、内存保留（测试 / 执行期检视）；
- 未来若要长期存储：新增一个实现 `TracePort` 的 adapter（例如写入独立表 / 对象存储 / 日志管道），
  **不改动 Application 层**，因为 Application 只依赖 `TracePort`。

延后项清单：

| # | 项 | 原因 |
|---|----|------|
| P1 | Trace 持久化表 / migration | 需要 schema 变更授权（Phase 6+） |
| P2 | trace 采样与保留策略 | 需要真实流量与存储决策 |
| P3 | metric 聚合（延迟分布、错误率、token 成本） | 属 metrics 平台，本阶段只产出 metric-ready 数据 |
| P4 | `AICallMeta` 中按类型拆分 attempts（网络重试 vs 解析修复） | 需要修改 Phase 3 已批准契约 |
| P5 | prompt / output 显式 opt-in 捕获 | 需要独立设计与授权（默认仍不采集） |
| P6 | HTTP middleware 生成/透传入站 traceId | 本阶段只在两个参考目标内部生成 |
| P7 | 持久化前的**错误 message 策略复审** | 审核方 v3 非阻断提示 B：若 trace 落盘，应重新审查是否改为基于 code 的显式安全 message 映射，而不是持久化任意 `Error.message`（当前已有密钥模式脱敏 + 长度上限 + 不含 stack） |

---

## 14. 延后：外部可观测性系统（Part 6）

**未引入**（本阶段禁止）：OpenTelemetry collector / Jaeger / Zipkin / Datadog / Sentry tracing SDK /
Kafka / Elasticsearch / trace 数据库表结构。

可迁移性：输出是结构化 JSON 行 + 结构化 `TraceRecord`，因此未来的接入路径是"新增一个 adapter/转发器"，
而不是改动业务代码或 Application 契约。

---

## 15. 已知风险与限制

| # | 风险 / 限制 | 处置 |
|---|------------|------|
| R1 | Reading CLI 的 stdout 现在额外包含结构化 trace JSON 行（`TRACE_MODE=console` 默认） | **有意且已记录**：业务行为（抓取/AI/入库/顺序/退出码）不变；仅新增结构化输出。可用 `TRACE_MODE=memory` 关闭 |
| R2 | 无法如实拆分 AI attempts（网络重试 vs 解析修复） | 不伪造；记录策略上限，列为延后项 P4 |
| R3 | Trace 不做持久化 → 进程结束后只保留在日志里 | 属本阶段范围；延后项 P1 |
| R4 | 未 instrument 其它 feature / Route | 任务范围限定为两个参考目标；其余属后续 Phase |
| R5 | `X-Trace-Id` 是新增响应头 | 纯增量；不改响应体与状态码；客户端忽略即可 |
| R6 | 400 / 友好回退的请求 trace 状态为 `error` | 有意：观测视角"这次执行失败了"，用 `http.status` / `http.outcome` 区分用户可见结果 |
| R7 | 假时钟下的 `durationMs` 为 0 的场景不具代表性 | 属测试设计；生产使用真实时钟 |
| R8 | 两处 Phase 4 断言因新增可选参数而同步更新 | 见 `phase-5-handoff.md` §5（配置断言本身未放宽） |
| R9 | 一个**从未结束**的 trace 会一直占据 ACTIVE state | 无法自动判定"被遗弃"；由 `activeTraceCount()` 暴露，生产埋点用 `runInTrace` / `runInSpan` 保证不会出现（有测试） |
| R10 | `TRACE_MODE=memory`（测试 / 显式开启）会保留 trace 快照 —— 审核方 v3 **非阻断提示 A** | 有意为之：内存 adapter 的用途就是归档快照供断言 / 检视；生产默认 `console` 不保留任何 state。**不得**把 `InMemoryTraceRecorder` 当作长时间运行的生产 trace 存储 |
| R11 | 遥测输出失败会导致**记录丢失**（不重试、不落盘） | 这是 fail-open 的代价，也是本阶段的选择：观测不得影响业务；持久化 / 重试属延后工作 |
| R12 | 错误 message 目前按"密钥模式脱敏 + 折叠 + 300 字符上限"记录 | 审核方 v3 **非阻断提示 B**：本阶段不落盘，风险有限；若未来持久化 trace，应重新审查该策略，可能改为基于 code 的显式安全 message 映射（见 §13 P7） |

---

## 16. Phase 6 交接注意事项

1. **`TracePort` 是唯一扩展点**：若要持久化 trace，只需在 Infrastructure 增加一个 adapter 并在
   Composition Root 装配；Application / Domain 不需要改动。
2. **不要把 tracing 放进 Domain**：任何新的纯规则（含 Phase 6 的记忆/用户规则）都不得 import
   `TracePort`、Trace 类型或 logger。
3. **新增 use case / workflow 时**：在 Delivery 创建 root trace，通过 `ExecutionContext` 显式传入，
   用 `runInTrace` / `runInSpan` 包住步骤；AI 调用用 `withAITracing` 包住 port。
4. **新增 metadata 前先看 §11 的禁用键集合**：新增键名不要命中禁用片段；内容型字段仍然禁止采集。
5. **状态语义保持一致**：`degraded` 只用于"完成但有已兜底失败"；致命失败才用 `error`。
6. **User / Memory 相关的隐私边界**：Phase 6 引入用户态数据后，trace 中同样禁止记录用户文本、
   记忆内容、偏好原文；只记录 id / 计数 / 尺寸。
7. **若需要更细的 AI 尝试拆分**（延后项 P4），必须在 Phase 6 中作为**显式契约变更**处理
   （更新 `AICallMeta`、AI Client 测试、本文件与 DECISIONS）。
8. **Phase 5 遗留的临时产物**：`phase-5-review-pack-v1.zip` 为评审产物，评审通过后应删除
   （与 Phase 3/4 同一行政流程），不作为提交内容。
