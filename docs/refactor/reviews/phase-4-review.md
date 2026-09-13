# Phase 4 审核记录 — Reading Content Pipeline 样板

**审核对象:** Phase 4 实现（Reading 内容摄取管线迁移）
**审核方式:** 外部独立审核（审核包 `phase-4-review-pack-v1.zip`）

---

## v1 外部审核记录

**日期:** 2026-09-13
**审核包:** `phase-4-review-pack-v1.zip`

| 项目 | 结果 |
|------|------|
| **Review Status** | ❌ **Changes Requested** |
| **Phase 5 Release Decision** | ❌ **Not Approved yet** |
| 总体架构 | ✅ 原则性接受（Delivery → Use Case → Workflow → Ports → Infrastructure 分解正确；Phase 3 AI Client 复用正确；受保护基线全绿） |
| 阻断问题 | 3 项（见下） |

### 审核边界要求（本次修正必须遵守）

- 保持在 Phase 4；不进入 Phase 5；不迁移第二条管线
- 不调用真实 AI/TTS；不修改 Prisma schema
- 暂不提交（no commit）

### 阻断问题 1 — 结构化输出的行为保持不完整

生产 validator 比旧管线更严格，且 C3 的描述不足以覆盖由此产生的行为变化。
旧管线是**逐字段兜底**（缺失 `vocabItems` → `[]` 且保留标题摘要；缺失 `titleZh`/`summaryZh` → `''` 且保留其余字段），
而 v1 的严格校验会让整包失败并丢弃**全部** AI 字段（降级为 `EMPTY_AI_RESULT`）——比 C3 描述的变化更大。
另外，旧实现中"非法嵌套词汇条目 / truthy 但类型不兼容的字段"会在写库阶段失败（该条 failed、不入库），
而 v1 把它们变成了"成功但降级"的文章。

**要求:** 恢复旧语义（逐字段兜底）；原始负载与归一化 Reading 数据分别建模；
不可安全恢复的数据不得静默变成降级成功；不得削弱 Phase 3 通用 AI Client；改动限于 Reading 管线；
补充 A–F 六类 characterization 测试。

### 阻断问题 2 — 原始/归一化类型不一致

`ReadingVocabItem.type` 声明为 `string`，但 `isValidVocabItem()` 允许 `type` 为 `undefined`
（依赖后续 `item.type || 'word'` 兜底）——类型守卫对"它声称保证的类型"不成立。

**要求:** 让类型模型真实：区分原始 AI 词汇条目形状与归一化形状，
或把原始形状的 `type` 设为可选并在归一化时补成具体字符串；不得用不安全类型断言绕过。补充测试。

### 阻断问题 3 — `persistence_failed` 不是真实契约

代码与文档都定义了 `ApplicationError('persistence_failed')`，但**没有任何生产路径产生它**：
运行级仓储失败（去重查询 / 统计 / 取最旧 / 删除）经由 Use Case 包装成了 `unexpected`。

**要求:** 让实现与文档一致——运行级仓储失败 → `persistence_failed`；
单条 `createArticle()` 失败仍隔离为该条失败，**不得**升级为整轮失败。补充测试。

### 其他要求

| # | 要求 |
|---|------|
| 4 | 准确记录剩余的有意行为变更：接受 C1 / C2 / C4；C3 需修正/准确描述；配置校验（`maxPerRun` 等）要么保留旧 CLI 宽松行为，要么作为 **C5** 显式记录；不得再声称操作员错误文案逐字节一致 |
| 5 | 只修正 `DECISIONS.md` ADR-011 中"Phase 3 等待外部审核"的过期状态措辞（Phase 3 已 Approved）；不要改写历史决策；ADR-012 保持"等待 Phase 4 外部审核" |
| 6 | 建议补充 `RssFeedSource` 单元测试（映射 + 失败传播），不新增依赖、不访问网络 |

---

## 修正记录（执行者提交，等待外部复审）

**修正日期:** 2026-09-13
**修正包:** `phase-4-review-pack-v2.zip`

### 阻断问题 1 修正

| 项 | 内容 |
|----|------|
| 改动 | `domain/reading/ai-response-rules.ts` 重写为 `normalizeArticleProcessingPayload()`（纯函数）：恢复逐字段兜底；把"旧实现会在写库阶段失败"的负载判定为 `ok: false`；先 `slice(0, 10)` 再校验 |
| Workflow | AI 步骤改为三态：`ok`（正常）/ `degraded`（请求失败或响应不可解析为 JSON，文章仍入库）/ `failed`（负载不可安全恢复 → 该条 failed、不入库，循环继续） |
| Schema | `articleProcessingPayloadSchema`（只表达"已成功解析出 JSON"），JSON 提取仍由 Phase 3 `chatStructured()` 完成；Phase 3 AI Client 未修改 |
| 测试 | `ai-response-rules.test.ts` 重写为 A–F characterization 测试，并在测试内**复刻旧实现**（`legacyNormalize`）逐条对照；Workflow 增加缺失 titleZh / 缺失 vocabItems / 非法嵌套条目（失败而非降级）三类测试 |
| 文档 | CONTENT_PIPELINE_DESIGN §5（三段职责 + 原始/归一化模型 + A–F 对照表）、任务文档 B21–B23 与 C3/C6、ADR-012 第 4/6/7 条 |

### 阻断问题 2 修正

| 项 | 内容 |
|----|------|
| 改动 | 类型模型区分 `RawReadingVocabItem`（`type?: string`）与 `ReadingVocabItem`（`type: string`）；归一化负责 `type || 'word'` |
| 测试 | 新增：原始条目可省略 `type`；falsy `type` → `'word'`；归一化结果满足声明类型（编译期赋值断言 + 运行时 `typeof` 检查），**无任何类型断言** |

### 阻断问题 3 修正

| 项 | 内容 |
|----|------|
| 改动 | Workflow 新增 `withPersistence()`：`listExistingUrls` / `listExistingTitles` / `countArticles` / `findOldestArticleIds` / `deleteArticlesWithVocab` 失败 → `ApplicationError('persistence_failed')`（保留原 message 与 cause） |
| 保持不变 | 单条 `createArticle()` 失败仍隔离为该条失败，不中止整轮、不标记为 `persistence_failed` |
| 测试 | 新增 6 个测试：去重查询（urls / titles）、统计、取最旧、删除失败 → `persistence_failed`；`createArticle` 失败 → 仅该条失败且整轮完成 |
| 文档 | CONTENT_PIPELINE_DESIGN §7 错误传播表更新 |

### 其他要求修正

| # | 内容 |
|---|------|
| 4 | C 清单更新为 C1–C6（C1/C2/C4 已获审核接受；C3 改为"失败时机提前、结果不变"；新增 C5 配置校验快速失败、C6 `null` 负载边界）；并修正"日志文案逐字节一致"的措辞为"日志分类与控制流一致，底层错误文案可能因归一化而不同" |
| 5 | `DECISIONS.md` ADR-011 状态改为"Phase 3 已于 2026-09-13 通过外部复审（Approved）"；ADR-012 保持"等待 Phase 4 外部审核" |
| 6 | 新增 `src/infrastructure/rss/__tests__/rss-feed-source.test.ts`（注入 parser stub：字段映射、缺失字段、空 feed、失败传播），不访问网络、不新增依赖 |

---

## 当前审核状态

| 项目 | 结果 |
|------|------|
| v1 外部审核 | ❌ Changes Requested（3 项阻断问题） |
| 修正状态 | ✅ 3 项阻断问题均已修正，含 characterization 测试与文档同步 |
| 审核方已接受的变更 | ✅ C1（有界超时）、C2（fence 可解析）、C4（不启用重试/修复） |
| 待确认的变更 | ⏳ C3（失败时机）、C5（配置校验快速失败）—— 最终结论见下方 v3 记录（C6 已归类为行为保持） |
| **Review Status** | ✅ **Approved**（最终结论见下方 v3 外部审核记录） |
| **Phase 5 Release Decision** | ✅ **Approved after administrative closeout** |

> ⚠️ 本文件由 **Phase 4 执行者**记录外部审核意见与自己的修正内容。
> 执行者**不**对 Phase 4 作出 Approved 结论；最终结论只能由外部审核方给出。

---

## v2 外部审核记录

**日期:** 2026-09-13
**审核包:** `phase-4-review-pack-v2.zip`

| 项目 | 结果 |
|------|------|
| **Review Status** | ❌ **Minor Changes Requested** |
| **Phase 5 Release Decision** | ❌ **Not Approved yet** |
| v1 的 3 项阻断问题 | ✅ 已正确解决（审核方确认） |
| 新增要求 | 3 项小修正（见下） |

### 审核边界要求

- 不重新设计管线；不迁移第二条管线；不改动 Phase 3 AI Client 架构
- 不进入 Phase 5；不调用真实 AI/TTS/数据库/网络
- 暂不提交

### 小修正 1 — 剩余的 falsy 兜底语义

旧实现映射为 `type: v.type || 'word'`、`partOfSpeech: v.partOfSpeech || null`，
因此 `undefined` / `""` / `null` / `false` / `0` 都走兜底。
v2 的 `normalizeVocabItem()` 对"非 undefined 的非字符串"一律失败，改变了 `null` / `false` / `0` 的旧行为。

**要求:** 精确复现 `||` 语义（falsy → 兜底；truthy 非字符串仍失败），并补充 12 类对照测试；
不得放宽 `word` / `definition` / `contextSentence` 的校验。

### 小修正 2 — 归一化边界不应包含类型断言

`normalizeVocabItem()` 使用了 `item.word as string`、`(item.type || 'word') as string`、
`item.partOfSpeech as string | undefined` 等断言，而文档声称"无类型断言"。

**要求:** 用局部变量 + 控制流收窄重写，使实现与文档一致；不得为满足 TypeScript 引入不安全断言。

### 小修正 3 — C6 必须用真实 Phase 3 边界验证

C6 文档声称"provider content 为 JSON `null` → Phase 3 提取边界视为未提取 → `chatStructured()` 抛
`invalid_response` → 降级"。但工作流测试使用 `FakeAIClient`，绕过了真实 Phase 3 实现。

**要求:** 用**真实** `AIClient` / `chatStructured()` + 内存假 provider（无网络）证明实际行为；
若实际为 `data: null`，则改为如实更新 C6 文档。不得为迁就文档而修改 Phase 3 实现。

---

## 修正记录 v3（执行者提交，等待外部复审）

**修正日期:** 2026-09-13
**修正包:** `phase-4-review-pack-v3.zip`

| # | 修正 | 证据 |
|---|------|------|
| 1 | `normalizeVocabItem()` 对 `type` / `partOfSpeech` 改为"falsy → 兜底（`'word'` / `null`）、truthy 非字符串 → 失败"，与旧实现 `\|\|` 完全一致 | `ai-response-rules.test.ts` 新增 20 个对照测试（每个字段各 5 个 falsy 值 + 4 个 truthy 非字符串 + 字符串保留 + 必填字段未放宽） |
| 2 | 重写为局部变量 + 控制流收窄；把 `asPlainRecord`（含 `as Record`）改为类型守卫 `isPlainRecord(value): value is Record<string, unknown>` | 该文件已无任何 `as` 断言（`rg ' as '` 为空），`tsc --noEmit` 通过 |
| 3 | 新增 `reading-pipeline.structured-output-boundary.test.ts`：真实 `AIClient` + 内存假 provider 返回 `"null"` | 实测：`chatStructured()` 抛 `AIError('invalid_response')`（`retryable = false`，仅 1 次 provider 请求）；Workflow 端到端 **降级**（`pushed: 1, degraded: 1, failed: 0`），文章入库、`titleZh = null`、摘要回退为 excerpt ⇒ **C6 文档成立，实现未改动**。另有正常对象负载的对照用例证明链路有效 |

**文档同步：** `CONTENT_PIPELINE_DESIGN.md` §5.2/§5.3（falsy 规则表 + C6 验证）、
`phase-4-task.md`（B24 + C6 验证说明）、`DECISIONS.md` ADR-012 第 4 条（falsy 兜底与"控制流收窄而非断言"）、
`phase-4-handoff.md`（v3 修正记录与测试计数）。

---

## 当前审核状态（v3 提交后）

| 项目 | 结果 |
|------|------|
| v1 外部审核 | ❌ Changes Requested（3 项阻断问题）→ ✅ 已解决 |
| v2 外部审核 | ❌ Minor Changes Requested（3 项小修正）→ ✅ 已修正 |
| 修正后测试 | ✅ 19 files / **292 tests passed**（Phase 2 95 + Phase 3 89 + Phase 4 108；含 C6/C7 对照 4 个） |
| **Review Status** | ⏳ **Awaiting external re-review**（v3） |
| **Phase 5 Release Decision** | ⏳ **Not Approved**（等待外部复审） |

> 执行者**不**对 Phase 4 作出 Approved 结论。

---

## v3 外部审核记录（最终）

**日期:** 2026-09-13
**审核包:** `phase-4-review-pack-v3.zip`
**审核方式:** 外部独立复审

| 项目 | 结果 |
|------|------|
| 技术实现审核 | ✅ **Accepted**（架构 / 生产实现 / v1 阻断问题 / v2 小修正 / 288 测试基线） |
| 剩余要求 | 1 项 characterization/documentation 更正（C6 重新归类 + C7 记录 + 测试措辞） |
| **Review Status（更正后）** | ✅ **Approved** |
| **Blocking Issues** | ✅ **None after this correction** |
| **Phase 5 Release Decision** | ✅ **Approved after administrative closeout** |

### 更正 1 — C6 重新归类为"行为保持"

审核方指出：旧实现的**内层** `processWithDeepSeek` 在 JSON `null` 上确实抛 TypeError，
但该异常被调用方的**外层 AI try/catch** 转成空结果，**文章仍然入库**（旧代码同时把操作员日志
放在同一个 try 内）。因此：

```
旧：JSON null → 内层抛错 → 外层 catch → 空结果 → 文章入库
新：JSON null → invalid_response → Workflow 降级 → 空结果 → 文章入库
```

两者最终结果一致 ⇒ **C6 是行为保持，不是有意变更**。已从变更清单移出。
真实 `AIClient` 验证测试保留，结论更新为"真实 Phase 3 结构化输出路径保持了旧管线的最终结果"。

### 更正 2 — 新增 C7（畸形 truthy 非字符串 `titleZh`）

旧实现中 `titleZh` 为 number / boolean / plain object 时，`processWithDeepSeek` 原样返回该值，
随后**操作员日志**的 `dsResult.titleZh.slice(0, 30)` 抛 TypeError → 被外层 catch 降级（文章入库）。
新实现在归一化边界确定性地判为失败（该条 failed、不入库）。外部审核**接受**该变更
（理由：旧结果依赖日志副作用，不应固化为领域行为；影响面仅限畸形 AI 负载）。
数组为特例（`Array.prototype.slice` 存在 → 旧实现走到写库才失败），新实现同样失败，结果一致。

### 更正 3 — characterization 测试措辞

区分"内层归一化抛错"与"整条旧链路的最终结果"，并补充旧外层 catch 结果的小型对照测试
（root `null` → 降级/入库；畸形 truthy 非字符串 `titleZh` → 由日志副作用导致的降级）。
生产行为未因此改变。

### 最终行为变更清单（审核接受）

| # | 变更 | 状态 |
|---|------|------|
| C1 | AI 请求现在有界超时 | ✅ 接受 |
| C2 | markdown-fence 包裹的 JSON 现在可被解析 | ✅ 接受 |
| C3 | 畸形负载的失败时机可能提前，但最终"该条 failed"结果保持 | ✅ 接受 |
| C4 | 网络重试（`maxAttempts=1`）与解析修复（`maxRepairAttempts=0`）显式保持关闭 | ✅ 接受 |
| C5 | 非法运行配置快速失败（`invalid_input`） | ✅ 接受 |
| C7 | 畸形 truthy 非字符串 `titleZh` 确定性判失败，不再依赖旧日志副作用的降级 | ✅ 接受 |
| **C6** | **根为 JSON `null` —— 行为保持（非变更）** | ✅ 已归类为 behavior preserved |

### 行政收尾

| 项 | 结果 |
|----|------|
| 临时审核 ZIP（v1/v2/v3） | ✅ 已从仓库根目录删除 |
| Phase 4 状态 | ✅ Completed / Approved |
| Phase 5 状态 | ✅ Ready / Not Started |
| 基线提交 | ✅ `feat: establish reading content pipeline architecture` |

> 本文件至此记录了 Phase 4 的完整审核轨迹：v1 Changes Requested → v2 Minor Changes Requested
> → v3 Accepted / Approved（含 C6 更正与 C7 记录）。
