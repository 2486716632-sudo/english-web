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
