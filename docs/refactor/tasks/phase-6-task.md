# Phase 6 任务定义 — 用户状态与记忆系统

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 6 |
| **名称** | 用户状态与记忆系统（User State + Memory Foundation） |
| **状态** | In Progress |
| **前置条件** | Phase 0–5 全部 Completed / Approved；Git 基线 `31bd772f70f545ebb8502602f196c1bd6892442b`（分支 `master`，工作区干净）；Phase 2 + 3 + 4 + 5 受保护基线 442 tests 全绿 |
| **参考集成** | Phase 3 已批准的 `POST /api/assistant`（Route → Use Case → AIClientPort） |
| **复用** | Phase 3 `AIClientPort` / Phase 5 `TracePort` / `ExecutionContext` / `runInTrace` / `runInSpan`（**不修改其契约，只做加法**） |
| **开始日期** | 2026-09-13 |

> 本文件是 Phase 6 的正式任务定义。范围以本文件为准，**不得**扩张。

---

## 目标

为应用引入**持久化的用户状态 + 记忆**基础设施，使应用能够：

- 识别当前逻辑用户（logical user）
- 存储用户专属的持久状态
- 之后读回该状态
- 明确区分 **canonical state**（当前事实）与 **historical memory**（历史记忆）
- 有意识地更新记忆
- 把**有界的**记忆/上下文提供给 Application 用例
- 保持 Application / Domain / Infrastructure 边界清晰
- **不**把原始对话历史变成不受控的记忆

Phase 6 的产物是 Phase 7 Agent 行为的地基。**Phase 6 保持确定性**：

> 目标**不是**构建自主 Agent，**不是**构建 RAG，**不是**构建向量记忆。

---

## 核心概念模型（必须在文档中显式区分）

| 概念 | 回答的问题 | 生命周期 | Phase 6 处置 |
|------|-----------|---------|-------------|
| **User State**（canonical state） | "这个用户**当前**为真的是什么？" | 持久，可覆盖 | 新增 `User` + `UserProfile`（最小字段） |
| **Memory** | "过去哪些**有用信息**应用应当能回忆起来？" | 持久，有意识地写入 | 新增 `UserMemory`（有界、结构化、有 key） |
| **Chat / Event History** | 原始交互历史 | 不在此阶段持久化 | **不**自动写入 Memory（关键禁令） |
| **Working / Request Context** | 一次执行内需要的数据 | 单次执行 | 不持久化（`ExecutionContext` 内传递，不落库） |

Phase 6 引入的派生规则：

1. 原始聊天/事件历史**不会**自动成为 Memory。
2. Memory 的写入是**显式且确定性**的（Phase 6 没有"由 LLM 决定记住什么"）。
3. Canonical state（profile）与 historical memory 是**两个不同的表**，不合并为一张 JSON 表。

---

## Part 1 — 现状盘点（以当前仓库为准，不依赖 Phase 0 文档）

盘点方式：直接读取 `prisma/schema.prisma`、`src/app/**`、`src/features/**`、`src/lib/**`、`src/infrastructure/**`。

### 1.1 现有 Prisma 模型（7 张业务表，全部**无 userId**）

| 模型 | 字段要点 | 当前归属 |
|------|---------|---------|
| `Word` | 词库（word / phonetic / POS / definition / collocations / example / theme / difficulty / source） | **全局共享**（2000+ 内置词） |
| `WordReview` | SRS 状态（interval / easiness / repetitions / nextReviewAt / lastReviewedAt / isMastered） | **全局单份**：`@@unique([wordId])` → 每个词只有一行复习状态 |
| `DailyProgress` | 每日计数（date / newWordsAdded / wordsReviewed） | **全局单份**，无用户维度 |
| `Article` | 文章内容 + **`readAt` / `favoritedAt`** | 内容全局共享；阅读状态**全局共享** |
| `ArticleVocab` | 文章词汇条目 + `addedToReview` | 全局共享 |
| `ListeningScene` | 场景 + **`playedAt`** | 内容全局共享；播放历史**全局共享** |
| `ListeningLine` | 场景台词 + `audioUrl` | 全局共享 |

### 1.2 哪些数据**已经是**用户专属语义（但存储在全局）

| 数据 | 语义 | 存储现状 |
|------|------|---------|
| `WordReview` | 个人 SRS 进度 | 全局单份（`@@unique([wordId])`）→ 隐含单用户假设最强的位置 |
| `Article.readAt` / `favoritedAt` | 个人阅读/收藏状态 | 文章表上的全局列 |
| `ListeningScene.playedAt` | 个人听力历史 | 场景表上的全局列 |
| `DailyProgress` | 个人每日进度 | 全局按日期计数 |

### 1.3 Coach / Session 历史

**服务端无持久化会话**。`src/app/api/coach/route.ts` 是无状态的：完整 `messages` 数组由客户端每次请求带上；
`src/app/coach/page.tsx` 只用 localStorage（`coach_practiced_tags` / `coach_recommendations`）保存"练过的标签"与推荐。
→ **不存在**服务端 coach 会话表，**不存在**可迁移的历史。

### 1.4 Reading / Listening 状态

- Reading：`Article.readAt`、`Article.favoritedAt`（全局列）；`/api/history/cleanup` 用 `UPDATE` 批量清空 10 天前的 `readAt`（**全局写**）。
- Listening：`ListeningScene.playedAt`（全局列）；同一 cleanup 端点清空。
- 二者都**不是**用户专属存储。

### 1.5 UI 设置 / 偏好（全部在浏览器侧）

| 位置 | 键 | 内容 |
|------|----|------|
| `src/app/words/page.tsx`, `words/dashboard/page.tsx` | `localStorage: dailyTarget` | 每日学习目标 |
| `src/app/coach/page.tsx` | `localStorage: coach_practiced_tags`, `coach_recommendations` | 练习标签 / 推荐 |
| `src/app/words/themes/page.tsx` | `localStorage: (custom meta)` | 自定义主题名 / emoji |
| `src/app/words/themes/[theme]/list/page.tsx` | `localStorage: wordpack_<theme>` | 主题词包缓存 |
| `src/components/AIAssistant.tsx` | `localStorage: (pos)` | 助手浮窗位置 |
| `src/app/listening/scenes/page.tsx`, `listening/knowledge/page.tsx` | `sessionStorage: lsn-restore` | 滚动位置 |
| `src/app/reading/history/page.tsx`, `listening/history/page.tsx` | `localStorage: *-history-cleanup` | 上次清理时间 |

### 1.6 模块级缓存

`src/lib/word-cache.ts`（进程内词缓存）、`src/app/api/reading/[id]/route.ts` 的 `phoneticMap`、
`src/lib/prisma.ts` 的 global 单例。三者都是**进程级**、无用户维度。

### 1.7 用户 / 会话标识

**全仓库不存在任何用户或会话标识**：无 cookie 读取、无 session、无 `userId`、无 request identity。
唯一的 `Authorization` 头是**出站**调用 DeepSeek 的 API Key（与用户身份无关）。

### 1.8 隐含单用户假设（清单）

1. `WordReview.@@unique([wordId])` —— 结构上只允许一个用户的学习进度。
2. `Article.readAt/favoritedAt`、`ListeningScene.playedAt` —— 状态直接挂在共享内容上。
3. `DailyProgress` 无用户维度。
4. 无任何身份解析：所有 Route 都假设"访问者就是唯一用户"。
5. UI 偏好只存在于单个浏览器。

### 1.9 本应最终用户化、但**超出 Phase 6 安全范围**的数据（显式延后）

| # | 数据 | 为何延后 |
|---|------|---------|
| D-01 | `WordReview`（+ `@@unique([wordId])` → `[userId, wordId]`） | 涉及已有生产数据回填与唯一约束重建，破坏面大；需要独立 Phase + 迁移审批 |
| D-02 | `Article.readAt` / `Article.favoritedAt` | 需要新的用户-文章状态表 + 历史数据归属策略 |
| D-03 | `ListeningScene.playedAt` | 同上 |
| D-04 | `DailyProgress` | 需要用户维度 + 回填策略 |
| D-05 | 浏览器 localStorage 偏好 | 需要 UI/迁移策略，属 Phase 7+ |
| D-06 | `src/lib/prisma.ts` 单例搬迁（Phase 3 遗留 D6） | 与本阶段目标无关 |

> **原则：** 不因为"现在有 User 模型了"就迁移全部历史表。
> Phase 6 只新增 User/Profile/Memory 三张表；既有全局学习历史表**保持不变**。

---

## Part 2 — 身份策略

### 2.1 现状

应用历史上**没有完整认证系统**。Phase 6 **不得**演变成认证项目。

### 2.2 决定

1. **Application 代码只使用 `UserId` 抽象**（`type UserId = string`，Domain 定义）。
2. **Domain 不读 cookie / header / session**（`ARCHITECTURE_RULES.md` DOM-002）。
3. **需要用户归属的 Repository 方法必须接受 `userId`**。
4. **Delivery/Composition 边界**提供**过渡性的确定性默认用户解析**
   （`resolveCurrentUserId()`，`src/bootstrap/identity.ts`）：当前产品仍是单用户/本地形态，
   Phase 6 用一个稳定的默认逻辑用户承载新的 state/memory。
5. 该过渡策略**必须在文档与代码注释中标注为 transitional**，并说明"真实认证如何替换它"。
6. **不引入** Auth.js / Clerk / OAuth / 账号管理（仓库当前不需要）。
7. 过渡期**不得**在 Application 中假设"永远只有一个用户"：
   所有端口与用例都显式接受 `userId` 参数。

### 2.3 替换路径（写入 `MEMORY_DESIGN.md`）

```
今天：  Route → resolveCurrentUserId(request) → DEFAULT_USER_ID（过渡）
将来：  Route → resolveCurrentUserId(request) → session/JWT
                → external identity → identity boundary →（可能的映射）→ internal userId
        其余层在 internal userId 确定后不需要改合同（用例、端口、适配器都已按 userId 参数化）
```

> v1 外部复核修正：**不**得声称未来认证"只需改 identity.ts 一个文件"；
> provider subject identifier 可能需要映射到满足应用约束的 internal `UserId`（见 Part 29）。

---

## Part 3 — 用户状态模型

### 3.1 设计约束

- 不做通用 JSON dumping ground。
- 每个持久字段必须有**真实或近期消费者**。
- 稳定身份（`User`）与可变学习档案（`UserProfile`）**分开**。

### 3.2 模型

```
User         — 稳定逻辑身份（id 即 UserId，无冗余字段）
UserProfile  — 可变 canonical state，1:1 挂在 User 上
```

`UserProfile` 的**最小**字段集合（每个都有消费者）：

| 字段 | 类型 | 消费者 |
|------|------|--------|
| `englishLevel` | `String?` | 参考集成：写入 Assistant 的 learner-context 数据段 |
| `explanationLanguage` | `String?` | 参考集成：写入 learner-context |
| `createdAt` / `updatedAt` | `DateTime` | 审计与 Phase 7 排序 |

刻意**不加** `preferredTopics` / `nativeLanguage` / `learningGoal` 等"听起来有用"的字段：
其中历史性信息属于 Memory（Part 4），不重复进 profile。

### 3.3 校验规则（Domain 纯函数）

- `englishLevel` ∈ 闭集 `beginner | elementary | intermediate | upper_intermediate | advanced`。
- `explanationLanguage` ∈ 闭集 `zh | en | bilingual`。
- 首尾空白裁剪；空字符串 → 显式清空该字段（`null`）。
- 未知/非法值 → 拒绝（`invalid_input`），**不静默丢弃**。

---

## Part 4 — 记忆数据模型

### 4.1 约束

- **不**建向量数据库，**不**做 RAG，**不**做 embedding。
- **不**存不受控的完整 prompt / 聊天记录。
- 不做大型本体（ontology）。

### 4.2 模型

```
UserMemory
  id         String   @id @default(cuid())
  userId     String                  // 归属（关系型所有权）
  kind       String                  // 闭集：preference | goal | weakness | milestone
  key        String                  // 稳定的"含义键"（去重身份）
  content    String                  // 有界的短文本内容
  source     String                  // 闭集：explicit_user | deterministic
  createdAt  DateTime
  updatedAt  DateTime

  @@unique([userId, kind, key])      // 去重/覆盖语义的落点
  @@index([userId, kind])
```

刻意**不加**：`importance` / `confidence` / `status` / `active` / `embedding` / `json`。
理由：Phase 6 的选择策略是"kind + 最近更新 + 固定上限"（Part 8），这些字段没有真实消费者。

### 4.3 Memory 种类（最小闭集，4 个）

| kind | 语义 | key 语义 | 写入语义 |
|------|------|---------|---------|
| `preference` | 学习偏好（非 canonical） | 稳定含义键（`example_order`） | **单槽**：重复写入 = 更新 |
| `goal` | 学习目标 | 稳定含义键（`primary_goal`） | **单槽**：重复写入 = 更新 |
| `weakness` | 已确定的反复弱点 | 稳定含义键（`weakness:articles`） | **单槽**：重复写入 = 更新 |
| `milestone` | 确定性学习里程碑 | **每次事件一个不同的 key** | 追加型：不同 key = 不同记录；同 key = 幂等重放 |

### 4.4 边界

- `content`：非空、去首尾空白、≤ 500 字符（超出 → 拒绝，不截断）。
- `key`：非空、≤ 80 字符、归一化（小写、折叠空白/连字符 → `_`），使 `Explanation Language`
  与 `explanation_language` 命中同一去重键。

> v1 外部复核修正（B-02）：canonical profile 语义键（`english_level`、`explanation_language`
> 及其归一化变体）**保留给 User State**，不得写成 Memory。见 Part 29-A2。
- `source`：闭集 `explicit_user | deterministic`；其他值**拒绝**。

---

## Part 5 — Application 端口

Application 拥有端口；Infrastructure 实现端口；**Prisma 只出现在 Infrastructure**。
端口描述**应用需求**，不是数据库表。

```ts
// src/application/ports/user-repository.ts
interface UserRepositoryPort {
  getProfile(userId: UserId): Promise<UserLearningProfile | null>
  updateProfile(userId: UserId, patch: LearningProfilePatch): Promise<UserLearningProfile>
}

// src/application/ports/memory-repository.ts
interface MemoryRepositoryPort {
  saveMemory(record: NewMemoryRecord): Promise<StoredMemoryRecord>   // create-or-update by (userId, kind, key)
  listMemory(query: MemoryQuery): Promise<StoredMemoryRecord[]>      // bounded
}
```

刻意**不做**通用 CRUD（没有 `findAll` / `deleteById` / `updateAny` / 分页表）。
`saveMemory` 承载"按含义键 create-or-update"的应用语义；`listMemory` 承载"**有界**选取"的应用语义。

---

## Part 6 — Memory 服务 / 用例边界

**不允许**任意 Route 直接写 Memory。Memory 的创建/更新必须经过显式的 Application 行为。

Phase 6 实现的**最小用例集**：

| 用例 | 类型 | 职责 |
|------|------|------|
| `GetUserContextUseCase` | 读 | 读取 profile + **有界**记忆选择；失败可降级（Part 10） |
| `UpdateLearningProfileUseCase` | 写 | 校验并更新 canonical profile（只写显式提供的字段） |
| `RememberUserFactUseCase` | 写 | 校验 + 归一化 + 按 `(userId, kind, key)` create-or-update |

**不实现** `GetRelevantMemoryUseCase` 独立用例：有界记忆选择是 `GetUserContextUseCase` 的一部分，
再加一层只会制造空壳（Part 6 明确允许"用最少的一组"）。

明确禁止：

```
每条用户消息 → 自动存为 memory        ❌ 不接受
```

---

## Part 7 — Memory 写入策略

### 7.1 允许的来源（Phase 6 只有这两类）

| 来源 | 例子 |
|------|------|
| `explicit_user` | 用户显式表达的偏好变化 / 学习目标更新 |
| `deterministic` | 确定性派生的学习里程碑、已经确定性派生的反复弱点 |

### 7.2 禁止的来源（永不写入 Memory）

每条消息、每次模型回复、原始 prompt 正文、临时 UI 状态、临时错误、
密钥、凭据、与学习无关的任意隐私内容、任何"由 LLM 自主判断该记住什么"的结果。

### 7.3 覆盖 / 更新策略

- 同一 `(userId, kind, key)` 再次写入 → **更新** `content` 与 `updatedAt`（不新增行）。
- 不同 key → 不同记录。
- `milestone` 由调用方保证 key 的事件唯一性；同一 key 重放 = 幂等。

### 7.4 重复策略

见 Part 16。由 `@@unique([userId, kind, key])` + `saveMemory` 的 upsert 语义保证；
key 在 Domain 内**归一化**，因此大小写/空格差异不会产生重复。

---

## Part 8 — Memory 读取 / 选择策略

1. **不**把每条记忆都塞进每个 prompt。
2. Phase 6 的选择是**确定性**的：
   `userId` → `kind`（可选过滤）→ `updatedAt` 降序 → 固定 `limit`。
   v1 外部复核修正（B-03）：过滤语义必须是"省略 = 有意不过滤；非数组 / 空 / 全非法 =
   `invalid_input`；混合 = 合法子集"。**非法收窄请求永不扩大为 select-all**。见 Part 29-A3。
3. 上限由 Domain 常量给出（默认 `MEMORY_SELECTION_LIMIT = 5`，硬上限 `MEMORY_SELECTION_MAX_LIMIT = 20`）；
   调用方的 `limit` 被 `clampMemoryLimit()` 收敛到 `[1, 20]`。
4. **不**做语义/向量检索（RAG 延后）。
5. 上下文体量预算（写入 `MEMORY_DESIGN.md`）：

| 项 | 上限 |
|----|------|
| 记录条数 | 5（默认），硬上限 20 |
| 单条 `content` 落库 | 500 字符 |
| 单条渲染进 prompt | 200 字符（超出截断并加 `…`） |
| 整段渲染进 prompt | ≤ 1500 字符（超出丢弃末尾记录并记 `memory.truncated=true`） |
| profile 字段 | 2 个闭集字段 |

---

## Part 9 — 参考集成

### 9.1 选择

**`POST /api/assistant`**（Phase 3 已批准的 Route → Use Case → AIClientPort），
理由是它已经是唯一一条"简单、低风险、已可注入"的纵向链路，且 Phase 5 已在其上完成 trace 埋点。

| 候选 | 结论 | 原因 |
|------|------|------|
| **A. `/api/assistant`** | ✅ 选中 | 已批准、无 UI/DB 写入、已有 AI 端口与 trace 接缝 |
| B. Reading 内容摄取管线 | ❌ | CLI 触发面、无用户交互语义，不能证明"用户上下文" |
| C. `/api/words*` / `reading/[id]/vocab` | ❌ | 冻结/需授权模块；且涉及其它未迁移表 |
| D. 新增 profile/memory HTTP Route | ❌ | 会扩张产品面（新端点），超出 Phase 6 范围 |

### 9.2 迁移前后

```
迁移前：HTTP → Assistant Use Case → prompt → AI Client
迁移后：HTTP → UserContext 解析（Delivery）
             → Assistant Use Case
             → 有界 profile/memory 读取（Application 用例 + Port）
             → prompt/context 构造（Application）
             → AI Client
```

硬性要求：

- **不**让 Infrastructure 构造个性化 prompt。
- **不**迁移其它任何 AI feature。
- 只在**读**方向接入个性化；写方向通过 Application 用例提供（无新 Route）。

### 9.3 依赖可选项（行为保真的关键）

`ReplyToAssistantQueryUseCase` 的新依赖 `getUserContext` 是**可选**的：

- 未提供，或 `ExecutionContext` 中没有 `userId` → **完全不做个性化**，
  system prompt 与消息数组与迁移前**逐字节一致**（Phase 3 既有测试不改也仍然通过）。
- 提供且解析出 `userId` → 追加**有界**的 learner-context 数据消息。
- Composition Root 在生产路径上**始终**提供该依赖。

> v1 外部复核修正（B-01）：user-scoped 用例的权威归属身份只能来自 `ExecutionContext.userId`；
> 操作 payload 不携带 `userId`；缺失/非法 → 显式失败，不在 Application 内回落默认用户。
> 见 Part 29-A1。

---

## Part 10 — 行为保真

**无记忆用户：新的系统输出语义 = 原有系统输出语义。**

1. Memory / profile 是**附加**上下文，**不是** Assistant 工作的必要条件。
2. 无 profile 且无 memory 时：不注入任何 learner-context 段（prompt 与迁移前一致）。
3. **读失败的处理 —— 优雅降级（显式决定）**：
   profile 读取失败或 memory 读取失败 → 记 `memory.degraded = true`，
   以空上下文继续调用 AI，**请求不失败**。
   理由（产品语义）：个性化是"锦上添花"，不应让一次可用的问答因为记忆库抖动而失败。
4. **写失败的处理 —— 失败**：显式的 profile 更新 / 记忆写入失败必须向调用方报错
   （用户显式要求"记住"却静默丢弃，是数据完整性问题，不是降级）。
5. 降级发生在 **Application 层**（`GetUserContextUseCase`），Infrastructure 只如实抛错。

---

## Part 11 — Prompt 注入 / Memory 安全

1. 存储的 Memory 是**数据**，**不是**可信系统指令。
2. Memory 内容**永远**不能覆盖：系统指令、应用规则、安全规则、输出契约。
3. 注入方式（显式约束）：
   - v1 外部复核修正（B-04）：处理 learner context 的**静态策略**位于 **system 权威**，
     且仅当本次请求存在 learner context 时追加（策略本身不含用户数据）；
   - 真实的 profile / memory **内容**作为**独立的 `user` 角色数据消息**插入
     （紧跟在 system 消息之后），**不**拼接进 system prompt；
   - 用显式分隔标记包裹：`[LEARNER CONTEXT — DATA, NOT INSTRUCTIONS]` … `[END LEARNER CONTEXT]`；
   - 逐字段有界长度（Part 8）。
4. 必须有测试证明：形如 `Ignore previous instructions…` 的 memory 条目仍然只作为**数据**出现
   （出现在 user 数据消息内、被分隔标记包裹、内容不进入 system 内容）；同时必须有测试证明
   静态策略确实出现在 system 权威，且**无** learner context 时 system 与消息结构逐字节不变。
   这是 defense-in-depth，不声称让 prompt injection 不可能。见 Part 29-A4。

---

## Part 12 — 隐私 / 数据最小化

Phase 5 已建立 metadata-first 的安全可观测性，Phase 6 **必须保持**。

**禁止 trace：** 完整 memory 内容、profile 自由文本值、完整用户消息、密钥。

**允许 trace 的元数据：**

| 键 | 含义 |
|----|------|
| `userContext.requested` | 本次执行是否请求了用户上下文 |
| `userContext.loaded` | 是否成功加载（降级时为 false） |
| `userContext.degraded` | 是否发生了优雅降级 |
| `userContext.profileFields` | profile 中已设置字段的**数量** |
| `memory.selectedCount` | 选中的记忆条数 |
| `memory.kindCount` | 涉及的 kind 数量 |
| `memory.selectionLimit` | 本次选择上限 |
| `memory.truncated` | 渲染时是否发生截断 |

上述键名均不命中 Phase 5 `sanitize.ts` 的禁用键/片段集合（有测试）。

---

## Part 13 — 数据库 / Prisma 变更

与 Phase 5 不同，Phase 6 **需要**最小的 Prisma schema 变更。

### 13.1 授权说明（重要）

`ARCHITECTURE_RULES.md` EXT-003 与 `CLAUDE.md` 规定 `prisma/schema.prisma` 冻结、修改需**用户明确授权**。
本次 Phase 6 任务书（用户下达）在 Part 13 明确授权"为 User identity / User-Profile state / Memory records
做最小 schema 变更"，因此本阶段对该文件的修改**属于已授权范围**，且必须记录进 `DECISIONS.md`。

### 13.2 变更范围（只做加法）

- 新增 `User`、`UserProfile`、`UserMemory` 三个模型；
- 通过 `userId` 建立关系型所有权（含 `onDelete: Cascade`）；
- 为真实查询模式建索引：`@@unique([userId, kind, key])`（去重/upsert 键）、`@@index([userId, kind])`（有界选择）；
- **不**重写任何既有模型、**不**改动任何既有表语义、**不**迁移既有数据归属。

### 13.3 迁移要求

- 生成一个**正常**的 migration（目录 + `migration.sql`），SQL 必须**非破坏性**（只有 `CREATE TABLE` / `CREATE INDEX` / 外键）；
- 必须**人工检查** SQL；
- **不得**对生产数据库执行迁移（无用户明确批准）；
- 自动化测试**不得**依赖真实生产数据库；
- 允许并需要本地 `prisma generate`（生成的 client 已在版本库中，需同步）。

### 13.4 已知的既有仓库问题（非本阶段引入，不在本阶段修）

`prisma/migrations/20260609000001_baseline/migration.sql` 在 HEAD（31bd772，早于 Phase 6）就已经是一份
**UTF-16 编码的 PowerShell 错误转储**，而不是真实 SQL。这是历史提交遗留的损坏文件。
Phase 6 **不修改**它（属无关修复，违反"不做无关清理"）；本阶段新增的迁移文件独立且为合法 SQL。

> v1 外部复核 non-blocking note A：**完整迁移链的生产部署在历史迁移被独立验证/修复之前保持
> BLOCKED**；不得声称 deployment-ready。见 Part 29-B。

---

## Part 14 — 遗留数据 / 默认用户

当前数据早于 User 身份存在，**不得**静默销毁或重新归属任何既有用户历史。

策略：

1. 引入**稳定的默认逻辑用户身份**（`DEFAULT_USER_ID = 'local-default-user'`，确定性常量）。
2. 新的 Phase 6 state / memory 只附着在该默认用户上。
3. 既有全局学习历史表（WordReview / Article / ListeningScene / DailyProgress）**保持不变**。
4. 存储适配器对"默认用户行不存在"的情况采用**惰性供给**（lazy provisioning）：
   在写 profile / 写 memory 时幂等创建 `User` 行（不预置 profile 行）。
   → 因此**不需要**在生产数据库上执行数据回填迁移；
   → 也不需要在只读路径（GetUserContext）写库。
5. 只有当参考集成**明确要求**时才迁移既有表 —— 参考集成（Assistant 读路径）不要求。
6. 延后的用户化债务见 Part 1.9 与 `MEMORY_DESIGN.md`。

---

## Part 15 — Domain 规则

Domain **可以**包含的纯规则：

- memory 归一化（key 归一化、内容边界）
- 允许的 memory kind / source（闭集）
- 有界内容校验
- 去重身份键（key）生成
- profile 校验

Domain **不得**：

- 调用 Prisma / AI / 网络 / 文件系统
- 检索 Memory
- 用 LLM 决定记住什么
- import Trace 基础设施
- import Next.js
- 读取 HTTP / session / cookie / 环境变量

文件布局：

```
src/domain/user/{types.ts, profile-rules.ts}
src/domain/memory/{types.ts, memory-rules.ts}
```

---

## Part 16 — Memory 去重

**确定性重复/更新策略：**

1. 去重身份 = `(userId, kind, normalizedKey)`，由数据库唯一约束 + 适配器 upsert 共同保证。
2. `key` 在 Domain 内归一化（小写、首尾裁剪、内部空白/`-`/`:` → `_`、折叠重复 `_`），
   因此 `Explanation Language`、`explanation language`、`explanation-language` 是**同一条**记忆。
3. 不同 kind 的差异是**调用方如何选 key**，不是不同的存储机制：
   - `preference` / `goal` / `weakness`：用**稳定含义键** → 天然单槽，更新即覆盖；
   - `milestone`：用**事件唯一键** → 追加型；同键重放幂等。
4. **不**构建高级记忆合并/压缩引擎（延后到后续 Phase）。
5. 更新策略：同键写入覆盖 `content` 并推进 `updatedAt`；`createdAt` 不变。

---

## Part 17 — 测试

不需要真实 AI、不需要生产数据库写入。至少覆盖以下 16 项：

| # | 要求 | 落点 |
|---|------|------|
| 1 | profile / user state 读取 | `get-user-context.use-case.test.ts` |
| 2 | profile 更新校验 | `profile-rules.test.ts` + `update-learning-profile.use-case.test.ts` |
| 3 | memory 创建 | `remember-user-fact.use-case.test.ts` |
| 4 | 确定性 memory 去重/更新 | `memory-rules.test.ts` + `remember-user-fact.use-case.test.ts` |
| 5 | memory 归属正确用户 | `remember-user-fact.use-case.test.ts` + `memory.repository.test.ts` |
| 6 | 用户 A 不能取到用户 B 的记忆 | `get-user-context.use-case.test.ts` + `memory.repository.test.ts` |
| 7 | 有界 memory 选择 | `memory-rules.test.ts` + `get-user-context.use-case.test.ts` + `memory.repository.test.ts` |
| 8 | 无 memory 时参考集成行为不变 | `reply-to-assistant-query.memory.test.ts` |
| 9 | 选中的记忆被正确加入 Application 上下文 | `personal-context.prompt.test.ts` + `reply-to-assistant-query.memory.test.ts` |
| 10 | 指令式 memory 文本仍是数据、不是权威 | `personal-context.prompt.test.ts` + `reply-to-assistant-query.memory.test.ts` |
| 11 | memory 仓储失败行为（降级 / 写入失败） | `get-user-context.use-case.test.ts` + `remember-user-fact.use-case.test.ts` |
| 12 | 持久化适配器映射 | `user.repository.test.ts` + `memory.repository.test.ts` |
| 13 | 默认 / 过渡性用户解析 | `identity.test.ts` |
| 14 | Trace 记录 memory 元数据但不记录内容 | `reply-to-assistant-query.memory.test.ts`（InMemoryTraceRecorder） |
| 15 | 非法 / 超长 memory 内容处理 | `memory-rules.test.ts` + `remember-user-fact.use-case.test.ts` |
| 16 | 参考 Assistant Use Case + fake repositories + fake AIClientPort | `reply-to-assistant-query.memory.test.ts` |

约束：

- Application 测试使用 **fake repositories**；
- **不**调用真实 DeepSeek；**不**依赖真实生产数据库；
- 计时/ID 使用注入的假实现（确定性）。

---

## Part 18 — 仓储适配器测试

- 适配器保持**薄**：只做参数映射与调用 Prisma。
- 用**记录调用的 stub client** 断言 where 子句（含 `userId` 归属）、orderBy/take（有界）、upsert 语义；
- 纯映射 helper 单独测试（导出并直接断言）；
- **不**引入 Docker / Testcontainers（仓库当前没有，也不为本阶段引入）；
- 明确记录"没有真实数据库集成测试"这一事实（`MEMORY_DESIGN.md` 测试策略）。

---

## Part 19 — Trace 集成

复用 Phase 5 已批准的可观测性设施（`TracePort` / `ExecutionContext` / `runInTrace` / `runInSpan`）。

- 只在**应用编排**边界加 span：`user.context`（读取）与 `memory.remember`（写入）；
- 只记录 Part 12 列出的计数/布尔元数据；
- **不**改 Trace 设计、**不**加持久化、**不**记录内容。

---

## Part 20 — Memory 设计文档

创建 `docs/refactor/MEMORY_DESIGN.md`，必须包含：

目标、非目标、User State vs Memory vs Chat History vs Request Context、身份策略、
当前单用户过渡策略、User/Profile 模型、Memory 模型、归属模型、Application Ports、
Repository adapters、memory 写入策略、memory 读取/选择策略、有界上下文策略、
去重/更新策略、prompt 注入处理、隐私/数据最小化、Trace 集成、参考集成、
迁移策略、延后的用户化债务、测试策略、Phase 7 Agent 交接注意事项。

---

## Part 21 — 允许的修改

- User / Profile / Memory 的最小 Prisma 模型与迁移
- Application user / memory 端口
- Domain memory / profile 规则
- Infrastructure Prisma 仓储适配器
- bootstrap / composition 装配
- **一个**参考 Use Case 集成
- 最小 Delivery 身份解析
- Phase 5 Trace 的元数据接入（不改 Trace 设计）
- 测试 / fixtures
- Phase 6 文档、`PHASE_STATUS.md`、`DECISIONS.md`（真实长期决策）

## Part 22 — 禁止的修改

- 开始 Phase 7 / 构建 Agent / 用 LLM 做自主记忆选择
- 实现 RAG / 向量库 / embedding / 语义记忆检索
- 引入完整认证（仓库当前没有）
- 把每一张历史表都迁移到 User 归属
- 整体重写 Words / Reading / Listening / Coach
- 重新设计 Phase 3 AI Client / Phase 4 Workflow / Phase 5 Trace
- 把每条聊天消息存成 Memory
- trace 完整 Memory 内容
- 无关 UI 改版、无关技术债修复

---

## Part 23 — 必须成立的不变式

1. Memory 始终归用户所有。
2. User State 表示 canonical 当前状态；Memory 表示持久化的、被选中的历史上下文。
3. 原始聊天/事件历史不会自动成为 Memory。
4. Phase 6 的持久 Memory 写入是显式且确定性的。
5. Memory 读取是有界的。
6. Memory 注入 LLM 上下文时被当作**不可信数据**。
7. 无 memory 时行为保持可用（且与迁移前语义一致）。
8. Infrastructure 从不决定学习/记忆语义。
9. Domain 保持 provider / persistence / trace 独立。
10. Trace 元数据不得暴露 Memory 内容。

---

## Part 24 — 验证

变更前记录已批准基线；实现后运行：

- `npx vitest run`
- `npx tsc --noEmit`
- `npx next build`
- `npx eslint tests/`
- `npx eslint src/lib/__tests__/`
- `npx eslint src/domain/ src/application/ src/infrastructure/ src/bootstrap/`
- lint 被修改的 Route / identity / memory 文件
- `npx eslint src/`
- 既有 HTTP 冒烟套件（等价端口）

Prisma 相关：

- `npx prisma validate`
- `npx prisma generate`

**不**自动对生产数据库执行迁移；**不**调用真实 DeepSeek；**不**做不受控的生产库写入。
Phase 2–5 受保护测试必须全绿。

---

## Part 25 — 状态管理

- 开始：Phase 6 = **In Progress**
- 实现完成：Phase 6 = **In Review**；Phase 7 = **Not Started**
- v1 外部复核 = **Changes Requested / Phase 7 Not Approved**；B-01–B-04 修正完成后
  Phase 6 = **In Review（corrections complete, awaiting external re-review）**；Phase 7 仍为 Not Started
- **不**自行标记 Completed / Approved（需要外部审核）

## Part 26 — Git 纪律

变更前记录 branch / HEAD / `git status --short` / `git diff --stat`；工作区必须干净。
**不自动提交**；**不**使用破坏性 Git 命令；**不**重写既往已批准的提交。

---

## Part 27 — 完成报告

实现完成时报告 37 项（身份策略 → Phase 7 仍为 Not Started），见任务书 Part 27 清单。

## Part 28 — 生成审核包

生成 `phase-6-review-pack-v1.zip`（因本阶段引入持久用户态），包含：
`phase-6-task.md`、`MEMORY_DESIGN.md`、`phase-6-handoff.md`、`PHASE_STATUS.md`、
修改后的 `DECISIONS.md`、Prisma schema + Phase 6 迁移、全部 Phase 6 Domain / Application / Infrastructure 源码、
identity resolver / bootstrap 变更、参考集成文件、Phase 6 测试、`validation-results.txt`、
`git-status.txt`、`git-diff-stat.txt`、完整 Phase 6 diff（含未跟踪文件）、`review-manifest.md`、
`file-hash-verification.txt`。

对包内副本与工作区做 hash 校验。排除：`.env`、API Key、DB 凭据、`node_modules`、`.next`、
历史 review ZIP、音频/二进制资产、无关临时文件、真实私有 memory 记录。
生成后**重新打开 ZIP 检查真实内容**，最后报告路径。

---

## Part 29 — v1 外部复核修正（2026-09-14，绑定）

> v1 外部复核结论：**Review Status = Changes Requested；Phase 7 Release Decision = Not Approved**。
> 以下四项 blocking correction 已落入实现。本节是任务定义的**绑定补充**：与正文冲突时以本节为准。
> 完整评审历史见 `docs/refactor/reviews/phase-6-review.md`。

### 29-A1 — 执行上下文身份是权威归属（B-01）

- 受用户归属约束的 Application 操作，权威归属身份**只能**来自 `ExecutionContext.userId`
- 操作 payload **不得**包含/选择 `userId`（类型层面移除 + 运行时忽略敌意字段）
- `ExecutionContext.userId` 缺失或非法 → 显式 `invalid_input`，**不**在 Application 内回落默认用户
- 过渡默认用户解析保留在 Delivery / Composition（`src/bootstrap/identity.ts`）
- Domain 校验需要归属时，由 Application 注入**受信任**的 `context.userId`
  （`validateNewMemoryInput(fields, ownerUserId)`），不从任意请求输入取归属
- 落点：`src/application/use-cases/user/ownership.ts`（新增）、三个 user use case、
  `src/domain/memory/{types,memory-rules}.ts`

### 29-A2 — Canonical User State 与 Memory 的语义所有权（B-02）

- 同一个语义当前事实不得同时由 `UserProfile` 与 `UserMemory` 权威拥有
- 至少 `english_level` / `explanation_language`（含归一化变体）保留给 User State
- Memory 写入命中保留键 → `invalid_input`，**不**落库
- `preference` kind 保持可用；非 canonical 偏好（如 `example_order`）照常可写
- explanation-language 偏好只能经 `UpdateLearningProfileUseCase` 更新

### 29-A3 — 非法过滤不得扩大读取（B-03）

- 省略 / `null` → 有意不按 kind 过滤
- 合法数组（可混合非法项）→ 使用合法子集
- 空数组 / 全部非法 / 非数组 → `invalid_input`
- **非法收窄请求永不退化为 select-all**；条数上限 / 单条 / 整段预算不变

### 29-A4 — Learner-context 权威分离（B-04）

- 仅**静态**处理策略进入 system 权威；真实 profile / memory 内容保持 system 之外
- 内容仍为**独立的 `user` 角色数据消息**，被显式分隔标记包裹且逐字段/整段有界
- 记忆文本永不插值进 system 指令
- **无** learner context 时，system prompt 与消息结构保持 Phase 6 之前逐字节不变
- 这是 defense-in-depth，**不**声称让 prompt injection 不可能

### 29-B — Non-blocking notes

1. **迁移链部署门禁**：Phase 6 新迁移在单独看时合法，但
   `prisma/migrations/20260609000001_baseline/migration.sql` 是历史损坏文件；
   在完整迁移链被独立验证/修复之前，生产迁移部署 **BLOCKED**。Phase 6 不修复它、不对生产库执行迁移。
2. **未来认证身份映射**：不得声称只需改 `identity.ts`。正确路径为
   external identity → identity boundary → 可能的映射 → internal `UserId`（满足应用约束）
   → 现有 User State / Memory 架构。Phase 6 不实现认证。

### 29-C — v2 外部复核修正（B-05）

v2 结论：**Minor Changes Requested / Phase 7 Release Decision = Not Approved yet**；
B-01–B-04 **接受为已解决**（不得重新设计）。

- **B-05**：`MemoryRepositoryPort` 选择语义必须显式统一 ——
  `kinds === undefined` → 有意不做 kind 限制；`kinds.length > 0` → 限制到这些 kind；
  **`kinds.length === 0` → 返回零条**（显式空收窄绝不变成 select-all）
- `PrismaMemoryRepository.listMemory()` 在空收窄时先返回 `[]`，不执行 `findMany`
- Application 级 B-03 校验保持不变；**不**引入通用 repository 重构
- Phase 7 交接规则：Phase 6 的保留键机制只保护当前已知的 canonical 语义；Phase 7 的
  Agent / tool **不得**用同义 Memory 键绕过 canonical User State 所有权，
  修改 canonical 当前事实必须走 canonical profile/state 操作

---

## 验收标准

1. 引入最小 User / UserProfile / UserMemory 持久模型，且既有表语义**未改变**
2. Application 端口存在、由 Infrastructure 实现、Prisma 只出现在 Infrastructure
3. Domain 保持纯净（无 Prisma / AI / Next.js / Trace / 环境变量依赖）
4. Memory 写入显式、确定性、有界、可去重；**没有**"每条消息即记忆"
5. Memory 读取有界（条数/长度/预算），并有无记忆时的行为保真
6. 参考集成（`/api/assistant`）证明身份 → 上下文读取 → 有界 Application 上下文 → 既有 prompt → AIClientPort
7. prompt 注入处理满足"数据不是指令"，有测试
8. Trace 只记录元数据（无 memory 内容 / profile 自由文本 / 用户消息），有测试
9. 身份策略显式，默认用户解析明确标注为 transitional，并有替换路径文档
10. Phase 2 / 3 / 4 / 5 受保护基线全绿（442 → 442+）
11. `npx vitest run` / `npx tsc --noEmit` / `npx next build` / 约定 ESLint / HTTP 冒烟 全部通过
12. Prisma validate + generate 通过；迁移为合法、非破坏性 SQL；**未**对生产库执行迁移
13. Phase 6 = In Review；Phase 7 = Not Started（**不自行批准**）
14. 生成并自检 `phase-6-review-pack-v1.zip`
