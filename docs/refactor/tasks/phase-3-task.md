# Phase 3 任务定义 — 统一 AI Client + 首个纵向迁移

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 3 |
| **名称** | 统一 AI Client + 首个纵向 Use Case |
| **状态** | In Progress |
| **前置条件** | Phase 0/1/2 已完成并通过外部审核 ✅；Phase 2 评估基线已冻结为 protected baseline ✅；Git 基线 HEAD `8891b48`（分支 `master`） |
| **开始日期** | 2026-09-12 |
| **参考迁移目标** | `POST /api/assistant`（见 Part 2） |

---

## 目标

实现项目**第一层统一 AI 基础设施**，并通过**唯一一条**受控的纵向迁移证明该架构可用。

本阶段的目标**不是**迁移项目中所有 AI 调用，而是建立一个可靠的参考实现：

```
Route / UI
  → Application Use Case
  → AIClientPort（接口，定义在 Application 层）
  → Infrastructure AI Client
  → Provider Adapter (DeepSeek)
  → external model provider
```

并在整个过程中**保持现有用户可见行为不变**。

---

## 核心架构规则（沿用 Phase 1 已批准架构）

1. **UI/API 层** — 接收输入、做传输层校验、调用 Application Use Case、返回响应；**不得包含 provider 相关的 AI 调用逻辑**。
2. **Application 层** — 拥有 Use Case；构建/选择 Prompt；编排 AI 调用；拥有 `AIClientPort` 与其他 output port；需要时可调用 Domain 逻辑；**不得依赖具体 provider 实现**。
3. **Domain 层** — 保持 provider-independent；不调用 AI、不构建 Prompt、不 import Prisma / Next.js / DeepSeek / 文件系统 / 具体基础设施。
4. **Infrastructure 层** — 实现 Application 定义的 port；拥有 provider 相关的 HTTP/API 细节；可向内依赖 Application 契约与 Domain 类型；**不得拥有英语学习业务编排**。
5. **Composition Root** — 把具体 Infrastructure 实现装配进 Application Use Case；Route 不再自行实例化 provider 客户端。

---

## Part 1 — 当前 AI 调用清单（以当前仓库为唯一事实来源）

清单方法：`rg -i deepseek` 定位所有调用点，逐个阅读源码确认 provider / prompt 来源 / 输出类型 / 超时 / 重试 / 错误处理 / 解析方式 / 冻结状态。

> Phase 0 记录的是「10 个 AI 调用文件」。实际清点结果为 **11 个调用点**（Phase 0 未单独列出 `scripts/translate-titles-raw.js`）。
> 本清单以当前仓库为准。

### 1.1 调用点明细

| # | 文件 | 模块 | Provider / Model | Prompt 来源 | 期望输出 | 结构化 | 超时 | 重试 | 错误处理 | 当前解析方式 | 冻结 | 参考迁移适合度 |
|---|------|------|------------------|--------------|----------|--------|------|------|----------|--------------|------|----------------|
| 1 | `src/app/api/assistant/route.ts` | AI Assistant | DeepSeek `deepseek-chat`（纯文本） | Route 内联 system prompt（含可选词卡注入） | 自由文本回复 + 可选 `wordData` | ❌ 自由文本 | ✅ 30s `AbortController` | ❌ 无 | 全部错误 → HTTP 200 + `Sorry, I got an error: …` | 无（不做解析） | ❌ 未冻结 | ✅ **最佳（已选中）** |
| 2 | `src/app/api/coach/route.ts` | AI Coach | DeepSeek `deepseek-chat` | Route 内联两步 prompt | Step1 自由文本 + Step2 JSON | 混合 | ✅ 30s（两步各自） | ❌ 无 | 外层 catch → 502 | `indexOf('{')` 切片 + `JSON.parse` + 手写 `safeJsonParse` | 🔒 严格冻结 | ❌ 冻结 |
| 3 | `src/app/api/scene/generate/route.ts` | 场景系统 | DeepSeek `deepseek-chat` + `json_object` | Route 内联 | 场景 JSON 对象 | ✅ | ✅ 30s | ❌ 无 | 外层 catch → 502 | `first{ / last}` 切片 + `JSON.parse` | 🔒 冻结（场景系统） | ❌ 冻结 |
| 4 | `src/app/api/scene/recommend/route.ts` | 场景系统 | DeepSeek `deepseek-chat` + `json_object` | Route 内联 | `recommendations[]` JSON | ✅ | ✅ 30s | ❌ 无 | 空响应/解析失败 → 502 | `first{ / last}` 切片 + `JSON.parse` | 🔒 冻结（场景系统） | ❌ 冻结 |
| 5 | `src/app/api/words/themes/generate/route.ts` | Words / Themes | DeepSeek `deepseek-chat` + `json_object` ×3 步 | Route 内联 ×3 | Step0 主题 key / Step1 词表数组 / Step2 富化映射 | ✅ | ❌ **无超时** | ❌ 无 | 外层 catch → 500 | `[`/`{` 切片 + `JSON.parse` ×3 | ⚠️ UI 冻结，Route 需授权 | ❌ 需授权 |
| 6 | `src/app/api/words/ai-train/route.ts` | Words | DeepSeek `deepseek-chat` + `json_object` | Route 内联 | `{ dialogue, aiTips }` | ✅ | ✅ 30s | ❌ 无 | 内层 catch → 502 | `first{ / last}` 切片 + `JSON.parse` | ⚠️ 需授权 | ❌ 需授权 |
| 7 | `src/app/api/reading/[id]/vocab/route.ts` | Reading | DeepSeek `deepseek-chat` + `json_object` | 内联 `enrichWord` prompt | 词汇富化 JSON | ✅ | ✅ 30s | ❌ 无 | 任何失败 → `return null`（静默降级） | `first{ / last}` 切片 + `JSON.parse` | ❌ 未冻结 | ⚠️ 备选（DB 写入耦合过重） |
| 8 | `src/features/listening/lib/listening.ts` (`generateScene`) | Listening | DeepSeek `deepseek-chat` | `src/features/listening/lib/listening-prompts.ts`（`getSystemPrompt`，**唯一已抽出的 prompt**） | 场景 JSON | ✅ | ❌ **无超时/无 signal** | ❌ 无 | `console.error` + `return null` | 去 markdown fence + `JSON.parse` | ⚠️ schema 冻结，代码可重构 | ❌ 依赖 DB/TTS/FS，风险高 |
| 9 | `scripts/reading-push.ts` | Reading Pipeline（CLI） | DeepSeek `deepseek-chat` + `json_object` | 内联 | `{ titleZh, summaryZh, vocabItems }` | ✅ | ❌ 无 | ❌ 无（仅轮询间隔） | 抛出异常 | `{`/`}` 切片 + `JSON.parse` | ❌ 未冻结 | ⚠️ CLI + RSS + DB |
| 10 | `prisma/seed.ts` | 种子脚本（CLI） | DeepSeek `deepseek-chat` + `json_object` | 内联 `genSystemPrompt` | 词条映射 JSON | ✅ | ✅ `API_TIMEOUT` | ❌ 无（批间 150ms 间隔） | 抛出 + 跳过批次 | `[`/`]` → `{`/`}` 回退切片 | ❌ 未冻结 | ⚠️ 批处理 + DB |
| 11 | `scripts/translate-titles-raw.js` | 运维 CLI | DeepSeek `deepseek-chat`（纯文本） | 内联 | JSON 字符串数组 | 半结构化 | ❌ 无 | ❌ 无 | 批级 catch + `console.error` | 正则 `match(/\[[\s\S]*?\]/)` | ❌ 未冻结 | ⚠️ 纯运维，代表性低 |

### 1.2 清单结论

| 观察 | 说明 |
|------|------|
| Provider 单一 | 11 个调用点全部使用 DeepSeek `deepseek-chat`，仅 base URL 与 model 参数可配 |
| 超时不一致 | 6 处有 30s `AbortController`；#5、#8、#9、#11 **完全没有超时** |
| 重试完全缺失 | **11 个调用点全部没有重试**（`prisma/seed.ts` 有批间 sleep，但不是重试） |
| 错误语义不统一 | 有的抛错（502/500）、有的静默 `return null`、有的返回 200 + 错误文案 |
| 解析逻辑重复 | 至少 6 处重复实现「切片大括号 + `JSON.parse`」；fence 剥离在 #8 单独实现 |
| Prompt 归属混乱 | 仅 #8 的 prompt 已抽出（但在 feature 目录）；其余全部内联在 Route/脚本中 |
| 冻结分布 | Coach（#2）与场景系统（#3/#4）严格冻结；Words（#5/#6）需授权；其余未冻结 |
| Phase 0 计数偏差 | 实际为 11 个调用点，Phase 0 记录为 10 |

### 1.3 明确不在本阶段处理

- 不修复 #5/#8/#9/#11 缺失超时的问题（属于各自模块的迁移工作）。
- 不修复 `src/features/listening/lib/listening.ts` 中 `${DEEPSEEK_BASE_URL}/chat/completions` **缺少 `/v1`** 的既存实现细节。
- 不统一 11 个调用点的错误文案。

---

## Part 2 — 选择一个参考迁移

### 2.1 候选方案

| 候选 | 调用点 | 优点 | 缺点 / 风险 | 结论 |
|------|--------|------|-------------|------|
| **A** | `POST /api/assistant` | 未冻结；单步 AI 调用；无多步 pipeline；无 schema 写入；无 TTS/文件系统；Phase 2 已明确把它的 Route 级自动化测试推迟到 Phase 3（原因正是缺少可注入 AI Client 接缝） | 含一次 Prisma 词卡查询（需最小 Repository-ish port） | ✅ **选中** |
| B | `POST /api/reading/[id]/vocab` | 未冻结；结构化输出 | 单条路径包含多次 DB 写入（`word`/`wordReview`/`articleVocab`）、批量模式、静默降级，迁移会牵出大量 Repository port，超出「参考迁移」最小范围 | ❌ 风险过高 |
| C | `POST /api/words/ai-train` | 结构化输出、单步 | Words 相关 Route 属需用户明确授权的范围（`CLAUDE.md`：Words 页面 UI 需授权），Phase 3 未获得授权 | ❌ 需授权 |
| D | `POST /api/coach`、`POST /api/scene/*` | — | Coach 严格冻结；场景系统冻结（需授权） | ❌ 冻结 |
| E | `src/features/listening/lib/listening.ts`、`scripts/*`、`prisma/seed.ts` | 未冻结 | 依赖 DB / RSS / TTS / 文件系统，非 Route 路径，代表性偏弱或风险高 | ❌ 非最佳 |

### 2.2 选中的调用点

**`POST /api/assistant`**（`src/app/api/assistant/route.ts`）

### 2.3 选择理由

1. **低风险** — 单次 AI 调用、自由文本输出、无多步编排、不写任何数据库记录、不触碰 TTS 或文件系统。
2. **未冻结** — 不在 `CLAUDE.md` 的冻结清单（Coach / 场景系统 / Words UI / `schema.prisma`）内。
3. **正是 Phase 2 预留给 Phase 3 的缺口** — `docs/refactor/handoffs/phase-2-handoff.md` 与 `EVALUATION_BASELINE.md` 都记录：`/api/assistant` 的 Route 级自动化测试推迟到 Phase 3，因为缺少可注入的 AI Client 接缝。本阶段交付该接缝。
4. **足以验证架构** — 覆盖「Route → Use Case → Port → Adapter → provider」全链路，并证明：Prompt 归属 Application、provider 细节归属 Infrastructure、Route 不再持有 API Key 与 HTTP 细节、可注入 fake 做自动化测试。
5. **行为面窄** — 用户可见契约只有 `{ reply, wordData }` 与「失败时返回 200 + 友好错误文案」两点，便于逐条对照保持。

### 2.4 必须保持不变的既有行为

| # | 行为 | 现状 | Phase 3 要求 |
|---|------|------|--------------|
| B1 | 请求体 | `{ messages?, query? }` | 不变 |
| B2 | 传输层校验 | `!query && (!messages \|\| messages.length === 0)` → `400 { error: 'No query provided' }` | 不变 |
| B3 | 词卡查询键 | 取 `query` 或最后一条消息内容，按 `[\s,，.。!！?？]+` 切分取首段，去掉非 `[a-zA-Z-]` 字符，小写后精确匹配 `Word.word` | 不变 |
| B4 | 词卡降级 | 查询失败（含 DB 不可用）→ 静默不带词卡，继续回复 | 不变 |
| B5 | 词卡字段 | `word` / `phonetic` / `partOfSpeech` / `definition` / `collocations` / `example` / `exampleZh` | 不变 |
| B6 | Prompt 文本 | system prompt 全文（含词卡注入段） | **逐字不变** |
| B7 | 消息映射 | `role: 'ai'` → `'assistant'`；system 置于最前 | 不变 |
| B8 | 模型参数 | `model=deepseek-chat`、`max_tokens=1024`、`temperature=0.7`、无 `response_format` | 不变 |
| B9 | 端点 | `${DEEPSEEK_BASE_URL \|\| https://api.deepseek.com}/v1/chat/completions`，`Authorization: Bearer ${DEEPSEEK_API_KEY}` | 不变 |
| B10 | 超时 | 30s（用户可见等待上限） | 不变 |
| B11 | 成功响应 | `200 { reply, wordData }`，`reply` 取 `choices[0].message.content \|\| ''` | 不变 |
| B12 | 失败响应 | `200 { reply: "Sorry, I got an error: <msg>", wordData: null }` | 不变 |
| B13 | 日志 | `console.error('[AI Assistant]', msg)` | 不变 |
| B14 | 畸形 JSON 请求体 | `await request.json()` 在 try 之外 → 未捕获 → 500（既有输入校验技术债） | **保持现状**，不在本阶段顺手修复 |
| B15 | 未配置 API Key | 现状：发出请求 → provider 401 → `Sorry, I got an error: DeepSeek HTTP 401: …` | **保持现状**（不新增 pre-flight key 校验，避免改变错误面） |
| B16 | 重试次数（v2 补充） | 现状：**只发起一次** provider 请求；任何 429 / 5xx / 网络失败都直接转为友好错误回复 | 统一层默认提供有界重试，但本参考迁移必须**显式** `retry: { maxAttempts: 1 }` 退出重试（外部审核 v1 blocking issue #1） |

---

## Part 3 — AI Client 抽象的实现范围

### 3.1 Application 层新增

| 文件 | 内容 |
|------|------|
| `src/application/ports/ai-client.ts` | `AIClientPort` 接口 + provider-independent 请求/响应类型 + 归一化错误模型 `AIError` |
| `src/application/ports/word-lookup.ts` | `WordLookupPort`（参考迁移所需的最小第二个 output port） |
| `src/application/prompts/assistant/qa.prompt.ts` | Assistant system prompt 构建函数（从 Route 原样抽出） |
| `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` | 参考 Use Case |

### 3.2 Infrastructure 层新增

| 文件 | 内容 |
|------|------|
| `src/infrastructure/ai/errors.ts` | HTTP status → 归一化错误码映射；未知错误归一化 |
| `src/infrastructure/ai/retry.ts` | 有界重试策略（指数退避 + jitter，deadline 感知） |
| `src/infrastructure/ai/structured-output.ts` | JSON 安全提取 + schema 校验 + 解析修复指令（解析恢复，非网络重试） |
| `src/infrastructure/ai/adapters/types.ts` | `AIProviderAdapter` 接口 + provider 请求/响应类型 |
| `src/infrastructure/ai/adapters/deepseek.adapter.ts` | DeepSeek provider adapter（HTTP 细节、请求/响应翻译、错误映射） |
| `src/infrastructure/ai/ai-client.ts` | 统一 AI Client（实现 `AIClientPort`：超时、重试、结构化边界、metadata） |
| `src/infrastructure/db/word-lookup.ts` | `WordLookupPort` 的 Prisma 实现 |

### 3.3 Composition Root

| 文件 | 内容 |
|------|------|
| `src/bootstrap/index.ts` | 装配 DeepSeek adapter → AI Client → WordLookup → 参考 Use Case；Route 只拿装配好的 Use Case |

### 3.4 迁移后的 Route

`src/app/api/assistant/route.ts` 只保留：读取请求体 → 传输层校验 → 调用 Use Case → 统一响应 / 统一错误映射。不再持有 API Key、base URL、fetch、Prompt 或解析逻辑。

### 3.5 明确不做

- 不迁移其余 10 个 AI 调用点（各自留在后续 Phase）。
- 不为其他模块的 prompt / 解析器做提前抽取。
- 不引入 DI 框架。
- 不引入 Memory / RAG / Agent。
- 不改 `schema.prisma`、不改 UI、不动 SM-2。
- 不顺手修复 `POST /api/words` 缺 `wordId` → 500 的既有技术债。

---

## 允许修改

- Application 层：`AIClientPort` 与**唯一一个**参考 Use Case 所需代码
- Infrastructure 层：统一 AI Client 与 provider adapter
- Composition Root
- **唯一一个**被选中的 AI 调用点及其 Route（`/api/assistant`）
- 新架构的测试与测试 fixture
- 必要的极简依赖（本阶段计划**不新增任何依赖**）
- Phase 3 文档、`PHASE_STATUS.md`
- `DECISIONS.md`（仅当产生真实的长期架构决策）

## 禁止修改

- 迁移其它 AI 调用
- 进入 Phase 4
- 重构无关 Route
- 移动 SM-2
- 修改 Prisma schema
- 引入 Memory / RAG / Agent 编排
- 重新设计 UI
- 改变产品行为
- 修复无关技术债（含 `POST /api/words` 缺 `wordId` → 500）
- 改写 Phase 1 架构文档（除非发现真实矛盾并记录）
- 在自动化测试中调用真实 AI
- 为「显得高级」引入 DI 框架

---

## 测试要求

以 Phase 2 基线为回归安全网（受保护基线，不得删除或放宽）。新增测试**不得调用真实 provider**，至少覆盖：

1. 成功的 provider 响应
2. 超时归一化
3. 可重试的 provider 失败
4. 不可重试的失败
5. 无效结构化响应
6. provider 响应翻译
7. 参考 Application Use Case（fake `AIClientPort`）
8. 被迁移的 Route（可注入接缝）

如需真实 provider 冒烟测试：**先记录理由，等待用户明确批准后再消耗 API 额度**。

---

## 回归要求

实现后运行完整 Phase 2 基线：

```
npx vitest run
npx tsc --noEmit
npx next build
npx eslint tests/
npx eslint src/lib/__tests__/
tests/smoke/api-smoke.sh（dev server 运行后）
```

并对所有新增 Phase 3 文件运行 lint。

---

## 交付物

| # | 文档/文件 | 说明 |
|---|----------|------|
| 1 | `docs/refactor/tasks/phase-3-task.md` | **本文件** |
| 2 | `docs/refactor/AI_CLIENT_DESIGN.md` | AI Client 设计文档 |
| 3 | `docs/refactor/handoffs/phase-3-handoff.md` | Phase 3 交接文档 |
| 4 | `src/application/ports/ai-client.ts` | `AIClientPort` + 错误模型 |
| 5 | `src/application/ports/word-lookup.ts` | 参考迁移所需最小 port |
| 6 | `src/application/prompts/assistant/qa.prompt.ts` | 参考迁移的 Prompt |
| 7 | `src/application/use-cases/assistant/reply-to-assistant-query.use-case.ts` | 参考 Use Case |
| 8 | `src/infrastructure/ai/*` | 统一 AI Client、重试、错误映射、结构化输出、adapter |
| 9 | `src/infrastructure/db/word-lookup.ts` | Prisma 实现的 `WordLookupPort` |
| 10 | `src/bootstrap/index.ts` | Composition Root |
| 11 | `src/app/api/assistant/route.ts`（修改） | 薄 Route |
| 12 | Phase 3 测试 | 见测试要求 |
| 13 | `PHASE_STATUS.md`（更新） | Phase 3 状态 |
| 14 | `DECISIONS.md`（更新） | ADR-011 |

---

## 验收标准

1. `AIClientPort` 定义在 Application 层，Infrastructure 提供实现与 provider adapter
2. `/api/assistant` 迁移为 Route → Use Case → Port → Adapter，且 B1–B15 行为保持不变
3. 超时显式、重试有界、错误归一化、结构化输出边界可复用
4. 新增测试全部通过，且不含真实 provider 调用
5. Phase 2 基线（95 tests）保持全绿，未删除或放宽
6. `npx tsc --noEmit`、`npx next build`、`npx eslint tests/`、`npx eslint src/lib/__tests__/` 全部通过
7. 新增文件 ESLint 无新增错误
8. 未迁移其它 AI 调用，未修改冻结模块，未改产品行为
9. Phase 3 → In Review，Phase 4 → Not Started（**不自行宣告 Completed / Approved**）

---

## 状态管理

- 开始时：Phase 3 → **In Progress**
- 实现完成时：Phase 3 → **In Review**；Phase 4 → **Not Started**
- Phase 3 **不得**由执行者标记为 Completed / Approved —— 只有外部审核可以批准。
