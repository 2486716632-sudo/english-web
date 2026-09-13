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
**状态:** Accepted（Phase 3 实现，等待外部审核确认）

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
