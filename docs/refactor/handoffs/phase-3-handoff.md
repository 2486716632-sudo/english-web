# Phase 3 交接文档 — 统一 AI Client + 首个纵向迁移

**日期:** 2026-09-12（v2 修正）／2026-09-13（行政收尾 + 审核通过）
**Phase 状态:** ✅ **Completed / Approved**（外部复审 v2：Review Status = Approved，Blocking Issues = None，2026-09-13）
**Phase 4 状态:** **Not Started**
**参考迁移:** `POST /api/assistant`
**审核记录:** `docs/refactor/reviews/phase-3-review.md`

> **版本轨迹：** 外部审核 v1 = Changes Requested（3 项阻断问题）→ v2 修正 → **v2 复审 = Approved**。
> 修正明细见 §5，审核通过与基线收尾见 §6。

---

## 1. 前置校验（Phase 3 开始前）

| 项 | 结果 |
|----|------|
| 分支 | `master` |
| HEAD | `8891b48aea361bd44bc7565decfbd2ef1b0fbe95` |
| `git status --short` | 仅 Phase 2 已批准产物（`PHASE_STATUS.md`、`package.json`、`package-lock.json` 修改 + Phase 2 新增文档/测试未跟踪） |
| `git diff --stat` | `PHASE_STATUS.md` / `package.json` / `package-lock.json`（均为 Phase 2 产物） |
| Phase 2 状态 | ✅ Completed / Approved（2026-07-29 外部审核通过） |
| Phase 3 状态 | Ready / Not Started → 本次启动 |
| Phase 2 基线 | ✅ `npx vitest run` → 5 files / 95 tests passed；`npx tsc --noEmit` → 0 errors；`npx eslint tests/`、`src/lib/__tests__/` → 0 errors |

> **说明：** 工作区中的未提交改动**全部**是 Phase 2 已批准产物（Phase 2 未提交即关闭）。未发现任何意外改动。

### Git 基线说明（v2 补充）

> Phase 2 approved changes and Phase 3 changes coexist in the working tree because Phase 2 was not
> committed before Phase 3 started. A clean Git baseline must be established after Phase 3 approval
> and before Phase 4 begins.

也就是说：当前 HEAD（`8891b48`）早于已批准的 Phase 2 改动，因此工作区中同时存在
Phase 2 与 Phase 3 的改动。这是**流程问题**，不是修改 Phase 2 产物的许可。

- 本阶段**未**执行 commit / reset / stash，**未**重建历史提交，**未**删除任何 Phase 2 文件。
- Phase 3 审核通过后、Phase 4 开始前，必须建立一个干净的 Git 基线（由用户/审核方决定如何落盘）。

---

## 2. 完成报告

### ① 选中的参考 AI 调用与理由

**`POST /api/assistant`**（`src/app/api/assistant/route.ts`）—— 完整候选对比见 `docs/refactor/tasks/phase-3-task.md` Part 2。

理由：未冻结；单步 AI 调用、纯文本输出、无多步 pipeline、不写数据库、不触碰 TTS/文件系统；
且 Phase 2 明确把它的 Route 级自动化测试推迟到 Phase 3（原因正是缺少可注入的 AI Client 接缝）。
被排除的候选：`coach`（严格冻结）、`scene/*`（场景系统冻结）、`words/*`（需用户授权）、
`reading/[id]/vocab`（DB 写入耦合过重）、`listening.ts` 与 CLI 脚本（依赖 DB/RSS/TTS/FS，风险或代表性不足）。

### ② 新建的文件

| 文件 | 行数 | 层次 |
|------|------|------|
| `src/application/ports/ai-client.ts` | 178 | Application（Port + 错误模型） |
| `src/application/ports/word-lookup.ts` | 24 | Application（Port） |
| `src/application/prompts/assistant/qa.prompt.ts` | 88 | Application（Prompt） |
| `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` | 78 | Application（Use Case） |
| `src/infrastructure/ai/ai-client.ts` | 191 | Infrastructure |
| `src/infrastructure/ai/errors.ts` | 47 | Infrastructure |
| `src/infrastructure/ai/retry.ts` | 93 | Infrastructure |
| `src/infrastructure/ai/structured-output.ts` | 97 | Infrastructure |
| `src/infrastructure/ai/adapters/types.ts` | 35 | Infrastructure |
| `src/infrastructure/ai/adapters/deepseek.adapter.ts` | 110 | Infrastructure |
| `src/infrastructure/db/word-lookup.ts` | 34 | Infrastructure |
| `src/bootstrap/index.ts` | 32 | Composition Root |
| `docs/refactor/tasks/phase-3-task.md` | — | 文档 |
| `docs/refactor/AI_CLIENT_DESIGN.md` | — | 文档 |
| `docs/refactor/handoffs/phase-3-handoff.md` | — | 文档（本文件） |

**新建测试（6 个文件，89 个测试）**

| 文件 | 测试数 |
|------|--------|
| `src/application/use-cases/assistant/__tests__/reply-to-assistant-query.use-case.test.ts` | 13 |
| `src/app/api/assistant/__tests__/route.test.ts` | 6 |
| `src/infrastructure/ai/__tests__/ai-client.test.ts` | 20 |
| `src/infrastructure/ai/__tests__/deepseek-adapter.test.ts` | 21 |
| `src/infrastructure/ai/__tests__/retry.test.ts` | 13 |
| `src/infrastructure/ai/__tests__/structured-output.test.ts` | 16 |

### ③ 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/app/api/assistant/route.ts` | 120 行 → 20 行；改为薄 Route（传输校验 → Use Case → 统一响应/错误映射） |
| `docs/refactor/PHASE_STATUS.md` | Phase 3 → In Progress → In Review；当前阶段段落更新 |
| `docs/refactor/DECISIONS.md` | 新增 ADR-011（统一 AI Client 契约）+ v2 修正记录 |
| `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` | v2：显式 `retry: { maxAttempts: 1 }`（阻断问题 1） |
| `src/infrastructure/ai/ai-client.ts` | v2：`chatStructured()` 单一 deadline（阻断问题 2） |
| `src/infrastructure/ai/adapters/deepseek.adapter.ts` | v2：HTTP 200 畸形响应体 → `invalid_response`（阻断问题 3） |
| `docs/refactor/AI_CLIENT_DESIGN.md` | v2：超时/重试/错误分类语义同步 |
| `docs/refactor/handoffs/phase-3-handoff.md` | 本文件（v2 修正记录 + Git 基线说明） |

**v2 新增文档**

| 文件 | 说明 |
|------|------|
| `docs/refactor/reviews/phase-3-review.md` | v1 外部审核记录（Changes Requested）+ 执行者修正记录（**不含** Approved 结论） |

> 未修改：`package.json` / `package-lock.json`（本阶段**未新增任何依赖**，Phase 2 的改动保持原样）、
> 其它 10 个 AI 调用点、任何冻结模块、`prisma/schema.prisma`、UI、SM-2。

### ④ AIClientPort 设计

`src/application/ports/ai-client.ts`（只有接口与类型，无实现）：

```ts
interface AIClientPort {
  chat(request: AIChatRequest): Promise<AIChatResult>
  chatStructured<T>(request, schema: AIStructuredSchema<T>, options?): Promise<AIStructuredResult<T>>
}
```

- provider-neutral 类型：`AIMessage` / `AIChatRequest` / `AICallMeta` / `AIStructuredSchema<T>`
- 请求参数含 `timeoutMs` / `totalBudgetMs` / `retry` / `metadata`（后两者不下发 provider）
- 归一化错误模型 `AIError`（8 个错误码 + `retryable` 标记）
- 附加最小 port：`WordLookupPort`（契约：不得抛异常，失败返回 `null`）

### ⑤ Infrastructure / Provider Adapter 设计

```
AIClient (ai-client.ts)                ← 超时、重试、结构化边界、metadata
   └─ AIProviderAdapter (adapters/types.ts)
        └─ DeepSeekAdapter (adapters/deepseek.adapter.ts)  ← HTTP、请求/响应翻译、错误映射
辅助模块：errors.ts（status → 错误码）、retry.ts（有界退避）、structured-output.ts（提取/校验/修复）
```

新增 provider 只需实现 `AIProviderAdapter` 并在 Composition Root 装配。

### ⑥ Composition Root 设计

`src/bootstrap/index.ts` — 唯一 import Infrastructure 具体实现的地方：

```
DeepSeekAdapter(env) → AIClient → PrismaWordLookup(prisma) → ReplyToAssistantQueryUseCase
   → getAssistantReplyUseCase()（进程内惰性单例，供 Route 调用）
```

手动装配，**未引入 DI 框架**。

### ⑦ 超时策略

- 单次尝试超时：`timeoutMs`，默认 30 000 ms（`AbortController` 强制）
- 整次调用总预算：`totalBudgetMs`，默认 30 000 ms
- 单次实际超时 = `min(timeoutMs, 剩余预算)`；预算耗尽 → `AIError('timeout')`，不再发起尝试
- 参考迁移显式传 30 000 / 30 000 → **用户可见等待上限与迁移前一致**
- 不存在无超时路径

### ⑧ 重试策略

| 类型 | 归属 | 默认上限 | 触发 |
|------|------|---------|------|
| 传输/网络重试 | `retry.ts` | `maxAttempts = 3` | timeout / rate_limited / provider_error / network_error |
| provider 重试 | 同一机制（provider 状态码是触发源之一） | 同上 | HTTP 429 / 5xx |
| 结构化输出解析修复 | `structured-output.ts` | `maxRepairAttempts = 1` | invalid_response |

退避：`min(4000, 500 × 2^(n-1)) ± 25% jitter`。**不重试**：`auth_error`、`invalid_request`、`unknown`。
终止条件：达到上限 / 不可重试 / 退避越过 deadline。**不存在无限重试路径**。

### ⑨ 错误模型

`timeout` / `rate_limited` / `provider_error` / `network_error`（可重试）、
`auth_error` / `invalid_request` / `invalid_response` / `unknown`（不可重试）。
错误文案保留 provider 原文（`DeepSeek HTTP 500: <body 前 200 字符>`），使迁移前后一致。

### ⑩ 结构化输出策略

`chatStructured()` = 提取（干净 JSON / markdown fence / 夹带文本 / `{}` 与 `[]` 根结构）
→ 调用方提供的 `AIStructuredSchema.validate` → 失败时按 `maxRepairAttempts` 有界修复。
校验失败抛 `AIError('invalid_response')`（不可重试）。Infrastructure 只做结构校验，业务合理性校验留给 Domain。
Phase 2 的 33 个 fixture 已全部通过生产提取器/校验边界的格式自测（离线契约测试本身未改动）。

### ⑪ 新增测试

6 个文件 / 89 个测试（见 ② 表），覆盖：成功响应、超时归一化、可重试失败、不可重试失败、
无效结构化响应、provider 请求/响应翻译与 9 种状态码映射、参考 Use Case（fake ports）、
以及被迁移 Route 的 6 个 Route 级用例（mock Composition Root）。

### ⑫ 完整测试结果

```
 Test Files  11 passed (11)
      Tests  184 passed (184)
```

（Phase 2 基线 5 files / 95 tests 全绿 + 新增 6 files / 89 tests）

### ⑬ TypeScript

`npx tsc --noEmit` → **0 errors**

### ⑭ Build

`npx next build` → ✅ 通过（Next.js 16.2.6 + Turbopack；41 routes 编译成功；33/33 静态页面）
警告：2 条 `public/listening/` 文件模式过宽警告 —— 与 Phase 2 基线完全相同，非本次引入。

### ⑮ ESLint

| 范围 | 结果 |
|------|------|
| `npx eslint src/application/ src/infrastructure/ src/bootstrap/ src/app/api/assistant/ tests/ src/lib/__tests__/` | ✅ 0 errors, 0 warnings |
| `npx eslint tests/` | ✅ 0 errors |
| `npx eslint src/lib/__tests__/` | ✅ 0 errors |
| `npx eslint src/application/ src/infrastructure/ src/bootstrap/ src/app/api/assistant/` | ✅ 0 errors, 0 warnings |
| `npx eslint src/`（v2 新增范围，含 Phase 0 历史问题） | ⚠️ 35 errors, 36 warnings —— **与 Phase 0/2 基线数值完全相同**（`src/` 现已包含全部新增 Phase 3 目录，说明 Phase 3 未引入任何新问题） |

### ⑯ 冒烟测试

`npx next dev -p 3456`（实际启动）+ `bash tests/smoke/api-smoke.sh`（jq 可用）：

```
Results: 14 passed, 0 failed, 0 skipped
```

与 Phase 2 基线一致。dev server 已关闭。

### ⑰ 是否调用真实 AI

**否。**

- 自动化测试全部使用 fake adapter / fake port / 注入的 `fetchImpl`，无网络调用
- 冒烟脚本显式跳过 `/api/assistant`（脚本内注明会调用真实 DeepSeek）
- 本阶段**未执行**任何真实 provider 冒烟测试（按任务要求：如需执行须先说明理由并获得用户明确批准）

### ⑱ 产品行为变化

| 项 | 结论 |
|----|------|
| `POST /api/assistant` 成功响应 `{ reply, wordData }` | 不变 |
| 传输校验 `400 No query provided` | 不变 |
| 词卡查询键推导 / 词卡字段 / 查询失败降级 | 不变 |
| Prompt 文本（含词卡注入段） | 逐字不变 |
| `model` / `max_tokens` / `temperature` / 无 `response_format` | 不变 |
| 30s 用户可见等待上限 | 不变 |
| 失败时 `200 { reply: "Sorry, I got an error: …" }` | 不变（含 HTTP 错误文案格式） |
| `console.error('[AI Assistant]', msg)` | 不变 |
| 畸形 JSON 请求体 → 500（既有输入校验技术债） | 保持不变，未顺手修复 |
| 未配置 API Key → provider 401 → 友好错误文案 | 保持不变（未新增 pre-flight 校验） |
| 网络重试次数（v2 修正） | **保持不变**：Use Case 显式 `retry: { maxAttempts: 1 }`，任何 429 / 5xx / 网络失败都只发起**一次** provider 请求，随后直接返回友好错误回复——与迁移前完全一致 |

**唯一差异（失败路径）**：超时/网络中断的错误文案由底层运行时文案（如
`This operation was aborted`）变为归一化文案（如 `AI request timed out after 30000ms (deepseek)`）。
这是引入归一化错误模型的直接结果，属可接受且有意的变化；未改变任何成功路径或状态码。

> v1 审核曾指出：迁移后的 Use Case 继承统一层默认重试（`maxAttempts = 3`），
> 会让原本失败的瞬时错误"重试后可能成功"，属于行为改变。v2 已按阻断问题 1 修正：
> **统一层默认能力保留，参考迁移显式退出重试**。

### ⑲ 延后的 AI 调用迁移

其余 **10 个**调用点保持原样（详见任务文档 Part 1 清单）：
`coach/route.ts`、`scene/generate`、`scene/recommend`、`words/themes/generate`、`words/ai-train`、
`reading/[id]/vocab`、`features/listening/lib/listening.ts`、`scripts/reading-push.ts`、
`prisma/seed.ts`、`scripts/translate-titles-raw.js`。

### ⑳ 已知风险与未决问题

| # | 风险 / 问题 | 说明 | 建议 |
|---|-------------|------|------|
| R1 | 仅一个调用点被迁移 | 抽象尚未在第二种调用形态（结构化输出、多步 pipeline）上验证 | Phase 4 通过 Reading Pipeline 验证 `chatStructured()` |
| R2 | `chatStructured()` 暂无生产调用方 | 只有测试覆盖 | 随 Phase 4 接入，避免成为死代码 |
| R3 | `PrismaWordLookup` 依赖 `src/lib/prisma.ts` | 过渡期依赖，未搬迁 | Phase 6 随 Infrastructure 归位 |
| R4 | 统一 30s 预算策略未在真实 provider 上做压力验证 | 无真实调用 | 需要时由用户批准一次真实冒烟 |
| R5 | 其余 10 个调用点仍无重试 / 部分仍无超时 | 属各自模块迁移范围 | 在各模块迁移时收敛 |
| R6 | `words/themes/generate` 完全没有超时 | 既存风险 | Phase 4 迁移时修复 |

### ㉑ `git diff --stat`

```
 docs/refactor/DECISIONS.md     |  57 +++
 docs/refactor/PHASE_STATUS.md  | 121 +++++-
 package-lock.json              | 951 ++++++++++++++++++++++++++++++++++++++++--
 package.json                   |   6 +-
 src/app/api/assistant/route.ts | 120 +-----
 5 files changed, 1090 insertions(+), 165 deletions(-)
```

> `package.json` / `package-lock.json` 的改动是 **Phase 2** 遗留（vitest 依赖），Phase 3 未再改动。
> 上面未列出未跟踪的新文件（`git diff` 不含 untracked）。

### ㉒ `git status --short`

```
 M docs/refactor/DECISIONS.md
 M docs/refactor/PHASE_STATUS.md
 M package-lock.json
 M package.json
 M src/app/api/assistant/route.ts
?? docs/refactor/AI_CLIENT_DESIGN.md
?? docs/refactor/EVALUATION_BASELINE.md
?? docs/refactor/TEST_STRATEGY.md
?? docs/refactor/handoffs/phase-2-handoff.md
?? docs/refactor/handoffs/phase-3-handoff.md
?? docs/refactor/reviews/phase-2-review.md
?? docs/refactor/reviews/phase-3-review.md
?? docs/refactor/tasks/phase-2-task.md
?? docs/refactor/tasks/phase-3-task.md
?? phase-2-review-pack-v3.zip
?? phase-3-review-pack-v1.zip
?? phase-3-review-pack-v2.zip
?? src/app/api/assistant/__tests__/
?? src/application/
?? src/bootstrap/
?? src/infrastructure/
?? src/lib/__tests__/
?? tests/
?? vitest.config.ts
```

（`?? docs/refactor/EVALUATION_BASELINE.md` … `?? vitest.config.ts` 等为 Phase 2 产物。）

启用 Git Bash 的 bash / jq 后执行的冒烟脚本未产生任何文件改动；
开发服务器在验证后已停止（端口 3456 已释放）。

**未执行任何 `git commit` / `git add`。**

### ㉓ Phase 3 当前状态

**In Review** —— 实现与回归验证完成，等待外部审核。
执行者**不**自行宣告 Completed / Approved。

### ㉔ Phase 4 状态

**Not Started**（未创建任何 Phase 4 交付物，未触碰 Reading Pipeline）。

### ㉕ 审核包（Review Pack）

| 项 | 值 |
|----|-----|
| 归档文件（提交时） | `phase-3-review-pack-v2.zip` — v2 外部复审使用的快照 |
| 归档文件（历史） | `phase-3-review-pack-v1.zip` — v1 外部审核使用的快照 |
| 包内说明 | `review-manifest.md` |
| 包内验证记录 | `validation-results.txt`（本次重新运行的原始输出） |
| 包内哈希校验 | `file-hash-verification.txt`（源文件 vs 包内副本） |
| 包内 Git 证据 | `git-status.txt`、`git-diff-stat.txt`、`git-diff-phase-3.patch` |

> v2 包已包含 `docs/refactor/reviews/phase-3-review.md`（v1 审核意见 + 执行者修正记录）。
> 本包**不含** `.env` 或任何凭据。
>
> **行政收尾（2026-09-13）：** 审核 ZIP 属于**临时审核产物**，已按要求从项目根目录删除
> （`phase-2-review-pack-v3.zip`、`phase-3-review-pack-v1.zip`、`phase-3-review-pack-v2.zip`），
> 不进入基线提交；对应 `tmp/` 暂存目录亦已清理。审核证据已完整保留在
> `docs/refactor/reviews/phase-3-review.md` 与本文档中。

---

## 3. 实现期间发现并记录（未修复）

| 项 | 说明 |
|----|------|
| Phase 0 的 AI 调用计数偏差 | 实际为 11 个调用点（Phase 0 记录 10），漏记 `scripts/translate-titles-raw.js`。已在任务文档 Part 1 记录 |
| `listening.ts` 端点缺少 `/v1` | `${DEEPSEEK_BASE_URL}/chat/completions`（其它调用点均带 `/v1`）。既存实现细节，未修改 |
| 4 个调用点无超时 | `words/themes/generate`、`listening.ts`、`scripts/reading-push.ts`、`scripts/translate-titles-raw.js` |
| 11 个调用点全部无重试 | 统一层是本阶段唯一引入重试的地方 |

---

## 4. 审核建议关注点

1. `src/app/api/assistant/route.ts` 的 20 行实现是否严格复现原行为（对照任务文档 §2.4 的 B1–B15）。
2. `AIClientPort` 是否满足"不承担业务编排"边界，`AIError` 是否足够小。
3. 双约束超时（`timeoutMs` + `totalBudgetMs`）是否被认可为长期契约（ADR-011）。
4. 解析修复与网络重试的分离是否满足 SO-003。
5. `chatStructured()` 在 Phase 3 无生产调用方（仅测试）是否可接受 —— 计划在 Phase 4 接入。

**v2 复审建议关注：**

6. 参考迁移是否确实只发一次 provider 请求（`retry: { maxAttempts: 1 }`），且统一层默认重试未被削弱。
7. `chatStructured()` 是否只有一个 deadline：修复请求只拿到剩余预算、预算耗尽后不发请求、失败归一化为 `timeout`。
8. HTTP 200 畸形响应体是否归为 `invalid_response`（不可重试、`cause` 保留解析错误、不回显响应体）。

---

## 5. v2 修正记录（针对外部审核 v1 的 3 项阻断问题）

| # | 阻断问题 | 修正 | 证据 |
|---|---------|------|------|
| 1 | 参考迁移继承默认 `maxAttempts = 3`，改变了"只发一次请求"的行为 | `reply-to-assistant-query.use-case.ts` 显式 `retry: { maxAttempts: 1 }`；统一层默认能力不变 | Use Case 测试断言 `retry === { maxAttempts: 1 }`；`ai-client` 测试保留默认 3 次重试与 `maxAttempts=1` 只发 1 次的用例 |
| 2 | `chatStructured()` 每次修复重置 `totalBudgetMs`，最坏约两倍预算 | `ai-client.ts` 引入单一 `deadlineAt` + `runChat(request, deadlineAt)`；修复前检查剩余预算，耗尽即抛 `timeout` 且不发请求 | 新增 4 个确定性测试（注入时钟）：A 修复只拿剩余预算、B 预算耗尽不发请求、C 预算充足可成功、D 普通 `chat()` 行为不变 |
| 3 | HTTP 200 畸形响应体被归为 `unknown` | `deepseek.adapter.ts` 改为 `AIError('invalid_response', …)`（`retryable = false`、`cause` 保留解析错误、不回显响应体） | `deepseek-adapter` 新增测试：非 JSON 体与空体均为 `invalid_response` + `retryable = false` + `provider = deepseek` |

**未改变的既有设计**（修正 1 特意保留）：统一 AI Client 的默认有界重试（`maxAttempts = 3`、
指数退避 + jitter）与超时双约束语义。

**文档同步：** `AI_CLIENT_DESIGN.md`（§5/§6.1/§7/§8/§9/§13/§15）、`DECISIONS.md` ADR-011 修正记录、
`docs/refactor/reviews/phase-3-review.md`（v1 审核记录 + 修正记录）。

**审核结论：** 执行者**不**作出 Approved 结论；Phase 3 保持 In Review，等待外部复审 v2。

---

## 6. 审核通过与 Git 基线收尾（2026-09-13）

### 最终审核结论

| 项目 | 结果 |
|------|------|
| **Review Status** | ✅ **Approved** |
| **Blocking Issues** | ✅ **None** |
| **Phase 4 Release Decision** | ✅ **Approved after Git baseline closeout** |
| 是否需要进一步 Phase 3 技术改动 | ❌ 不需要 |

### 已确立的基线（Baseline）

1. **统一 AI Client 是已批准的 AI 基础设施基线。**
   `AIClientPort`（Application）+ `AIClient` / `AIProviderAdapter` / `DeepSeekAdapter`（Infrastructure）
   + `src/bootstrap`（Composition Root）+ 归一化 `AIError` + 超时/重试/结构化输出边界，
   后续所有 AI 调用迁移都必须经由该层，不得在业务代码中直接 `fetch` provider。
2. **`/api/assistant` 是已批准的参考纵向迁移。**
   它是 `Route → Use Case → Port → Adapter → provider` 的可复制样板，含 Route 级自动化测试接缝。
   其行为约束为 B1–B16（含 v2 的"只发一次请求"）。
3. **Phase 4 必须复用现有测试资产：**
   - Phase 2 受保护基线（95 tests：SM-2 / utils / word-cache / 离线结构化输出契约 / 内容质量）
   - Phase 3 AI Client 测试（89 tests：client / retry / structured-output / adapter / use case / route）
   - `tests/smoke/api-smoke.sh` 端点可达性回归
   任何 Phase 4 改动都不得删除、跳过或放宽这些测试。
4. **Phase 4 的架构验证方向：** 在 **Reading Pipeline / structured-output workflow** 上验证该架构，
   即让 `chatStructured()` 获得第一个生产调用方（Reading 词汇/文章处理），并验证 Workflow 模式。
5. **Git 基线问题已在本次收尾中解决：** 建立**唯一一个**基线提交，包含已批准的 Phase 2 + Phase 3 状态
   （commit message：`feat: establish evaluation and unified AI client baseline`）。
   未重建历史提交、未 reset、未 stash。

### 行政收尾清单

| # | 项目 | 结果 |
|---|------|------|
| 1 | 订正过期的测试计数（`82` → `89`） | ✅ `docs/refactor/handoffs/phase-3-handoff.md` §⑪ |
| 2 | 记录最终外部复审结果 | ✅ `docs/refactor/reviews/phase-3-review.md`（保留 v1 Changes Requested 历史） |
| 3 | 更新阶段状态 | ✅ `docs/refactor/PHASE_STATUS.md`（Phase 3 = Completed / Approved；Phase 4 = Ready / Not Started） |
| 4 | 记录审核通过与基线说明 | ✅ 本节 |
| 5 | 删除临时审核 ZIP 与暂存目录 | ✅ 3 个 ZIP + `tmp/phase-3-review-pack-v1|v2/` |
| 6 | 提交前最终验证 | ✅ 184 tests / tsc 0 errors / build 通过 / 新范围 lint 0-0 / smoke 14-0-0 |
| 7 | 建立唯一基线提交 | ✅ `feat: establish evaluation and unified AI client baseline` |
| 8 | 提交后工作区状态 | ✅ clean |
