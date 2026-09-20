# AI Client 设计 — Phase 3

**日期:** 2026-09-12
**状态:** 已实现，等待外部审核（Phase 3 = In Review）
**范围:** 统一 AI 基础设施（`AIClientPort` + Infrastructure AI Client + DeepSeek Adapter + Composition Root）
**参考迁移:** `POST /api/assistant`

---

## 1. 职责（Responsibilities）

AI Client 拥有以下关注点，且**只在 Infrastructure 层实现一次**：

| 关注点 | 实现位置 | 说明 |
|--------|---------|------|
| provider / model 选择 | `ai-client.ts` + adapter | 调用方可指定逻辑模型名；否则使用 adapter 默认模型 |
| 请求执行 | `ai-client.ts` → `adapters/*.ts` | 统一入口，adapter 负责协议翻译 |
| 超时 | `ai-client.ts` | 每次尝试显式 `AbortController` |
| 重试策略 | `retry.ts` | 有界、指数退避 + jitter、deadline 感知 |
| 归一化错误 | `ports/ai-client.ts`（模型）+ `ai/errors.ts`（映射） | provider 语义不外泄 |
| 延迟测量 | `ai-client.ts` | 整次逻辑调用墙钟耗时 |
| token usage | adapter → `AICallMeta.usage` | provider 暴露时记录，不伪造 |
| provider metadata | `AICallMeta` | provider / model / attempts / finishReason |
| 结构化输出边界 | `structured-output.ts` | JSON 提取、schema 校验、有界解析修复 |
| 可测性 | 构造函数注入 adapter / `now` / `sleep` / `random` | 全链路可离线测试 |

## 2. 非职责（Non-Responsibilities）

| 不属于 AI Client | 归属 |
|------------------|------|
| 英语学习业务流程编排 | Application Use Case（Phase 4+ 为 Workflow） |
| feature 级 Prompt 内容与语义 | Application `prompts/` |
| 学习规则、队列规则、SRS 计算 | Domain（Phase 4+） |
| Reading / Listening / Words / Coach 业务 | 各自模块的 Use Case |
| 输出内容的**业务**合理性校验 | Domain 校验（Infrastructure 只做结构与类型校验） |
| 降级策略决策（如"失败就静默降级"） | Application Use Case |
| 缓存、Trace 持久化 | 后续 Phase（Cache / Telemetry） |
| HTTP 语义、状态码映射到产品响应 | UI/API 层 |

## 3. 接口 / Port

`src/application/ports/ai-client.ts`（只有接口与类型，无实现）：

```ts
interface AIClientPort {
  chat(request: AIChatRequest): Promise<AIChatResult>
  chatStructured<T>(
    request: AIChatRequest,
    schema: AIStructuredSchema<T>,
    options?: AIStructuredOptions,
  ): Promise<AIStructuredResult<T>>
}
```

请求/响应类型刻意保持 provider-neutral：

- `AIMessage { role: 'system' | 'user' | 'assistant'; content: string }`
- `AIChatRequest { messages, model?, temperature?, maxTokens?, responseFormat?, timeoutMs?, totalBudgetMs?, retry?, metadata? }`
- `AICallMeta { provider, model, latencyMs, attempts, usage?, finishReason? }`
- `AIStructuredSchema<T> { name, validate(value): value is T }` —— 纯函数校验，由调用方提供

配套的第二个最小 port：`src/application/ports/word-lookup.ts`（`WordLookupPort`，契约明确"不得抛异常，失败返回 null"），
用于把参考迁移中的 Prisma 读取移出 Layer 1。完整 Repository 体系仍属 Phase 4+（TBD-1）。

## 4. Provider Adapter 边界

`src/infrastructure/ai/adapters/types.ts`：

```ts
interface AIProviderAdapter {
  readonly provider: string
  readonly defaultModel: string
  chat(request: ProviderChatRequest, signal: AbortSignal): Promise<ProviderChatResponse>
}
```

| Adapter 拥有 | Adapter 不拥有 |
|--------------|----------------|
| provider 的 HTTP 端点、认证头、请求体形状 | Prompt 语义 |
| 请求翻译（`messages` → provider 格式；`jsonObject` → `response_format`） | 超时与重试编排 |
| 响应翻译（`choices[0].message.content`、`usage`、`finish_reason`） | 结构化输出校验 |
| provider 级错误映射（HTTP status → `AIErrorCode`） | 业务规则 |

已实现：`DeepSeekAdapter`（`adapters/deepseek.adapter.ts`）。
新增 provider 只需实现该接口并在 Composition Root 装配，不改动 Application 层。

## 5. 请求 / 响应归一化

**请求方向**（Application → Infrastructure）：

| Application 概念 | provider 表达（DeepSeek） |
|------------------|--------------------------|
| `messages` | `messages`（`ai` → `assistant` 的映射在 Application 层完成） |
| `model` | `model`；未指定时用 adapter 默认模型 |
| `temperature` / `maxTokens` | `temperature` / `max_tokens`（未提供则不写入） |
| `responseFormat: 'json_object'` | `response_format: { type: 'json_object' }` |
| `timeoutMs` / `totalBudgetMs` / `retry` / `metadata` | **不发送**（属于编排与可观测性，不是 provider 参数） |

**响应方向**：`choices[0].message.content` → `content`；`model` / `finish_reason` / `usage` → `AICallMeta`。
空 `choices` 翻译为空字符串（与迁移前 `|| ''` 行为一致），不抛异常。

**错误方向**：provider 的失败语义在 adapter 内一次性翻译为 `AIError`。

| provider 表现 | 归一化结果 |
|---------------|-----------|
| HTTP 401 / 403 | `auth_error`（不可重试） |
| HTTP 408 | `timeout`（可重试） |
| HTTP 429 | `rate_limited`（可重试） |
| HTTP 400 / 422 | `invalid_request`（不可重试） |
| HTTP 5xx | `provider_error`（可重试） |
| 其它 4xx | `unknown`（不可重试） |
| **HTTP 200 但响应体不是合法 JSON** | **`invalid_response`（不可重试）** —— 不是网络失败；原始解析错误保留在 `cause`，响应体内容不回显 |
| fetch 抛 `TypeError`（连接层失败） | `network_error`（可重试） |

## 6. 超时策略

| 项 | 值 | 说明 |
|----|----|------|
| 单次尝试超时 | 请求 `timeoutMs`，默认 **30 000 ms** | 由 `AbortController` 强制 |
| 整次逻辑调用总预算 | 请求 `totalBudgetMs`，默认 **30 000 ms** | 包含所有重试与退避 |
| 单次尝试实际超时 | `min(timeoutMs, 剩余预算)` | 保证总耗时不超过预算 |
| 预算耗尽时 | 抛 `AIError('timeout')` | 不再发起新尝试 |

参考迁移显式传入 `timeoutMs = totalBudgetMs = 30 000`，因此**用户可见等待上限与迁移前完全一致**；
重试只会在快速失败（429 / 5xx / 网络错误）且预算仍有余量时发生 —— 而参考迁移进一步
通过 `retry: { maxAttempts: 1 }` 关闭了网络重试（见 §7），因此其行为与迁移前"只发一次请求"完全一致。

不存在无超时路径：`AIClient.chat` 总是设置定时器，未显式传超时时也会落到默认值。

### 6.1 单一 deadline 规则（`chat()` 与 `chatStructured()` 一致）

`totalBudgetMs` 表示**整次逻辑调用**的总预算，而不是每次 provider 请求各自的预算：

| 规则 | 实现 |
|------|------|
| 逻辑调用入口只计算一次 `deadlineAt` | `chat()` / `chatStructured()` 都在入口处 `deadlineAt = now() + totalBudgetMs` |
| 每次 provider 尝试只拿到剩余预算 | `attemptTimeoutMs = min(timeoutMs, deadlineAt - now())` |
| 网络重试与解析修复共享同一份剩余预算 | `chatStructured()` 复用同一个 `deadlineAt` 调用私有 `runChat(request, deadlineAt)` |
| 预算耗尽后不再发起请求 | 修复循环在发起下一次请求前检查 `now() >= deadlineAt` → 直接抛 `AIError('timeout')` |
| 不存在"新预算"路径 | 没有任何分支会重新计算 `deadlineAt` |

因此 `totalBudgetMs = 30 000` + `maxRepairAttempts = 1` 的最坏情况仍是 **30 秒**，而不是约 60 秒。
结构化调用的失败归一化：预算耗尽 → `timeout`；预算内但输出始终不合法 → `invalid_response`。

## 7. 重试策略

**三类不同的"重试"被严格区分：**

| 类型 | 触发 | 归属 | 次数上限 |
|------|------|------|---------|
| 传输/网络重试 | `timeout` / `rate_limited` / `provider_error` / `network_error` | `retry.ts` | `maxAttempts`（默认 3，可关闭为 1） |
| provider 重试 | 与上同（同一机制，provider 级状态码是触发源之一） | `retry.ts` | 同上 |
| 结构化输出解析修复 | `invalid_response`（JSON 无效 / schema 不满足） | `structured-output.ts` + `ai-client.ts` | `maxRepairAttempts`（默认 1） |

**明确不重试**：`auth_error`、`invalid_request`、`unknown`、`invalid_response`（走解析修复，不走网络重试）。

退避：`min(maxDelayMs, baseDelayMs × 2^(attempt-1)) ± jitter`（默认 500ms 起、上限 4000ms、jitter 25%）。
终止条件：达到 `maxAttempts`、错误不可重试、或退避后越过 deadline —— **不存在无限重试路径**。

**参考迁移如何选择策略（重要）**

| 场景 | 策略 | 原因 |
|------|------|------|
| 统一 AI Client 默认 | `maxAttempts = 3` | 提供有界重试能力，供**明确接受该行为**的调用点使用 |
| Phase 3 `/api/assistant` 参考迁移 | `retry: { maxAttempts: 1 }` | 迁移前该 Route 只发一次请求，任何瞬时失败都直接变成友好错误回复；改为自动重试会改变用户可见行为，因此**显式退出** |

后续调用点在迁移时若希望获得重试能力，必须由该次迁移**显式声明**这是有意的行为变更
（外部审核 v1 blocking issue #1）。默认继承重试策略 = 默认改变既有行为，不被允许。

## 8. 错误模型

provider-independent 的 `AIError`（`ports/ai-client.ts`），共 8 个错误码：

| code | 含义 | 触发示例 | 可网络重试 |
|------|------|---------|-----------|
| `timeout` | 超时 / 预算耗尽 | AbortController 触发、HTTP 408 | ✅ |
| `rate_limited` | 限流 | HTTP 429 | ✅ |
| `provider_error` | provider 服务端失败 | HTTP 5xx | ✅ |
| `network_error` | 网络/连接层失败 | `TypeError: fetch failed` | ✅ |
| `auth_error` | 认证 / 配置失败 | HTTP 401 / 403、无有效 Key | ❌ |
| `invalid_request` | 请求被判定非法 | HTTP 400 / 422 | ❌ |
| `invalid_response` | 结构化输出解析/校验失败 | JSON 非法、schema 不满足 | ❌（解析修复） |
| `unknown` | 未分类失败 | 其它 4xx / 未知异常 | ❌ |

> provider 返回 HTTP 200 但响应体无法解析为约定的 JSON 时同样归类为 `invalid_response`
> （provider 已"成功"返回，这不是网络问题；重试同一请求大概率仍然失败）。

错误信息保留 provider 原文（`DeepSeek HTTP 500: <body 前 200 字符>`），使**迁移前后的错误文案保持一致**。
`AIError` 携带 `code` / `retryable` / `status?` / `provider?` / `cause?`，不向上泄露 HTTP 语义以外的细节。

## 9. 结构化输出边界

`src/infrastructure/ai/structured-output.ts`：

1. **提取** `extractJsonCandidate()` —— 支持干净 JSON、markdown fence、前后夹带自然语言、`{}` 与 `[]` 两种根结构。
   与 Phase 2 离线评估 fixture 的格式集合一一对应（含 `fencedSceneResponse`、`jsonWithSurroundingText`、`invalidJson` 等）。
2. **校验** `parseStructured(raw, schema)` —— 由调用方提供 `AIStructuredSchema`（纯函数 `validate`）。
3. **修复** `buildRepairMessages()` —— 失败时把失败原因（可选回带截断后的原始响应）反馈给模型重新生成，
   次数上限 `maxRepairAttempts`（默认 1）。这是**解析恢复**，与网络重试是两套机制（SO-003）。

预算语义（见 §6.1）：解析修复与网络重试**共享同一个总预算**。修复请求只获得剩余预算；
预算耗尽时不再发起请求并抛 `AIError('timeout')`；预算内反复失败才抛 `AIError('invalid_response')`。
这两类失败的区分对调用方很重要：前者值得稍后重试整次请求，后者说明模型输出结构不可用。

边界保持最小：Infrastructure 只做结构/类型校验；**内容业务合理性校验属于 Domain**（Phase 4+）。

Phase 3 **只**为参考迁移接入 `chat()`（自由文本），**不**逐个迁移其它 feature 的解析器 ——
Phase 2 的离线契约测试继续作为各模块未来迁移的基线；`chatStructured()` 已通过 Phase 2 fixture 全量格式自测证明可用。

## 10. Token / 延迟 metadata

`AICallMeta`：

- `provider` / `model`：实际使用的 provider 与模型
- `latencyMs`：整次逻辑调用墙钟耗时（含重试与退避）
- `attempts`：实际发出的 provider 请求次数（`chatStructured` 时包含解析修复带来的调用）
- `usage`：`promptTokens` / `completionTokens` / `totalTokens`（provider 未暴露时**不出现**，不伪造 0）
- `finishReason`

目前只返回给调用方，不落库、不上报 —— 持久化与 Trace 属 Phase 5（TBD-3）。

## 11. Composition 方式

`src/bootstrap/index.ts`（唯一 import Infrastructure 具体实现的地方）：

```
DeepSeekAdapter(env: DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL)
   → AIClient
   → PrismaWordLookup(prisma)
   → ReplyToAssistantQueryUseCase
   → getAssistantReplyUseCase()  ← Route 只调用这一个入口
```

- 手动构造，**不引入 DI 框架**（TARGET_ARCHITECTURE §17.3）。
- 进程内惰性单例，避免每个请求重建客户端。
- 环境变量的读取只发生在 Composition Root 与 adapter 构造处，Route 与 Use Case 不感知 provider 配置。
- 未配置 `DEEPSEEK_API_KEY` 时不新增 pre-flight 校验（保持迁移前的错误面）；这些**基础**安全 / 授权边界（缺失 API Key 的 pre-flight 校验、CORS、auth）由 **Phase 10** 建立 / 修复，**Phase 15 只做生产级复验与最终加固**（2026-09-20 第二次路线修订，已批准 / 生效；Phase 15 此前编号为 Phase 13 / Phase 9）。**Phase 15 不得成为这些基础控制的首次实现点。**

## 12. 测试策略

全部离线，**不调用真实 provider**：

| 测试文件 | 覆盖 |
|---------|------|
| `infrastructure/ai/__tests__/retry.test.ts` | 策略规整、指数退避、jitter 边界、有界性、deadline、不可重试短路 |
| `infrastructure/ai/__tests__/structured-output.test.ts` | JSON 提取、schema 校验、解析修复指令、Phase 2 fixture 全量格式兼容 |
| `infrastructure/ai/__tests__/deepseek-adapter.test.ts` | 请求/响应翻译、9 种 HTTP status → 错误码映射、错误体截断、网络异常归一化 |
| `infrastructure/ai/__tests__/ai-client.test.ts` | 成功路径、metadata、超时归一化、可重试/不可重试、上限、结构化修复与失败 |
| `application/use-cases/assistant/__tests__/…use-case.test.ts` | 参考 Use Case（fake `AIClientPort` + fake `WordLookupPort`）、prompt 注入、参数一致、错误传播 |
| `app/api/assistant/__tests__/route.test.ts` | Route 级：400 校验、成功响应、错误回退、请求透传（mock Composition Root） |

注入点：adapter 的 `fetchImpl`、`AIClient` 的 `now`/`sleep`/`random`、以及 port 的 fake 实现。

## 13. 选中的参考迁移

**`POST /api/assistant`** —— 详见 `docs/refactor/tasks/phase-3-task.md` Part 2。

迁移前后结构：

```
迁移前： Route（内联 Prompt + API Key + fetch + 超时 + 词卡查询 + 错误文案）

迁移后： Route（传输校验 + 统一响应）
           → ReplyToAssistantQueryUseCase（词卡查询键 + Prompt + 调用编排）
           → AIClientPort / WordLookupPort
           → AIClient + DeepSeekAdapter / PrismaWordLookup
```

行为保持不变（14 条约束见任务文档 §2.4），且由此获得了 Route 级自动化测试接缝（Phase 2 遗留项）。

参考迁移对统一层的**两处显式选择**：

1. `retry: { maxAttempts: 1 }` —— 退出网络重试，保持"只发一次请求"的既有行为。
2. `timeoutMs = totalBudgetMs = 30 000` —— 保持 30 秒用户可见等待上限。

统一层的默认重试能力不受影响，供后续明确授权改变行为的迁移使用。

## 14. 延后工作（Deferred）

| # | 项 | 原因 / 归属 |
|---|----|------------|
| D1 | 其余 10 个 AI 调用点的迁移 | Phase 4+，逐个模块进行（清单见任务文档 Part 1） |
| D2 | 各 feature 的输出解析器接入 `chatStructured()` | 保留 Phase 2 离线契约作为基线；仅参考迁移深度接入 |
| D3 | `src/features/listening/lib/listening.ts` 缺超时/信号 | Listening 迁移时处理 |
| D4 | `words/themes/generate` 三步内联 pipeline → Workflow | Phase 4（Workflow 样板） |
| D5 | Token / 延迟持久化与 Trace 传播 | Phase 5 |
| D6 | Prisma 单例搬迁至 `infrastructure/db/` | Phase 6 |
| D7 | 未配置 API Key 的 pre-flight 校验、CORS/鉴权 | **Phase 10** 建立基础安全 / 授权边界（2026-09-20 第二次路线修订，已批准 / 生效）；Phase 15 只做生产级复验与最终加固，**不得**首次实现 |
| D8 | `AIRequestOptions` 的降级策略（TBD-2） | 需要真实用例后再定，暂不引入 |

---

## 15. 修正记录

### v2 — 外部审核 v1（Changes Requested）的三项阻断问题

| # | 问题 | 修正 | 文档位置 |
|---|------|------|---------|
| 1 | 参考迁移继承了统一层默认 `maxAttempts = 3`，改变了"只发一次请求"的既有行为 | Use Case 显式传入 `retry: { maxAttempts: 1 }`；统一层默认重试能力保持不变；后续迁移必须显式声明行为变更 | §7、§13 |
| 2 | `chatStructured()` 每次解析修复都重新计算 `totalBudgetMs`，最坏可消耗约两倍预算 | 引入单一 `deadlineAt`：`chat()` 与 `chatStructured()` 都只计算一次；修复与网络重试共享剩余预算；预算耗尽不发请求并归一化为 `timeout` | §6.1、§9 |
| 3 | HTTP 200 但响应体非 JSON 被归一化为 `unknown` | adapter 改为抛 `AIError('invalid_response')`（`retryable = false`，`cause` 保留原始解析错误，不回显响应体） | §5、§8 |

> 审核记录见 `docs/refactor/reviews/phase-3-review.md`（v1 Changes Requested + 修正记录，等待外部复审）。
