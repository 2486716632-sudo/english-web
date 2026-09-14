# User State & Memory 设计 — Phase 6

**日期:** 2026-09-13（2026-09-14 同步 v1 + v2 外部复核修正）
**状态:** ✅ **Approved**（2026-09-14 外部最终复审 v3 通过；B-01–B-05 全部 resolved and accepted；
Phase 6 = Completed / Approved）
**范围:** 持久化 User State + Memory 基础设施（`User` / `UserProfile` / `UserMemory`），
以 Phase 3 已批准的 `POST /api/assistant` 作为**唯一**参考集成
**复用:** Phase 3 `AIClientPort`、Phase 4 分层与 Port/Adapter 模式、Phase 5 `TracePort` / `ExecutionContext` / `runInTrace` / `runInSpan`
**任务定义:** `docs/refactor/tasks/phase-6-task.md`

---

## 0. v1 外部复核修正（2026-09-14）

v1 送审后的外部复核结论是 **Changes Requested / Phase 7 Not Approved**。四项 blocking issue
以及两项 non-blocking note 的修正已落入实现与本文档：

| # | v1 问题 | 修正后的语义 |
|---|---------|-------------|
| B-01 | 用例可同时接受 `ExecutionContext.userId` 与 payload `userId`，存在跨用户指向空间 | 受用户归属约束的 Application 操作，权威归属**只**来自 `ExecutionContext.userId`；payload 不携带 `userId`；缺失/非法 → 显式 `invalid_input`（不回落默认用户） |
| B-02 | canonical `UserProfile` 与 Memory 可拥有同一语义事实（如 `explanation_language`） | canonical profile 语义键保留给 User State；Memory 写入命中保留键 → `invalid_input`，不落库 |
| B-03 | 非法 `memoryKinds` 归一化为 `undefined`，与"有意省略"不可区分 → 退化为 select-all | 省略 = 有意不过滤；非数组 / 空数组 / 全部非法 → `invalid_input`；混合非法项 → 使用合法子集。**非法收窄请求永不扩大读取范围** |
| B-04 | "learner context 不可信"的**策略**与数据同处 user 消息权威 | 静态处理策略只在 learner context 存在时进入 **system 权威**；真实 profile/memory 内容仍只在独立 user 数据消息内，且有界 |
| B-05（v2） | `MemoryRepositoryPort` 允许 `kinds: []`，但 fake 返回零条、Prisma 退化为无过滤 | Port 级语义显式统一：省略 = 不限制；非空 = 限制；**`[]` = 返回零条**（Prisma 提前短路，不查询数据库） |

验证记录与完整评审历史见 `docs/refactor/reviews/phase-6-review.md`。

---

## 1. 目标

给应用一个**可靠、可测试**的持久用户状态与记忆基础：

1. 明确"当前逻辑用户是谁"（identity）
2. 存储用户专属的持久状态（canonical user state）
3. 之后能读回该状态
4. 明确区分 canonical state 与 historical memory
5. 有意识地更新记忆（不是自动吞噬对话）
6. 把**有界**的记忆/上下文提供给 Application 用例
7. 保持 Application / Domain / Infrastructure 边界
8. 让 Phase 7 的 Agent 工作站在这个地基上

## 2. 非目标（本阶段明确不做）

| 不做 | 原因 |
|------|------|
| 自主 Agent | Phase 7 |
| 由 LLM 决定"该记住什么" | 记忆写入必须确定性可审核（Phase 7+） |
| RAG / 向量库 / embedding / 语义检索 | 选择策略先做成确定性的有界选择 |
| 完整认证（Auth.js / Clerk / OAuth / 账号管理） | 仓库当前没有认证；本阶段只做最小身份抽象 |
| 迁移全部历史表到用户归属 | 破坏面大，需要独立 Phase + 数据回填审批 |
| 记忆合并/压缩引擎 | 先保证"不产生重复、可覆盖、有界" |
| 记忆内容的完整留存（原始聊天记录） | 隐私与数据最小化 |

---

## 3. 四个概念的显式区分

| 概念 | 回答的问题 | 生命周期 | 本阶段的载体 |
|------|-----------|---------|-------------|
| **User State**（canonical current state） | "这个用户**当前**为真的是什么？" | 持久、可覆盖 | `User` + `UserProfile` |
| **Memory**（durable historical context） | "过去哪些有用信息应用应当能回忆？" | 持久、显式写入 | `UserMemory` |
| **Chat / Event History** | 原始交互历史 | 本阶段不持久化（服务端至今无会话表） | **不落库**；**永不自动**变成 Memory |
| **Working / Request Context** | 一次执行内需要的数据 | 单次执行 | `ExecutionContext`（含 `trace` / `userId`），**不持久化** |

一条容易踩错的边界：**"用户在对话里说了什么" ≠ Memory**。
Phase 6 没有任何"消息 → 记忆"的通路；写入必须经过 `RememberUserFactUseCase`，
并且来源只能是 `explicit_user`（用户显式表达）或 `deterministic`（确定性派生）。

---

## 4. 身份策略

### 4.1 现状

仓库历史上**没有认证系统，也没有任何用户/会话标识**：
没有 cookie 读取、没有 session、没有 `userId`、Route 默认"访问者就是唯一用户"。

### 4.2 Phase 6 的策略

```
Delivery（Layer 1）
  POST /api/assistant
    → resolveCurrentUserId(request)        // src/bootstrap/identity.ts（Composition 边界）
    → ExecutionContext { trace, userId }   // 显式传播，无全局状态
Application（Layer 2）
  ReplyToAssistantQueryUseCase
    → ExecutionContext { trace, userId } 传入 user-scoped 用例
    → GetUserContextUseCase.execute({ memoryLimit, memoryKinds })
       归属 = ExecutionContext.userId（权威；B-01）
Domain（Layer 3）
  仅纯规则：userId 归一化、profile 校验、memory 归一化 —— 不读 cookie / header / session
Infrastructure（Layer 4）
  PrismaUserRepository / PrismaMemoryRepository —— 每个方法都要求 userId
```

硬性规则：

- Application 代码只使用 `UserId` 抽象（`type UserId = string`）
- Domain 不读 cookie / header / session（`ARCHITECTURE_RULES.md` DOM-002）
- 需要用户归属的 Repository 方法**必须**接受 `userId`
- Application **不得**假设"全局只有一个用户"
- **B-01**：user-scoped 用例的权威归属身份只能来自 `ExecutionContext.userId`；
  操作 payload 不得携带或选择 `userId`

### 4.3 当前单用户过渡策略（**TRANSITIONAL**）

`src/bootstrap/identity.ts`：

```ts
export const DEFAULT_USER_ID: UserId = 'local-default-user'
export function resolveCurrentUserId(request?: IdentityRequestLike): UserId
```

- 产品当前仍是单用户 / 本地形态，因此用一个**确定性常量身份**承载新状态与记忆
- 这是**过渡**实现，**不是**认证：它刻意不解析任何请求头（有测试断言）
- 常量必须通过 Domain 的身份校验（有测试断言）

### 4.4 未来如何被真实认证替换

```
今天：  Route → resolveCurrentUserId(request) → DEFAULT_USER_ID
将来：  Route → resolveCurrentUserId(request) → session / cookie / JWT
              → external identity（provider subject）
              → identity boundary 内可能需要的映射
              → internal UserId（须通过 normalizeUserId 的字符集/长度约束）
              → ExecutionContext.userId
        其余层（Application Use Case / Ports / Adapters / Domain 规则）不需要改合同
```

**不要声称替换认证"只需改 `identity.ts` 一个文件"**（v1 外部复核 non-blocking note B）。
对于当前过渡实现，`src/bootstrap/identity.ts` 确实是解析入口；但一旦接入外部认证，
provider 的 subject identifier（可能含 `@`、大小写、超长、非 `[a-z0-9._-]` 字符）
很可能**不能**直接当作 internal `UserId`（`normalizeUserId` 是有约束的）。
因此真实替换路径是一个**身份边界**：external identity → 映射 → internal `UserId`。
映射可能需要额外的持久表与代码，具体设计属于未来认证阶段，**不属于 Phase 6**。

---

## 5. 数据模型

### 5.1 User（稳定身份）

| 字段 | 说明 |
|------|------|
| `id` (`String @id`) | 即 `UserId`。不透明字符串；Domain 不解释其内容 |
| `createdAt` / `updatedAt` | 审计 |
| `profile` | 1:1 → `UserProfile?` |
| `memories` | 1:N → `UserMemory[]` |

刻意**不**在 `User` 上放任何学习字段：身份与状态分离。

### 5.2 UserProfile（canonical user state）

| 字段 | 类型 | 为什么存在（真实消费者） |
|------|------|------------------------|
| `userId` | `String @unique` | 1:1 归属 |
| `englishLevel` | `String?` | 参考集成把它渲染进 learner context（决定解释深度） |
| `explanationLanguage` | `String?` | 参考集成把它渲染进 learner context |
| `createdAt` / `updatedAt` | `DateTime` | 审计 |

闭集（Domain 校验）：`englishLevel ∈ {beginner, elementary, intermediate, upper_intermediate, advanced}`、
`explanationLanguage ∈ {zh, en, bilingual}`。

刻意**没有**：`preferredTopics` / `nativeLanguage` / `learningGoal` / 任意 JSON 列。
理由：没有当前消费者；其中历史性内容属于 Memory。

### 5.3 UserMemory（durable memory）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | 归属（关系 + `onDelete: Cascade`） |
| `kind` | `String` | 闭集：`preference` / `goal` / `weakness` / `milestone` |
| `key` | `String` | **归一化**的稳定"含义键"（去重身份的一半） |
| `content` | `String` | 有界短文本（≤ 500 字符，Domain 拒绝超长） |
| `source` | `String` | 闭集：`explicit_user` / `deterministic` |
| `createdAt` / `updatedAt` | `DateTime` | `createdAt` 是历史起点，更新不改变它 |

索引与约束（都由真实查询模式决定）：

```prisma
@@unique([userId, kind, key])   // 去重 / upsert 的落点
@@index([userId, kind])         // 有界选取的过滤路径
```

刻意**没有**：`importance` / `confidence` / `status` / `active` / `embedding` / JSON 列。
Phase 6 的选择策略是"kind + 最近更新 + 固定上限"，这些字段没有消费者。

### 5.4 归属模型

- Memory **始终**归用户所有：`UserMemory.userId` 是必填外键，`onDelete: Cascade`
- 所有读取都带 `userId`（Port 契约 + 适配器 `where` + 有测试）
- 跨用户泄漏在四个层次被阻断：Delivery（解析身份）、
  Application（B-01：归属只来自 `ExecutionContext.userId`，payload 无法指定用户）、
  Infrastructure（`where: { userId }`）、数据库（外键 + 唯一约束）

---

## 6. Application 端口

Ports 定义在 Application，Infrastructure 实现，Prisma 只出现在 Infrastructure。

```ts
// src/application/ports/user-repository.ts
interface UserRepositoryPort {
  getProfile(userId: UserId): Promise<UserLearningProfile | null>
  updateProfile(userId: UserId, patch: LearningProfilePatch): Promise<UserLearningProfile>
}

// src/application/ports/memory-repository.ts
interface MemoryRepositoryPort {
  saveMemory(record: NewMemoryRecord): Promise<StoredMemoryRecord>
  listMemory(query: MemoryQuery): Promise<StoredMemoryRecord[]>
}
```

为什么不是通用 CRUD：

- `saveMemory` 表达的是应用语义"**按含义键 create-or-update**"，不是"插入一行"
- `listMemory` 表达的是应用语义"**有界选取**"，不是"列出全部"
- 没有 `deleteById` / `updateAny` / `findAll`：Phase 6 没有它们的应用需求

---

## 7. Repository adapters（Infrastructure）

| 适配器 | 职责 | 刻意不做的 |
|--------|------|-----------|
| `PrismaUserRepository` | `getProfile` 只读；`updateProfile` 幂等供给 `User` + upsert `UserProfile` | 不做 profile 语义校验（Domain 做） |
| `PrismaMemoryRepository` | `saveMemory` upsert by `(userId, kind, key)`；`listMemory` userId 过滤 + 可选 kind + `updatedAt desc, id asc` + `take` | 不做记忆语义、不做上限决策（Domain/Application 做） |

两个适配器都导出**纯映射函数**（`mapUserProfileRow` / `mapUserMemoryRow`），可独立测试：

- DB 中命中闭集的值才被采信；无法识别的值收敛为 `null`（profile）
  或整行丢弃（memory 读取）
- 写入路径上出现无法解释的行 = 不变式违反 → 抛错（不静默）

**惰性供给（lazy provisioning）**：写路径先 `user.upsert`（幂等）再写 profile/memory。
因此：

- **不需要**数据回填迁移，**不需要**在生产库预置默认用户
- 只读路径（参考集成）**不写库**

---

## 8. Memory 写入策略

### 8.1 允许的来源（闭集，只有两类）

| source | 含义 | 例子 |
|--------|------|------|
| `explicit_user` | 用户显式表达 | "以后用中英对照解释" / "我的目标是雅思口语 7 分" |
| `deterministic` | 确定性派生 | 里程碑（完成第 N 篇阅读）、已由确定性规则得出的反复弱点 |

### 8.2 禁止的来源（永不写入）

每条消息、每次模型回复、原始 prompt 正文、临时 UI 状态、临时错误、密钥与凭据、
与学习无关的任意隐私内容、任何"由 LLM 自主判断该记住什么"的结果。

### 8.3 唯一写入入口

```
RememberUserFactUseCase
  → 归属 = ExecutionContext.userId（B-01：作为独立参数注入 Domain 校验）
  → Domain validateNewMemoryInput(fields, ownerUserId)（闭集 + 归一化 + 有界 + 保留键拒绝）
  → MemoryRepositoryPort.saveMemory（upsert by (userId, kind, key)）
```

- 没有"每条消息 → 记忆"的路径
- 没有 Route 直接写记忆（Phase 6 也不新增写路由）
- 写入失败**向上报错**（`invalid_input` / `persistence_failed`），不静默丢弃
- 写入 payload 结构里**没有** `userId` 字段；归属身份无法从请求输入选择
- canonical profile 语义键（§11.1）→ `invalid_input`，不落库

---

## 9. Memory 读取 / 选择策略

```
GetUserContextUseCase
  → UserRepositoryPort.getProfile(userId)
  → MemoryRepositoryPort.listMemory({ userId, kinds?, limit })
       where userId [+ kind in kinds] → orderBy updatedAt desc, id asc → take limit
```

确定性选择规则：

1. 归属：`userId` 必填
2. 类别：可选 `kind` 过滤。语义（B-03，`normalizeMemoryKinds`）：
   - 省略 / `null` → 有意不按 kind 过滤
   - 合法数组（可混合非法项）→ 使用合法子集，忽略非法项
   - 空数组 / 全部非法 / 非数组 → `invalid_input`
   - **非法收窄请求永远不会退化为 select-all**
3. 顺序：`updatedAt` 降序；并列时 `id` 升序（避免顺序不稳定）
4. 条数：默认 5（`MEMORY_SELECTION_LIMIT`），硬上限 20（`MEMORY_SELECTION_MAX_LIMIT`），
   调用方的 `limit` 由 `clampMemoryLimit` 收敛
5. **没有**语义/向量检索（RAG 延后）

### 9.1 Port 级空 kinds 语义（B-05，v2 外部复核）

B-03 是 Application 边界的防线；`MemoryRepositoryPort` 还需要第二道防线，因为
`kinds?: readonly MemoryKind[]` 在类型上允许 `[]`，而未来调用方可能误传。Port 契约（所有实现必须一致）：

| `query.kinds` | 语义 |
|---------------|------|
| `undefined` | 有意不做 kind 限制（返回该用户的所有 kind） |
| 非空数组 | 只返回这些 kind |
| `[]` | **返回零条**；显式空收窄绝不变成 select-all |

`PrismaMemoryRepository.listMemory()` 在 `kinds.length === 0` 时**先返回 `[]`**，
既保证语义又避免无谓的 `findMany`；`FakeMemoryRepository` 的 `.includes()` 行为与之天然一致，
并有 parity 测试锁定。

---

## 10. 有界上下文策略（预算）

| 项 | 上限 | 执行点 |
|----|------|--------|
| 记忆条数 | 5（默认）/ 20（硬上限） | Domain `clampMemoryLimit` + 适配器 `take` |
| 单条记忆落库 | 500 字符 | Domain `validateNewMemoryInput`（**拒绝**超长） |
| 单条渲染进 prompt | 200 字符 | `buildAssistantLearnerContext`（截断 + `…`） |
| 整段渲染进 prompt | 1500 字符 | 同上（超出丢弃末尾条目 + `truncated = true`） |
| profile 字段 | 2 个闭集字段 | Domain 闭集校验 |

渲染顺序确定性：profile 行在前，记忆行按"最近更新优先"。

---

## 11. 去重 / 更新策略

去重身份 = `(userId, kind, normalizedKey)`。

`key` 的归一化（Domain 纯函数）：

```
trim → lowercase → 空白 / - / : / . 折叠为 _ → 折叠重复 _ → 去首尾 _
```

因此 `Explanation Language`、`explanation language`、`explanation-language`、
`explanation:language` 是同一条记忆（有测试）。

不同 kind 的差异是**调用方如何选 key**，不是不同的存储机制：

| kind | key 语义 | 结果 |
|------|---------|------|
| `preference` / `goal` / `weakness` | 稳定含义键 | **单槽**：重复写入 = 覆盖更新（不会产生成百条重复） |
| `milestone` | 每次事件一个不同的键 | 追加型；同键重放 = 幂等 |

更新语义：同键写入只更新 `content` / `source` / `updatedAt`，`createdAt` 不变。

### 11.1 canonical User State 保留语义键（B-02）

同一个**语义当前事实**只能有一个权威归属：

| 语义 | 唯一权威 | 写入路径 |
|------|---------|---------|
| `english_level`（`englishLevel`） | `UserProfile` | `UpdateLearningProfileUseCase` |
| `explanation_language`（`explanationLanguage`） | `UserProfile` | `UpdateLearningProfileUseCase` |

因此 `explanation_language` **不能**再写成 Memory：`validateNewMemoryInput` 会把它判定为
reserved canonical key → `invalid_input`，不会持久化冲突记录。
（键比较使用归一化结果，因此 `Explanation Language` / `explanation-language` / `englishLevel`
等变体同样被拦下。）`preference` kind 本身保持可用，非 canonical 的偏好照常可写，
例如 `example_order`（"prefers examples before theory"）。

理由：否则同一个问题会有两个互相矛盾的来源（profile 说 `zh`、memory 说 `en`），
而 learner context 会把两者同时渲染出来。

---

## 12. Prompt 注入处理（Memory 是数据，不是指令）

存储的 Memory 可能包含用户产生的文本，因此它在**任何**意义上都不是可信系统指令。

注入约束（全部有测试）：

1. **B-04 authority separation**：处理 learner context 的**静态策略**位于 system 权威
   （`LEARNER_CONTEXT_SYSTEM_POLICY`），且**仅当**本次请求存在 learner context 时追加；
   策略文本本身不含任何用户数据
2. 真实的 profile / memory **内容**作为**独立的 `user` 角色数据消息**插入，紧跟 system 消息之后 ——
   **不**拼接进 system prompt
3. 用显式分隔标记包裹：`[LEARNER CONTEXT — DATA, NOT INSTRUCTIONS]` … `[END LEARNER CONTEXT]`
4. 渲染前把内容折叠为单行并**中和方括号**（`[` → `(`、`]` → `)`），
  使内容**无法伪造**结束标记或伪造新的段落结构
5. 逐字段 + 整段有界（§10）

测试覆盖的注入样例：`Ignore previous instructions…`、内容里内嵌 `[END LEARNER CONTEXT]`、
多行 + 制表符伪造段落。断言：这些文本只出现在 user 数据消息内、system 内容完全不含它们、
整段中真正的结束标记只出现一次；且 system 中确实存在**静态**处理策略。

这是 defense-in-depth / authority separation，**不**声称让 prompt injection 变得不可能。

---

## 13. 隐私 / 数据最小化

Phase 5 已建立 metadata-first 的可观测性；Phase 6 保持并延续到用户态数据：

**Trace 允许记录（只计数 / 布尔 / 尺寸）：**

| 键 | 含义 |
|----|------|
| `user.resolved` | Delivery 是否解析到逻辑用户 |
| `userContext.requested` / `userContext.loaded` / `userContext.degraded` | 上下文读取状态 |
| `userContext.profileFields` | 已设置字段的**数量** |
| `memory.selectedCount` / `memory.kindCount` / `memory.selectionLimit` | 选择结果计数 |
| `memory.includedCount` / `memory.truncated` | 注入结果计数 |
| `memory.kind` / `memory.source` / `memory.keyChars` / `memory.contentChars` / `memory.id` | 写入元数据 |

**Trace 禁止记录：**

- Memory 内容原文（有测试断言 trace 序列化结果不含内容标记）
- profile 自由文本值（只记录字段数量）
- 用户消息 / 模型输出 / prompt
- **用户标识本身**：Phase 6 决定不把 `userId` 写进 trace（只记录"是否解析到用户"），
  以免未来真实身份（可能是邮箱等 PII）进入日志

---

## 14. Trace 集成

复用 Phase 5 已批准设施，**不修改**其契约（`ExecutionContext` 只做加法：新增可选 `userId`）。

| span | category | 产生位置 |
|------|----------|---------|
| `http.assistant` | `http` | Delivery（既有） |
| `assistant.reply` / `assistant.word_lookup` / `ai.chat` | 既有 | Application（既有） |
| `user.context` | `persistence` | `GetUserContextUseCase`（Phase 6 新增） |
| `user.profile.update` | `persistence` | `UpdateLearningProfileUseCase`（Phase 6 新增） |
| `memory.remember` | `persistence` | `RememberUserFactUseCase`（Phase 6 新增） |

- 读失败降级：span 状态 = `degraded`，并记录事件 `user.context.degraded`（只带来源名，不带底层错误消息）
- 写失败：span 状态 = `error`，错误码 `invalid_input` / `persistence_failed`
- **不**持久化 trace、**不**引入外部可观测性平台（Phase 5 的范围决定）

---

## 15. 参考集成

### 15.1 选择

**`POST /api/assistant`** —— Phase 3 已批准、Phase 5 已 instrument 的唯一低风险纵向链路。

### 15.2 迁移前后

```
迁移前：HTTP → Assistant Use Case → prompt → AIClientPort
迁移后：HTTP → resolveCurrentUserId（Delivery）
             → Assistant Use Case
             → GetUserContextUseCase（有界 profile + memory）
             → buildAssistantLearnerContext（Application 构造数据段）
             → 既有 prompts/assistant/qa.prompt.ts（**未修改**）
             → AIClientPort
```

Infrastructure **不**构造 prompt；prompt 的构造留在 Application。

### 15.3 行为保真（关键）

| 场景 | 行为 |
|------|------|
| 未装配 `getUserContext`（Phase 3 迁移前的构造方式） | 消息数组与迁移前**逐字节一致**（既有 Phase 3 测试不改也仍然通过） |
| 装配了但没有 `ExecutionContext.userId` | 不做个性化，等价于迁移前 |
| 有 userId 但该用户没有 profile / memory | 不注入任何数据段，等价于迁移前 |
| 有 profile / memory | system 追加**静态处理策略**（B-04）；内容作为**一个**独立 user 数据消息追加；既有 turns 不变 |
| profile 或 memory 读取失败 | **优雅降级**：记 `degraded`，以空上下文继续调用 AI，请求不失败 |
| 显式写入失败 | **失败**（不降级）：用户要求记住却静默丢弃是数据完整性问题 |

为什么读降级、写不降级：个性化是附加价值；显式写入是承诺。

---

## 16. 迁移策略（Prisma / 数据库）

- 变更**纯增量**：只新增 `User` / `UserProfile` / `UserMemory` 三张表 + 3 个索引 + 2 个外键
- 迁移文件：`prisma/migrations/20260913000001_add_user_state_and_memory/migration.sql`
  （由 `prisma migrate diff` 生成后人工检查：只有建表、建索引、加外键，**无**删除语句、
  **无**对既有表的 `ALTER`、**无**数据变更）
- 既有 7 张业务表的语义**未改变**，不迁移任何既有数据归属
- **不**对生产数据库执行迁移（需要用户明确批准）
- 自动化测试**不**依赖真实数据库（适配器测试使用记录调用的 stub client）
- 生成客户端已随 `prisma generate` 更新（`src/generated/prisma` 在 `.gitignore` 中，不入库）

授权说明：`ARCHITECTURE_RULES.md` EXT-003 / `CLAUDE.md` 规定 `schema.prisma` 冻结、修改需用户明确授权；
本次 Phase 6 任务书明确授权"为 User identity / User-Profile state / Memory records 做最小 schema 变更"，
该授权记录见 `DECISIONS.md` ADR-014。

### 16.1 迁移链部署门禁（v1 外部复核 non-blocking note A）

- Phase 6 新增的迁移**在单独看时**是合法、非破坏性的增量 SQL
- 但 `prisma/migrations/20260609000001_baseline/migration.sql` 在 Phase 6 之前的历史提交中
  就已经是一份 UTF-16 编码的 PowerShell 错误转储（不是真实 SQL，已用字节编码复核确认）
- 因此**生产迁移部署是 BLOCKED 的**：在历史迁移链被独立验证/修复之前，
  不能声称完整迁移链是 deployment-ready
- 该修复**不属于** Phase 6（属无关修复），需要单独授权
- Phase 6 未对任何生产数据库执行迁移

---

## 17. 延后的用户化债务

以下数据**应当**最终用户化，但**明确不在** Phase 6 范围内（不迁移、不改语义）：

| # | 数据 | 现状 | 延后原因 |
|---|------|------|---------|
| D-01 | `WordReview` + `@@unique([wordId])` | 全局单份 SRS 状态 | 需要 `[userId, wordId]` 唯一约束重建 + 存量回填 |
| D-02 | `Article.readAt` / `favoritedAt` | 全局列 | 需要用户-文章状态表 + 历史归属策略 |
| D-03 | `ListeningScene.playedAt` | 全局列 | 同上 |
| D-04 | `DailyProgress` | 全局按日期计数 | 需要用户维度 + 回填 |
| D-05 | localStorage 偏好（`dailyTarget` / `coach_*` / `wordpack_*` / 助手位置…） | 浏览器本地 | 需要 UI + 迁移策略 |
| D-06 | `src/lib/prisma.ts` 单例搬迁 | Phase 3 遗留 D6 | 与本阶段目标无关 |

Phase 6 的新状态/记忆只附着在过渡默认用户上；将来做真实认证时，
这些新表**不需要**改结构（`userId` 已经是外键）。

---

## 18. 测试策略

全部离线：**不**调用真实 DeepSeek、**不**调用真实 RSS、**不**连真实数据库。

Phase 6 新增 **12 个测试文件 / 102 个测试**（v1 为 11 个文件 / 77 个测试；
v1 复核修正新增 1 个组合测试文件并扩展既有测试，v2 的 B-05 追加 3 个 adapter 测试）。
受保护基线 442 tests，全量 **544 tests**：

| 文件 | 覆盖 |
|------|------|
| `domain/user/__tests__/identity-rules.test.ts` | userId 归一化与边界 |
| `domain/user/__tests__/profile-rules.test.ts` | 闭集校验、显式清空、未知字段拒绝、字段计数、DB 值收敛 |
| `domain/memory/__tests__/memory-rules.test.ts` | kind/source 闭集、key 归一化（去重身份）、内容归一化、上限收敛、超长拒绝；**复核追加** B-02 保留键、B-03 过滤语义（省略 / 合法 / 混合 / 全非法 / 非数组） |
| `application/use-cases/user/__tests__/get-user-context.use-case.test.ts` | 读路径、有界选择、用户隔离、kind 过滤、读失败降级、trace 元数据（无内容）；**复核追加** B-01 权威归属、缺失/非法 context.userId、payload 跨用户指向、B-03 不扩大读取 |
| `application/use-cases/user/__tests__/update-learning-profile.use-case.test.ts` | 只写显式字段、清空、非法输入、持久化失败、trace 只记数量；**复核追加** B-01 权威归属、缺失 context.userId、payload 跨用户指向 |
| `application/use-cases/user/__tests__/remember-user-fact.use-case.test.ts` | 创建、去重/更新、kind/用户隔离、非法与超长、失败语义、trace 不含内容；**复核追加** B-01 权威归属与缺失 user id、B-02 保留键拒绝、非 canonical 偏好仍可写 |
| `application/use-cases/user/__tests__/canonical-ownership.test.ts` | **B-02 端到端**：profile 更新 + Memory 写入两条获批路径组合，证明 `explanationLanguage` 只有一个权威、无法产生矛盾上下文 |
| `application/prompts/assistant/__tests__/personal-context.prompt.test.ts` | 空上下文返回 null、渲染、注入防护（方括号中和 / 单行化）、有界预算；**复核追加** B-04 静态策略、无 context 时 system 逐字节不变、策略与数据分离 |
| `application/use-cases/assistant/__tests__/reply-to-assistant-query.memory.test.ts` | 参考集成端到端（fake repos + fake AIClientPort）、行为保真、有界、隔离、trace；**复核追加** B-04 策略在 system 权威、恶意内容不入 system、无 context 时消息结构逐字节不变 |
| `infrastructure/db/__tests__/user.repository.test.ts` | 映射、where 归属、惰性供给顺序、只写显式字段 |
| `infrastructure/db/__tests__/memory.repository.test.ts` | upsert 去重键、update 只改 content/source、有界/确定性查询、行丢弃；**B-05**：省略 kinds / 非空 kinds / `[]`（返回 [] 且不调用 findMany）/ fake-Prisma 空 kinds 语义一致 |
| `bootstrap/__tests__/identity.test.ts` | 过渡默认用户的确定性与合法性、不解析请求头 |

**没有真实数据库集成测试**：仓库当前没有隔离数据库基础设施（无 Docker / Testcontainers），
本阶段也不为它引入。补偿措施：适配器保持极薄 + 纯映射函数单独测试 +
用 stub client 断言 where/orderBy/take/upsert 形状（与 Phase 4 Reading 适配器测试同一方法）。

---

## 19. Phase 7 Agent 交接注意事项

1. **写入必须仍走用例**：任何"记住这件事"的动作都要经过 `RememberUserFactUseCase`；
   不要为了 Agent 方便新增直写路径。
2. **不要放开来源闭集**：`explicit_user` / `deterministic` 之外的新来源（例如 `agent_inferred`）
   必须是一次**显式契约变更**并接受审核 —— 它意味着记忆写入不再确定性可审核。
3. **选择策略仍是确定性的**：RAG / 向量检索需要独立设计与授权；
   当前的 `listMemory` 契约（userId + kind + updatedAt + limit）是刻意最小的。
4. **上下文预算必须保持有界**：新增上下文来源时，沿用 §10 的"条数 + 单条 + 整段"三层上限。
5. **Agent 不应直接消费 `ExecutionContext.userId` 之外的身份信息**；
   多用户化只应通过替换 `resolveCurrentUserId()` 实现。
6. **不要把 trace 当成记忆来源**：trace 是观测数据，且刻意不记录内容。
7. **若需要更丰富的 profile**：新增字段必须同时指出真实消费者，并走一次 schema 授权流程。
8. **不得用同义 Memory 键绕过 canonical User State（v2 外部复核要求记录）**：
   Phase 6 的保留键机制只保护 Domain **当前已知**的 canonical 语义
   （`english_level` / `explanation_language` 及归一化变体）。Phase 7 的 Agent / tool 设计
   **不得**用任意同义 Memory 键绕过 canonical 所有权；若 Agent 想修改 canonical 当前事实，
   必须调用 canonical profile/state 操作。这是 Phase 7 的 tool-contract / guardrail 事项，
   **不是**要求在 Phase 6 构建语义本体（ontology）。
