# Architecture Decision Records

## ADR-001: 采用渐进式重构

**日期:** 2026-07-25
**状态:** Accepted

**决定:**
不推倒重写，采用渐进式方式改造现有代码。每次只修改一个模块或一个功能，项目始终保持可运行。

**理由:**
- 项目已有 2000+ 单词、43 篇文章、听力场景和 AI Coach 等真实内容，推倒重写代价大
- 渐进式允许在每个阶段结束后验证效果，避免一次性引入大量错误
- 边重构边学习，每阶段的收获可以立即应用

**后续影响:**
- 每个 Phase 必须明确范围，不得越界修改
- 需要建立基线数据，否则无法判断重构效果
- 新功能开发应优先使用新架构，旧功能逐步迁移

---

## ADR-002: Workflow/Agent 分离原则

**日期:** 2026-07-25
**状态:** Accepted

**决定:**
固定步骤的任务使用 Workflow（确定性编排），只有需要模型动态决策的任务才使用 Agent。

**理由:**
- 现有场景（Reading Pipeline、听力生成、Coach 两步调用）都是固定步骤，用 Workflow 更可靠、更便宜、更容易测试
- Agent 的额外成本（状态管理、工具调用、循环控制）只有在路径不确定时才有价值
- 明确边界避免"为了用 Agent 而用 Agent"

**后续影响:**
- Phase 4 重构样板 Pipeline 时采用 Workflow 模式
- Phase 7 学习路径规划才引入 Agent

---

## ADR-003: AI Client 单一职责

**日期:** 2026-07-25
**状态:** Accepted

**决定:**
AI Client 只负责模型调用（Provider Adapter、超时、重试、回退、结构化输出、Token 统计），不负责任何业务流程编排。

**理由:**
- 业务流程（如"先分析难度→再提取词汇→再生成题目"）应属于 Workflow
- AI Client 如果承担业务逻辑，会变成"上帝类"，难以测试和替换
- 分离后，更换模型供应商只需改 Adapter，不影响 Workflow

**后续影响:**
- Phase 3 设计 AI Client 接口时严格限定职责范围
- 现有散落的 AI 调用迁移时，需要把业务逻辑留在原地，只抽离模型调用部分

---

## ADR-004: 四层架构 + Port/Adapter + Composition Root

**日期:** 2026-07-29
**状态:** Accepted (修正版)

**决定:**
采用四层架构 + Port/Adapter 模式 + Composition Root：

```
UI/API Layer → Application Layer → Domain Layer
                  ↕（Port 接口）
            Infrastructure Layer (Adapter)
            Composition Root (装配)
```

**关键区别（修正版）：**
1. 增加 Composition Root（`src/bootstrap/`）负责装配所有层
2. 区分**源码依赖**（import 方向）和**运行时调用**（方法调用方向）
3. Port 接口定义在 Application 层（不是 Domain 层）
4. Infrastructure 实现 Application 定义的 Port 接口
5. Domain 不定义接口、不注入外部服务——Domain 是纯计算

**理由:**
- 解决 v1 中"Domain 定义接口 → Infrastructure 不能 import Domain"的矛盾
- Composition Root 是唯一的"知道所有具体实现"的地方
- Domain 保持纯计算，不依赖接口/注入

**后续影响:**
- 所有新代码必须归入四层之一 + Composition Root
- Application 层包含 Use Case、Port 接口、Prompt 函数
- Domain 层只包含纯计算、状态转换、规则校验
- Infrastructure 层实现 Port 接口
- Composition Root 装配所有层

---

## ADR-005: Application Use Case 为入口，Workflow 为可选内部机制

**日期:** 2026-07-29
**状态:** Accepted (修正版)

**决定:**
- **Application Use Case / Service** 是每个 API 端点的应用入口，负责编排 Domain 计算和调用 Output Port
- **Workflow** 是复杂 Use Case 内部的可选步骤编排机制，仅在需要步骤级 Trace、恢复、局部重试、补偿时引入
- 删除 v1 中的硬性规则："3 步以下用 Service/3 步以上用 Workflow/有 AI 调用用 Workflow"
- 是否有 AI 调用和步骤数量只是参考，不是硬规则

**理由:**
- v1 中的硬性规则与实际场景矛盾（AI Assistant 只有 1 步 AI 调用但被标记为 Service）
- Workflow 不是独立组件，是 Use Case 的组成部分
- 避免"为了用 Workflow 而用 Workflow"

**后续影响:**
- 每个 API Route → 一个 Application Use Case
- Workflow 只在需要步骤级编排时在 Use Case 内部引入
- Agent（动态决策）在 Phase 7 引入

---

## ADR-006: Domain 层纯计算原则（修正版）

**日期:** 2026-07-29
**状态:** Accepted (修正版)

**决定:**
Domain 层只包含**纯计算、状态转换和规则校验**。不包含 AI 调用、Prompt 构建、外部服务编排。

**Domain 的唯一职责：**
1. 领域计算（如 SM-2 公式、学习队列安排）
2. 领域状态转换（如复习状态机）
3. 领域规则校验（如评分范围、间隔合规性）
4. 对 AI 输出进行业务合理性校验（纯函数）

**Domain 不负责（v1 中错误包含的内容）：**
- ❌ AI 调用（无 AIClient 注入）
- ❌ Prompt 构建（归 Application 层）
- ❌ TTS/Storage/DB 调用
- ❌ 跨领域编排

**理由:**
- v1 中 Domain 的 `EnrichWordService` 注入了 AIClient，违反了纯逻辑原则
- Prompt 构建是"如何使用 AI"的编排逻辑，不是业务规则，应归 Application 层
- Domain 保持纯函数可确保独立测试

**后续影响:**
- Domain Service 不接收构造参数（纯函数，无依赖注入）
- `src/application/prompts/` 存放所有 Prompt 构建函数
- AI 输出的业务校验作为纯函数放在 Domain

---

## ADR-007: AI Client 单一职责（继承 ADR-003，补充细节）

**日期:** 2026-07-29
**状态:** Accepted

**决定:**
AI Client 的职责边界明确限定为：模型 API 调用、超时控制、指数退避重试、结构化输出统一处理、Token 统计和成本计算、错误映射。不负责：构建 Prompt、业务编排、降级策略决策。

**理由:**
详见 ADR-003。本 ADR 细化了 ADR-003 的具体边界。

**后续影响:**
- AIClientPort 定义在 Application Layer 的 `src/application/ports/ai-client.ts`；Infrastructure Layer 提供其具体实现及 Provider Adapter
- Provider Adapter 模式接入不同模型供应商
- 两层法（json_object 回退）封装在 AI Client 内部，对调用者透明

---

## ADR-008: 纯运维端点例外（替代原"纯 CRUD 例外"）

**日期:** 2026-07-29
**状态:** Accepted (修正版)

**决定:**
移除"纯 CRUD API Route 可直接调用 Prisma"的通用例外。改为：
- 仅限**无产品语义的纯运维端点**（如 `/api/warmup`）可以直接调用 Prisma
- 有业务含义的简单读写（如标记已读、获取队列统计）需通过轻量 Application Use Case
- 运维端点文件头必须标记 `// @ops-endpoint`

**理由（修正版）：**
- v1 中的"纯 CRUD 例外"将 `GET /api/words/queues`（队列统计有业务语义）和 `POST /api/reading/[id]/read`（标记已读有业务语义）列为示例，但这两个操作都有产品含义
- 简单业务通过轻量 Application Use Case 完成，不需要套 Domain 层
- 轻量 Use Case 仍通过 Repository Port 访问数据库，Prisma 的具体调用属于 Infrastructure Adapter
- 只有 `/api/warmup` 等无产品语义的纯运维端点可以直接调用 Prisma

**后续影响:**
- `ARCHITECTURE_RULES.md API-003` 已同步修正
- 有业务含义的读写操作 → 轻量 Application Use Case（通过 Repository Port 访问 DB）
- Warmup → @ops-endpoint（可直接调用 Prisma）

---

## ADR-009: Reading Pipeline 作为首个迁移样板

**日期:** 2026-07-29
**状态:** Accepted

**决定:**
Phase 4 选择 Reading Pipeline 作为首个完整迁移到新架构的样板 Pipeline。

**理由:**
- 不受冻结约束（Reading 不在冻结范围内）
- Pipeline 流程清晰（4 步：RSS 获取 → AI 处理 → DB 存储 → 词汇提取）
- 包含 AI 调用（展示 AI Client 集成）
- 规模适中（不太小也不太大）

**后续影响:**
- Phase 4 建立 Workflow 模式模板
- Listening、Theme 生成等 Pipeline 后续参考 Reading 模式
- Phase 4 结束后验证架构模式是否合理

---

## ADR-010: 恢复 Phase 9 — 部署与作品集包装

**日期:** 2026-07-29 (修正版)
**状态:** Accepted

**决定:**
在 Phase 8 之后增加 Phase 9，负责部署配置、安全边界、演示数据、README、架构图、作品集展示和面试讲解材料。

**理由:**
- Phase 1 v1 的 MIGRATION_PLAN.md 和 PHASE_STATUS.md 意外遗漏了原有 Phase 9
- 重构完成后需要进行部署验证、安全加固和面向读者的总结
- 作品集演示和面试讲解能力是项目的明确目标之一（MASTER_PLAN.md "可作为面试项目完整讲解"）

**后续影响:**
- MIGRATION_PLAN.md 新增 Phase 9 章节
- PHASE_STATUS.md 恢复 Phase 9
- Phase 9 不修改架构，只负责部署、文档和展示材料

---

## ADR-011: 统一 AI Client 契约（Port 归属、超时/重试策略、错误模型）

**日期:** 2026-09-12
**状态:** Accepted（Phase 3 已于 2026-09-13 通过外部复审：Review Status = Approved，Blocking Issues = None）

**决定:**
Phase 3 落地统一 AI Client，并固定以下长期契约：

1. **`AIClientPort` 定义在 Application 层**（`src/application/ports/ai-client.ts`），
   包含 provider-independent 的请求/响应类型与归一化错误模型 `AIError`；
   Infrastructure 提供实现与 provider adapter（`src/infrastructure/ai/`）。符合 ADR-007。
2. **错误模型保持 8 个错误码**：`timeout` / `rate_limited` / `provider_error` / `network_error` /
   `auth_error` / `invalid_request` / `invalid_response` / `unknown`。
   只有前四类标记 `retryable = true`。
3. **超时采用「单次尝试超时 + 整次调用总预算」双约束**：
   单次尝试实际超时 = `min(timeoutMs, 剩余预算)`；默认值均为 30 000 ms。
   不存在无超时的 AI 请求路径。
4. **三类重试严格区分**：传输/网络重试（`retry.ts`，`maxAttempts` 默认 3）、
   provider 重试（同一机制，状态码是触发源之一）、结构化输出**解析修复**
   （`structured-output.ts`，`maxRepairAttempts` 默认 1）。
   认证/配置/确定性请求错误不重试；不存在无限重试路径。
5. **prompt-neutral 的编排参数不下发 provider**：`timeoutMs` / `totalBudgetMs` / `retry` / `metadata`
   只用于 Infrastructure 编排与未来的可观测性。
6. **Provider 接入只经 Adapter**：新增模型供应商只需实现 `AIProviderAdapter` 并在 Composition Root 装配，
   不改动 Application 层。

**理由:**
- 11 个既存 AI 调用点各自实现超时、错误处理与 JSON 解析，其中 4 处完全没有超时、11 处全部没有重试
- 若不在本阶段固定契约，后续模块迁移会各自发明一套语义，统一层就失去意义
- 双约束超时让「新增重试」不改变用户可见等待上限（参考迁移仍是 30s 上限）
- 明确区分网络重试与解析修复，避免把确定性格式错误当作可重试错误反复消耗额度

**后续影响:**
- 后续 Phase 迁移任何 AI 调用时，必须通过 `AIClientPort`，不得在业务代码中直接 `fetch` provider
- 新增 feature 的 Prompt 放 `src/application/prompts/`，不得放入 Infrastructure
- 结构化输出统一经 `chatStructured()`；各模块的校验规则以 `AIStructuredSchema` 形式接入
- `AICallMeta`（延迟、token、attempts）为 Phase 5 Trace 的输入，暂不持久化
- 详细设计见 `docs/refactor/AI_CLIENT_DESIGN.md`

**修正记录 — v2（2026-09-12，Phase 3 外部审核 v1 Changes Requested 后）:**

1. **`totalBudgetMs` = 整个逻辑调用的预算（单一 deadline）**
   `chatStructured()` 的网络重试与解析修复必须共享同一个 deadline；
   每次 provider 尝试只获得剩余预算；预算耗尽后**不得**再发起任何 provider 请求，
   并按 `timeout` 归一化失败。任何代码路径都不得为结构化调用重新计算 deadline。
   （原实现每次解析修复都重新调用 `chat()`，从而重置预算，最多可消耗约两倍预算。）
2. **provider 畸形响应 = `invalid_response`**
   HTTP 2xx 但响应体无法解析为 provider 约定 JSON 时，归类为 `invalid_response`（`retryable = false`），
   而不是 `unknown` 或网络失败；原始解析错误保留在 `cause`，响应体内容不回显。
   （空 `choices` 仍翻译为 `content = ''`，这一既有行为不变。）
3. **迁移默认不得改变既有行为**
   统一层的默认策略（有界重试 `maxAttempts = 3`）只适用于**明确声明接受该行为变化**的调用点。
   参考迁移 `/api/assistant` 显式使用 `retry: { maxAttempts: 1 }`，因为迁移前该 Route 只发起一次请求。
   后续任何调用点若要启用重试，必须在迁移文档中显式声明该行为变更并接受审核。

---

## ADR-012: Content Pipeline 样板（Reading 摄取管线）与迁移行为保真原则

**日期:** 2026-09-13
**状态:** Accepted（Phase 4 实现，等待外部审核确认）

**决定:**

1. **Reading 内容摄取管线成为 Content Pipeline 的参考样板。**
   链接方式：`交付层（CLI）→ Application Use Case → Workflow（显式步骤）→ Application Ports → Infrastructure Adapters → 外部系统`。
   Workflow 暴露 4 个显式步骤边界（collectCandidates / selectNewArticles / processArticles / trimToLimit），
   并以结构化事件（`ReadingPipelineEvent`）作为日志与未来 Trace 的挂点。
   后续内容管线（Listening refill 等）迁移时照此结构，**不引入**工作流框架、队列或编排平台。
2. **Composition Root 按交付面拆分文件**：`src/bootstrap/index.ts`（Next 服务端 / assistant 面）与
   `src/bootstrap/reading-composition.ts`（CLI 面）。目的是避免把 CLI 专用重依赖
   （rss-parser / jsdom / node-postgres）拉进 Next 打包，也避免 CLI 加载 Next 专用的
   Prisma 单例（其在模块加载时会建连并 warmup）。两者同属 Composition Root 层。
3. **既有管线迁移的行为保真原则**：统一基础设施提供的"新能力"（网络重试、解析修复）
   **默认不得自动生效**；每次迁移要么显式 opt-in 并在迁移文档中声明这是行为变更，
   要么显式 opt-out 以保持既有语义。若架构本身无法保留某个既有行为
   （例如 Phase 3 的"不存在无超时路径"），必须在任务文档与设计文档中**显式列出**该变更及其影响面。
4. **结构化输出生产化模式（含 v2 修正）**：分为三段，且**原始负载与归一化结果分别建模**：
   1. **提取**：Infrastructure（Phase 3 的 `chatStructured()` / `structured-output.ts`）负责取得 JSON；
   2. **归一化**：Domain 纯函数按**该管线迁移前的真实语义**逐字段兜底
      （旧 Reading 管线是 `titleZh || ''`、`Array.isArray(vocabItems) ? … : []`，
      而不是"整包校验失败就全部丢弃"）；
   3. **持久化形状**：归一化结果类型保证字段具体（例如 `type: string`），
      原始负载类型允许字段可选（例如 `type?: string`）—— 不得用类型断言掩盖不一致。
   迁移前"无法安全恢复的负载最终导致该条失败"的行为必须保留（在归一化阶段判定失败），
   不得静默变成"成功但降级"的文章。**可选字段的 falsy 兜底必须逐字对齐旧实现的 `||` 语义**
   （例如 `type: v.type || 'word'`、`partOfSpeech: v.partOfSpeech || null`：
   `undefined` / `""` / `null` / `false` / `0` 走兜底，只有 truthy 非字符串才判失败）；
   归一化实现应使用控制流收窄而非类型断言。Phase 2 的离线契约测试保持不变。
   **不得把依赖运行时副作用（例如操作员日志里的 `titleZh.slice()` 抛错）的旧结果固化为领域规则**：
   这类结果应以确定性判定替代，并作为显式行为变更记录（Phase 4 的 C7）。
5. **应用层错误模型保持精简**：`ApplicationError` 只为真实出现的失败类别建码
   （`invalid_input` / `feed_unavailable` / `persistence_failed` / `unexpected`）；
   AI 失败继续复用 Phase 3 的归一化 `AIError`，不重复定义。
6. **错误码必须由真实路径产生**：`persistence_failed` 必须由真实的运行级仓储操作
   （去重查询 / 统计 / 取最旧 / 裁剪删除）产生，不得退化为 `unexpected`；
   单条文章的 `createArticle()` 失败仍按既有语义隔离为该条失败，**不得**升级为整轮失败。
7. **迁移中的"安全改进"必须显式记录**：例如运行配置校验（`maxPerRun` 必须为正整数）
   相对旧 CLI（依赖 `slice()` 宽松行为）是**有意的行为变更**，
   必须作为独立条目（C5）记录原因与影响，不得声称行为完全不变。

**理由:**
- Reading 摄取管线是项目里唯一同时具备"外部内容源 + AI 结构化输出 + 持久化 + 运行级清理"的确定性多步流程，
  能真正验证架构而不需要发明步骤
- 管线此前 0 测试且全部逻辑内联在脚本里；端口化之后可完全离线验证（57 个新测试）
- 交付面分离解决了"Next 服务端与 CLI 共用同一个 Composition Root 会互相拖入重依赖"的实际问题
- 行为保真原则把 Phase 3 参考迁移的经验固化为可复用的迁移规则，避免后续迁移出现"静默改行为"

**后续影响:**
- 后续内容管线迁移必须复用该结构（Use Case + Workflow + Ports + Domain 纯规则）
- 交付层只做配置、日志与退出码映射；不得直接实例化适配器
- 每个新步骤边界都应发出事件，Phase 5 在其上实现 Trace（本阶段不实现存储）
- 迁移中的"有意行为变更"必须逐条记录在任务文档与设计文档，并接受外部审核

---

## ADR-013: 应用级 Trace / 可观测性契约（Phase 5）

**日期:** 2026-09-13
**状态:** Accepted（Phase 5 实现，等待外部审核确认）

**决定:**

Phase 5 建立项目**第一个应用级 Trace 系统**，并固定以下长期契约
（详细设计见 `docs/refactor/TRACE_DESIGN.md`）：

1. **TracePort 定义在 Application 层**（`src/application/ports/trace.ts`），
   只有类型与接口：`startTrace()` 返回 `TraceScope` 句柄，span / event / error / end 都在句柄上完成。
   Port **不依赖** DeepSeek / Prisma / Next.js / console / 文件系统。
   配套最小 `ClockPort { now(): number }` 用于确定性计时（生产用真实时钟）。
2. **显式 ExecutionContext 传播，不使用 `AsyncLocalStorage`**：
   Delivery（CLI / HTTP Route）创建 root trace → 作为显式参数交给 Application Use Case →
   Workflow → 子 span。未提供 trace 时使用 Null Object（`NOOP_TRACE_SCOPE`），行为与迁移前完全一致。
   理由：依赖方向清晰、无隐式全局状态（并发安全）、可测试、与既有显式注入风格一致。
3. **归一化三态 status**：`ok` / `degraded` / `error`。
   `degraded` 表示"操作完成但存在已兜底/已隔离的失败"（AI 降级后文章仍入库、单篇失败但整轮继续）。
   状态**不自动向上冒泡**：整轮 trace 的状态由应用入口按运行结果判定，
   从而区分"单篇失败但整轮完成"（`degraded`）与"致命失败"（`error`）。
4. **生命周期安全（单一不变式）**：*一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。*
   `runInTrace()` / `runInSpan()` 保证任何路径（含抛异常）下先结束子 span 再结束父 span，因此正常路径没有孤儿；
   `end()` 幂等、终态后写入为 no-op。若 root 在仍有存活子 span 时被终结（手工埋点缺陷），
   该 trace 被终结为**显式的生命周期违规状态**（`status = 'error'` + `error.code = 'lifecycle_violation'` +
   `trace.lifecycleViolation` metadata），**不伪造**子 span 的结束，也**不进入**"正常完成的 trace"集合
   （内存实现走 `getLifecycleViolations()`，console 实现输出独立的 `trace.lifecycle_violation` 记录）。
   选择显式错误状态而非抛异常，是为了避免在清理路径上把观测缺陷升级成业务错误。全部有测试覆盖。
5. **AI 可观测性用 Application 层装饰器**（`withAITracing`，`AIClientPort` → `AIClientPort`），
   **不修改** Phase 3 已批准的 AI Client 契约。装饰器只消费 provider-neutral 的 `AICallMeta`
   （provider / model / latency / attempts / usage / finishReason）并记录 `AIError` 归一化码。
   由于 `AICallMeta.attempts` 把网络重试与解析修复**合并计数**，本阶段**不伪造**拆分后的计数：
   只记录实际 attempts 与编排层已知的策略上限，把"按类型拆分计数"列为延后项（需修改 Phase 3 契约）。
6. **metadata-first + 默认不采集内容**：只记录计数、尺寸、标识符、操作名、model/provider、错误码；
   **不记录**完整 prompt、完整模型输出、任意用户文本。API Key / 密钥 / 认证头 / 连接串 / cookie /
   环境变量由 Infrastructure 的 `sanitize.ts` 在**写入前**丢弃或脱敏（键名禁用集合 + 值模式脱敏 +
   长度上限 + 类型收敛），并且不保留 stack trace。该策略是"数据离开进程"的最后一道防线，因此
   放在 Infrastructure，而不是依赖调用方自觉。
7. **本阶段不做 trace 持久化**：不改 `prisma/schema.prisma`、不建 Trace 表、不建 migration。
   只提供两个本地 adapter：结构化 JSON 行（console，默认）与结构化内存记录（测试 / 运行期检视）。
   **不引入**任何外部可观测性系统（OpenTelemetry / Jaeger / Zipkin / Datadog / Sentry tracing /
   Kafka / Elasticsearch）。
8. **范围限定为两个参考目标**：Phase 3 的 `POST /api/assistant` 与 Phase 4 的 Reading 内容摄取管线。
   不为其它 feature / Route 加埋点，不进入 Phase 6。
9. **最小 HTTP 增量**：`POST /api/assistant` 响应新增 `X-Trace-Id` 头；**不改** JSON 响应体结构、
   状态码、重试语义、超时语义、model/provider 与用户可见行为。
10. **可观测性不污染 Domain**：Domain 不得 import TracePort / Trace 类型 / logger / console；
    既有 `ReadingPipelineEvent` 操作员事件流保持不变，trace 是并列的新增输出。
11. **ACTIVE state 生命周期 = 仅执行期间**（外部审核 v2 修正 B-03）：
    recorder 只在 trace 执行期间保留可变 TraceState；root 到达终态、adapter 收到终态快照之后，
    该 state 在 `finally` 中被释放（从内部 map 移除并断开重引用）。
    因此进程级单例 `getTraceRecorder()`（assistant 交付面）**不会**随请求数无限增长；
    归档是 adapter 的职责（内存 adapter 保留快照副本供测试，console adapter 不保留任何 state）。
    配套诊断语义被如实重命名：`activeTraceCount()` / `activeSpanCount()` 仅表示 ACTIVE state
    （旧的 `openSpanCount()` / `traceCount()` 命名在释放后会产生误导，已移除）。
12. **fail-open 遥测（外部审核 v2 修正 B-04）**：
    adapter 输出失败（`onEventRecorded` / `onSpanEnded` / `onTraceEnded`，例如 console sink 抛错）
    **绝不**影响业务控制流 —— 业务成功仍然成功并返回原结果，业务失败仍然抛出**原始**错误；
    失败只被计数（`emissionFailures()`，无内容）、不重抛、不递归追踪、不打印 TraceRecord 内容、
    不引入外部日志依赖。该边界是中心化的（recorder 内的 `emitSafely()`），
    Assistant / Reading 及未来调用方都不需要各自包裹 try/catch。

**理由:**

- 项目此前不存在任何 correlation ID、统一 logger 或执行级记录：出现问题只能靠自由文本日志与
  AI 元数据的偶然信息，无法回答"这一次执行内部发生了什么"。
- Phase 3 已经产出 provider-neutral 的 `AICallMeta`，Phase 4 已经把 Workflow 步骤边界显式化，
  因此可观测性可以在**不改动**这两个已批准基线的前提下接入（装饰器 + 显式 context）。
- 若不在本阶段固定"status 语义 / 生命周期保证 / redaction 策略 / Port 归属"，
  后续每个模块都会各自发明一套日志与状态语义，把可观测性变成新的技术债。
- 明确不做持久化与外部平台，避免为"看起来高级"引入 collector、SDK 或 schema 变更。

**后续影响:**

- 后续任何新增 Use Case / Workflow：Delivery 创建 root trace，通过 `ExecutionContext` 显式传入，
  用 `runInTrace` / `runInSpan` 包住步骤，AI 调用用 `withAITracing` 包住 port。
- 新增 trace metadata 时必须遵守 `TRACE_DESIGN.md` §11 的禁用键集合与"默认不采集内容"策略。
- 若要持久化 trace 或接入外部平台：新增一个实现 `TracePort` 的 Infrastructure adapter 并在
  Composition Root 装配，**不修改** Application / Domain。
- CLI 的操作员可见输出新增结构化 trace JSON 行（`TRACE_MODE=console` 默认，`memory` 可关闭）；
  业务行为、日志分类与控制流不变。
- Trace 持久化、metrics 聚合、prompt/output opt-in 捕获、`AICallMeta` 按类型拆分计数
  均列为延后工作（`TRACE_DESIGN.md` §13 / §14）。

---

## ADR-014: 持久化 User State + Memory 契约（Phase 6）

**日期:** 2026-09-13
**状态:** Accepted（Phase 6 已于 2026-09-14 经外部最终复审 v3 **Approved**；
B-01–B-05 全部 resolved and accepted；Phase 7 Release Decision = Approved after administrative closeout）

**决定:**

Phase 6 建立项目**第一个持久化用户态基础设施**，并固定以下长期契约
（详细设计见 `docs/refactor/MEMORY_DESIGN.md`）：

1. **四个概念显式分离**：User State（canonical 当前事实，`User` + `UserProfile`） /
   Memory（持久历史上下文，`UserMemory`） / Chat-Event History（原始交互，**不落库、永不自动成为记忆**） /
   Working-Request Context（单次执行，`ExecutionContext`，不持久化）。
2. **身份用显式 `UserId` 抽象，不做认证**：Application 只使用 `type UserId = string`；
   Domain 不读 cookie / header / session；需要归属的 Repository 方法必须接受 `userId`；
   Delivery/Composition 边界用**过渡性确定性默认用户**（`DEFAULT_USER_ID = 'local-default-user'`，
   `src/bootstrap/identity.ts`）承载新状态。
   **B-01（v1 外部复核修正）**：受用户归属约束的 Application 操作，权威归属身份只能来自
   `ExecutionContext.userId`；操作 payload 不携带 `userId`；缺失/非法 → `invalid_input`
   （Application 不回落默认用户）。
   未来接入真实认证时，路径是 external identity → identity boundary → **可能的映射** →
   internal `UserId`（须满足 `normalizeUserId` 的字符集/长度约束）。**不得**声称只需改动
   `identity.ts` 一个文件。**不引入** Auth.js / Clerk / OAuth / 账号管理。
3. **架构边界不变**：`UserRepositoryPort` / `MemoryRepositoryPort` 定义在 Application，
   Prisma 实现只在 Infrastructure，Domain 只含纯规则（归一化、闭集、边界、去重键）。
   端口表达应用需求（"按含义键 create-or-update"、"有界选取"），**不是**通用 CRUD。
4. **记忆写入是显式且确定性的**：唯一入口 `RememberUserFactUseCase`；
   `source` 闭集 `explicit_user | deterministic`；`kind` 闭集
   `preference | goal | weakness | milestone`；内容 ≤ 500 字符（**拒绝**超长而非截断）。
   **不存在**"每条消息 → 自动存为记忆"的路径；Phase 6 也**不**新增写入 Route。
5. **记忆读取有界且确定性**：`userId` → 可选 kind → `updatedAt desc, id asc` → `take limit`；
   默认 5 条、硬上限 20 条；**不做** RAG / 向量 / 语义检索（延后）。
   **B-03（v1 外部复核修正）**：`memoryKinds` 省略 = 有意不过滤；非数组 / 空数组 / 全部非法
   → `invalid_input`；混合非法项 → 使用合法子集。非法收窄请求**永不**扩大为 select-all。
   **B-05（v2 外部复核修正）**：`MemoryRepositoryPort` 层语义显式统一为
   `undefined` = 不限制、非空 = 限制、**`[]` = 返回零条**；`PrismaMemoryRepository`
   在空收窄时先返回 `[]` 且不执行 `findMany`，与 `FakeMemoryRepository` 语义一致。
   这是 Application 边界之外的第二道防线。
6. **去重身份 = `(userId, kind, normalizedKey)`**：由 `@@unique([userId, kind, key])` +
   upsert 共同保证；`key` 在 Domain 归一化（大小写/空白/`-`/`:`/`.` 收敛为 `_`），
   因此同一含义的偏好不会累积成成百条记录。`preference` / `goal` / `weakness` 为单槽（覆盖更新），
   `milestone` 用事件唯一键（追加型，同键重放幂等）。
   **B-02（v1 外部复核修正）**：canonical profile 语义键（至少
   `english_level` / `explanation_language`，含归一化变体）**保留给 User State**；
   Memory 写入命中保留键 → `invalid_input`，不落库。同一语义当前事实只有一个权威归属。
7. **Memory 注入 LLM 时是数据而非权威**：真实的 profile / memory **内容**作为
   **独立的 `user` 角色数据消息**注入（**不**拼接进 system prompt），用显式分隔标记包裹，
   渲染前折叠为单行并中和方括号（防伪造结束标记），逐条 ≤ 200 字符、整段 ≤ 1500 字符。
   **B-04（v1 外部复核修正）**：处理 learner context 的**静态策略**位于 **system 权威**，
   且仅在本次请求存在 learner context 时追加；策略本身不含用户数据。这是
   defense-in-depth / authority separation，不声称让 prompt injection 不可能。
8. **失败语义按产品语义区分**：读路径（profile / memory）失败 → **优雅降级**
   （记 `degraded`，以空上下文继续，请求不失败）；显式写路径失败 → **必须报错**
   （`invalid_input` / `persistence_failed`）。
9. **Prisma 变更是纯增量的，且已被任务书授权**：新增 `User` / `UserProfile` / `UserMemory`
   三张表 + `@@unique([userId, kind, key])` + `@@index([userId, kind])` + 两个外键；
   **不**修改既有 7 张表的语义、**不**迁移既有数据归属、**不**对生产库执行迁移。
   `CLAUDE.md` / `ARCHITECTURE_RULES.md` EXT-003 的"schema 冻结需授权"约束由本次 Phase 6
   任务书 Part 13 明确授权满足，授权范围仅限上述三张新表。
   **部署门禁（v1 外部复核 non-blocking note A）**：
   `prisma/migrations/20260609000001_baseline/migration.sql` 是 Phase 6 之前的损坏历史迁移
   （UTF-16 PowerShell 错误转储）。Phase 6 新增迁移在单独看时合法，但**完整迁移链的生产部署
   在历史迁移链被独立验证/修复之前保持 BLOCKED**；不得声称 deployment-ready。
10. **legacy 用户化债务显式延后**：`WordReview`（含 `@@unique([wordId])`）、
    `Article.readAt/favoritedAt`、`ListeningScene.playedAt`、`DailyProgress`、
    localStorage 偏好均**不**在本阶段迁移（清单见 `MEMORY_DESIGN.md` §17）。
11. **隐私与可观测性延续 Phase 5 的 metadata-first**：trace 只记录计数 / 布尔 / 尺寸
    （`userContext.*` / `memory.selectedCount` / `memory.contentChars` …），
    **不**记录记忆内容、profile 值、用户消息，并且**不**记录 `userId` 本身。
12. **参考集成保持行为保真**：`POST /api/assistant` 的个性化依赖为**可选**，
    且需要 `ExecutionContext.userId`；两者缺一或用户无任何 profile/memory 时，
    消息数组与迁移前逐字节一致（Phase 3 既有测试无需修改即仍然通过）。

**理由:**

- Phase 5 结束时项目已经具备统一 AI Client（Phase 3）、Content Pipeline 样板（Phase 4）与
  显式 `ExecutionContext` 传播（Phase 5），因此可以在**不改动**这三条已批准基线的前提下
  接入"用户身份 → 有界上下文 → 既有 prompt → AI Client"这一条纵向链路。
- 仓库历史上完全没有身份概念，且所有学习进度表都是"全局单份"（`WordReview.@@unique([wordId])`）。
  若不先建立显式的 `userId` 抽象，Phase 7 的 Agent 会直接在"隐含单用户"的假设上生长。
- 若不在本阶段固定"写入是显式的 / 选择是有界的 / 注入是数据 / 读降级写失败"，
  后续每个模块都会各自发明记忆语义，把记忆系统变成不受控的对话转储。

**后续影响:**

- 任何新增的记忆写入必须经过 `RememberUserFactUseCase`；新增来源种类属**显式契约变更**。
- 任何新增的上下文注入必须沿用三层上限（条数 / 单条 / 整段），并保持"数据非指令"的注入形态。
- 新增 trace 元数据必须遵守 Phase 5 的禁用键集合（`TRACE_DESIGN.md` §11）；
  用户态数据只允许计数与尺寸。
- 多用户化 = 重写 `resolveCurrentUserId()` 的身份边界（external identity → 可能的映射 →
  internal `UserId`）；`User` / `UserProfile` / `UserMemory` 的表结构不需要改变，但
  **不保证**只改动单个文件（见第 2 条）。
- Phase 7 若需要语义检索或 LLM 自主记忆，必须作为独立阶段设计与授权（不在本 ADR 范围内）。

---

## ADR-015: Post-Phase-6 路线图重新基线（Learning Path Agent 退役 / Vocabulary 优先 / Agentic AI Coach 延后）

**日期:** 2026-09-16
**状态:** Accepted（post-Phase-6 权威规划修订；**Phase 7 尚未开始**，本 ADR 不授予任何实现授权）

**决定:**

Phase 6 通过外部批准、进入 Phase 7 之前，产品的未来方向被重新确认，并据此重建路线图：

1. **退役「网站级 / master Learning Path Agent」路线。**
   不会建立横跨 Vocabulary、Reading、Listening、AI Coach 的学习路径编排 Agent。
   旧的「Phase 7 = 学习路径 Agent」在未来路线图中的位置被取消。
2. **Vocabulary 平台工作成为 Phase 6 之后的下一优先级。**
   Phase 7 = `Vocabulary Platform Design & Data Provenance`（证据 / 设计阶段），
   Phase 8 = `Vocabulary Books Implementation`，Phase 9 = `Themed Packs Convergence`。
3. **Agentic AI 工作被刻意延后到有界的后续 AI Coach 阶段。**
   AI Coach 成为唯一候选的 Agentic 子系统，但必须先经过 Phase 11
   （`AI Coach Foundation Refactor`），再接 Phase 12（`Agentic AI Coach`）；
   Phase 12 只做产品行为确实需要动态决策的部分。
4. **高级技术不构成路线图义务。** RAG、MCP、LangGraph、向量数据库、fine-tuning
   只在出现**被验证的真实需求**时评估；不得为了让项目看起来更高级而变成交付承诺。
5. **历史叙事保持不动。** 本 ADR 只取代 ADR-002 / ADR-005 等既有 ADR 中关于
   「Agent 在 Phase 7 引入」的**未来路线图后果**。这些既有 ADR 的历史理由、以及
   Phase 0–6 已批准的任务 / 交接 / 评审记录，均保留为历史证据，不被改写。
   Phase 0–6 的已批准含义、编号与范围**不因本 ADR 改变**。
6. **Phase 数量从属于范围。** 阶段数不是目标；拆分 / 合并 / 重排必须走高阶治理流程
   （任务书 + 外部审核 + 用户明确批准），不得在阶段内夹带实现。
7. **冻结模块的保护语义明确化（默认冻结）。**
   AI Coach（口语对练 + 场景系统）、Words 页面 UI、`prisma/schema.prisma` **默认保持冻结**；
   只有当**当前已批准的 Phase 任务书**明确包含该修改、**且**用户明确授权时，
   才可在任务书限定的范围内做最小修改。本 ADR **不**授予任何实现权限。

**理由:**

- 退役的方向在**实现开始之前**就被取消，因此不存在"半成品 Agent"或需要回滚的代码；
  但**路线图文档**若不重建，后续每一个 Phase 都会基于已失效的方向重建命令。
- Phase 6 已建立显式 `userId` 抽象与持久用户状态；真正缺少的不是 Agent 能力，而是
  **Vocabulary 产品域本身的设计**（Book / Pack 语义、数据来源合规、用户学习状态归属）。
- 项目的既有原则是"架构复杂度只在解决真实产品或工程问题时才引入"。把 Agentic 工作
  排在 Vocabulary 之后，使 Agent 有真实产品需求作为前提，而不是路线图中的默认占位。
- 明确区分"默认冻结"与"永久冻结"，可以把保护语义从措辞（"严格冻结"）变成可执行条件
  （当前已批准任务书 + 用户明确授权），避免以后用"历史措辞"或"看起来需要"绕过授权。

**后续影响:**

- `MASTER_PLAN.md` 的 Phase 表与叙事、`MIGRATION_PLAN.md` 的 future 迁移路径、
  `PHASE_STATUS.md` 的 Phase 7–13 状态、`TARGET_ARCHITECTURE.md` 的 future phase 引用、
  `ARCHITECTURE_RULES.md` 的适用范围与 APP-004 已同步。
- Phase 7 的执行任务书必须在本修订经外部评审后**单独重建**（`PHASE_EXECUTION_PROTOCOL.md` §4）。
- 本修订**不**创建 `docs/refactor/tasks/phase-7-task.md`，**不**创建 Phase 7 源码 / schema /
  migration / handoff / review。
- 后续若要恢复"网站级 Agent"或引入 MCP / RAG / 向量库，属于**新的产品决策**，
  需要新的 ADR 与用户明确批准，不能引用本 ADR 覆盖。

**修正记录 — v2（2026-09-16，外部复审 Minor Changes Requested 后）：**

1. **Phase 8 范围 / 拆分决策门（R-01）**：不在本 ADR 内机械拆分 Phase 8。Phase 7 的出口必须是
   一个显式决策 —— 判定「迁移链修复」与「Vocabulary Books 实现」能否安全留在同一个有界 Phase；
   若属可以独立审核的高风险变更，必须在 Phase 8 实现开始前再次拆分路线图。**Phase 编号不受保护。**
   见 `MASTER_PLAN.md` / `MIGRATION_PLAN.md` / `PHASE_STATUS.md` 的 Phase 7 出口条件。
2. **迁移正确性同阶段验收（R-02）**：修复迁移链或变更 `schema.prisma` / migrations 的那个
   已批准 Phase，必须**自行**通过迁移正确性与可复现性的真实数据库验收；Phase 13 只做**复验**，
   不得成为正确性首次建立点。见 `EVALUATION_BASELINE.md` 的"迁移验证门"。
3. **APP-004 阶段无关化（R-03）**：架构规则只拥有**不变式**，实现阶段归 `MASTER_PLAN.md` /
   `PHASE_STATUS.md` / 已批准任务书，不再把阶段编号写进规则。
4. **RAG / MCP / 语义与向量检索与 Agent 准入门槛解耦（R-05）**：这些能力**不要求** Agent 行为，
   因此**不适用** Agent 特有的"动态决策"准入条件，按各自的产品 / 工程理由独立评估
   （见 `ARCHITECTURE_RULES.md` APP-004 第 4 条）；它们仍然都不是路线图的强制交付物。

---

## ADR-016: Vocabulary 的两个产品域（Vocabulary Books vs Themed Packs）与数据来源 / 许可前置审查

**日期:** 2026-09-16
**状态:** Accepted（post-Phase-6 权威规划修订；产品域决策与数据合规前置条件）

**决定:**

1. **Vocabulary 包含两个**不同的产品域**，不得为了架构整齐而合并成一个通用词汇抽象：**
   - **Vocabulary Books** — 结构化、可选择的词书；
   - **Themed Packs** — 主题词包，包含 **Default Packs** 与 **User-created Custom Packs**。

   两者可以共享底层 lexical 基础设施（同一个 `Word` 概念、同一套复习算法），
   但**产品 / 领域概念保持独立**，直到后续证据明确支持收敛。
2. **Default Packs 与 User-created Custom Packs 是两种不同的产品行为**，
   不能因为它们共享生成 / 存储手段而被当作同一种东西。
3. **当前以 IELTS 为中心的词汇实现不是目标成熟形态。**
   现有实现把词书语义压在 `Word.difficulty` / `Word.source` / `Word.theme` 的组合上
   （例如队列查询使用 `source = 'ielts' AND theme IS NULL`，AI 生成词包写入
   `source = 'generated'` / `difficulty = 'CUSTOM'`）。这只作为**现状证据**，
   不构成未来的领域模型。
4. **外部 Vocabulary 数据集的引入以文档化的合规审查为前置条件。**
   每个候选数据集在被批准导入之前必须记录：provenance、上游来源、许可 / 使用条件、
   转换方法、版本、质量检查。**"上游仓库是公开的"不构成导入理由或授权。**
5. **候选方向只是候选。** CET-4 / CET-6、精选 IELTS 词表、General English 核心词表、
   Business English 等是 **Phase 7 的研究对象**，不是已批准的导入；
   **具体书单与数据集不因本次路线修订而确定**。
6. **本 ADR 不决定实现形状。** `VocabularyBook` / `VocabularyBookEntry` 的表结构、
   导入管线形态、选书 UI、以及 `WordReview` 的 user-scoped 归属方案，
   全部留给 Phase 7 设计 + 后续已批准的任务书。

**理由:**

- Books 与 Packs 的**生命周期、所有权和产品预期不同**：词书是可选择的、有稳定身份的
  结构化目录（且其内容来自需要许可审查的外部数据集）；词包（尤其自定义词包）是
  用户驱动、内容可生成的。把它们统一成一个抽象，会迫使后续实现为一个不存在的
  "通用词汇容器" 服务，并掩盖数据来源合规问题。
- 在 Phase 7 之前不锁定书单与数据集，是为了避免"先导入再补许可"的顺序错误——
  这类错误在数据层面很难回滚。
- 保留共享 lexical 基础设施，是为了不重复实现 SM-2 与复习队列（Phase 2 已验证的
  受保护基线）。

**后续影响:**

- Phase 7 必须把 Books / Packs 的目标模型与数据来源审查**分别**产出，而不是一份合并设计。
- Phase 8（Books）与 Phase 9（Packs）是**两个不同的阶段**，不得合并为一个"Vocabulary 大阶段"。
- 任何 Vocabulary 数据导入 PR 必须引用本 ADR 第 4 条并附来源 / 许可记录，
  否则视为超出范围。
- 若未来证据表明 Books 与 Packs 应当收敛，需要新的 ADR 记录证据与取舍，不能静默合并。

---

## ADR-017: 作品集级 AI 应用工程证据成为显式成功要求（含跨领域评估 / 实验）

**日期:** 2026-09-20
**状态:** **Accepted**（2026-09-20 经外部评审 **Approved**，Blocking Issues: None；
post-Phase-6 第二次路线修订。该修订此前以 `Proposed — Pending External Review` 状态送审，
由本次行政收尾命令转为 `Accepted`。**Phase 7 尚未开始**，本 ADR 不授予任何实现授权）

**决定:**

项目的成功标准新增一条显式要求：这次重构不仅要产出**可用的英语学习产品**，还要产出一个
**作品集级的 AI 应用工程项目**，能够经受未来 AI / LLM / Agent 工程面试的技术追问。

1. **成功标准升级。** “作品集级 AI 应用工程证据”成为**显式的项目成功要求**。完整的判定契约
   归新文档 `docs/refactor/PORTFOLIO_ENGINEERING_CRITERIA.md`：`MASTER_PLAN.md` 继续拥有
   **执行顺序**，该文件拥有**项目完成时必须存在的证据**。本 ADR 只固定这一要求，不重述契约细节。
2. **评估 / 实验是跨领域工程要求，不是晚期测试关切。** Evaluation 被提升为**系统级能力**：
   golden set、自动化回归评估、检索评估、Agent / tool 评估、baseline vs candidate 对比、
   bad-case 追踪、以及在有理由处的质量门禁。Observability 不等于 console logging，
   Evaluation 不等于 unit testing。
3. **至少两次有意义的工程对照研究。** 到项目完成时，必须存在**至少两个**可测量的工程对照
   （例如 lexical vs semantic vs hybrid retrieval；确定性 Coach vs Agentic Coach；
   model / provider 对比；tool-selection 策略对比）。每个实验记录
   Hypothesis → Baseline → Candidate → Dataset → Metrics → Result → Limitation → Decision。
4. **Phase 数量仍然从属于范围。** Phase 拆分 / 合并 / 重排必须走正常治理流程
   （任务书 + 外部审核 + 用户明确批准）；阶段数不是目标。新增的 Phase 12–15 是有界范围与
   可审核性的结果（与 ADR-015 第 6 条一致）。

**理由:**

- 项目已经明确把“可作为面试项目完整讲解”作为目标之一（`MASTER_PLAN.md` 重构目标）。
  但“有功能”与“有可被追问的工程证据”是两件事：前者不需要评估与实验，后者需要。
- Phase 2 已建立评估基线、Phase 5 已建立应用级 Trace，具备把评估 / 实验提升为跨领域要求的
  既有地基；若不在路线图层级明确它，后续 AI 能力容易退化为“凭感觉说变好了”。
- 明确“实验义务 ≠ 生产义务”，可以在不违反“架构复杂度只为真实问题引入”这一既有原则的前提下，
  保证重要的 AI 应用工程技术被认真调查而不是被静默跳过。

**后续影响:**

- **批准记录（2026-09-20）。** 本 ADR 于 2026-09-20 经外部评审 **Approved**
  （Blocking Issues: None），由行政收尾命令把状态从 `Proposed — Pending External Review`
  转为 `Accepted`；下面的“已同步”现指**已生效**的权威基线。
- `MASTER_PLAN.md` 的核心原则与 Phase 表、`MIGRATION_PLAN.md`、`PHASE_STATUS.md`、
  `TARGET_ARCHITECTURE.md`、`ARCHITECTURE_RULES.md`、`EVALUATION_BASELINE.md`、
  `TEST_STRATEGY.md` 已同步。
- Phase 10 承担评估 / 实验**基础设施**；Phase 11 产出确定性 Coach 基线；Phase 12 / 13 /
  14 各自承担其领域的评估；Phase 15 汇总基准与实验结论。
- 本 ADR **不**创建任何 Phase 7 任务书 / 源码 / schema / migration / handoff / review，
  也**不**安装任何评估平台或观测 SDK（见 ADR-018 与 `PORTFOLIO_ENGINEERING_CRITERIA.md`）。

---

## ADR-018: AI 能力采纳门槛 —— 检索 / Agent / MCP 的可测量调查与 fine-tuning 门（实验义务 ≠ 生产义务）

**日期:** 2026-09-20
**状态:** **Accepted**（2026-09-20 经外部评审 **Approved**，Blocking Issues: None；R-01–R-07
修正已全部 resolved；post-Phase-6 第二次路线修订。该修订此前以
`Proposed — Pending External Review` 状态送审，由本次行政收尾命令转为 `Accepted`。
**Phase 7 尚未开始**，本 ADR 不授予任何实现授权）

**决定:**

为若干重要 AI 应用工程技术固定**可测量的采纳门槛**。核心区分是：
**“必须做一次严肃的工程调查”不等于“必须进入生产”**。生产采纳仍由证据决定。

1. **RAG / 检索必须接受一次可测量的工程调查，生产采纳由证据决定。**
   检索（Phase 12）**不预设**向量检索必要：先建立至少一个更简单的基线
   （结构化 / 数据库 / 词法 / 关键词），并按证据递进到语义 embedding / hybrid / reranking。
   必须产出明确架构决策：哪种方法胜出、为什么、被测量的 trade-off、**RAG 是否属于生产**、
   以及更简单检索在何处仍然更优。**“语义 / 向量检索不值得其复杂度”在证据支持下是合法结论，
   不构成失败的 Phase。** “装了一个向量数据库 + 跑通一次语义搜索”不构成证据。
2. **Agentic Coach 必须相对确定性基线被评估，而不是被假定更优。**
   Agent 自主性（Phase 13）必须先经过 Phase 11（Coach 基础重构 + 确定性评估基线）与
   Phase 12（检索理解）。默认先做**有界单一 Agent**；**不**为架构外观引入 Multi-Agent。
   必须回答“Agent 自主性究竟改善了什么，又让什么变差了”，
   **若 Agent 自主性并未改善某个 workflow，就保留确定性 workflow。**
   把普通 Workflow 称作 Agent、或使用 LangGraph 却没有动态决策，都不满足本门槛。
3. **至少一个合法的 MCP 互操作边界是显式作品集目标，但要求真实协议价值。**
   MCP（Phase 14）必须有真实的互操作故事（例如外部 MCP 兼容客户端可通过标准协议复用
   选定的学习能力）。首选架构方向是 `Application Use Cases → 多个 adapter`
   （Web/API、内部 AI Coach tool adapter、MCP adapter）；**Domain / Application 核心不得依赖 MCP**。
   只暴露刻意选定的能力子集，优先只读。**不**为证明 MCP 而强行拆出外部微服务；
   只要互操作边界真实，单进程 MCP adapter 可接受。
   “把内部一个函数包进 MCP、再由同一组件调用”不满足本门槛。
4. **fine-tuning 由被测量的 specialization 瓶颈把门，而不是由技术吸引力把门。**
   fine-tuning **不是**强制 Phase，也**不是**强制技术。只有当后续评估暴露出一个
   **狭窄、可重复、可测量、且具有经济意义**的失败模式，并且该失败模式无法由
   更好的 prompt / 工具 schema / 检索 / 模型选择 / 工作流架构充分解决时，
   才可以提出一个有界的 specialization 实验。该实验必须经过未来已批准的修订 / 任务，
   **不得**在当前阶段夹带。
5. **这些能力不互相绑定。** 检索 / RAG、MCP、向量库、外部服务边界不要求 Agent 行为，
   因此不适用 Agent 特有的“动态决策”准入条件（与 `ARCHITECTURE_RULES.md` APP-004 第 4 条、
   ADR-015 v2 R-05 一致）。**确定性 Workflow + 检索是合法形态。**

**理由:**

- 作品集深度要求对关键技术做一次严肃调查（ADR-017），但既有的“架构复杂度只为真实问题引入”
  原则必须继续生效；把两者写成“实验义务 ≠ 生产义务”可以在不引入生产技术债的前提下满足两者。
- 若把 RAG / Agent / MCP 设为生产强制项，会直接违反 `MASTER_PLAN.md` 重构目的与
  ADR-015 第 4 条；若完全不调查，则项目无法提供可被追问的 AI 应用工程证据。
- 把 Agent 与确定性基线做对照，是区分“工程”与“演示”的关键；把 MCP 绑定到真实互操作故事，
  是区分“协议价值”与“简历装饰”的关键。

**后续影响:**

- **批准记录（2026-09-20）。** 本 ADR 于 2026-09-20 经外部评审 **Approved**
  （Blocking Issues: None），由行政收尾命令把状态从 `Proposed — Pending External Review`
  转为 `Accepted`；下面的门槛文本现为**已生效**的权威约束。
- Phase 12 / 13 / 14 的出口条件由 `MIGRATION_PLAN.md` 与 `PHASE_STATUS.md` 拥有；
  本 ADR 只固定采纳门槛的不变式。
- `PORTFOLIO_ENGINEERING_CRITERIA.md` 逐条以**双轴模型**标注每项标准：
  义务轴（`MC` 强制能力 / 证据、`ME` 强制工程实验、`CP` 条件性生产采纳）
  与证据 / 运行时表面轴（`PR` 生产运行时、`ER` 工程 / CI / 评估基础设施、`DOC` 文档 / 作品集证据）。
- 任何引入向量库 / MCP SDK / Agent 框架 / fine-tuning 的 PR，都必须引用本 ADR 对应条款并附
  被测量的证据，否则视为超出范围。

---

## ADR-019: Vocabulary 目标领域模型 —— 身份 / 内容 / 成员资格 / 学习者状态分离

**日期:** 2026-09-21
**状态:** **Accepted**（**2026-09-23 经外部评审 v5 Approved，Blocking Issues: None**；
由行政收尾命令从 `Proposed — Pending External Review` 转为 `Accepted`。含义以 **v5** 设计为准。
本 ADR 仍**不**单独授予实现授权：实现范围以各阶段已批准任务书为准）
**来源:** `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md`（Phase 7）

> **阅读顺序提示（v5）。** 本 ADR 的**现行版本是文末的 `v5 修正` 块**（其中已合并 v4 的模型决定）。
> 上方的 `决定:` 列表与 `v2 修正` / `v3 修正` 块是**历史记录**：凡涉及 `WordUsage`、
> `WordExample(.wordUsageId)`、`UNIQUE(bookId, position)`、`posKey` 闭集的表述**均已被取代**，
> 只能作为 v1 → v5 决策演变的追溯材料，**不得**作为现行设计依据。

**决定:**

1. Vocabulary 采用**分区模型**，四类信息各自有归属：
   **A** 词汇底座（`Word` 身份 + 内容字段）、**B** 词书成员资格、**C** 词包成员资格、
   **D** 学习者状态、**E** 来源追溯（provenance）。
2. `Word` **只**承载词条身份（`wordKey` 归一化身份 + `headword` 展示词形）与其内容字段；
   **不再**承载 `theme`（词包成员）、`difficulty`（实为词书 / 词包身份）、
   `source`（同时表示来源与产品域的混合语义）。
3. 成员资格用**关系型中间表**表达（词书条目 / 词包条目），从而支持"同一个词属于多本书 / 多个包"
   而不复制词条。
4. 内容字段必须带**逐字段来源标记**（例如 built-in / imported / generated），
   使"哪些内容是 AI 生成的、是否可替换"可被查询与审计。
5. **不引入** `Lexeme` / `WordForm` / `WordSense`；**暂不引入**独立的 `WordContent` 表。
   触发条件：当出现"同一词的多个内容版本必须并存"或"必须按义项追踪掌握度"的**真实产品需求**时，
   经治理流程再评估。
6. Books 与 Packs 保持**概念分离**（沿用 ADR-016）：共享词汇底座与 SRS 引擎，
   但不合并为通用"词汇容器"抽象。

**v2 修正（2026-09-21，外部复核 v1 = Changes Requested 的 B-02 / B-03）:**

- **源条目语义归属（B-02）**：`Word` 身份**只**由归一化 headword 决定，**不含** POS；
  来源的词性 / 等级 / 条目 id / 分类 / 排名等**来源特定属性**一律落在 `VocabularyBookEntry`
  （`sourcePos`、`sourceCefrLevel`、`sourceEntryId`、`sourceCategory`、`sourceRank` 等）。
  理由：CEFR-J Wordlist 等真实来源会把同一 headword 的不同词性当作不同条目、并可能赋不同等级；
  把这些属性放在 `Word` 上会让一个来源覆盖另一个来源。**仍不引入** `WordSense` / `Lexeme`。
  学习者状态默认仍为"一个词一条"；按 POS 切分状态（`posScope`）是**有触发条件**的后续升级。
- **多值例句（B-03）**：`Word.example` / `Word.exampleZh` 的 ` ||| ` 拼接表示**不再作为目标模型**；
  例句改为 `WordExample` 子关系（每行一条，带 `position`、`source` ∈ `licensed` / `curated` / `generated`、
  以及生成元数据 `provider` / `model` / `generatorVersion` / `generatedAt`、许可内容的 `sourceManifestRef`、
  以及 `status` 以支持"替换而不删除"）。该触发条件**已成立**（现网 2,000 条词全部含多条例句且由 AI 生成）。
  搭配（`collocations`）**不**拆表：它整体展示、无逐条替换需求，保留为有界文本 + 字段级来源标记。
- **书内进度版本安全**：若持久化书内进度，**不得**使用裸位置游标；
  必须推迟持久化、或绑定 `bookVersion`、或使用稳定引用（如 `lastStudiedWordId`）。

**v3 修正（2026-09-21，外部复核 v2 = Changes Requested 的 B-05）:**

- **引入轻量 `WordUsage`（教学相关用法）**：`Word`（headword 身份）→ `WordUsage`（`(wordId, posKey)`，
  `posKey` 为闭集 `n` / `v` / `adj` / … / `phrase` / `multi` / `unknown`）→ `VocabularyBookEntry`
  （指向 usage，并携带 `sourceCefrLevel` / `sourceEntryId` / `sourceCategory` / `sourceRank` / `position`）。
  `WordUsage` **不是** `WordSense`：不含义项编号、义项辨析或本体映射。
  选择它的理由是端到端自洽：用法级内容（如 POS 相关音标）、例句作用域、以及将来可能的用法级学习状态
  都需要一个**共享锚点**；把用法语义只放在 entry 上会导致跨书重复且未来升级要改多处。
- **内容解析规则（新增）**：`BookEntry 级 → WordUsage 级 → Word 级` 逐字段回退；
  回退是"取一条完整内容"，**不是**拼接；**不得**因为缺少用法内容而回退到**另一个用法**的内容。
  典型例子：`record` 名词 `/ˈrekɔːd/` 与动词 `/rɪˈkɔːd/` 必须由用法级音标区分，
  不得假设全局 `Word.phonetic` 永远正确。
- **例句作用域**：`WordExample` 增加**可空** `wordUsageId` —— 非空 = 只属于该用法的例句，
  为空 = 用法中立例句；展示某条目时取"该用法例句 ∪ 用法中立例句"，**绝不**跨用法取例句。
- **条目层唯一性**：`UNIQUE(bookId, position)` 与（`sourceEntryId` 非空时）
  `UNIQUE(bookId, sourceEntryId)`；**禁止** `UNIQUE(bookId, wordUsageId)`，
  因为同一本书可以合法地两次列出同一用法（不同义项 / 考试要求）。

**v4 修正（2026-09-23，产品澄清后的重新定锚）:**

- **移除 `WordUsage`**（不再作为目标领域实体）。v3 需要它是因为假设"状态按词、跨书共享"；
  v4 把学习单位改为 `BookEntry` 且**不要求跨书共享**，因此该共享锚点没有消费者。
  若将来出现"必须在多本书之间共享同一批用法级内容"的真实需求，再经治理流程评估。
- **目标模型（v4）**：`Word`（词形身份 + 共享词汇内容，**不是** SRS 归属）→
  **`VocabularyBookEntry`**（学习单位：目标词性 / 用法、顺序、层级、书目元数据、来源；**SRS 归属**）→
  从属 **`BookEntryMeaning`**（1..N 个目标义项 / 用法，逐条来源 / 生成元数据 / 校验状态；**不是** SRS 归属）→
  从属 **`BookEntryExample`**（0..N 条例句，逐条来源；**不是** SRS 归属）。
- **上游来源条目不得丢弃**：上游多行可映射为 1 条策划条目（N:1 合法），
  但每条来源行都必须在某个 `BookEntryMeaning` 上有来源引用；是否为每条来源行建学习者可见条目，
  是**该书策划决定**（不因上游把它分成两行就自动拆卡）。
- **继续不引入** `Lexeme` / `WordForm` / `WordSense`（义项本体）。

**v5 修正（2026-09-23，外部复核 v4 = Changes Requested 的 B-06 / B-07 / B-10）:**

- **稳定条目身份（B-06）**：`VocabularyBookEntry` 必须有**稳定策划身份 `entryKey`**，
  目标不变式 `UNIQUE(bookId, entryKey)`；**`position` 仅是排序，不是身份**。
  导入 / 重新导入 / 更新**按 `entryKey` 协调**（已存在 → 原地更新；新增 → 建；本次缺失 → `inactive` / `superseded`，
  **不物理删除**）；只有**策划上确实是另一个学习单位**（拆分 / 合并 / 语义变化）才分配新 `entryKey`。
  这是 `(userId, bookEntryId)` 学习状态**连续性的前提**。**不**引入 `VocabularyBookVersion` 表；
  **不**引入跨书身份。
- **正式词书学习内容的规范载体（B-07）**：正式出版词书的学习卡片以 **`BookEntryMeaning` 的内容为规范**
  —— 目标释义（`text`）、面向学习者的中文解释 / 翻译（`translation`）、目标词性、
  **义项级音标（`phonetic`）** 与 **该书作用域的搭配（`collocations`，有界文本）**；
  `BookEntryExample` 承载例句（可绑定义项）。**共享 `Word` 数据只是策划素材与通用查询数据**，
  **不得**被静默用作正式词书的卡片内容（`record` 名词 `/ˈrekɔːd/` 与动词 `/rɪˈkɔːd/` 必须可分别表示）；
  任何回退必须**显式声明**（manifest `fallbackPolicy`，默认 `none`）且经校验。
- **阶段边界（B-10）**：Books 阶段**只**引入正式词书侧模型；**保留**词包当前依赖的
  `theme` / `source` / `difficulty` 字段与其运行时 / 遗留 review 路径（标注为 transitional / deprecated），
  跨域 `Word` 合并与遗留语义移除留给 **Phase 10（Packs）**。

**理由:**

- 现状把四类信息挤在同一张表（`prisma/schema.prisma` 的 `Word.theme` / `difficulty` / `source`），
  导致"加一本词书"会连带影响复习队列、统计与界面，且无法回答"这个词为什么属于雅思"。
- 分区后每类变更的影响范围变小，且许可审查可以落在**成员资格**与**内容**两个可定位的位置。
- 逐字段来源标记是"AI 生成内容可识别、可替换"这一要求的**最小**实现；
  它避免引入 JSON dumping ground，也避免过早引入语义规范化。

**后续影响:**

- Phase 8 / 9 的实现范围以各自被批准的任务书为准；schema 变更仍受 `ARCHITECTURE_RULES.md` EXT-003
  与 `CLAUDE.md` 的授权规则约束。
- 本文只记录**设计决策**。**Phase 7 不实现**任何模型、表或字段。
- 若后续证据表明 Books 与 Packs 应当收敛，需新 ADR 记录证据，不能静默合并（与 ADR-016 一致）。

---

## ADR-020: 学习者词汇状态归属与重叠词语义（全局掌握度 + 成员资格）

**日期:** 2026-09-21
**状态:** **Accepted**（**2026-09-23 经外部评审 v5 Approved，Blocking Issues: None**；
由行政收尾命令转为 `Accepted`。**现行决定 = 本 ADR 顶部的"当前决定（v4/v5）"**，
下方 v1–v3 的历史决定与理由仅作追溯，不得作为现行依据）
**来源:** `docs/refactor/VOCABULARY_PLATFORM_DESIGN.md` §5–§6、`docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md` §3–§4

---

### 当前决定（**v4 起生效；v5 修正，B-09 —— 本 ADR 的唯一现行版本**）

> **标题中的"全局掌握度 + 成员资格"是 v1–v3 的历史结论，已被本节取代。**
> 标题为保留历史引用而**不改写**。本节以下的 `决定 / v2 修正 / v3 修正 / 理由 / 后续影响`
> 均标注为**历史记录（已被取代）**，只作追溯之用，**不得**作为现行决定或理由引用。

1. **SRS 状态属于 `User + BookEntry`**：`LearnerEntryReview(userId, bookEntryId)`，
   `@@unique([userId, bookEntryId])`。**不是** `(userId, wordId)`。
2. **同一拼写出现在不同书 = 不同条目 = 各自独立状态**：**不**传播、**不**合并、**不**做迁移评分。
3. **换书**：新书条目从"未学习"开始；旧书状态保留；用户可**自行**在新书按"已掌握"
   （现有产品已提供知识等级 / 掌握标记能力）。
4. **明确拒绝**（不得在实现中悄悄加入）：全局跨书 SRS 同步、自动掌握度传播、跨书复习状态合并、
   transfer scoring、合成的"全局熟悉度调度器"。
5. **状态连续性依赖稳定 `entryKey`（v5，B-06）**：`bookEntryId` 只在 `entryKey` 不变时代表
   同一个学习单位；导入按 `entryKey` 协调（原地更新 / 新增 / 旧条目转 `inactive`），
   **`position` 不是身份**。
6. **"禁止拼接复习状态"的硬性不变式继续有效**（来源：v2 修正），但适用范围收窄为
   **多条旧 `WordReview` 行被映射到同一个新条目**的情形（现网 IELTS 池为 1:1，**预期冲突数 0**）。
7. 学习者归属身份**只能**来自 `ExecutionContext.userId`（Phase 6 B-01 不变式）；payload 不携带 `userId`。
8. **SM-2 算法与返回值语义不变**（Phase 2 的 32 个表征测试为受保护基线，不得放宽）。

**当前理由（v4 / v5）:**

- **"先选一本词书，然后学习与 SRS 作用在这本书的条目上"是产品决定**：学习单位是 `BookEntry`，
  不是跨书共享的"词"。因此状态键必须是 `(userId, bookEntryId)`。
- **每本书拥有自己的 `BookEntry` SRS**：同一拼写在不同书里可能是不同的策划目标
  （不同义项、不同等级、不同例句 / 音标 / 搭配），它们**本来就不是同一个学习单位**。
- **不存在隐藏的跨书同步**：跨书传播 / 合并 / 迁移评分意味着额外的语义与迁移风险，
  而产品没有要求它；**简单与可预测**优先于"转移逻辑"。
- **跨书重复出现是可以接受的**：同一个词在两本书里都要学，是可接受的产品行为；
  学习者可以使用**现有的知识等级 / "已掌握"按钮**自行处理。
- **数据现实支持这一简化**：现网 2,849 行对应 2,704 个词形（119 个词跨 IELTS 池与主题包、
  26 个词跨多个主题）；这些重复**不需要**算法去同步，只需要清晰的"书内条目"语义。

---

### 历史决定与理由（v1–v3，**已被上面的当前决定取代；保留作追溯**）

> 以下内容**不是**现行决定，也**不是**现行理由。它们包含与当前 v4 决定**相反**的论断
> （例如"换书后重新学习是产品缺陷"、"按书隔离状态劣于全局状态"），
> 保留仅为审计 v1 → v4 的决策演变。

**历史决定（v1）:**

1. **掌握度属于"学习者 × 词条"**：学习状态按 `(userId, wordId)` **全局唯一**
   （由当前 `WordReview` 的 `@@unique([wordId])` 演进而来）。
2. **书与包只记录成员资格与顺序**，不拥有第二份掌握度。
3. **书内进度是派生的**（由成员集合 + 学习状态计算），不存冗余计数；
   只有在实测证明派生成本不可接受时才引入缓存列。
4. **换书不重置**任何学习状态；**词书版本更新不销毁**学习状态（状态键与版本无关）。
5. 学习者归属身份**只能**来自 `ExecutionContext.userId`（沿用 Phase 6 的 B-01 不变式）；
   payload 不携带 `userId`。
6. **SM-2 算法与返回值语义不变**（Phase 2 的 32 个表征测试为受保护基线，不得放宽）。

**v2 修正（2026-09-21，外部复核 v1 = Changes Requested 的 B-04）:**

- **禁止拼接复习状态（硬性不变式）**：`interval` / `easiness` / `repetitions` / `lastReviewedAt` /
  `nextReviewAt` 是同一条调度状态的侧面；**绝不**允许从多条复习记录中各取字段组合成"混合状态"，
  除非存在不变量 / 证明表明该组合有效。没有逐次复习事件历史时，合并后的 SM-2 状态无法被可靠重建。
- **重复词条的状态冲突处理**：区分三种情况 ——
  C-0（重复行均无状态）无需迁移；C-1（**恰有一条**有状态）**整条复制**该完整状态；
  C-2（**两条及以上**有状态）**不自动合并**，标记为迁移冲突，按确定性规则**整条采用**其中一条，
  或在严重不一致时把该词显式**重置为全新学习状态**（`interval=0` / `easiness=2.5` / `repetitions=0` /
  `isMastered=false` / `nextReviewAt=今天`）——后者是**合法的新状态**而非历史拼接。
- **可审计性**：破坏性归并前，所有原始行必须完整存在于备份 / 导出 / 审计证据中；
  冲突组数量必须在迁移前测量并报告，超出阈值（建议默认 0）即暂停并请求决议。

**v3 修正（2026-09-21，外部复核 v2 = B-05 的连带确认）:**

- **状态粒度保持"一个词一条"**（`LearnerWordReview(userId, wordId)`），
  即使模型引入了 `WordUsage`。该规则**必须显式写明其后果**：
  名词条目上的掌握会让同词的动词条目**同样显示为已掌握**；
  书内进度按条目计数但掌握判定按词，因此可能**高估**按用法的真实掌握度；
  队列按词调度（同一次调度可能呈现不同用法的卡片）；跨书重叠条目共享同一状态；UI 必须显示当前条目所属用法。
- **用法级状态（`(userId, wordUsageId)`）继续 defer**，并在文档中给出**触发条件**
  （可测量证据显示同词不同词性掌握度显著不同，且产品要求展示用法级掌握度）。
  升级成本低：只需更换状态外键，无需重做身份模型。

**历史理由（v1 —— 与当前决定相反，仅作追溯）:**

- 已核实的当前数据现实：2,849 行中仅 2,704 个不同词形，**119 个词同时属于雅思池与主题包**，
  **26 个词出现在多个主题**中；当前实现把它们写成不同的 `Word` 行，
  因而**掌握度会被切碎**（同一词要学多遍）。
- "掌握度是关于词的记忆状态，不是关于书的"——换书后重新学习是产品缺陷而非特性。
- 备选方案（按书复制词条 / 按书隔离状态 / 立即使义项级状态）在数据重复、调度数量与认知成本上
  均劣于本决定；义项级在当前**没有真实需求**。

**历史后续影响（v1 —— 已被当前决定取代）:**

- 迁移阶段需要唯一约束重建与既有全局状态回填（回填到 Phase 6 的过渡默认用户），
  并需要真实数据库验证（`EVALUATION_BASELINE.md` 迁移验证门）。
- 迁移期间存在**不可逆**步骤（约束重建 / 重复词条归并），必须配套备份、回滚剧本与审计记录。
- 本 ADR 不实现任何内容；Phase 7 不修改 schema。

---

## ADR-021: Vocabulary 数据来源、许可证据与可复现导入

**日期:** 2026-09-21
**状态:** **Accepted**（**2026-09-23 经外部评审 v5 Approved，Blocking Issues: None**；
由行政收尾命令转为 `Accepted`，口径以 v5 的两轴规则为准）
**来源:** `docs/refactor/VOCABULARY_DATA_PROVENANCE.md`

**决定:**

1. **词书成员资格必须有来源证据**：来自具备**可读许可 / 条款证据**的数据集，
   或显式标注为 `legacy / unresolved pending evidence`（现状即属后者）。
2. **每次导入必须有 manifest**（受版本控制的清单），至少记录：上游身份与 URL、上游版本 / 发布日期、
   **许可名称与证据 URL**、是否允许再分发与是否需要署名、上游校验和（SHA-256）、
   importer / 转换版本、规范化与去重规则、校验规则、期望条目数。
3. **导入必须可拒绝**：manifest 缺少许可字段 → **拒绝导入**（负向校验）。
4. **导入必须幂等**：以"书 + 版本"为粒度整体替换成员集合，同一 manifest 重复导入结果一致。
5. **内容字段必须带来源标记**；**AI 生成内容不得作为成员资格权威**
   （模型无法证明"这个词属于 CET-6"）。
6. **"公开 GitHub 仓库"不构成许可证据**；不得据此导入数据。
   ECDICT 的 MIT 许可证覆盖仓库 / 软件，**不**自动证明其汇集自第三方的词条文本可再分发。
7. 导入结果（版本、校验和、importer 版本、导入数、拒绝数、时间、结果）必须留下可审计记录。

**v2 修正（2026-09-21，外部复核 v1 = Changes Requested 的数据集证据 / 措辞要求）:**

- **已核实的许可证据（第一方原文，2026-09-21）**：NGSL 1.2 与 BSL 1.2 均为
  **Creative Commons Attribution-ShareAlike 4.0 International**；
  CEFR-J Wordlist 页面明确"可用于研究与商业用途，条件是正确标注来源"并给出引用格式。
  上述均属**署名 / 相同方式共享（ShareAlike）**类许可，会约束派生数据的许可选择 → 属产品 / 法务决策。
- **措辞纪律**：描述第三方数据时使用"**在现有证据下不具备项目导入资格**"、
  "**未找到经核实的再分发许可**"、"**需要进一步的许可证据**"；
  **不得**把"未观察到许可"写成"法律上禁止再分发"这类绝对结论，除非权威条款原文明确如此。
  来源明确允许或禁止某项用途时，**逐字引用其条款并列出条件**。
- **AI 派生内容的 provenance 最低要求**：必须能区分 `generated` 与 `licensed` / `curated`，
  并记录生成方（provider / model）、生成管线或 importer 版本、生成时间；
  **不**保存 prompt 正文、用户私有数据或完整模型响应。

**v3 修正（2026-09-21，外部复核 v2 = B-05 的导入一致性要求）:**

- **导入必须保留来源条目**：身份分三层（`Word` = `wordKey`；`WordUsage` = `(wordId, posKey)`；
  `BookEntry` = `sourceEntryId` 或书内 `position`），**去重只在该层的真正重复上进行**。
  明确**移除**对书内条目使用 `by-wordKey-keep-first` 与 `no-duplicate-wordKey` 的规则；
  同一 `wordKey` 的不同词性（`record` n / v）、不同 `sourceEntryId`、不同等级 **一律保留**。
- **真重复 vs 非重复的判定**写入文档（含来源用 `"n./v."` 未区分词性时记 `posKey='multi'` 并保留原文、
  不得自行拆分）。
- **CEFR-J 证据已逐字取证**（第一方日文原文）：允许研究 / 教育 / 商用（须正确引用），
  **允许改変为另一份词表但必须正确引用**，涉及其监修参与的商业使用需另行协商并可收费；
  同时官方明确"同一单词的不同词性为不同条目并赋予不同 CEFR 等级"（B-02 / B-05 的依据）。

**v4 修正（2026-09-23，产品澄清）:**

- **四类来源分离**（取代 v2/v3 的三类）：① **Book membership source**（为什么这个词 / 条目属于这本书）；
  ② **Lexical source**（词形 / 音标 / 词性 / 释义 / 等级等词汇证据）；
  ③ **AI enrichment**（AI 生成或改写的学习者可见内容）；④ **Final curated BookEntry**（实际展示版本）。
  四者都必须可追溯，并且在导入报告里能分别回答"它从哪来"。
- **来源审批三态**（**文档语言，不是领域实体**）：
（**v4 时期的单轴三态；已在 v5 拆分为两个正交问题，见下方 v5 修正块**）
`APPROVED FOR IMPORT` / `RESEARCH / REFERENCE ONLY` / `REJECTED / INSUFFICIENT EVIDENCE`。
  必须**分别**判断 **member-list suitability** 与 **lexical-enrichment suitability**，
  并区分 **English lexical evidence** 与 **Chinese learner-facing content**。
- **AI 富化被明确允许**（产品口径：这是我们自己的结构化数字词书）：AI 可参与释义简化 / 改写、
  中文解释与翻译辅助、补充例句、搭配、用法辨析、练习、记忆提示；但必须经过**校验门**，
  并记录 `sourceType`（`ai-assisted` / `ai-generated`）、provider、model、`generatorVersion`、
  `generatedAt`、`validationStatus`。**不得**伪造来源归属；
  **不得**把 AI 作为第三方考试词表成员资格的唯一依据（除非该词书本身是我们自研 / 策划并如实标注）；
  provenance 只需**内容项级**（一条 meaning / 一条 example）可区分，**不要求**逐字段历史链。
- **v4 新取证（第一方）**：**Open English WordNet** = **CC BY 4.0**
  （`LICENSE.md` 要求同时署名 Princeton WordNet 与 OEWN 团队）；
  **FreeDict** 项目级声明为 "truly free（可学习 / 修改 / 分发，须传递同等自由）"，**逐词典许可待核实**。
- **导入保留来源条目（v3 决定继续有效，口径随 v4 更新）**：
  身份分两层（`Word` = `wordKey`；来源条目 = `sourceEntryId` 或来源顺序）+ **策划条目**；
  上游 N 条来源行可映射为 1 条 `BookEntry`（N:1 合法），但每条来源行都必须在
  `BookEntryMeaning` 上有来源引用。**禁止** `by-wordKey-keep-first` / `no-duplicate-wordKey`
  作用于来源条目或书内条目。

**v5 修正（2026-09-23，外部复核 v4 = Changes Requested 的 B-08 / B-06）:**

- **把"许可适用性"与"项目导入批准"拆成两个独立问题（B-08）**：
  **① source eligibility**（现有第一方证据是否**看起来允许**设想的用途，附条件）
  ∈ `ELIGIBLE` / `CONDITIONAL-INCOMPLETE` / `INSUFFICIENT EVIDENCE`；
  **② project import approval**（本项目是否已**理解、接受并落实**那些义务）
  ∈ `APPROVED FOR PRODUCTION IMPORT` / `PENDING PROJECT DECISION` / `NOT APPROVED`。
  **只要署名 / ShareAlike / 再分发处理仍未落实，来源就只能标 `PENDING PROJECT DECISION`**，
  **不得**标成"已批准导入"。这是文档状态，**不是**新的领域模型或法律架构。
- **当前事实（诚实记录）**：目前**没有任何来源**达到 `APPROVED FOR PRODUCTION IMPORT`；
  NGSL 1.2 / BSL 1.2（CC BY-SA 4.0）、CEFR-J（需引用）、Tatoeba（CC BY 2.0 FR）、
  Wiktextract（CC BY-SA + GFDL）、OEWN（CC BY 4.0，需双署名）均为
  `ELIGIBLE + PENDING PROJECT DECISION`（义务未落实）。
- **署名信息必须可保留（B-08）**：来源派生内容在导入时必须写入
  `sourceName` / `sourceRef` / `licenseName` / **`attributionText`**，
  使产品能够履行署名 / 引用义务；缺这些信息的来源派生内容应被拒绝或标记。
- **措辞纪律继续有效**：保留已核实的第一方许可事实，使用"在现有证据下不具备项目导入资格"
  "未找到经核实的再分发许可""需要进一步的许可证据"，**不**做无依据的法律结论。
- **与 B-06 的衔接**：导入协调按稳定 `entryKey` 进行（`UNIQUE(bookId, entryKey)`），
  重新导入不得删除重建条目；`position` 不是身份。

**理由:**

- 现状的成员资格判定（内联词表 + ECDICT `tag` 含 `ielts`）无法回答"为什么这个词属于雅思"，
  也无法证明合规（见来源文档 §5–§7）。
- 已核查的反面证据：`mahavivo/english-wordlists` 自述来源包含商业词典与考试大纲，
  `kajweb/dict` 自述为爬取商业 App 内容 —— 两者都公开在 GitHub 上，但**都没有**再分发许可。
- 商业产品（百词斩）自述其释义**取自柯林斯、朗文等授权词典**，说明这类内容的正确路径是授权而非抓取。

**后续影响:**

- 任何 Vocabulary 数据导入 PR 必须引用 ADR-016 第 4 条**与**本 ADR，并附来源 / 许可记录，否则视为超出范围。
- 许可证据不足的数据只能以 `legacy / unresolved` 标注存在，不得被当作新架构的权威来源。
- 本 ADR 不导入任何数据；Phase 7 不新增 schema 表。

---

## ADR-022: Phase 8 拆分建议 —— 迁移链修复与 Vocabulary Books 实现分离

**日期:** 2026-09-21
**状态:** **Accepted 且已激活**（**2026-09-23 经外部评审 v5 Approved，Blocking Issues: None**；
由行政收尾命令转为 `Accepted`，并**在 canonical 路线图中激活**：Phase 8 = Migration Chain Repair &
Reproducible Baseline（Ready / Not Started）、Phase 9 = Vocabulary Books Implementation、
Phase 10 = Themed Packs Convergence，原 Phase 10–15 顺延为 Phase 11–16。
路线图文件已在本次收尾中同步；**Phase 8 的实现未启动**）
**来源:** `docs/refactor/VOCABULARY_MIGRATION_STRATEGY.md` §6–§7

**决定（建议）:**

1. 把原 **Phase 8** 拆分为两个独立可审核阶段：
   - **A. Migration Chain Repair & Reproducible Baseline**：处置损坏的 baseline 迁移
     （倾向方案：显式 squash 并归档损坏文件字节与 SHA-256），在空库与生产形状克隆库上完成验证；
     **不含**产品功能；
   - **B. Vocabulary Books Implementation**：词条身份归并、`VocabularyBook` / `Entry`、
     学习者归属状态、导入管线 + manifest、选书体验；**在本阶段内**完成迁移正确性验收。
2. Themed Packs 收敛顺延为后续独立阶段；**Phase 编号不受保护**
   （`MASTER_PLAN.md`：有界范围与可审核性优先于编号连续性）。
3. 若治理流程选择**不拆分**，必须满足：两类高风险变更各自产出可独立审核的证据、
   各自有回滚剧本，且外部评审在结论中显式接受该取舍。

**v2 修正（2026-09-21，外部复核 v1 = Changes Requested 的 B-01）:**

- 阶段 A 的处置必须按 Prisma ORM v7 官方语义在**两条互斥路线**之间明确选择：
  **路线 A** = 只重建损坏的 baseline 到"当时的历史 schema 点"（保留后续三个迁移；
  baseline 内容属**推断重建**，必须如此标注）；
  **路线 B**（推荐）= 有意 **squash 整条历史**为**一份** baseline
  （`migrate diff --from-empty --to-schema ./prisma/schema.prisma` → 排序最靠前的单目录 →
  `migrate resolve --applied`）。
- 若采用路线 B，**被 squash 的历史目录必须归档并移出活动迁移链**；
  新环境只执行这一份 baseline，其后只追加未来迁移；已有生产形状数据库通过
  `migrate resolve --applied` 对齐（不重放），生产库 `_prisma_migrations` 中既有的已应用历史仍然保留。
- **不得**出现"新 baseline 已含当前结构、后续历史迁移又重复创建同一结构"的非法链；
  官方同时提示 squash 不会保留手工改写的 SQL，因此修复前必须逐文件核对。
- 详细设计见 `VOCABULARY_MIGRATION_STRATEGY.md` §6.2（含官方文档引用与归档 / 验收要求）。

**v4 确认（2026-09-23，产品澄清后）:**

- 本建议**保持不变**：迁移链修复与 Vocabulary Books 实现是**可独立审核的高风险变更**，
  应在 Books 实现**之前**拆分（建议编号：Phase 8 = 迁移链修复 / 可复现 baseline，
  Phase 9 = Vocabulary Books，Phase 10 = Themed Packs），后续阶段顺延。
- **v4 的产品澄清没有削弱拆分理由**：`BookEntry` 成为学习单位与 SRS 归属、
  `WordUsage` 被移除之后，Books 阶段的范围仍然很大（条目模型、义项、导入管线、manifest、
  curation 规则、选书体验、状态迁移），而迁移链修复仍然是它**可独立验证的前置条件**。
- **本 ADR 仍未生效**：它需要 v4 外部评审 + 用户批准；Phase 7 **不**修改任何路线图文件。

**v5 补充（2026-09-23，外部复核 v4 = B-10）:**

- **拆分的另一个理由：Books 阶段不得提前实现 Packs。** Books 阶段**只**引入正式词书侧模型
  （`VocabularyBook` / `BookEntry`（稳定 `entryKey`）/ `BookEntryMeaning` / `BookEntryExample` /
  `LearnerEntryReview`），并**保留**词包当前依赖的 `Word.theme` / `source` / `difficulty`
  与其运行时 / 遗留 review 路径（标注为 transitional / deprecated）。
- **词包收敛的全部工作在 Phase 10 完成**：主题 / 生成成员迁移、词包学习状态语义、
  剩余的跨域 `Word` 身份合并，以及**在词包不再依赖之后**才移除遗留语义。
- **因此 Books 阶段的验收不得要求跨域全局去重**（例如"2,849 → 2,704"），
  该目标改为**分阶段达成**（见 `VOCABULARY_MIGRATION_STRATEGY.md` §5.1 与 §8.2 的 V-15 修正）。

**理由:**

- 两类变更的**失败模式**不同：迁移链修复的失败是"无法部署 / 数据库损坏"，影响面最大；
  Books 实现的失败是被测功能与语义问题，可迭代修正。
- 需要的**证据类型**不同：前者需要真实数据库上的迁移执行与 schema 比对；后者需要领域与管线测试。
- A 是 B 的**前置条件**而不是其组成部分（不修复迁移链就无法安全演进 schema）。
- `MASTER_PLAN.md` 的 R-01 决策门明确要求：若二者是可独立审核的高风险变更，须在实现前拆分。

**后续影响:**

- 若本建议被批准，`MASTER_PLAN.md` / `MIGRATION_PLAN.md` / `PHASE_STATUS.md` 的阶段编号与文本
  需由**相应的行政收尾命令**更新（不由 Phase 7 执行）。
- 迁移正确性验收门随阶段归属移动，但**不得**推迟到 Phase 15（`EVALUATION_BASELINE.md`）。
- 本 ADR 不执行任何拆分，也不修改任何阶段状态。

---

## 路线图编号变更记录（2026-09-23 行政收尾 — 已生效）

**性质:** 文档 / 治理层面的**行政收尾**（不是新的产品决策，也不是 Phase 8 实现）。
它**执行**了 Phase 7 已作出的出口决策（ADR-022），并同步了所有受影响的 canonical 路线图文档。

**变更内容:**

1. **Phase 7 关闭**：`Vocabulary Platform Design & Data Provenance` → **Completed / Approved**
   （2026-09-23，外部评审 v5 Approved，Blocking Issues: None）。
2. **原 Phase 8 拆分并顺延**：
   - **Phase 8** = `Migration Chain Repair & Reproducible Baseline`（**Ready / Not Started**）
   - **Phase 9** = `Vocabulary Books Implementation`（Not Started）
   - **Phase 10** = `Themed Packs Convergence`（Not Started）
3. **原 Phase 10–15 顺延 +1**（意图、出口条件、安全要求、评估义务**全部保留**）：
   Reliability/Ownership/Evaluation → **11**；AI Coach Foundation → **12**；
   Retrieval & Knowledge Engineering → **13**；Agentic AI Coach & Tool System → **14**；
   MCP Interoperability/AgentOps/Safety → **15**；Production/Benchmark/Portfolio → **16**。
4. **ADR-019…ADR-022 转为 `Accepted`**（含义以 v5 设计为准）。

**历史处理规则（重要）:**

- Phase 0–7 的已批准含义、编号与历史记录**不改写**；历史审核 / 交接文件保持原样。
- **历史文档中的旧编号可以保留**，但必须能被识别为历史叙述。具体地：
  ADR-015 / ADR-016 / ADR-017 / ADR-018 正文中出现的旧编号（例如 "Phase 10 承担评估基础设施"、
  "Phase 12 检索"）属于**该 ADR 当时**的路线图表述，保留为历史；
  **当前 / 未来的规范性引用一律使用新编号（Phase 8–16）**，见 `MASTER_PLAN.md`、
  `PHASE_STATUS.md` 与 `MIGRATION_PLAN.md` 的现行章节。
- 本次变更**不启动任何阶段**：Phase 8 保持 Ready / Not Started，
  其执行命令由下一位协调者依据仓库现状重建（`PHASE_EXECUTION_PROTOCOL.md` §4）。
