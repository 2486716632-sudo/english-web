# Phase 5 审核记录 — Trace 与可观测性

**审核对象:** Phase 5 实现（应用级 Trace / 可观测性；参考目标 = Phase 3 `/api/assistant` + Phase 4 Reading 管线）
**审核方式:** 外部独立审核（审核包 `phase-5-review-pack-v1.zip`）
**审核状态:** ✅ **Approved**（v3 外部审核最终通过；Blocking Issues: None）

---

## 提交记录（执行者）

**日期:** 2026-09-13
**审核包:** `phase-5-review-pack-v1.zip`

| 项目 | 内容 |
|------|------|
| 交付范围 | Application `TracePort` + `ClockPort`、Application observability（ExecutionContext / 生命周期包装器 / AI 装饰器）、Infrastructure telemetry（sanitize / base recorder / in-memory / console）、time adapter、Composition Root、assistant 与 reading 两侧埋点、8 个新测试文件（99 tests）、4 份文档 |
| 未改动 | `prisma/schema.prisma`（无 Trace 表 / 无 migration）、Phase 3 AI Client 契约与实现、Phase 2/3 测试、`package.json`（无新依赖）、其它 Route 与 UI |
| 受保护基线 | Phase 2 95 ✅ / Phase 3 89 ✅ / Phase 4 108 ✅（合计 292，全部保留并通过） |
| 测试总数 | 27 files / **391 tests passed**（+99 Phase 5 测试） |
| tsc | 0 errors |
| build | ✅ 41 routes，33/33 静态页面，2 条既有警告 |
| lint | 新增/修改文件全部 0 errors 0 warnings；`eslint src/` 全量 = 既有历史 35 errors / 36 warnings（数量与 Phase 0/2 记录一致，问题文件中不含 Phase 5 文件） |
| 冒烟 | 14 passed / 0 failed / 0 skipped（等价端口；本环境无 bash/jq，说明见交接文档 §6） |
| 真实外部调用 | 无（未调用真实 DeepSeek / RSS / 写入型数据库操作） |
| 行为变化 | 业务行为无变化；两项有意增量：`X-Trace-Id` 响应头 + CLI 结构化 trace 输出 |

### 提交时状态

| 项目 | 结果 |
|------|------|
| Phase 5 状态 | 🔄 **In Review** |
| Phase 6 状态 | **Not Started** |
| Review Status | ⏳ **Awaiting external review** |
| Phase 6 Release Decision | ⏳ **Not Applicable**（Phase 5 未获批准前不得启动 Phase 6） |

### 审核边界要求（执行者自述，请审核方确认）

- 保持在 Phase 5；不进入 Phase 6；不实现 Memory / RAG / Agent
- 不为其它 feature / Route 加埋点
- 不修改 Prisma schema、不引入新依赖、不引入外部可观测性平台
- 不调用真实 AI / RSS / 写入型数据库操作
- 全程未 commit（等待审核结论后再做行政收尾）

---

## 外部审核记录

> 本节由外部审核方填写（或由执行者在收到审核意见后如实转录）。
> Phase 3/4 的既有格式为：v1 → 修正记录 → v2（…）→ 最终结论。

### 待审核方确认的重点（执行者建议）

1. Phase 3 AI Client 与 Phase 4 业务行为是否真的未被改变（事件流 / 日志分类 / 结果结构 / 持久化路径）。
2. 分层是否成立（TracePort 在 Application、Domain 零 trace 依赖、Infrastructure 只实现 Port）。
3. 生命周期不变式（root 不得在有存活后代时被终结为正常完成）是否已经在文档 / 实现 / 测试三处一致。
4. 状态语义（`ok` / `degraded` / `error`）是否合理、是否会造成误导。
5. Redaction 策略是否足够严格（含 `label.*` 两条防线）。
6. 是否存在被"伪造"的观测数据（provider 未暴露的 token / 无法拆分的 attempts / 生命周期违规下不伪造子 span 结束）。
7. 范围控制（两个参考目标、无新依赖、无 schema 变更）是否符合任务定义。

---

## v1 外部审核记录（Changes Requested）

**日期:** 2026-09-13
**审核包:** `phase-5-review-pack-v1.zip`

| 项目 | 结果 |
|------|------|
| **Review Status** | ❌ **Changes Requested** |
| **Phase 6 Release Decision** | ❌ **Not Approved yet** |
| 总体架构 | ✅ 原则性接受（TracePort 在 Application、Infrastructure 实现 Port、Domain 无 trace、显式 ExecutionContext、未重设计 Phase 3 AI Client、两个参考目标共用同一模型、计时可注入、391 tests 通过、Phase 2/3/4 受保护基线全绿） |
| 阻断问题 | 2 项（B-01 / B-02） |

### 审核边界要求（本次修正必须遵守）

- 不重设计可观测性架构；不进入 Phase 6；不新增 trace 持久化；不引入 OpenTelemetry 或外部 SaaS
- 不为其它 feature 加埋点；不调用真实 AI/RSS/数据库写入；暂不提交

### 阻断问题 B-01 — `label.*` 元数据 redaction 绕过

`TracedAIClient` 把 `AIChatRequest.metadata` 的**所有**条目复制为 `label.<key>`，
导致 `{ prompt: … }` → `label.prompt` → `normalizeMetadataKey()` = `labelprompt`，
整体精确匹配不再命中禁用键 `prompt`，内容型键（query / message / content / output / text /
userText / requestBody / responseBody / rawResponse 等）因此可以进入 trace，
违反"默认不记录 prompt / 模型输出 / 用户文本"的策略。

**要求:** 两层防御 —— (A) 在装饰器边界用**白名单**校验**原始**键（建议 `useCase` / `step` / `promptVersion`）；
(B) Infrastructure `sanitizeMetadata()` 仍须拒绝 `label.prompt` / `label.apiKey` 等**带前缀**的
内容/凭据键，同时不误伤安全键；补充 7 类测试；更新 `TRACE_DESIGN.md` 使文档与实现一致。

### 阻断问题 B-02 — 孤儿 span 生命周期契约不一致

任务要求"每个已开始的 trace/span 必须到达终态"，但 `BaseTraceRecorder` 允许
root 在有存活子 span 时被终结，并把该 trace 作为正常完成的 trace 归档（子 span `endedAt = null`），
文档、实现与测试三处描述互相矛盾。

**要求:** 选择并文档化**一个**明确不变式（建议："trace 不得在有存活子 span 时被终结为正常完成"）；
最小实现：root `end()` 时检测存活后代 → 拒绝（抛显式不变式错误）**或**以显式错误状态终结并记录违规；
不得伪造子 span 完成时间；不得让含 `endedAt = null` 子 span 的 trace 留在"已完成"集合中；
生产 `runInTrace()` / `runInSpan()` 仍须保证正常清理；补充 5 类测试；同步更新
TraceScope 注释、BaseTraceRecorder 注释、`TRACE_DESIGN.md` 生命周期章节与相关测试。

---

## 修正记录 v2（执行者提交，等待外部复审）

**修正日期:** 2026-09-13
**修正包:** `phase-5-review-pack-v2.zip`

### B-01 修正

| 项 | 内容 |
|----|------|
| (A) 源头白名单 | `src/application/observability/traced-ai-client.ts`：新增 `AI_TRACE_LABEL_ALLOWLIST = ['useCase','step','promptVersion']` 与 `resolveApprovedTraceLabel()`；只有**批准**的标签才被复制，且使用规范名（大小写不敏感）。未批准键在**加前缀之前**丢弃 |
| (B) 兜底清洗 | `src/infrastructure/telemetry/sanitize.ts`：新增 `metadataKeySegments()`，键名判定变为"整体精确匹配 + 高风险片段匹配 + **命名空间逐段匹配**"；`_`/`-` 视为词内字符以避免 `lookup_key` 被误拆成 `key` 造成误伤 |
| 测试 | `sanitize.test.ts` +34（命名空间禁用键 19 类、安全键不误伤、`label.*` 直接写入被丢弃）；`traced-ai-client.test.ts` +2（未批准标签 marker 不入 trace、大小写/命名空间变体不能绕过） |
| 文档 | `TRACE_DESIGN.md` §6.5（新增白名单规则与理由）、§11（三步键名判定 + 不误伤清单） |

### B-02 修正

| 项 | 内容 |
|----|------|
| 不变式 | **一个 trace 只有在没有存活后代 span 时，才可以被终结为"正常完成的 trace"。** |
| 实现 | `BaseTraceRecorder.endSpan()`：root 终结前检测存活后代；若有 → 强制 `status='error'`、写入 `error.code='lifecycle_violation'`（`operation: 'trace.lifecycle'`，message 含存活 span 数量与名称）、metadata `trace.lifecycleViolation=true` + `trace.openSpanCount=N`（原有错误码另存 `trace.priorErrorCode`）；**不**修改任何子 span 的 `endedAt`/`durationMs` |
| 归档 | `InMemoryTraceRecorder`：违规 trace 进入 `getLifecycleViolations()`，**不进入** `getTraces()`（`getTraces()` 只含全部 span 均已正常结束的 trace）；`ConsoleTraceRecorder`：输出独立的 `record: "trace.lifecycle_violation"` 行 |
| 选择理由 | 选择"显式错误状态"而非抛异常：`end()` 常在 `finally` / 错误处理中被调用，抛异常会替换真正的业务错误（把观测缺陷升级为行为缺陷）；显式状态同样不会被静默忽略 |
| 测试 | `in-memory-trace-recorder.test.ts` +3（直接子 span 存活、深层后代存活且报告有界名称列表、正常路径零违规）并在既有成功用例中断言无违规；`console-trace-recorder.test.ts` +1（独立 record 类型）；`trace-helpers.test.ts` / Reading / Assistant / Route trace 测试断言生产路径 `getLifecycleViolations() === []` |
| 文档 | `TRACE_DESIGN.md` §8 重写（单一不变式 + root 违规行为表 + 选择理由）、`ports/trace.ts` 生命周期注释、`BaseTraceRecorder` 类注释、`DECISIONS.md` ADR-013 第 4 条、任务文档 Part 12 修正记录 |

### 回归结果（修正后）

| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ 27 files / **431 tests passed**（Phase 2 95 + Phase 3 89 + Phase 4 108 + Phase 5 **139**） |
| 受保护基线 | ✅ Phase 2 / 3 / 4 全部保留通过 |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面，2 条既有警告） |
| ESLint（约定范围） | ✅ 0 errors / 0 warnings；`npx eslint src/` 全量 = 既有 35 errors / 36 warnings（无 Phase 5 文件） |
| HTTP 冒烟 | ✅ 14 passed / 0 failed / 0 skipped（等价端口，环境无 bash/jq） |
| 真实外部调用 | ✅ 无 |

---

## 当前审核状态（v2 提交后）

| 项目 | 结果 |
|------|------|
| v1 外部审核 | ❌ Changes Requested（B-01 / B-02）→ ✅ 已修正 |
| 修正后测试 | ✅ 27 files / **431 tests passed** |
| **Review Status** | ⏳ **Awaiting external re-review**（v2） |
| **Phase 6 Release Decision** | ⏳ **Not Approved**（等待外部复审） |

> 执行者**不**对 Phase 5 作出 Approved 结论。

---

## v2 外部审核记录（Changes Requested）

**日期:** 2026-09-13
**审核包:** `phase-5-review-pack-v2.zip`

| 项目 | 结果 |
|------|------|
| **Review Status** | ❌ **Changes Requested** |
| **Phase 6 Release Decision** | ❌ **Not Approved yet** |
| v1 B-01（`label.*` redaction 绕过） | ✅ **接受为已解决**（Application 白名单 + Infrastructure 命名空间清洗） |
| v1 B-02（孤儿 span 生命周期契约） | ✅ **接受为已解决**（显式 `lifecycle_violation` 并与正常完成分离） |
| v2 已接受证据 | 27 test files / 431 tests passed；Phase 2/3/4 受保护基线保留；tsc / build / Phase 5 lint 范围 / 冒烟（14/0/0）全部通过 |
| 新增阻断问题 | 2 项（B-03 / B-04） |

### 审核边界要求

- 不要重新设计已解决的两个区域（B-01 / B-02）；保持在 Phase 5；不进入 Phase 6
- 不新增 trace 持久化；不引入 OpenTelemetry 或外部可观测性服务；不为其它 feature 加埋点
- 不调用真实外部服务；暂不提交

### v2 阻断问题 B-03 — 终态 TraceState 未释放（进程内存增长）

`BaseTraceRecorder.startTrace()` 把 `TraceState` 放进 `this.states`，root 终结后**从不移除**。
`src/bootstrap/trace-composition.ts` 的 `getTraceRecorder()` 是 assistant 交付面的**进程级单例**，
因此每个已完成的请求都会永久保留 TraceRecord / spans / events / metadata / endedSpanIds，
在长驻服务中造成无界内存增长。

**要求:** 不重设计 Trace 模型；确立不变式"ACTIVE recorder state 只在 trace 执行期间保留"；
root 终态快照交付 adapter 后在 `finally` 中释放 state（正常完成与生命周期违规都不应要求永久保留）；
adapter 归档独立负责；释放后旧 scope 的晚到写入仍是 no-op；`InMemoryTraceRecorder.getTrace(id)`
仍能返回归档快照；违规快照仍保留"子 span `endedAt = null`"的证据；
重新审视并如实命名/注释 `openSpanCount()` / `traceCount()` 的语义（不得为保留内部 helper 而维持误导语义）；
补充 6 类测试。

### v2 阻断问题 B-04 — 遥测输出失败会逃逸到业务执行

`BaseTraceRecorder` 直接调用 adapter hook，`ConsoleTraceRecorder` 直接执行 `write`。
若输出 sink 抛错，异常会沿 `scope.end()` → `runInSpan` / `runInTrace` → Application / Route 传播，
可能把一次**成功的** Use Case 变成失败，或替换原本的业务错误 ——
违反 Phase 5 的核心要求"tracing 不得改变业务行为"。

**要求:** 在 recorder/adapter 边界集中实现 fail-open（不要在各调用方散落 try/catch）：
`onEventRecorded` / `onSpanEnded` / `onTraceEnded` 的输出失败不得逃逸；B-03 的状态释放仍必须发生；
不递归追踪遥测失败；不把 TraceRecord 内容作为 fallback 打印；不引入外部日志依赖；
用 `write: () => { throw new Error('telemetry sink unavailable') }` 写确定性测试（7 类）。

---

## 修正记录 v3（执行者提交，等待外部复审）

**修正日期:** 2026-09-13
**修正包:** `phase-5-review-pack-v3.zip`

### B-03 修正

| # | 修正 | 证据 |
|---|------|------|
| A | `BaseTraceRecorder.endSpan()` 的 root 终结路径改为固定顺序：**构建终态快照 → 交付 adapter → `finally` 释放 state**（`releaseState()`：从 `states` 移除 + 清空内部 record 的 spans / events / metadata / error 重引用） | `in-memory-trace-recorder.test.ts`：释放后归档快照仍可检索（`getTrace` / `getLastTrace` / `getTraces`）、连续 25 条 trace 零累积；`console-trace-recorder.test.ts`：完成后零 ACTIVE state、连续 20 条零累积 |
| B | 诊断语义如实重命名：`openSpanCount()` → **`activeSpanCount()`**，`traceCount()` → **`activeTraceCount()`**，并在类注释/方法注释中明确"仅表示 ACTIVE state"；新增 `emissionFailures()` 计数 | 全部调用点同步更新（trace-helpers / reading / assistant / route / recorder 测试）；生产路径断言 `activeTraceCount() === 0` |
| C | 晚到写入仍是 no-op：释放不清空 `endedSpanIds` / `closed`，因此 `end()` 仍幂等、旧 scope 写入仍被忽略 | 新增"释放后旧 scope 晚到写入是 no-op，且归档内容不受影响"测试（事件/元数据/状态均不变） |
| D | 违规 trace 同样释放 | 违规测试断言 `activeTraceCount() === 0`，同时快照保留 `endedAt = null` 的子 span 证据 |
| E | 文档/注释同步 | `TRACE_DESIGN.md` §6.4 / **§8.4**、`ports/trace.ts`、`BaseTraceRecorder`、两个 adapter 注释、`DECISIONS.md` ADR-013 第 11 条、任务文档 Part 12 + 验收项 13 |

### B-04 修正

| # | 修正 | 证据 |
|---|------|------|
| A | `BaseTraceRecorder` 新增中心化输出边界 `emitSafely()`：所有 adapter hook 均通过它调用；失败只 `emissionFailures += 1` 并继续，**不重抛、不递归追踪、不打印 trace 内容、不引入外部依赖** | 新增 `trace-emission-failure.test.ts`（6 tests）：`write` 永远抛错时 `recordEvent` / 子 span `end` / root `end` 都不抛错 |
| B | 业务结果不受影响 | 同文件：`runInTrace` / `runInSpan` 在输出失败下仍返回业务结果（`'business-ok'` / `'span-value'`） |
| C | 原始业务错误不被替换 | 同文件：业务回调抛 `BUSINESS_ERROR`（含"包装器收尾"与"自行 end 后抛错"两种路径）时，调用方收到的仍是 `BUSINESS_ERROR`，且消息不含 sink 错误 |
| D | 释放仍然发生 / 无 fallback 输出 | 同文件：输出失败后 `activeTraceCount() === 0`；`console.log` spy 证明 recorder 未打印任何 trace 内容 |
| E | 文档同步 | `TRACE_DESIGN.md` §6.4 / **§8.5**、两个 adapter 注释、`DECISIONS.md` ADR-013 第 12 条、任务文档 Part 12 + 验收项 14 |

### 回归结果（v3 修正后）

| 检查 | 结果 |
|------|------|
| `npx vitest run` | ✅ **28 files / 442 tests passed**（Phase 2 95 + Phase 3 89 + Phase 4 108 + Phase 5 **150**） |
| 受保护基线 | ✅ Phase 2 / 3 / 4 全部保留通过 |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过（41 routes，33/33 静态页面，2 条既有警告） |
| ESLint（约定范围） | ✅ 0 errors / 0 warnings；`npx eslint src/` 全量 = 既有 35 errors / 36 warnings（无 Phase 5 文件） |
| HTTP 冒烟 | ✅ 14 passed / 0 failed / 0 skipped |
| 真实外部调用 | ✅ 无 |

---

## 当前审核状态（v3 提交后）

| 项目 | 结果 |
|------|------|
| v1 外部审核 | ❌ Changes Requested（B-01 / B-02）→ ✅ 已解决并被v2 审核接受 |
| v2 外部审核 | ❌ Changes Requested（B-03 / B-04）→ ✅ 已修正 |
| 修正后测试 | ✅ 28 files / **442 tests passed** |
| **Review Status** | ✅ **Approved**（最终结论见下方 v3 外部审核记录） |
| **Phase 6 Release Decision** | ✅ **Approved**（行政收尾完成后） |

> 执行者**不**对 Phase 5 作出 Approved 结论。

---

## v3 外部审核记录（最终）

**日期:** 2026-09-13
**审核包:** `phase-5-review-pack-v3.zip`
**审核方式:** 外部独立复审

| 项目 | 结果 |
|------|------|
| **Review Status** | ✅ **Approved** |
| **Blocking Issues** | ✅ **None** |
| **Phase 6 Release Decision** | ✅ **Approved after administrative closeout** |
| 后续生产代码变更 | 不需要（"No further Phase 5 production-code changes are required"） |

### 阻断问题关闭情况（全部 resolved + accepted）

| # | 问题 | 状态 |
|---|------|------|
| B-01 | `label.*` 元数据 redaction 绕过 | ✅ resolved and accepted（Application 白名单 + Infrastructure 命名空间清洗） |
| B-02 | 孤儿 span 生命周期契约不一致 | ✅ resolved and accepted（显式 `lifecycle_violation`，与正常完成分离） |
| B-03 | 终态 TraceState 未释放（进程内存增长） | ✅ resolved and accepted（ACTIVE state 仅执行期间保留，终态后 `finally` 释放） |
| B-04 | 遥测输出失败可逃逸到业务执行 | ✅ resolved and accepted（中心化 `emitSafely()` fail-open 边界） |

### 审核方接受的最终证据

| 项 | 结果 |
|----|------|
| Vitest | ✅ 28 files / **442 tests passed** |
| Phase 2 受保护基线 | ✅ 95 passed |
| Phase 3 受保护基线 | ✅ 89 passed |
| Phase 4 受保护基线 | ✅ 108 passed |
| Phase 5 测试 | ✅ 150 passed |
| TypeScript | ✅ 0 errors |
| Build | ✅ passed |
| Phase 5 ESLint 范围 | ✅ 0 errors / 0 warnings |
| 全量 `src/` 历史 lint 基线 | ✅ 仍为 35 errors / 36 warnings，**无 Phase 5 回归** |
| HTTP 冒烟 | ✅ 14 passed / 0 failed / 0 skipped |
| 真实外部调用 | ✅ 无（未调用真实 DeepSeek / RSS / 可写数据库操作） |
| Prisma schema | ✅ 未修改 |
| 外部可观测性依赖 | ✅ 未新增 |

### 最终被接受的架构不变式（长期）

1. **Trace metadata 是 metadata-first**：敏感 / 内容型标签由 **Application 白名单** +
   **Infrastructure 清洗**双重阻断。
2. **一个 trace 在有存活后代 span 时不得被视为正常完成**；生命周期违规被**显式单独记录**。
3. **可变 ACTIVE TraceState 只在执行期间存在**；交付终态快照后由 `BaseTraceRecorder` 释放。
4. **可观测性是 fail-open 的**：遥测输出失败永不改变业务控制流，也不替换原始业务错误。
5. **Domain 保持无 Trace 依赖**。
6. **Phase 3 AI Client 保持完整**，通过 Application 装饰器被观测。
7. **Trace 持久化与外部可观测性平台仍然延后**。

### 非阻断的后续加固提示（审核方记录，非 Phase 5 阻断项）

| # | 提示 |
|---|------|
| A | `InMemoryTraceRecorder` 面向测试 / 检视用途，**不得**被当作长时间运行的生产 trace 存储（它会有意保留快照）。 |
| B | 若未来把 trace 持久化，应再次审查错误 message 策略，可能改为**显式的基于 code 的安全 message 映射**，而不是持久化任意 `Error.message` 文本。 |

### 行政收尾

| # | 项目 | 结果 |
|---|------|------|
| 1 | 临时审核 ZIP（v1 / v2 / v3）从仓库根目录删除 | ✅ 完成 |
| 2 | 评审期的打包 / 端口 / 证据临时产物（仓库外）清理 | ✅ 完成 |
| 3 | 建立唯一 Phase 5 基线提交 | ✅ `feat: establish application tracing and observability baseline` |
| 4 | Phase 5 状态 | ✅ **Completed / Approved** |
| 5 | Phase 6 状态 | ✅ **Ready / Not Started**（本会话不启动 Phase 6） |
