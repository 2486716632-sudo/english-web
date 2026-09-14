# Phase 6 交接文档 — 用户状态与记忆系统

**日期:** 2026-09-13（2026-09-14 外部最终复审 v3 通过并收尾）
**Phase 状态:** ✅ **Completed / Approved**（2026-09-14；Review Status = Approved，Blocking Issues: None，
Phase 7 Release Decision = Approved after administrative closeout）
**任务定义:** `docs/refactor/tasks/phase-6-task.md`
**设计文档:** `docs/refactor/MEMORY_DESIGN.md`
**决策记录:** `DECISIONS.md` ADR-014
**Git 基线:** `31bd772f70f545ebb8502602f196c1bd6892442b`（分支 `master`，Phase 6 开始时工作区干净）
**审核记录:** `docs/refactor/reviews/phase-6-review.md`（v1 Changes Requested → 修正记录）

---

## 1. 一句话总结

引入持久化的 **User State（`User` + `UserProfile`）** 与 **Memory（`UserMemory`）**，
并以 Phase 3 已批准的 `POST /api/assistant` 作为**唯一**参考集成，
证明"显式身份 → 有界 profile/memory 读取 → 既有 prompt → AIClientPort"这条链路；
无 profile/memory 的用户行为与迁移前**逐字节一致**。

**不是** Agent、**不是** RAG/向量记忆、**不是**完整认证、**不是**全库用户化迁移。

---

## 2. 变更清单（按层）

### Domain（纯规则，无外部依赖）

| 文件 | 内容 |
|------|------|
| `src/domain/user/types.ts` | `UserId`、`EnglishLevel` / `ExplanationLanguage` 闭集、`UserLearningProfile`、`LearningProfilePatch` |
| `src/domain/user/identity-rules.ts` | `normalizeUserId`（长度 / 字符集 / 大小写） |
| `src/domain/user/profile-rules.ts` | `validateLearningProfilePatch`、`toEnglishLevelOrNull` / `toExplanationLanguageOrNull`、`countProfileFields`、`isProfileEmpty` |
| `src/domain/memory/types.ts` | `MemoryKind` / `MemorySource` 闭集、`NewMemoryRecord`、`StoredMemoryRecord`、`MemoryQuery`、`RawMemoryWriteInput` |
| `src/domain/memory/memory-rules.ts` | `validateNewMemoryInput`、`normalizeMemoryKey`（去重身份）、`normalizeMemoryContent`、`clampMemoryLimit`、`normalizeMemoryKinds`、全部边界常量 |

### Application（Ports / Use Cases / Prompt）

| 文件 | 内容 |
|------|------|
| `src/application/ports/user-repository.ts` | `UserRepositoryPort`（`getProfile` / `updateProfile`） |
| `src/application/ports/memory-repository.ts` | `MemoryRepositoryPort`（`saveMemory` / `listMemory`） |
| `src/application/use-cases/user/get-user-context.use-case.ts` | 有界读取 profile + memory；读失败优雅降级；trace 元数据 |
| `src/application/use-cases/user/update-learning-profile.use-case.ts` | 显式更新 canonical 档案；校验→`invalid_input`；失败→`persistence_failed` |
| `src/application/use-cases/user/remember-user-fact.use-case.ts` | **唯一**记忆写入入口（闭集 + 归一化 + upsert） |
| `src/application/prompts/assistant/personal-context.prompt.ts` | learner context 数据段渲染（分隔标记、单行化、方括号中和、三层预算） |
| `src/application/use-cases/user/ownership.ts`（B-01 新增） | `requireOwnershipUserId(context)`：权威归属只来自 `ExecutionContext.userId`；缺失/非法显式失败 |

### Application（Phase 5 设施的**加法**扩展）

| 文件 | 变更 |
|------|------|
| `src/application/observability/execution-context.ts` | `ExecutionContext` 新增可选 `userId` + `resolveUserId()`（**不**改变 Trace 契约） |
| `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` | 新增**可选**依赖 `getUserContext`；在 system 消息后追加**一个** user 数据消息（仅在解析出 userId 且存在上下文时） |

### Infrastructure

| 文件 | 内容 |
|------|------|
| `src/infrastructure/db/user.repository.ts` | `PrismaUserRepository` + `mapUserProfileRow`（闭集收敛） |
| `src/infrastructure/db/memory.repository.ts` | `PrismaMemoryRepository` + `mapUserMemoryRow`；upsert by `(userId, kind, key)`；`updatedAt desc, id asc` + `take` |

### Composition Root / Delivery

| 文件 | 变更 |
|------|------|
| `src/bootstrap/identity.ts`（新增） | `DEFAULT_USER_ID = 'local-default-user'` + `resolveCurrentUserId()`（**过渡**，不解析请求头） |
| `src/bootstrap/user-state-composition.ts`（新增） | user/memory adapter 与三个用例的惰性装配 |
| `src/bootstrap/index.ts` | assistant 参考集成装配 `getUserContext` |
| `src/app/api/assistant/route.ts` | 最小身份解析（`ExecutionContext.userId`）；trace 记录 `user.resolved`，**不**记录 userId |

### Prisma

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | **仅新增** `User` / `UserProfile` / `UserMemory`（+ 唯一约束 + 索引 + 关系） |
| `prisma/migrations/20260913000001_add_user_state_and_memory/migration.sql` | 纯增量 SQL（建表 / 建索引 / 加外键），人工检查确认**无破坏性语句** |

> 生成客户端 `src/generated/prisma` 在 `.gitignore` 中，`prisma generate` 已在本地执行成功，**不**进入提交/审核包。
> **未**对任何数据库执行迁移。

### 测试

新增 **12 个文件**（v1 为 11 个；B-02 端到端组合测试为复核修正新增），
测试数量以 `validation-results.txt` 的最终完整运行为准（清单见 `MEMORY_DESIGN.md` §18），全部离线
（fake repositories + fake AIClientPort；无真实 DeepSeek / RSS / 数据库）。

---

## 3. 关键设计点（审核时最容易有异议的地方）

1. **写入是显式且确定性的**：唯一入口 `RememberUserFactUseCase`，
   `source ∈ {explicit_user, deterministic}`；**没有**"每条消息 → 记忆"的通路，
   也没有新增写路由（不扩张产品面）。写用例已装配进 Composition Root 供 Phase 7 使用。
2. **读有界**：默认 5 条 / 硬上限 20 条、单条落库 ≤ 500 字符、单条渲染 ≤ 200 字符、
   整段 ≤ 1500 字符；选择顺序 `updatedAt desc, id asc`（并列也稳定）。
3. **注入形态（B-04 修正后）**：处理 learner context 的**静态策略**位于 **system 权威**
   （仅当存在 learner context 时追加）；真实 profile/memory **内容**仍作为**独立 user 消息**，
   用分隔标记包裹 + 方括号中和 + 单行化，使记忆内容无法伪造结构。无 context 时 system 逐字节不变。
4. **失败语义**：读失败 → `degraded` 继续（个性化不该让问答失败）；
   写失败 → `invalid_input` / `persistence_failed`（显式承诺不能静默丢弃）。
5. **身份是过渡的**：`DEFAULT_USER_ID` 常量 + 不解析 header。替换真实认证是
   external identity → identity boundary → **可能的映射** → internal `UserId`；
   **不**声称只需改一个文件。
6. **schema 授权**：EXT-003 的冻结约束由本次任务书 Part 13 明确授权满足，范围仅限三张新表（ADR-014 第 9 条）。
7. **行为保真**：Phase 3 的 `reply-to-assistant-query.use-case.test.ts` 与 Phase 5 的
   tracing 测试**未做任何修改**即仍然通过（个性化依赖为可选 + 无上下文时不注入）。
8. **B-01 权威归属**：三个 user-scoped 用例统一经 `requireOwnershipUserId(context)` 解析归属；
   payload 不含 `userId`；缺失/非法 → `invalid_input`（不回落默认用户）。
9. **B-02 语义所有权**：`english_level` / `explanation_language`（含归一化变体）保留给
   `UserProfile`；Memory 写入命中保留键 → `invalid_input`，不落库。
10. **B-03 过滤语义**：`memoryKinds` 省略 = 有意不过滤；非数组 / 空 / 全非法 = `invalid_input`；
    混合 = 合法子集。非法收窄请求**永不**扩大为 select-all。
11. **迁移门禁**：Phase 6 新迁移单独看合法，但历史 baseline 迁移损坏（UTF-16 错误转储），
    完整迁移链生产部署 **BLOCKED**，需独立修复与授权。

---

## 4. 复现验证（命令与结果）

| 命令 | 结果 |
|------|------|
| `npx vitest run` | ✅ 40 files / **544 tests passed**（v1 为 39/519；v1 复核修正 +1 文件，v2 的 B-05 +3 tests） |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes；33/33 静态页面；2 条既有警告） |
| `npx eslint tests/`、`npx eslint src/lib/__tests__/` | ✅ 0 errors / 0 warnings |
| `npx eslint src/domain/ src/application/ src/infrastructure/ src/bootstrap/` | ✅ 0 errors / 0 warnings |
| `npx eslint src/app/api/assistant/` | ✅ 0 errors / 0 warnings |
| `npx eslint src/` | ✅ 既有历史基线不变（35 errors / 36 warnings，**无** Phase 6 文件） |
| `prisma validate` / `prisma generate` | ✅ 通过（CLI 本地包缺失构建产物，改用临时目录内的同版本 CLI + 本地 schema-engine 二进制） |
| HTTP 冒烟（14 项） | ✅ 14 passed / 0 failed / 0 skipped |
| 真实外部调用 | ✅ 未调用真实 DeepSeek；未调用真实 RSS；未对生产库迁移或写入。（`next build` 使用普通网络访问 Google Fonts，属正常构建依赖，不影响上述结论。） |

**环境说明（诚实记录）：**

1. 本环境**无 `bash` / `jq`**，因此 HTTP 冒烟使用**等价 PowerShell 端口**
   （14 项检查一一对应，单请求语义与 `tests/smoke/api-smoke.sh` 相同，JSON 结构用 `ConvertFrom-Json` 校验）。
2. 仓库 `node_modules/prisma` 缺少 CLI 构建产物（`build/index.js` 不存在）——
   这是 Phase 6 **之前**就存在的环境问题。为完成 `validate` / `generate` / `migrate diff`，
   在仓库外的临时目录安装了**同版本** `prisma@7.8.0`，并指向仓库内已有的
   `node_modules/@prisma/engines/schema-engine-windows.exe` 运行。
   仓库的 `node_modules` 与 lockfile **未被改动**。
3. 已知的既有仓库缺陷（**非** Phase 6 引入，本阶段**不**修改）：
   `prisma/migrations/20260609000001_baseline/migration.sql` 在基线提交中是一段
   UTF-16 编码的 PowerShell 错误转储，而不是真实 SQL。Phase 6 新增的迁移文件独立且为合法 SQL。

---

## 5. 未改动 / 刻意不做的

- 未修改 Phase 3 AI Client（`ports/ai-client.ts` / `infrastructure/ai/**`）与 Phase 4 Workflow
- 未修改 Phase 5 Trace 设计（只给 `ExecutionContext` 加了一个可选字段）
- 未修改既有 7 张业务表、未迁移既有数据归属
- 未新增任何 HTTP 写路由（profile / memory 写入暂不暴露为产品 API）
- 未引入 RAG / 向量 / embedding / 语义检索 / LLM 自主记忆
- 未引入认证（Auth.js / Clerk / OAuth）
- 未新增第三方依赖、未引入 Docker/Testcontainers
- 未做无关清理或技术债修复

## 6. 延后工作（交给后续 Phase）

| # | 项 | 归属 |
|---|----|------|
| D-01 | `WordReview` 用户化（`@@unique([userId, wordId])` + 存量回填） | 独立 Phase + 迁移审批 |
| D-02/D-03 | `Article.readAt/favoritedAt`、`ListeningScene.playedAt` 用户化 | 同上 |
| D-04 | `DailyProgress` 用户化 | 同上 |
| D-05 | localStorage 偏好迁移到服务端用户态 | Phase 7+ |
| D-06 | profile / memory 的 HTTP 写入端点 | 需要产品决策（Phase 7+） |
| D-07 | 语义记忆检索（RAG / 向量） | 需要独立设计与授权 |
| D-08 | 真实认证替换 `resolveCurrentUserId()` | 需要认证设计 |
| D-09 | 真实数据库集成测试（隔离数据库） | Phase 8（本阶段以 stub client + 纯映射测试补偿） |

## 7. 提交前状态

| 项目 | 结果 |
|------|------|
| Phase 6 状态 | ✅ **Completed / Approved**（2026-09-14） |
| Phase 7 状态 | **Ready / Not Started**（未启动；需用户明确批准） |
| Review Status | v1 Changes Requested → v2 Minor Changes Requested → ✅ **v3 Approved**（Blocking Issues: None） |
| 是否自行批准 | ❌ 否（由外部审核批准） |

---

## 8. 外部审核记录

> 本节由外部审核方填写（或由执行者如实转录审核意见）。完整记录见
> `docs/refactor/reviews/phase-6-review.md`。

### v1 结论（2026-09-13 送审）

| 项目 | 结果 |
|------|------|
| Review Status | 🔴 **Changes Requested** |
| Phase 7 Release Decision | ❌ **Not Approved** |
| Blocking Issues | B-01（`ExecutionContext.userId` 权威归属）/ B-02（canonical State vs Memory 所有权）/ B-03（非法 memoryKinds 扩大为 select-all）/ B-04（learner-context 权威分离） |
| Non-blocking Notes | A：迁移链部署门禁；B：未来认证需 external → internal UserId 映射 |

### 修正记录（2026-09-14）

- B-01：三个 user-scoped 用例统一经 `requireOwnershipUserId(context)`；payload 移除 `userId`；
  Domain 校验改为 `validateNewMemoryInput(fields, ownerUserId)`
- B-02：新增 reserved canonical keys；命中 → `invalid_input`，不落库
- B-03：`normalizeMemoryKinds` 改为结果对象；非法收窄 → `invalid_input`
- B-04：静态策略进 system 权威；内容仍在独立 user 数据消息；无 context 时逐字节不变
- Note A/B：写入 `MEMORY_DESIGN.md`、ADR-014 与本交接文档

修正后：Phase 6 = 🔄 **In Review — corrections complete, awaiting external re-review**；Phase 7 = **Not Started**。

### v2 结论与修正（2026-09-14）

| 项目 | 结果 |
|------|------|
| Review Status | 🟠 **Minor Changes Requested** |
| Phase 7 Release Decision | ❌ **Not Approved yet** |
| v1 blockers | B-01 / B-02 / B-03 / B-04 **接受为已解决**（不得重新设计） |
| v2 新增 | **B-05**：`MemoryRepositoryPort` 空 kinds 语义不一致（fake 返回零条 vs Prisma 退化为无过滤） |

B-05 修正：`PrismaMemoryRepository.listMemory()` 在 `kinds.length === 0` 时先返回 `[]`（且不执行
`findMany`）；Port 与 `MemoryQuery.kinds` 文档显式写明三种语义；新增 3 个 adapter 测试（含
fake/Prisma parity）。Application 级 B-03 校验保持不变。

最终状态：Phase 6 = 🔄 **In Review — final correction complete, awaiting external confirmation**；
Phase 7 = **Not Started**。

### 非阻塞 Phase 7 交接说明（v2 审核方要求）

Phase 6 的保留键机制只保护 Domain 当前已知的 canonical 语义（`english_level` /
`explanation_language` 及归一化变体）。Phase 7 的 Agent / tool 设计**不得**用任意同义 Memory 键
绕过 canonical User State 所有权；修改 canonical 当前事实必须走 canonical profile/state 操作。
这是 Phase 7 的 tool-contract / guardrail 事项，不是在 Phase 6 构建语义本体。

### 待审核方确认的重点（执行者建议）

1. 记忆写入是否确实"显式且确定性"（无消息级自动写入；`kind` / `source` 闭集可审核）。
2. 读取是否确实有界（三层预算）且"无记忆时行为保真"（有 Phase 3 既有测试不改也通过作为证据）。
3. 身份策略是否满足分层约束（Domain 零 cookie/header/session 依赖；过渡默认用户如实标注）。
4. Prisma 变更是纯增量且**未**对生产库执行；既有表语义未变。
5. Trace 是否只记录元数据（无记忆内容 / profile 值 / 用户标识）。
6. prompt 注入处理（独立 user 消息 + 分隔标记 + 括号中和 + 单行化）是否足够。
7. 范围控制（一个参考集成、无新依赖、无新写路由、无 RAG / 认证 / 全库迁移）。

---

## 9. Phase 7 交接（Phase 6 已批准）

Phase 6 已通过外部最终审核（v3 Approved，Blocking Issues: None）。Phase 6 生产代码**不需要**进一步改动。
以下内容不得被 Phase 7 重新设计或绕过。

### 9.1 Phase 7 可以依赖的已批准资产

- `ExecutionContext.userId` 作为**权威**用户身份（Delivery/Composition 解析，Application 只消费）
- `UserRepositoryPort`（canonical profile 读写）
- `MemoryRepositoryPort`（按 `(userId, kind, key)` upsert 的有界选取）
- `GetUserContextUseCase`（有界读取；读失败优雅降级）
- `UpdateLearningProfileUseCase`（canonical State 的唯一写路径；写失败必须报错）
- `RememberUserFactUseCase`（**唯一** durable Memory 写入入口；显式且确定性）
- 有界确定性 Memory 选择（默认 5 / 硬上限 20；三层渲染预算）
- canonical State vs Memory 语义所有权（保留键机制）
- Assistant learner-context 集成（静态策略在 system 权威；内容为不可信 user 数据）
- Phase 5 Trace 基础设施（`TracePort` / `ExecutionContext` / `runInTrace` / `runInSpan`；metadata-first）

### 9.2 Phase 7 硬性 guardrails

| # | 规则 |
|---|------|
| A | Agent **不得**自行选择用户归属：Agent 动作只作用于当前 `ExecutionContext.userId` |
| B | 若 Agent 要修改 canonical 当前事实，**必须**走 canonical profile/state 操作；**不得**发明同义 Memory 键绕过所有权 |
| C | Agent 的 Memory 写入**必须**经过 `RememberUserFactUseCase`；**不得**直接写 `UserMemory` |
| D | Agent 的 Memory 读取**必须**遵守既有的有界选择契约（不扩大检索范围，`[]` = 零结果） |
| E | Phase 7 **不得**把原始 chat history 静默重新解释为 durable Memory |
| F | Learner Memory 提供给 LLM 时始终是**不可信数据**（内容不进 system 权威） |
| G | Phase 6 **不**提供语义 Memory 检索；RAG / embedding / 向量检索需要独立设计与授权 |

### 9.3 部署门禁（继续保持）

Phase 6 新增的 Prisma 迁移**不得**应用到生产，直到既有 Prisma 迁移链
（`prisma/migrations/20260609000001_baseline/migration.sql`，历史损坏文件）被独立验证/修复。
