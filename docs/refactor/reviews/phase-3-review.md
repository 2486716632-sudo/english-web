# Phase 3 审核记录 — 统一 AI Client + 首个纵向迁移

**审核对象:** Phase 3 实现（参考迁移 `POST /api/assistant`）
**审核方式:** 外部独立审核（审核包 `phase-3-review-pack-v1.zip`）

---

## v1 外部审核记录

**日期:** 2026-09-12
**审核包:** `phase-3-review-pack-v1.zip`

| 项目 | 结果 |
|------|------|
| **Review Status** | ❌ **Changes Requested** |
| **Phase 4 Release Decision** | ❌ **Not Approved yet** |
| 总体架构 | ✅ 原则性接受（in principle） |
| 阻断问题 | 3 项（见下） |

### 审核边界要求（本次修正必须遵守）

- 保持在 Phase 3，不进入 Phase 4
- 不迁移第二个 AI 调用
- 不修改无关业务逻辑
- 暂不提交（no commit）

### 阻断问题 1 — `/api/assistant` 的重试行为未被保持

迁移前 `/api/assistant` 只发起**一次** provider 请求。迁移后的 Application Use Case
未指定重试策略，因此继承统一 AI Client 默认的 `maxAttempts = 3`，
这会让原本直接失败的瞬时 429 / 5xx / 网络错误变成"自动重试后可能成功"——用户可见行为被改变。

**要求:** 保留统一 AI Client 的有界重试能力，但在 Phase 3 参考迁移中**显式关闭网络重试**
（`retry: { maxAttempts: 1 }` 或等价类型形式），并补充测试与文档。

### 阻断问题 2 — `chatStructured()` 未在整个逻辑调用中共享总预算

`chatStructured()` 为每次解析修复调用 `this.chat()`，而每次 `this.chat()` 都会**重新计算**
`totalBudgetMs` deadline。因此 `totalBudgetMs = 30_000` + `maxRepairAttempts = 1` 时，
理论上可消耗接近两个完整的 30 秒预算，违反 `totalBudgetMs` 表示"整个逻辑调用总预算"的契约。

**要求:** 整个结构化调用只建立一个 deadline；网络重试与解析修复共享同一份剩余预算；
后续每次 provider 尝试只获得剩余预算；预算耗尽后**不再发起任何请求**且归一化为 `timeout`；
不存在"新预算"路径。同时补充确定性测试（注入时间/假 adapter）与文档一致性。

### 阻断问题 3 — provider 返回畸形 JSON 的错误分类不正确

DeepSeek adapter 在 HTTP 200 但响应体无法解析为 provider JSON 时，
经 `normalizeUnknownAIError()` 归为 `unknown`，与归一化错误契约不符。

**要求:** 归为 `AIError('invalid_response', ...)`（`provider = deepseek`、`retryable = false`、
原始解析错误保留为 `cause`、不回显响应体、不视为网络失败）。

### 流程问题（非阻断）

当前 HEAD 仍早于已批准的 Phase 2 改动，工作区中同时存在 Phase 2 与 Phase 3 的改动。
**要求:** 不提交、不 reset、不 stash、不重建历史提交、不删除 Phase 2 文件；
仅在 Phase 3 交接文档中记录该过程问题，并说明"Phase 3 批准后、Phase 4 开始前必须建立干净的 Git 基线"。

---

## 修正记录（执行者提交，等待外部复审）

**修正日期:** 2026-09-12
**修正包:** `phase-3-review-pack-v2.zip`

### 阻断问题 1 修正

| 项 | 内容 |
|----|------|
| 改动 | `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` 新增 `ASSISTANT_AI_RETRY_POLICY = { maxAttempts: 1 }` 并在 `chat()` 请求中传入 `retry` |
| 统一层默认 | **未改动** — `AIClient` 默认仍为有界重试（`maxAttempts = 3`、指数退避 + jitter） |
| 新增测试 | `reply-to-assistant-query.use-case.test.ts`：断言 Use Case 显式请求 `maxAttempts = 1`；断言仅关闭重试、其余迁移前参数不变 |
| 既有测试 | `ai-client.test.ts` 继续证明默认有界重试（默认最多 3 次尝试、可重试失败后成功）与 `maxAttempts = 1` 时只发 1 次请求 |
| 文档 | `AI_CLIENT_DESIGN.md` §7、§13；`phase-3-handoff.md` 行为保持表 B16 |

### 阻断问题 2 修正

| 项 | 内容 |
|----|------|
| 改动 | `src/infrastructure/ai/ai-client.ts`：新增私有 `runChat(request, deadlineAt)`；`chat()` 与 `chatStructured()` 都在入口处**一次性**计算 `deadlineAt`；`chatStructured()` 在每次修复前检查剩余预算，耗尽即抛 `AIError('timeout')` 且不再发请求 |
| 语义 | 网络重试与解析修复共享同一 deadline；每次尝试的 `attemptTimeoutMs = min(timeoutMs, 剩余预算)`；不存在新预算路径 |
| 新增测试 | `ai-client.test.ts` 新增「chatStructured 单一总预算」：A 修复共享原始预算（修复请求只拿到剩余 30ms 而非 100ms）、B 预算耗尽不再发请求且归一化为 timeout、C 预算充足时重试+修复可成功、D 普通 `chat()` 重试行为不变 |
| 文档 | `AI_CLIENT_DESIGN.md` §6、§9；`DECISIONS.md` ADR-011 修正记录；`phase-3-handoff.md` |

### 阻断问题 3 修正

| 项 | 内容 |
|----|------|
| 改动 | `src/infrastructure/ai/adapters/deepseek.adapter.ts`：`response.json()` 抛错时改为抛 `AIError('invalid_response', ...)`（带 `status`、`provider`、`cause`），不再走 `normalizeUnknownAIError()` |
| 保持不变 | 空 `choices` 仍翻译为 `content = ''`（参考迁移的 `content \|\| ''` 行为未变）；HTTP 非 2xx 仍按状态码映射 |
| 新增测试 | `deepseek-adapter.test.ts`：HTTP 200 + 非 JSON 体、HTTP 200 + 空体 → `invalid_response`、`retryable = false`、`provider = deepseek`、`cause` 为原始解析错误、message 不回显响应体 |
| 文档 | `AI_CLIENT_DESIGN.md` §5、§8 |

### 流程问题修正

| 项 | 内容 |
|----|------|
| 改动 | `phase-3-handoff.md` 新增「Git 基线说明」段落，记录 Phase 2 与 Phase 3 改动共存于工作区的原因与后续要求 |
| 未做 | 未 commit / 未 reset / 未 stash / 未删除任何 Phase 2 文件 |

---

## 当前审核状态

| 项目 | 结果 |
|------|------|
| v1 外部审核 | ❌ Changes Requested（3 项阻断问题） |
| 修正状态 | ✅ 3 项阻断问题均已修正，并有对应测试与文档一致性更新 |
| 回归 | ✅ Phase 2 受保护基线保持不变并全绿；Phase 3 测试全绿（见 `phase-3-review-pack-v2.zip` 内 `validation-results.txt`） |
| **Review Status** | ✅ **Approved**（v2 外部复审，2026-09-13 — 见下方最终复审记录） |
| **Phase 4 Release Decision** | ✅ **Approved after Git baseline closeout** |

> ⚠️ 本文件由 **Phase 3 执行者**记录外部审核意见与自己的修正内容。
> 执行者**不**对 Phase 3 作出 Approved 结论；最终结论只能由外部审核方给出。

---

## v2 外部复审记录（最终）

**日期:** 2026-09-13
**审核对象:** 审核包 `phase-3-review-pack-v2.zip`（v1 → 修正 → v2 复审）
**审核方式:** 外部独立复审

| 项目 | 结果 |
|------|------|
| **Review Status** | ✅ **Approved** |
| **Blocking Issues** | ✅ **None** |
| **Phase 4 Release Decision** | ✅ **Approved after Git baseline closeout** |
| 是否还需要 Phase 3 技术改动 | ❌ 不需要（No further Phase 3 technical changes are required） |

### 最终证据（Final evidence）

| 证据项 | 结果 |
|--------|------|
| Vitest | ✅ **11 files / 184 tests passed** |
| Phase 2 受保护基线 | ✅ **95 tests preserved**（未删除、未跳过、未放宽） |
| Phase 3 tests | ✅ **89 tests** |
| TypeScript（`npx tsc --noEmit`） | ✅ passed |
| Build（`npx next build`） | ✅ passed |
| Phase 3 lint 范围 | ✅ **0 errors / 0 warnings** |
| `src/` 全量 lint | ⚠️ 35 errors / 36 warnings — 与历史基线完全相同（未引入新问题） |
| Smoke test（`tests/smoke/api-smoke.sh`） | ✅ **14 passed / 0 failed / 0 skipped** |
| 真实 AI / TTS 调用 | ✅ 无（No real AI/TTS calls） |
| AI 调用迁移数量 | ✅ 仅 1 个（`/api/assistant`；Only one AI call migrated） |
| v1 阻断问题 | ✅ 3 项全部 resolved |

### 复审结论

- v1 的 3 项阻断问题（参考迁移重试行为、`chatStructured()` 单一总预算、畸形 provider 响应分类）
  **全部已在 v2 修正并验证**。
- Phase 3 **正式通过外部复审**，统一 AI Client 成为已批准的 AI 基础设施基线。
- Phase 4 放行条件：**先完成 Git 基线收尾**（建立唯一一个包含已批准 Phase 2 + Phase 3 状态的基线提交）。
  本次行政收尾已完成该提交（见 `docs/refactor/handoffs/phase-3-handoff.md` 与 `PHASE_STATUS.md`）。

### 最终测试计数订正（行政收尾）

Phase 3 交接文档中原有 1 处过期计数（`6 个文件 / 82 个测试`）已订正为 `6 个文件 / 89 个测试`；
该订正**不涉及任何实现代码**，仅为文档一致性。
