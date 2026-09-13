# Phase 4 交接文档 — Reading Content Pipeline 样板

**日期:** 2026-09-13
**Phase 状态:** ✅ **Completed / Approved**（2026-09-13 外部复审 v3：架构与生产实现 Accepted，C6/C7 更正后 Blocking Issues: None）
**Phase 5 状态:** **Not Started**
**参考 Pipeline:** Reading 内容摄取管线（`npm run push:reading`）
**审核记录:** `docs/refactor/reviews/phase-4-review.md`

> **版本轨迹：** v1 = Changes Requested（3 项阻断问题）→ v2 修正 → v2 复审 = Minor Changes Requested（3 项小修正）
> → v3 技术实现 **Accepted**，仅剩 C6/C7 characterization 更正 → **更正完成，Phase 4 Approved**。
> 修正明细见 §4（v2）与 §6（v3 + C6/C7 更正）。

---

## 1. 前置校验（Phase 4 开始前）

| 项 | 结果 |
|----|------|
| 分支 | `master` |
| HEAD | `045b642c381d4e68bc545972377b83e32e153681`（Phase 2+3 基线提交） |
| `git status --short` | 空（工作区干净） |
| `git diff --stat` | 空 |
| Phase 3 状态 | ✅ Completed / Approved（2026-09-13 外部复审） |
| Phase 4 状态 | Ready / Not Started → 本次启动 |
| 受保护基线 | ✅ `npx vitest run` → 11 files / 184 tests passed；`npx tsc --noEmit` → 0 errors |

---

## 2. 完成报告（任务 Part 18 的 31 项）

### ① 选中的参考 Pipeline

**Reading 内容摄取管线** —— 触发方式 `npm run push:reading` → `scripts/reading-push.ts`。

### ② 为什么选它

项目里唯一同时具备「外部内容源 + AI 结构化输出 + 持久化 + 运行级清理」的确定性多步管线；
不受冻结约束；MIGRATION_PLAN / ADR-009 早已指定它为样板；此前 **0 测试**且全部依赖可端口化，
改造收益最大。被排除的候选：`reading/[id]/vocab`（单词级富化 + SRS）、`words/themes/generate`（需授权）、
Listening refill（TTS + 文件系统）、Coach / scene（冻结）。完整对比见任务文档 Part 2。

### ③ Before 执行流程

```
CLI → 读配置 → 校验 API Key → 自建 Prisma
  → 遍历 5 个 feed（按 link 去重 + 合并 tag）→ 洗牌 → 与 DB 去重 → 取前 N
  → 逐条：RSS HTML 或 HTTP 抓取 → Readability 抽取 → 正文 < 100 字符跳过
          → DeepSeek（单次请求；失败降级为空结果）→ difficulty 启发式
          → prisma.article.create（嵌套 vocabItems）→ sleep 1500ms
  → 裁剪（> 50 篇删最旧，先词汇后文章，无事务）→ 日志 → 断开数据库
```

全部实现在单文件 `scripts/reading-push.ts`（约 330 行）；无测试。

### ④ After 执行流程

```
scripts/reading-push.ts（交付层：配置 + 事件→日志 + 退出码）
  → IngestReadingArticlesUseCase（入口：配置校验 → 调用 → 结果/错误映射）
       → ReadingPipelineWorkflow（显式 4 步：collectCandidates / selectNewArticles /
                                   processArticles / trimToLimit）
            → FeedSourcePort        ← RssFeedSource
            → ArticleExtractorPort  ← ReadabilityArticleExtractor
            → ReadingArticleRepositoryPort ← PrismaReadingArticleRepository
            → AIClientPort          ← Phase 3 AIClient + DeepSeekAdapter（复用，未修改）
            → domain/reading/*      纯规则（长度/难度/excerpt/上限/AI 输出契约）
```

### ⑤ 新建文件（21 个）

| 层 | 文件 | 行数 |
|----|------|------|
| Domain | `src/domain/reading/types.ts` | 21 |
| Domain | `src/domain/reading/content-rules.ts` | 45 |
| Domain | `src/domain/reading/ai-response-rules.ts` | 40 |
| Application | `src/application/errors.ts` | 35 |
| Application | `src/application/ports/feed-source.ts` | 20 |
| Application | `src/application/ports/article-extractor.ts` | 26 |
| Application | `src/application/ports/reading-article-repository.ts` | 47 |
| Application | `src/application/prompts/reading/process-article.prompt.ts` | 74 |
| Application | `src/application/workflows/reading-pipeline.workflow.ts` | 526 |
| Application | `src/application/use-cases/reading/ingest-reading-articles.use-case.ts` | 88 |
| Infrastructure | `src/infrastructure/rss/rss-feed-source.ts` | 43 |
| Infrastructure | `src/infrastructure/article-extraction/readability-article-extractor.ts` | 69 |
| Infrastructure | `src/infrastructure/db/reading-article.repository.ts` | 92 |
| Infrastructure | `src/infrastructure/db/standalone-prisma.ts` | 36 |
| Composition | `src/bootstrap/reading-composition.ts` | 60 |
| Test | `src/domain/reading/__tests__/content-rules.test.ts` | 10 tests |
| Test | `src/domain/reading/__tests__/ai-response-rules.test.ts` | 6 tests |
| Test | `src/application/workflows/__tests__/reading-pipeline.workflow.test.ts` | 14 tests |
| Test | `src/application/use-cases/reading/__tests__/ingest-reading-articles.use-case.test.ts` | 14 tests |
| Test | `src/infrastructure/db/__tests__/reading-article.repository.test.ts` | 6 tests |
| Test | `src/infrastructure/article-extraction/__tests__/readability-article-extractor.test.ts` | 7 tests |

文档：`docs/refactor/tasks/phase-4-task.md`、`docs/refactor/CONTENT_PIPELINE_DESIGN.md`、本文件。

### ⑥ 修改文件（3 个）

| 文件 | 说明 |
|------|------|
| `scripts/reading-push.ts` | 330 行 → 约 110 行；只保留配置、事件→日志映射、退出码 |
| `docs/refactor/DECISIONS.md` | 新增 ADR-012（Content Pipeline 样板 + 迁移行为保真原则） |
| `docs/refactor/PHASE_STATUS.md` | Phase 4 → In Review；Phase 5 说明 |

> 未修改：`prisma/schema.prisma`、任何 `/api/reading/*` Route、Phase 2/3 的测试与 AI Client、
> `src/lib/prisma.ts`、UI、`package.json`（**未新增依赖**）。

### ⑦ Use Case 设计

`IngestReadingArticlesUseCase`：唯一应用入口。负责配置级校验（feeds/url/tag 非空，
maxPerRun/maxArticles 为正整数，可选项非负）、调用 Workflow、把结果作为 DTO 返回、
把非应用级异常包装为 `ApplicationError('unexpected')`。不含 HTTP/provider/Prompt/SQL/业务规则。

### ⑧ Workflow 设计

`ReadingPipelineWorkflow`：4 个显式步骤（见 ④），逐条容错策略、限速、步骤事件（`ReadingPipelineEvent`）。
不持有 Prisma / Prompt 文案 / provider 参数 / 环境变量。事件边界即 Phase 5 Trace 的挂点。

### ⑨ Domain 变更（新增）

`content-rules.ts`（阈值/难度/excerpt/条数上限）、`ai-response-rules.ts`（AI 输出契约校验）、`types.ts`。
全部纯函数，无 AI / Prisma / Next / 文件系统依赖。既有 `src/lib/sm2.ts` **未移动**。

### ⑩ 引入的 Ports

`FeedSourcePort`、`ArticleExtractorPort`、`ReadingArticleRepositoryPort`（+ 复用 Phase 3 的 `AIClientPort`）。
Repository 只含管线真正使用的 6 个方法，未引入通用 Repository 框架。

### ⑪ 引入的基础设施 Adapters

`RssFeedSource`（rss-parser）、`ReadabilityArticleExtractor`（JSDOM + Readability）、
`PrismaReadingArticleRepository`（Prisma）、`createStandalonePrismaClient`（CLI 专用连接工厂，
保持迁移前的 pg Pool + PrismaPg 与去引号行为）、`createReadingIngestComposition`（Composition Root）。
AI 侧**复用** Phase 3 的 `AIClient` + `DeepSeekAdapter`，未修改、未绕过 `AIClientPort`。

### ⑫ 结构化输出生产化

三段职责（v2 修正后）：

1. **JSON 提取**：Infrastructure（Phase 3 `chatStructured()` / `structured-output.ts`，未修改）；
2. **负载归一化**：Domain `normalizeArticleProcessingPayload()` —— 恢复旧管线的**逐字段兜底**
   （缺失 `vocabItems` → `[]` 且保留标题摘要；缺失 `titleZh`/`summaryZh` → `''` 且保留其余字段），
   并把"旧实现会在写库阶段失败"的负载判定为失败；
3. **持久化形状**：归一化结果（`type: string` 等）→ Workflow 映射为 `NewReadingVocabItem`。

原始负载（`RawArticleProcessingPayload` / `RawReadingVocabItem`，`type?: string`）与归一化结果
（`ArticleProcessingResult` / `ReadingVocabItem`，`type: string`）分别建模，无类型断言。
Prompt 逐字保留在 `application/prompts/reading/process-article.prompt.ts`（含 4000 字符截断规则）。
`maxRepairAttempts: 0`（迁移前解析失败即降级）。Phase 2 离线契约测试未改动。

### ⑬ 持久化边界

Workflow 通过 Repository Port 写入；Prisma 仅在 Adapter 内。保留单条 create + 嵌套词汇写入、
`createdAt asc` 取最旧、裁剪时先删 ArticleVocab 再删 Article、**无事务**、运行前后各 `count()` 一次。
未改 schema、未跑 migration。

### ⑭ 重试 / 幂等结论

- 只读步骤与 AI 调用可安全重试（AI 实际仍是单次请求：`retry {maxAttempts:1}` + 解析修复 0 次）
- AI 调用发生在持久化之前，不产生副作用；上游失败时**不会**触发持久化（有测试覆盖）
- 幂等保护仅有"运行前按 url/title 去重"，无事务/唯一约束级保护 → 并发运行理论上可写入重复文章（既有行为，延后）
- 未引入幂等框架

### ⑮ 错误传播策略

`invalid_input` / `feed_unavailable`（致命，整轮中止）/ `persistence_failed` / `unexpected` 四码 `ApplicationError`；
`persistence_failed` 由**真实的运行级仓储操作**产生（去重查询 / 统计 / 取最旧 / 裁剪删除）；
AI 请求失败或响应不可解析为 JSON → 复用 Phase 3 `AIError` 并在管线内降级（文章仍入库）；
AI 负载不可安全归一化 / 抽取失败 / 单条写库失败 → 该条失败且**不入库**，只计数不中断整轮；
交付层把 `ApplicationError` 翻译为日志 + `exit(1)`；**日志分类与控制流与迁移前一致，
但底层错误文案可能因归一化而不同**（不再声称逐字节一致）。

### ⑯ 新增测试（108 个）

| 文件 | 数量 | 覆盖 |
|------|------|------|
| `domain/reading/__tests__/content-rules.test.ts` | 10 | 阈值、难度边界、excerpt、条数上限 |
| `domain/reading/__tests__/ai-response-rules.test.ts` | 40 | A–F 旧语义对照、falsy/异常字段、slice 顺序、原始/归一化类型模型、`type`/`partOfSpeech` falsy 兜底对照（v3）、**旧外层 catch 结果对照（C6/C7，v4）** |
| `application/workflows/__tests__/reading-pipeline.workflow.test.ts` | 24 | 完整流程、步骤顺序、AI 降级、字段级兜底、非法嵌套失败、运行级 persistence_failed、抽取/写库失败隔离、早期退出、裁剪、AI 请求形状 |
| `application/workflows/__tests__/reading-pipeline.structured-output-boundary.test.ts` | 3 | **C6 验证（v3）**：真实 `AIClient` + 内存假 provider；JSON `null` → `invalid_response` → 降级入库；正常负载对照 |
| `application/use-cases/reading/__tests__/ingest-reading-articles.use-case.test.ts` | 14 | 入口契约、配置校验、错误映射、真实 Workflow + fake Ports 组合 |
| `infrastructure/db/__tests__/reading-article.repository.test.ts` | 6 | 查询形状、写入映射、裁剪顺序 |
| `infrastructure/article-extraction/__tests__/readability-article-extractor.test.ts` | 7 | 配图、UA、错误文案、空正文 |
| `infrastructure/rss/__tests__/rss-feed-source.test.ts` | 4 | FeedEntry 映射、缺失字段、空 feed、parser 失败传播 |

### ⑰ 测试总数

```
 Test Files  19 passed (19)
      Tests  292 passed (292)
```

### ⑱ Phase 2 受保护基线状态

✅ 95 tests（sm2 32 / utils 10 / word-cache 6 / 离线结构化输出 35 / 内容质量 12）全部保留并通过；
`tests/smoke/api-smoke.sh` 未修改；`POST /api/words` 缺 wordId → 500 特征化行为保持不变。

### ⑲ Phase 3 受保护基线状态

✅ 89 tests（route 6 / use case 13 / ai-client 20 / deepseek-adapter 21 / retry 13 / structured-output 16）全部保留并通过；
`AIClientPort`、`AIClient`、`DeepSeekAdapter`、`structured-output.ts` **未被修改**。

### ⑳ TypeScript

`npx tsc --noEmit` → **0 errors**

### ㉑ Build

`npx next build` → ✅ 通过（41 routes，33/33 静态页面，2 条既有警告）。
`/api/reading/*` 路由未改动，行为不变。

### ㉒ ESLint

| 范围 | 结果 |
|------|------|
| `npx eslint tests/` | ✅ 0 errors, 0 warnings |
| `npx eslint src/lib/__tests__/` | ✅ 0 errors, 0 warnings |
| `npx eslint src/domain/ src/application/ src/infrastructure/ src/bootstrap/ scripts/reading-push.ts` | ✅ 0 errors, 0 warnings |
| `npx eslint src/`（全量，含 Phase 0 历史问题） | ⚠️ 与历史基线相同的既有问题（未引入新问题） |
| `npx eslint scripts/`（全量） | ⚠️ 既有历史问题（`find-zh-titles.js` 等）；**本次改动的 `scripts/reading-push.ts` 为 0 errors / 0 warnings** |

### ㉓ 冒烟测试

`npx next dev -p 3456` + `bash tests/smoke/api-smoke.sh`（jq 可用）→ **14 passed / 0 failed / 0 skipped**。
dev server 已关闭。

### ㉔ 是否调用真实 AI / TTS

**否。** 全部管线测试使用 fake Ports + fake `AIClientPort`；本阶段未运行 `npm run push:reading`
（那会访问真实 RSS/DeepSeek/数据库）。未执行任何真实 provider 冒烟测试。

### ㉕ 行为变更

**保持不变：** B1–B20（触发方式、API Key 校验、5 个 feed、跨 feed 去重与 tag 合并、洗牌、
DB 去重规则、MAX_PER_RUN、抓取策略与 UA、Readability、正文 < 100 字符跳过、AI 参数与 prompt 文案、
AI 失败降级、词汇 ≤ 10、难度启发式、入库字段、excerpt 规则、1500ms 限速、单条失败隔离、
裁剪规则），以及 **B21–B23**（AI 负载逐字段兜底、非法嵌套条目导致该条失败、先 slice 再校验）。

> **措辞修正（v2）：** 迁移前是"日志**分类**与控制流"保持一致（`Fetching feed` / `N are new` /
> `⚠ DeepSeek failed` / `✓ Pushed` / `✗ Failed` / `DB now has` / `Done` 等类别与顺序不变），
> **不是**底层错误文案逐字节一致 —— AI 步骤的文案来自归一化 `AIError`，
> 归一化失败来自领域原因字符串（例如 `vocabItems[0].contextSentence must be a string`），
> 而旧实现这里是数据库抛出的错误文案。

**有意且有记录的变更（C1–C5 + C7；C1/C2/C4 已获审核接受，C7 经 v3 审核接受；C6 已重新归类为"行为保持"，见下方说明）：**

| # | 变更 | 原因 |
|---|------|------|
| C1 | AI 调用现在有界超时（120s）｜**审核已接受** | Phase 3 `AIClientPort` 不存在无超时路径（架构要求）；原实现无超时 |
| C2 | ```json fence 包裹的响应现在可被解析｜**审核已接受** | 使用 Phase 3 已批准的结构化输出边界 |
| C3 | 非法嵌套负载的**失败时机提前**（结果不变：该条 failed、不入库） | 旧实现在写库阶段才会失败；现在归一化阶段即判定失败，仅日志文案不同 |
| C4 | 显式 **不启用** 网络重试与解析修复｜**审核已接受** | 保持"单次请求 + 失败即降级"的既有语义（与 Phase 3 同一原则） |
| C5 | 运行配置非法（`maxPerRun`/`maxArticles` 非正整数）→ `invalid_input` 快速失败 | 旧 CLI 依赖 `slice()` 隐式行为（0/负数/NaN 会产生静默异常结果）；这是**有意的安全改进**，默认配置（8/50）路径完全不变 |
| C7 | 畸形 truthy 非字符串 `titleZh`（number / boolean / plain object）：旧实现因**日志 `.slice()` 副作用**被外层 catch 降级（文章入库），新实现确定性判为失败（不入库）｜**经 v3 审核接受** | 旧结果依赖日志运行时意外，不应固化为领域行为；影响面仅限畸形 AI 负载 |

**不属于行为变更（v4 更正）：**

| # | 项 | 说明 |
|---|----|------|
| C6 | 根为 JSON `null` 的负载 | **行为保持。** 旧实现的内层归一化确实抛 TypeError，但**外层 AI try/catch** 把它转成空结果、文章仍然入库（B25）；新链路的最终结果相同（Phase 3 边界 → `invalid_response` → Workflow 降级 → 文章入库）。已用真实 `AIClient` + 内存假 provider 验证 |

### ㉖ 延后的 Pipeline 迁移

`/api/reading/push`、`/api/reading/[id]/vocab`、`/api/reading` 列表与详情、Listening refill、
Words themes、scene / coach、其余 9 个 AI 调用点（见 CONTENT_PIPELINE_DESIGN §10）。

### ㉗ 已知风险 / 未决问题

| # | 项 | 处置 |
|---|----|------|
| R1 | url 去重大小写不对称 | 既有行为，保留 |
| R2 | 并发运行可能写入重复文章（无唯一约束） | 延后（涉及 schema/migration） |
| R3 | 裁剪无事务 | 既有行为，保留 |
| R4 | C1–C3 行为变更 | 待外部审核确认 |
| R5 | CLI 脚本本身无自动化测试（自执行、无注入缝） | 逻辑已全部位于可测层；CLI 只做配置与日志映射 |
| R6 | `publishedAt` 未校验 | 既有行为，保留 |

### ㉘ `git diff --stat`

```
 docs/refactor/DECISIONS.md    |  61 +++++-
 docs/refactor/PHASE_STATUS.md |  74 +++++++-
 scripts/reading-push.ts       | 427 +++++++++---------------------------------
 3 files changed, 217 insertions(+), 345 deletions(-)
```

（`git diff` 不含未跟踪的新文件；完整清单见 ⑤，全量 diff 见审核包内 `git-diff-phase-4.patch`）

### ㉙ `git status --short`

```
 M docs/refactor/DECISIONS.md
 M docs/refactor/PHASE_STATUS.md
 M scripts/reading-push.ts
?? docs/refactor/CONTENT_PIPELINE_DESIGN.md
?? docs/refactor/handoffs/phase-4-handoff.md
?? docs/refactor/reviews/phase-4-review.md
?? docs/refactor/tasks/phase-4-task.md
?? src/application/errors.ts
?? src/application/ports/article-extractor.ts
?? src/application/ports/feed-source.ts
?? src/application/ports/reading-article-repository.ts
?? src/application/prompts/reading/
?? src/application/use-cases/reading/
?? src/application/workflows/
?? src/bootstrap/reading-composition.ts
?? src/domain/
?? src/infrastructure/article-extraction/
?? src/infrastructure/db/__tests__/
?? src/infrastructure/db/reading-article.repository.ts
?? src/infrastructure/db/standalone-prisma.ts
?? src/infrastructure/rss/
```

**说明：** 上面是**提交前**的工作区状态快照（审核阶段全程未 commit / 未 add / 未使用破坏性 Git 命令）。
Phase 4 通过外部审核后，行政收尾删除了临时审核 ZIP 并建立了唯一基线提交
（`feat: establish reading content pipeline architecture`），提交后工作区干净。

### ㉚ Phase 4 当前状态

**In Review** —— 实现与回归验证完成，等待外部审核。执行者**不**自行宣告 Completed / Approved。

### ㉛ Phase 5 状态

**Not Started**（未创建任何 Phase 5 交付物；仅在 Workflow 步骤边界预留事件挂点）。

---

## 3. 审核建议关注点

1. B1–B23 的保持是否成立（重点：AI 逐字段兜底、非法嵌套条目导致该条失败、单条失败隔离、裁剪顺序）。
2. 有意变更清单（C1–C5 + C7）是否可接受；**C6 已归类为行为保持，不在变更清单内**。
3. 分层是否正确：Prisma 是否只在 Infrastructure；Domain 是否无 AI/Next/IO；Workflow 是否无 Prompt/Prisma。
4. `AIClientPort` 是否被正确复用（未绕过、未修改 Phase 3 实现）。
5. Phase 2 / Phase 3 受保护基线是否完好（184 → 265，无删除/放宽）。
6. Composition Root 拆分为两个文件是否可接受（避免 CLI 重依赖进入 Next 打包）。

**v2 复审建议关注：**

7. 归一化是否真正恢复旧语义（A–F 六类对照测试是否可信、`null` 根边界 C6 是否可接受）。
8. 原始/归一化类型模型是否真实（不再有"守卫声称保证但实际不保证"的类型）。
9. `persistence_failed` 是否只由运行级仓储操作产生，且单条 `createArticle()` 失败仍是隔离的。

---

## 4. v2 修正记录（针对外部审核 v1 的 3 项阻断问题）

| # | 阻断问题 | 修正 | 证据 |
|---|---------|------|------|
| 1 | 严格 validator 丢弃全部 AI 字段，比旧管线更严格；非法嵌套负载被静默降级为"成功" | `normalizeArticleProcessingPayload()` 恢复逐字段兜底；不可安全恢复的负载 → 该条 `failed`（不入库）；`chatStructured` 仍负责 JSON 提取 | A–F characterization 测试（测试内复刻旧实现对照）；Workflow 三态（ok/degraded/failed）测试 |
| 2 | `ReadingVocabItem.type: string` 与守卫允许 `undefined` 不一致 | 拆分 `RawReadingVocabItem`（`type?: string`）与 `ReadingVocabItem`（`type: string`），归一化补 `'word'` | 类型模型测试：可省略 type、falsy → `'word'`、归一化结果满足声明类型（编译期 + 运行时，无断言） |
| 3 | `persistence_failed` 无生产路径，运行级失败落到 `unexpected` | Workflow `withPersistence()` 包装 5 个运行级仓储操作 | 6 个新测试（urls / titles / count / oldest / delete → `persistence_failed`；create → 仍隔离） |

**其他：** C 清单更新为 C1–C6（新增 C5 配置校验快速失败、C6 `null` 负载边界；C3 改为"失败时机提前、结果不变"）；
措辞修正为"日志分类与控制流一致，底层错误文案可能不同"；ADR-011 过期状态订正；ADR-012 增补第 4/6/7 条；
新增 `RssFeedSource` 适配器测试（4 个）。

**审核结论：** 执行者**不**作出 Approved 结论；Phase 4 保持 In Review，等待外部复审 v2。

---

## 5. v3 修正记录（针对外部审核 v2 的 3 项小修正）

外部审核 v2：**Minor Changes Requested**（v1 的三项阻断问题已被确认正确解决），Phase 5 仍未放行。

| # | 小修正 | 修正 | 证据 |
|---|--------|------|------|
| 1 | 剩余的 falsy 兜底语义：旧实现 `type: v.type \|\| 'word'`、`partOfSpeech: v.partOfSpeech \|\| null` 对 `null` / `false` / `0` 也走兜底，而 v2 实现把这些判成类型错误 | `normalizeVocabItem()` 改为：falsy（`undefined` / `""` / `null` / `false` / `0`）→ 兜底（`'word'` / `null`）；truthy 非字符串（`5` / `{}` / `[]` / `true`）→ 失败；`word` / `definition` / `contextSentence` 校验未放宽 | 新增 20 个对照测试（两字段各 5 个 falsy + 4 个 truthy 非字符串 + 字符串保留 + 必填字段未放宽），并与测试内复刻的旧 `\|\|` 映射逐条比对 |
| 2 | 归一化边界仍含类型断言，与文档"无类型断言"不符 | 重写为局部变量 + 控制流收窄；`asPlainRecord`（内部 `as Record<…>`）→ 类型守卫 `isPlainRecord(value): value is Record<string, unknown>` | 该文件 `rg ' as '` 结果为空；`tsc --noEmit` 通过 |
| 3 | C6 未通过真实 Phase 3 边界验证（原测试用 `FakeAIClient` 绕过） | 新增 `reading-pipeline.structured-output-boundary.test.ts`：真实 `AIClient` + 内存假 provider，返回 provider content `"null"` | 实测 `chatStructured()` 抛 `AIError('invalid_response')`（`retryable=false`，仅 1 次 provider 请求）；Workflow 端到端 `pushed:1 / degraded:1 / failed:0`，文章入库、`titleZh=null`、摘要回退 excerpt ⇒ **C6 既有文档成立，未修改 Phase 3 实现** |

**文档同步：** `CONTENT_PIPELINE_DESIGN.md`（§5.2 falsy 规则表、§5.3 C6 验证说明）、
`phase-4-task.md`（B24 + C6 验证说明 + 验收项）、`DECISIONS.md` ADR-012 第 4 条、本文件、`reviews/phase-4-review.md`。

**审核结论：** 执行者**不**作出 Approved 结论；Phase 4 保持 In Review，等待外部复审 v3。

---

## 6. v3 审核结论与 C6/C7 更正（2026-09-13）

外部审核 v3 结论：**架构、生产实现、v1 阻断问题、v2 小修正、288 测试基线全部接受**，
仅剩一项 characterization/documentation 更正。

### C6 重新归类为"行为保持"

旧实现把 AI 调用与**操作员日志**放在同一个 try/catch 中：

```js
try {
  dsResult = await processWithDeepSeek(...)                       // 内层：null → TypeError
  console.log(`… titleZh="${dsResult.titleZh.slice(0, 30)}…" …`)  // 日志也在同一个 try 内
} catch {
  dsResult = { titleZh: '', summaryZh: '', vocabItems: [] }        // 任何异常 → 降级，文章仍然入库
}
```

因此旧链路对 JSON `null` 的**最终结果**是"降级 + 文章入库"；新链路（Phase 3 边界 → `invalid_response`
→ Workflow 降级）结果相同。**C6 不是行为变更**，已从变更清单移出。
验证测试保留：`reading-pipeline.structured-output-boundary.test.ts`（真实 `AIClient` + 内存假 provider），
其结论更新为"真实 Phase 3 结构化输出路径**保持了旧管线对 JSON null 的最终结果**"。

### C7 记录为经审核接受的畸形输出行为变更

旧实现中 `titleZh` 为 truthy 非字符串（number / boolean / plain object）时，
`processWithDeepSeek` 会原样返回该值，而**日志**的 `dsResult.titleZh.slice(0, 30)` 抛 TypeError，
被外层 catch 转成降级（文章入库）。新实现在归一化边界确定性地判为失败（该条 failed、不入库）。
外部审核**接受**该变更（理由：旧结果依赖日志副作用；影响面仅限畸形 AI 负载）。
数组是特例（带 `Array.prototype.slice`，旧实现会走到写库才失败），新实现同样失败 —— 结果一致。

### 行政收尾清单

| # | 项目 | 结果 |
|---|------|------|
| 1 | C6 文档更正（任务文档 / 设计文档 / 交接文档 / 审核记录 / 领域注释与测试措辞） | ✅ 完成 |
| 2 | C7 记录为经接受的行为变更（含 B25 旧外层 catch 语义） | ✅ 完成 |
| 3 | characterization 测试补充（旧外层结果：`null` → 降级；畸形 `titleZh` → 日志副作用降级） | ✅ 完成（+4 测试） |
| 4 | 轻量/完整验证（vitest / tsc / build / lint / smoke） | ✅ 完成 |
| 5 | 删除临时审核 ZIP（v1/v2/v3） | ✅ 完成 |
| 6 | 建立唯一 Phase 4 基线提交 | ✅ `feat: establish reading content pipeline architecture` |

### 审核通过与既有基线声明

1. **Phase 4 已通过最终外部审核**（v3：架构与生产实现 Accepted；C6 更正 + C7 记录后 Blocking Issues = None，
   Phase 5 Release Decision = Approved after administrative closeout）。
2. **Reading 现在是已批准的参考确定性 Content Pipeline**：交付层 → Use Case → Workflow（显式步骤 + 事件）
   → Ports → Domain 纯规则 → Infrastructure Adapters。后续内容管线迁移照此样板。
3. **Phase 2 受保护测试保持完好**：95 tests 全部保留并通过（SM-2 / 工具函数 / 缓存 / 离线结构化输出契约 / 内容质量），
   `tests/smoke/api-smoke.sh` 未修改。
4. **Phase 3 AI Client 基线保持完好**：89 tests 全部保留并通过；`AIClientPort` / `AIClient` / `structured-output`
   / `retry` / `DeepSeekAdapter` 均未修改。
5. **Phase 5 可以直接在 Workflow 的显式步骤事件边界上构建 Trace / 可观测性**（`ReadingPipelineEvent`：
   feed / candidates / article / trim / earlyExit），本阶段未实现 Trace 存储。
6. **C6 是行为保持**（根为 JSON `null`：旧外层 catch 降级 + 文章入库 = 新链路结果），**不是**行为变更。
7. **C7 是经审核接受的畸形输出行为变更**（畸形 truthy 非字符串 `titleZh` 由"日志副作用导致的降级"
   改为"确定性判失败、不入库"）。
