# Phase 5 任务定义 — Trace 与可观测性

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 5 |
| **名称** | Trace 与可观测性（Application-level Trace / Observability） |
| **状态** | In Progress |
| **前置条件** | Phase 0–4 全部 Completed / Approved；Git 基线 `1deca075f59ad643416c4c15a88348c5a95ef1e3`（分支 `master`，工作区干净）；Phase 2 + Phase 3 + Phase 4 受保护基线 292 tests 全绿 |
| **参考目标 1** | Phase 3 `/api/assistant` AI 流程（HTTP → Use Case → AI Client） |
| **参考目标 2** | Phase 4 Reading 内容摄取管线（Use Case → Workflow → Ports → Adapters） |
| **复用** | Phase 3 已批准的 `AIClientPort` / `AIClient` / `DeepSeekAdapter`（**不修改**） |
| **开始日期** | 2026-09-13 |

---

## 目标

实现本项目**第一个应用级 Trace / 可观测性系统**，让重要的 AI 调用与 Workflow 执行
**可见、可检查、可测试**，且**不改变任何业务行为**。

Phase 5 建立的能力：

- Trace 身份（traceId）
- 执行计时
- Workflow 步骤可见性
- AI 调用可见性
- 归一化的成功 / 失败状态
- 错误元数据
- provider / model 元数据
- provider 提供时记录 token usage
- provider / 编排层提供时记录 retry / repair 元数据
- 一次应用请求与其内部操作的关联（correlation）

**范围严格限定为两个已批准的参考目标**（Phase 3 `/api/assistant`、Phase 4 Reading 管线）。

> 目标是用**同一套可复用设计**证明两件事：简单 AI Use Case 与确定性多步 Workflow 都能被观测。
> **不**为仓库内每个 feature 加埋点。

---

## Part 1 — Before 可观测性盘点（以当前仓库为准）

盘点结论（完整证据与文件清单见 `docs/refactor/TRACE_DESIGN.md` §2）：

| 维度 | 迁移前现状 |
|------|-----------|
| `console.log` / `console.error` | 存在，但**无统一 logger**：`scripts/reading-push.ts`（20 处，事件→自由文本）、12 个 API Route（各 1 处 `console.error`）、`src/features/listening/lib/listening.ts`（7 处）、若干脚本 |
| AIClient 返回的 AI metadata | `AICallMeta { provider, model, latencyMs, attempts, usage?, finishReason? }`（Phase 3；仅返回给调用方，**未落库、未上报**） |
| 延迟测量 | 仅 AI 逻辑调用的墙钟耗时（`AIClient.buildMeta`）。**没有** HTTP 级 / Workflow 步骤级计时 |
| 重试尝试信息 | `AICallMeta.attempts`（网络重试与解析修复**合并计数**）；重试策略本身在 `retry.ts` 内部 |
| 结构化输出修复信息 | `maxRepairAttempts` 选项存在；**修复次数不对外暴露** |
| provider / model 元数据 | `AICallMeta.provider` / `AICallMeta.model`；`AIChatRequest.metadata` 为 provider-neutral 标签（**不发给 provider**） |
| Workflow 事件 | `ReadingPipelineEvent`（11 种，含 feed / candidates / article / trim / earlyExit），交付层用它生成操作员日志 |
| HTTP 级请求上下文 | **无**：没有 middleware、没有 requestId、Route 只读 `request.json()` |
| 错误归一化 | `AIError`（8 码 + `retryable` + `status` + `provider` + `cause`）、`ApplicationError`（4 码 + `cause`）、`DomainError` 概念 |
| 现有 ID / correlation ID | **无**（全仓库无 `traceId` / `requestId` / `correlationId`） |
| 日志工具 | **无**（没有 logger 模块，直接 `console.*`） |
| DB / 日志 schema | Prisma 仅 7 张业务表（Word / WordReview / Article / ArticleVocab / ListeningScene / ListeningLine / DailyProgress），**无日志或 trace 表** |

**结论：不存在可复用的 Trace 系统；存在的是分散的自由文本日志 + 一层已经归一化的 AI 元数据。**

---

## Part 2 — Trace / Log / Metric 的定义边界

Phase 5 必须在文档中把三者显式区分（写入 `docs/refactor/TRACE_DESIGN.md` §3），**不得混用**：

- **Trace**：一次逻辑执行的完整记录，用 `traceId` 聚合相关操作，含 spans / steps / events，回答"这次执行发生了什么"。
- **Log**：单条诊断记录，可属于某个 trace，回答"发出了什么事件/消息"。
- **Metric**：跨执行的聚合数值（平均延迟、错误率）。Phase 5 **可以产出 metric-ready 数据，但不构建指标平台**。

---

## Part 3 — Trace 模型设计

建立**最小、provider-independent** 的应用级 Trace 模型。概念字段：

**Trace**：`traceId` / `name` / `startedAt` / `endedAt` / `durationMs` / `status` / `metadata` / 失败时的错误摘要 / 子 span 与事件

**Span / Step**：`spanId` / `traceId` / `parentSpanId`（需要时）/ `name` / `category` / `startedAt` / `endedAt` / `durationMs` / `status` / `metadata` / 失败时的错误摘要

候选 category：`http` / `use_case` / `workflow` / `workflow_step` / `ai` / `persistence` / `external_io` / `validation`。

约束：模型保持小；**不**复刻 OpenTelemetry；**不**构建通用分布式追踪框架。

---

## Part 4 — Trace 标识

- 每次逻辑执行必须有 `traceId`；应用级唯一即可；**内部生成**
- **不得**包含密钥或用户内容
- 可在 Application / Workflow / Infrastructure context 中传播
- **不得**让 Domain 依赖 Trace 基础设施
- 采用**显式 ExecutionContext / TraceContext** 在 Application 编排中传递；
  **不使用** `AsyncLocalStorage`（除非有明确且更优的理由；本阶段不使用）

---

## Part 5 — Trace Port

Application 依赖抽象而非具体 logger。定义**最小可用**的 Application Port
（概念名 `TracePort` / `TraceRecorder`），能力可包括
`startTrace` / `endTrace` / `startSpan` / `endSpan` / `recordEvent` / `recordError`，
但**不机械照搬**该 API，而是设计成能自然服务于：Assistant Use Case、Reading Workflow、AI Client 集成。

Trace 抽象**不得**依赖：DeepSeek、Prisma、Next.js、console、文件系统。

---

## Part 6 — Infrastructure Trace 实现

至少提供一个具体实现，优先**本地简单实现**：

- 结构化**内存** Trace recorder（供测试）
- 结构化 console / JSON 输出（供开发）

**禁止**引入：OpenTelemetry collector、Jaeger、Zipkin、Datadog、Sentry tracing SDK、Kafka、
Elasticsearch、trace 数据库表结构（除非既有已批准架构明确要求 —— 本阶段没有）。
外部可观测性平台整体**延后**。输出必须结构化到"未来可以换一个 adapter 转发到别处"。

---

## Part 7 — AI Client 可观测性

复用 Phase 3 已批准的 AI Client，**不把 provider 细节泄漏到上层**。可用时记录：

- provider、model、operation、latency、attempts、retry count、repair count
- provider 提供时的 input / output / total token 数
- 适当的 finish reason、成功/失败、归一化 `AIError` code

**不得**记录：API Key、authorization header、完整 provider 请求、完整用户消息、完整 prompt、完整模型输出。
采用 **metadata-first tracing**；如未来需要 prompt/output 捕获，必须定义为**显式 opt-in / deferred** 能力，不得默认存储。

---

## Part 8 — Reading Workflow 可观测性

为 Phase 4 已批准的 Reading Workflow 加埋点，**使用既有显式步骤边界**，不发明新步骤。

要求：

- 一次 Reading 运行 = 一个 `traceId`
- 重要步骤有可见 span / event
- 单篇操作可关联到该次运行
- **单篇失败可见，但不必然导致整轮失败**
- **致命失败必须把整体 trace 标记为失败**
- 若自然支持，**AI 降级（degraded）必须与完全成功可区分**

**不得**改变 Reading 管线业务行为。

---

## Part 9 — Assistant 可观测性

为 Phase 3 `/api/assistant` 参考迁移加埋点，使 trace 能表达：

```
HTTP 请求 → Use Case → AI 调用 → 结果 / 错误
```

**不得**改变：重试语义、超时语义、响应结构、model / provider、用户可见行为。

仅在**不破坏既有 API 行为**的前提下，可在响应头暴露 traceId（优先 `X-Trace-Id`）并记录在文档中。
**不得**修改 JSON 响应结构。

---

## Part 10 — 错误可观测性

按归一化后的错误信息记录：

- **AI 错误**：`AIError` code、provider、retryable、attempt 元数据、安全 message
- **Application 错误**：`ApplicationError` code、安全 message、相关 operation
- **Infrastructure 错误**：**先归一化**再进入 Application trace；不得泄漏凭据、SQL 连接串、请求头、
  含密钥的 stack trace、原始环境变量值

stack trace 仅在开发/内部输出中**安全且有界**时才允许保留。

---

## Part 11 — 敏感数据策略

建立显式 redaction 策略，写入文档并**测试**。绝不允许 trace：

API Key、密钥、auth header、数据库连接串、cookie / session token、含凭据的环境变量。

默认策略：不存完整 prompt、不存完整模型响应、不存任意用户文本。
优先记录：长度、计数、标识符、内容类型、操作名、真正有用时的 hash、model/provider 元数据。

只要引入了通用 metadata 清洗工具，就必须为 redaction 写测试。

---

## Part 12 — Trace 生命周期

明确规定：Trace start → 子 span / 事件 → 成功 / 失败 → Trace end。

- 每个已开始的 trace / span **必须**到达终态，即使抛异常
- 使用 try/finally 或等价的生命周期安全模式
- **不得**产生孤儿 span
- 必须有测试证明失败路径下的收尾行为

> **Phase 5 修正记录 v2（外部审核 v1 后，阻断问题 B-02）——不变式的可执行形式：**
> *一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。*
> 生产埋点通过 `runInTrace` / `runInSpan` 保证"先结束子 span，再结束父 span"，因此正常路径无孤儿；
> 若 root 在仍有存活后代时被 `end()`（手工埋点缺陷），实现**不得**伪造子 span 的结束时间戳，
> 必须把该 trace 终结为**显式的生命周期违规状态**（`status = 'error'` + `error.code = 'lifecycle_violation'`），
> 并且**不**将其归档为正常完成的 trace。详见 `docs/refactor/TRACE_DESIGN.md` §8。
>
> **Phase 5 修正记录 v3（外部审核 v2 后，阻断问题 B-03 / B-04）——两条长期不变式：**
> 1. **ACTIVE state 生命周期**：recorder 只在 trace 执行期间保留可变状态；root 到达终态、
>    adapter 收到终态快照后，state 必须在 `finally` 中释放（进程级单例不得随请求数增长）。
>    归档由 adapter 负责；旧 scope 的晚到写入仍必须是 no-op。
> 2. **fail-open 遥测**：adapter 输出失败**绝不**允许改变业务控制流或替换原始业务错误
>    （成功仍成功、失败仍抛原错误）；失败只计数、不重抛、不递归追踪、不打印 trace 内容。
> 详见 `docs/refactor/TRACE_DESIGN.md` §8.4 / §8.5 与 `DECISIONS.md` ADR-013 第 11/12 条。

---

## Part 13 — 测试要求（不需要真实外部服务）

至少覆盖：

1. 成功的 trace 生命周期
2. 失败的 trace 生命周期
3. span 计时 / 状态
4. 错误记录
5. AI 调用元数据记录
6. AI 失败记录
7. Assistant Use Case trace 关联
8. Reading Workflow trace 关联
9. 单篇 Reading 失败仍然可见
10. 致命 Reading 失败把整体 trace 标记为失败
11. 不记录任何密钥字段
12. 默认不记录 prompt / output 内容
13. 抛异常时 trace end 仍然发生

需要计时断言时优先注入时钟；**不得**写实时依赖的 flaky 测试。

---

## Part 14 — 时间 / 时钟抽象

仅在可靠计时测试需要时，引入**最小**时钟抽象（例如 `ClockPort { now(): number }`）。
生产用真实时间，测试可注入假时间。**不**建立大型时间框架。

---

## Part 15 — 本阶段不做持久化

- **不修改** Prisma schema
- **不创建** Trace 表
- **不创建** migration

长期持久化 trace 属于延后工作，必须在文档中记录。本阶段 trace 可以：
结构化日志输出、测试内存保留、执行期可见。
架构必须让"以后换一个 adapter 做持久化"成为可能。

---

## Part 16 — 输出格式

优先结构化 JSON-like 记录而非自由文本；trace / span 输出必须机器可读（示例见
`TRACE_DESIGN.md` §9，**不盲目照抄**示例，使用与项目类型相符的表示）。

---

## Part 17 — 设计文档

创建 `docs/refactor/TRACE_DESIGN.md`，包含：

目标、非目标、Trace vs Log vs Metric、Trace 模型、Span 模型、traceId 生命周期、
context 传播、Trace Port、Infrastructure 实现、Assistant 埋点、Reading Workflow 埋点、
AI Client 埋点、metadata 模型、敏感数据 / redaction 策略、错误追踪、计时、测试策略、
延后的持久化、延后的外部可观测性系统、Phase 6 交接注意事项。

---

## Part 18 — 允许修改

- Application trace 类型 / ports
- Infrastructure trace adapter
- bootstrap / composition 装配
- Phase 3 Assistant Use Case 集成
- **必要时**的 Phase 3 AI Client 集成（本阶段结论：不需要，见 §7）
- Phase 4 Reading Workflow 集成
- tracing 相关测试
- 最小 HTTP trace-id header 支持
- Phase 5 文档
- 产生真实架构决策时更新 `DECISIONS.md`
- `PHASE_STATUS.md`

## Part 19 — 禁止修改

- 迁移每一个 Route / 给每个 feature 加埋点
- 开始 Phase 6
- 实现 Memory / RAG / Agent 编排
- 修改 Prisma schema / 创建 trace 持久化表
- 引入外部 tracing SaaS
- 未经明确论证与批准引入 OpenTelemetry 基础设施
- 重新设计 Phase 3 AI Client
- 重新设计 Phase 4 Reading 管线
- 改变产品行为
- 默认记录完整 prompt / 完整模型输出
- 泄漏密钥
- 无关的清理 / 重构

---

## Part 20 — 架构约束

Tracing 是横切关注点，**不得污染 Domain 逻辑**。依赖方向保持：

```
Delivery → Application → Domain
Application → TracePort
Infrastructure → implements TracePort
```

Domain **不得**依赖：TracePort、Trace 类型、logger、console、Infrastructure。
不得把 tracing 逻辑放进纯 Domain 校验器 / 规则。

---

## Part 21 — 验证

变更前记录已批准的基线；实现后运行：

- `npx vitest run`
- `npx tsc --noEmit`
- `npx next build`
- `npx eslint tests/`
- `npx eslint src/lib/__tests__/`
- `npx eslint src/domain/ src/application/ src/infrastructure/ src/bootstrap/`
- lint 所有被修改的 Route / script 文件
- `npx eslint src/`
- 既有 HTTP 冒烟套件
- 所有新增 Phase 5 tracing 测试

**不调用**真实 DeepSeek、**不调用**真实 RSS、**不连**数据库（除非既有只读冒烟基线明确要求）。

若 Phase 2 / 3 / 4 受保护基线回归 → **停止**。
**不得**为了让回归消失而重写历史测试。

---

## Part 22 — 状态管理

- 开始：Phase 5 = **In Progress**
- 实现完成：Phase 5 = **In Review**；Phase 6 = **Not Started**
- **不**自行标记 Completed / Approved（需要外部审核）

---

## Part 23 — Git 纪律

变更前记录：branch、HEAD、`git status --short`、`git diff --stat`。工作区必须干净。
**不自动提交**；**不使用**破坏性 Git 命令；**不修改**既往已批准的提交。

---

## Part 24 — 完成报告

实现完成时报告 31 项：Trace 模型、Span 模型、TracePort 设计、Infrastructure 实现、
context 传播策略、Assistant 埋点、Reading Workflow 埋点、AI Client 埋点、
记录的 metadata、刻意排除的 metadata、敏感数据/redaction 策略、错误追踪行为、
计时策略、新增测试、测试总数、Phase 2/3/4 受保护基线状态、TypeScript 结果、
Build 结果、ESLint 结果、冒烟结果、是否发生真实外部调用、是否有产品行为变化、
延后的 trace 持久化、延后的外部可观测性集成、已知风险、`git diff --stat`、
`git status --short`、Phase 5 当前状态、确认 Phase 6 仍为 Not Started。

然后停止并等待外部审核；**不**自行作出最终批准。

---

## Part 25 — 生成审核包

由于 Phase 5 改动横切生产基础设施，生成 `phase-5-review-pack-v1.zip`，包含：

`phase-5-task.md`、`TRACE_DESIGN.md`、`phase-5-handoff.md`、`PHASE_STATUS.md`、
被修改时的 `DECISIONS.md`、所有新增 Trace 生产源码、所有被修改的 Assistant 文件、
所有被修改的 Reading Workflow 文件、所有被修改的 AI Client 文件、composition / bootstrap 变更、
所有 Phase 5 测试、`validation-results.txt`、`git-status.txt`、`git-diff-stat.txt`、
完整 Phase 5 diff、`review-manifest.md`、`file-hash-verification.txt`。

对包内副本与工作区文件做 hash 校验。排除：`.env`、API Key、数据库凭据、`node_modules`、
`.next`、音频/二进制资产、历史 review ZIP、无关临时文件。
生成后重新打开 ZIP 检查真实内容，最后报告 `phase-5-review-pack-v1.zip` 的路径，然后停止。

---

## §7 本阶段对 AI Client 的处理结论（对 Part 18 的补充说明）

Phase 5 **不修改** Phase 3 的 `AIClientPort` / `AIClient` / `structured-output` / `retry` / `DeepSeekAdapter`。

原因：AI 调用可观测性可以通过**应用层装饰器**（`AIClientPort` 装饰器）实现 —— 它读取既有的
provider-neutral `AICallMeta` 并写入 trace，完全不需要改动已批准的 AI Client 契约。
唯一无法从边界取得的细节是"网络重试 / 解析修复各发生了几次"（Phase 3 的 `attempts` 是合并计数）；
本阶段**不伪造**该数值，而是记录 `attempts`（实际 provider 请求数）与编排层已知的策略上限，
并把"在 `AICallMeta` 中增加按类型拆分的计数"列为**延后工作**（需要修改已批准的 AI Client 契约）。

---

## 验收标准

1. 两个参考目标（`/api/assistant`、Reading 管线）都被 instrument，且共用同一套 Trace 设计
2. Trace / Span 模型小而完整，含 traceId、计时、状态、metadata、错误摘要、父子关系
3. Trace Port 定义在 Application，且不依赖 DeepSeek / Prisma / Next.js / console / 文件系统
4. Infrastructure 至少提供一个内存实现与一个结构化 console 实现
5. 显式 ExecutionContext 传播；无 `AsyncLocalStorage`；Domain 零 Trace 依赖
6. 生命周期安全：生产埋点路径下 trace / span 都到达终态且无孤儿 span；
   root 在有存活子 span 时被终结会被显式记录为生命周期违规（不伪造、不归档为正常完成）（有测试）
7. Redaction 策略有实现、有文档、有测试；默认不记录 prompt / 输出 / 用户文本 / 密钥
8. 不修改 Prisma schema、不新增依赖、不引入外部可观测性平台
9. Phase 2（95）+ Phase 3（89）+ Phase 4（108）受保护基线全绿（292 → 292+）
10. `npx vitest run` / `npx tsc --noEmit` / `npx next build` / 约定范围内 ESLint / HTTP 冒烟 全部通过
11. Phase 5 = In Review；Phase 6 = Not Started（**不自行批准**）
12. 生成并自检 `phase-5-review-pack-v1.zip`

> **v3 追加（外部审核 v2 后）：**
> 13. ACTIVE state 生命周期：已终结的 trace 不在 recorder 内部保留可变状态；
>     进程级单例 `getTraceRecorder()` 不随请求数增长（有测试）。
> 14. fail-open 遥测：adapter 输出失败不影响业务结果、不替换原始业务错误、仍完成 state 释放（有测试）。

## 状态管理

- 开始：Phase 5 → **In Progress**
- 实现完成：Phase 5 → **In Review**；Phase 6 → **Not Started**
- 执行者**不得**标记 Completed / Approved
