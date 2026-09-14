# Phase 6 审核记录 — 用户状态与记忆系统

**审核对象:** Phase 6 实现（持久化 User State + Memory；参考集成 = Phase 3 `/api/assistant`）
**审核方式:** 外部独立审核（审核包 `phase-6-review-pack-v1.zip`）
**审核状态:** ✅ **Approved**（v3 外部最终审核；Blocking Issues: None）
**Phase 7 Release Decision:** ✅ **Approved**（after administrative closeout）
**完整轨迹:** v1 Changes Requested → v2 Minor Changes Requested → **v3 Approved**

---

## 提交记录（执行者，v1）

**日期:** 2026-09-13
**审核包:** `phase-6-review-pack-v1.zip`

| 项目 | 内容 |
|------|------|
| 交付范围 | Domain user/memory 规则、Application ports + 三个 user use case + learner-context prompt、Infrastructure Prisma adapters、bootstrap identity/composition、assistant 参考集成、Prisma schema + 迁移、11 个新测试文件、文档 |
| 受保护基线 | Phase 2 95 / Phase 3 89 / Phase 4 108 / Phase 5 99（合计 391，全部保留并通过） |
| 测试总数（v1） | 39 files / 519 tests passed（+77 Phase 6 测试） |
| 真实外部调用 | 无（未调用真实 DeepSeek / RSS；未对生产库执行迁移或写入） |
| 行为变化 | 用户态基础设施为纯增量；assistant 在无 profile/memory 时保持迁移前行为 |

---

## 外部审核记录（v1）

> 本节由外部审核方结论如实转录。v1 结论：**Changes Requested / Phase 7 Not Approved**。

### Blocking Issues（v1）

#### B-01 — `ExecutionContext.userId` 必须是权威归属身份

`ExecutionContext.userId` 已引入，但 user-scoped Application Use Case 仍接受独立的
payload `userId`，因此概念上允许：

```
context.userId = "user-a"
input.userId   = "user-b"
→ Application 操作 user-b
```

要求：受用户归属约束的 Application 操作，权威归属身份只能是 `ExecutionContext.userId`；
payload 不得选择另一个用户；缺失时**显式失败**，不得在 Application 内回落默认用户
（过渡默认用户解析属于 Delivery / Composition 边界）。

#### B-02 — Canonical User State 与 Memory 不得拥有同一语义当前事实

同一个语义当前事实不能同时由 `UserProfile` 与 `UserMemory` 权威拥有。例如：

```
UserProfile.explanationLanguage = "zh"
UserMemory(kind="preference", key="explanation_language", content="prefers English explanations")
```

要求：`english_level` / `explanation_language` 等 canonical profile 语义键保留给 User State；
Memory 写入命中保留键 → `invalid_input`，不得持久化冲突记录。
`preference` kind 本身保持可用（非 canonical 偏好仍可写），explanation-language 偏好只能
通过 `UpdateLearningProfileUseCase` 更新。

#### B-03 — 非法 memoryKinds 过滤绝不能扩大为 select-all

`normalizeMemoryKinds(["invalid"]) → undefined` 与"有意省略"不可区分，而 `undefined`
表示无过滤 → 检索全部 kind。要求：非法收窄请求永不扩大读取范围；必须给出显式语义
（省略 = 有意不过滤；合法数组 = 过滤；混合 = 合法子集或 invalid；全非法 / 非数组 = 零结果或 invalid）。

#### B-04 — learner-context 权威分离必须更强

v1 正确地把 Memory **内容**排除在 system prompt 之外，但"learner context 是不可信数据"
这条**静态策略**与数据同处 user 消息权威。要求：静态处理策略位于 **system 权威**；
真实 profile/memory 内容仍留在 system 之外并有界；内容不得插值进 system；
**没有** learner context 时必须保持 Phase 6 之前的 system prompt 与消息结构逐字节不变；
不得声称这让 prompt injection 变得不可能（defense-in-depth）。

### Non-blocking Notes（v1）

#### A — Prisma 迁移链部署门禁

- `prisma/migrations/20260609000001_baseline/migration.sql` 在 Phase 6 之前就已是损坏的历史
  PowerShell/错误转储（非合法 SQL）。Phase 6 **不**修改它。
- Phase 6 新增迁移在单独看时合法，但**生产迁移部署被 BLOCKED**，直到历史迁移链被独立
  验证/修复；不得声称完整迁移链 deployment-ready。

#### B — 未来外部认证的身份映射

- 不得声称未来认证"只需要改 `identity.ts` 一个文件"。
- 外部 auth provider 的 subject identifier 可能需要映射到应用内部 `UserId`
  （内部 `UserId` 有归一化/字符集/长度约束）。正确表述：
  external identity → identity boundary → 可能的映射 → internal `UserId` → 现有 User State / Memory 架构。
- Phase 6 **不**实现认证。

---

## 修正记录（执行者，2026-09-14）

| # | 修正 | 落点 |
|---|------|------|
| B-01 | 受用户归属约束的用例（GetUserContext / UpdateLearningProfile / RememberUserFact）统一通过 `requireOwnershipUserId(context)` 解析权威归属；payload 类型移除 `userId`；Domain `validateNewMemoryInput(fields, ownerUserId)` 由 Application 注入可信身份；缺失/非法 → `invalid_input` | `src/application/use-cases/user/ownership.ts`（新增）、三个 use case、`src/domain/memory/{types,memory-rules}.ts` |
| B-02 | 新增保留键集合 `RESERVED_CANONICAL_MEMORY_KEYS`（`english_level` / `explanation_language` 及 camelCase 归一化变体）；命中 → `invalid_input`，不落库 | `src/domain/memory/memory-rules.ts`、`MEMORY_DESIGN.md` §11.1、ADR-014 |
| B-03 | `normalizeMemoryKinds` 改为返回结果对象：省略 = `undefined`（有意不过滤）；非数组 / 空 / 全非法 = `invalid_input`；混合 = 合法子集 | `src/domain/memory/memory-rules.ts`、`get-user-context.use-case.ts`、`MEMORY_DESIGN.md` §9 |
| B-04 | 静态策略 `LEARNER_CONTEXT_SYSTEM_POLICY` 仅在存在 learner context 时追加到 system；内容仍为独立 user 数据消息；无 context 时 system 逐字节不变 | `src/application/prompts/assistant/personal-context.prompt.ts`、`reply-to-assistant-query.use-case.ts`、`MEMORY_DESIGN.md` §12/§15.3 |
| Note A | 在设计与交接文档中显式记录生产迁移门禁 | `MEMORY_DESIGN.md` §16.1 |
| Note B | 记录 external identity → internal UserId 映射路径，撤回"只改一个文件"表述 | `MEMORY_DESIGN.md` §4.4、`identity.ts` 注释、ADR-014 |

### 修正后状态

| 项目 | 结果 |
|------|------|
| Phase 6 状态 | 🔄 **In Review — corrections complete, awaiting external re-review** |
| Phase 7 状态 | **Not Started**（未启动） |
| Review Status | ⏳ **Awaiting v2 external review** |
| 是否自行批准 | ❌ 否（执行者不作 Approved 结论） |
| 审核包 | `phase-6-review-pack-v2.zip` |

> v1 的 Changes Requested / Not Approved 历史保留在本文档中，不因修正而被覆盖。

---

## 外部审核记录（v2）

**日期:** 2026-09-14
**审核对象:** `phase-6-review-pack-v2.zip`
**结论:** 🟠 **Minor Changes Requested** / Phase 7 Release Decision: ❌ **Not Approved yet**

### v1 blocking issues —— 接受为已解决

| # | 结论 |
|---|------|
| B-01 `ExecutionContext.userId` 权威归属 | ✅ **accepted as resolved** |
| B-02 canonical User State vs Memory 语义所有权 | ✅ **accepted as resolved** |
| B-03 非法 memory selector 不再在 Application 边界扩大检索 | ✅ **accepted as resolved** |
| B-04 learner-context system/data 权威分离 | ✅ **accepted as resolved** |

> 审核方明确要求：**不要**重新设计这四个区域。

### v2 accepted validation evidence

- 40 test files / 541 tests passed
- Phase 2–5 protected baseline = 442 tests, all green
- Phase 6 tests = 99
- TypeScript = passed；Build = passed
- Phase 6 lint scopes = clean；full `src/` historical lint debt unchanged
- Prisma validate = passed；Prisma generate = passed
- smoke = 14 passed / 0 failed / 0 skipped
- 无真实 DeepSeek 调用；无真实 RSS 调用；无生产 DB 迁移/写入

### B-05 — MemoryRepositoryPort 空 kinds 语义不一致（v2 新增）

**问题：** B-03 的 Application 修复是正确的，但底层 Port 仍允许 `kinds?: readonly MemoryKind[]`，
因此 `kinds: []` 是合法类型输入，而两个实现语义不同：

- `FakeMemoryRepository`：`[]` → `.includes()` 匹配不到 → **0 条**
- `PrismaMemoryRepository`：`[]` → kindFilter = `{}` → **无 kind 过滤** → 可能返回全部 kind

**两个后果：** (1) fake 与生产实现违反 Port 语义一致性；
(2) 未来 Application 用例若误传 `[]`，可能扩大检索范围。

**要求的不变式（Port 级）：**

- `kinds === undefined` → **有意不做 kind 限制**
- `kinds.length > 0` → 限制到这些 kind
- `kinds.length === 0` → **返回零条**

显式空收窄**绝不**变成 select-all。Application 级 B-03 校验保持不变。

### v2 修正记录（2026-09-14）

| 项 | 修正 | 落点 |
|---|------|------|
| B-05 | `PrismaMemoryRepository.listMemory()` 在 `query.kinds?.length === 0` 时**先返回 `[]`**（同时避免无谓的 `findMany`） | `src/infrastructure/db/memory.repository.ts` |
| B-05 | `MemoryRepositoryPort` 与 `MemoryQuery.kinds` 文档显式写明三种语义 | `src/application/ports/memory-repository.ts`、`src/domain/memory/types.ts` |
| B-05 | 新增 3 个 adapter 测试：省略 kinds（无 kind 条件）、`[]`（返回 [] 且不调用 findMany）、fake/Prisma 空 kinds 语义一致 | `src/infrastructure/db/__tests__/memory.repository.test.ts` |

**未做：** 没有重新设计 B-01–B-04；没有引入通用 repository 重构。

### v2 后状态

| 项目 | 结果 |
|------|------|
| Phase 6 状态 | 🔄 **In Review — final correction complete, awaiting external confirmation** |
| Phase 7 状态 | **Not Started**（未启动） |
| Review Status | ⏳ **Awaiting external confirmation** |
| 是否自行批准 | ❌ 否（执行者不作 Approved 结论） |
| 审核包 | `phase-6-review-pack-v3.zip` |

### 非阻塞 Phase 7 交接说明（审核方要求记录）

Phase 6 的保留键机制只保护 Domain **当前已知**的 canonical 语义
（`english_level` / `explanation_language` 及归一化变体）。Phase 7 的 Agent / tool 设计
**不得**用任意同义 Memory 键绕过 canonical User State 所有权：若 Agent 想修改 canonical 当前事实，
必须调用 canonical profile/state 操作，而不是发明一个同义的 Memory 键。
这是 Phase 7 的 tool-contract / guardrail 事项，**不是**要求在 Phase 6 构建语义本体（ontology）。

---

## 外部审核记录（v3）— 最终

**日期:** 2026-09-14
**审核对象:** `phase-6-review-pack-v3.zip`
**结论:**

| 项目 | 结果 |
|------|------|
| Review Status | ✅ **Approved** |
| Blocking Issues | **None** |
| Phase 7 Release Decision | ✅ **Approved**（after administrative closeout） |
| 进一步的 Phase 6 生产代码改动 | **不需要** |

审核轨迹：v1 **Changes Requested** → v2 **Minor Changes Requested** → v3 **Approved**（完整历史保留于本文档）。

### Blocking issues —— 全部 resolved and accepted

- **B-01** `ExecutionContext.userId` 权威归属 —— resolved and accepted
- **B-02** canonical User State vs Memory 语义所有权 —— resolved and accepted
- **B-03** 非法 Memory 过滤不再扩大检索 —— resolved and accepted
- **B-04** learner-context 权威分离 —— resolved and accepted
- **B-05** `MemoryRepositoryPort` 空 kinds 语义 —— resolved and accepted

### v3 accepted final evidence

- Vitest：40 files / **544 tests passed**
- Phase 2–5 受保护基线：**442 tests**，全绿
- Phase 6 tests：**102**
- TypeScript：0 errors；Build：passed
- Phase 6 lint scopes：0 errors / 0 warnings；`src/` 历史基线保持 35 errors / 36 warnings，无 Phase 6 回归
- Prisma validate：passed；Prisma generate：passed
- HTTP smoke：14 passed / 0 failed / 0 skipped
- 无真实 DeepSeek 调用；无真实 RSS 调用；无生产 DB 迁移；无生产 DB 写入
- 构建期对 Google Fonts 的普通网络访问**不**归类为 AI/RSS/DB 外部服务调用

### 最终 Phase 6 不变式（审核方认定）

1. `ExecutionContext.userId` 是 user-scoped Application 操作的**权威归属身份**。
2. canonical 当前事实在 User State 中**只有一个权威归属**；获批的 Memory 写入路径不得复制
   canonical 语义（例如 `english_level`、`explanation_language`）。
3. Memory 选择是有界的；**非法收窄永不扩大检索范围**。
4. `MemoryRepositoryPort` 语义：`kinds === undefined` → 不限制；`kinds` 非空 → 限制到这些 kind；
   `kinds` 为空数组 → **零结果**。
5. durable Memory 写入保持**显式且确定性**；原始 chat/model 历史**不会**自动成为 Memory。
6. learner-context 内容是**不可信数据**；静态处理策略可位于 system 权威，
   但 Profile/Memory **内容本身**保持在 system 权威之外。
7. 无 learner-context 时 Assistant 行为与获批的 Phase 6 之前行为保持兼容。
8. Trace 保持 metadata-first，不含 Memory 内容、profile 值、原始用户文本或 `userId`。
9. 完整认证、Agent 驱动的记忆写入、语义检索、embedding、向量库与 RAG 仍然**延后**。
10. Phase 6 Prisma 迁移的**生产部署仍为 BLOCKED**，直到既有损坏的迁移历史被独立验证/修复。

### 最终状态

| 项目 | 结果 |
|------|------|
| Phase 6 | ✅ **Completed / Approved**（2026-09-14） |
| Phase 7 | **Ready / Not Started**（等待用户明确批准后启动） |
| 执行者自批 | ❌ 否（由外部审核批准） |
