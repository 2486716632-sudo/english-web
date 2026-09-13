# Content Pipeline 设计 — Phase 4

**日期:** 2026-09-13
**状态:** 已实现，等待外部审核（Phase 4 = In Review）
**范围:** **一条** Content Pipeline（Reading 内容摄取）迁移到已批准的四层架构
**复用:** Phase 3 已批准的 `AIClientPort` / `AIClient` / `DeepSeekAdapter`

---

## 1. 选中的参考 Pipeline

**Reading 内容摄取管线** —— 触发方式 `npm run push:reading` → `scripts/reading-push.ts`。

覆盖链路：`RSS 抓取 → 正文抽取 → AI 结构化输出 → 业务校验 → 持久化 → 运行级裁剪`。

### 为什么选它

| 维度 | 说明 |
|------|------|
| 代表性 | 项目里唯一同时包含「外部内容源 + AI 结构化输出 + 数据库写入 + 运行级清理」的确定性多步管线 |
| 结构化输出复杂度 | 真实需要 JSON 契约（titleZh / summaryZh / vocabItems[]）与字段级校验 |
| 持久化行为 | 写入 Article + 嵌套 ArticleVocab，并按上限删除最旧文章 |
| 当前可测试性 | **0 测试**，且全部依赖（RSS / HTTP / AI / DB）都可通过端口替换 → 改造收益最大 |
| 迁移风险 | 中：行为面多，但每条都可通过 B 清单固定；无 UI、无 TTS、无文件系统 |
| 冻结约束 | 不受冻结（Reading 不在冻结清单内） |
| 与既有决策一致 | `MIGRATION_PLAN.md` Phase 4 与 `DECISIONS.md` ADR-009 均指定 Reading Pipeline 为首个样板 |

### 候选比较（摘要）

| 候选 | 结论 | 原因 |
|------|------|------|
| A. Reading 内容摄取管线 | ✅ 选中 | 见上表 |
| B. `POST /api/reading/[id]/vocab` | ❌ | 单词级富化 + SRS 多表写入，不是内容管线 |
| C. `POST /api/words/themes/generate` | ❌ | Words 相关需用户授权；Phase 3 已排除 |
| D. Listening refill（含 TTS/文件系统） | ❌ | 依赖 TTS 与音频资产，超出本阶段 |
| E. Coach / scene 生成 | ❌ | 冻结模块 |

完整对比见 `docs/refactor/tasks/phase-4-task.md` Part 2。

---

## 2. Before 执行地图（迁移前）

| 关注点 | 迁移前位置 |
|--------|-----------|
| 触发 | `npm run push:reading` → `tsx scripts/reading-push.ts`（CLI，无 HTTP Route） |
| 全部逻辑 | `scripts/reading-push.ts`（单文件约 330 行） |
| Prompt | 内联在该文件 |
| AI 调用 | 直接 `fetch` DeepSeek（未走统一层） |
| 解析 | `JSON.parse(raw)` 裸调 + 字段兜底 |
| 业务规则 | 内联（正文长度阈值、难度启发式、词汇条数上限、excerpt） |
| 持久化 | 脚本内直接 Prisma（自建 pg Pool + PrismaPg） |
| RSS / 抽取 | 脚本内 rss-parser / JSDOM + Readability |
| 测试 | 无 |

### 迁移前步骤（顺序）

```
1 读配置 → 2 校验 API Key → 3 建 Prisma
4 遍历 5 个 feed：按 link 去重 + 合并 tag
5 洗牌候选 → 6 与 DB 去重（url 原样集合 / title 小写集合）→ 7 取前 N
8 逐条：RSS HTML 或 HTTP 抓取 → Readability 抽取
      → 正文 < 100 字符则跳过（不调 AI / 不入库）
      → DeepSeek（单次请求，失败降级为空结果）
      → difficulty 启发式 → prisma.article.create（嵌套 vocabItems）
      → sleep 1500ms
9 裁剪：> 50 篇则删除最旧 N 篇（先 ArticleVocab 后 Article，无事务）
10 输出日志 → finally 断开数据库
```

（逐条行为约束见任务文档 §2.3 的 B1–B23）

---

## 3. After 执行地图（迁移后）

```
npm run push:reading
  └─ scripts/reading-push.ts                    【交付层】配置 + 事件 → 操作员日志 + 退出码
       └─ IngestReadingArticlesUseCase          【Application】入口：配置校验 → 调 Workflow → 结果/错误映射
            └─ ReadingPipelineWorkflow          【Application】显式步骤编排 + 事件流
                 ├─ FeedSourcePort              ← RssFeedSource（Infrastructure: rss-parser）
                 ├─ ArticleExtractorPort        ← ReadabilityArticleExtractor（JSDOM + Readability）
                 ├─ ReadingArticleRepositoryPort← PrismaReadingArticleRepository（Prisma）
                 ├─ AIClientPort                ← AIClient + DeepSeekAdapter（Phase 3，复用）
                 └─ domain/reading/*           纯规则：长度阈值 / 难度 / excerpt / 条数上限 / AI 输出契约
```

### Workflow 的 4 个显式步骤（Phase 5 Trace 的挂点）

| 步骤 | 名称 | 做什么 | 失败语义 |
|------|------|--------|---------|
| 1 | `collectCandidates` | 遍历 feeds、按 link 去重、合并 tag | **致命**：抛 `ApplicationError('feed_unavailable')`（与迁移前一致） |
| 2 | `selectNewArticles` | 洗牌 → 与 DB 去重 → 取前 N | **致命**：`ApplicationError('persistence_failed')` |
| 3 | `processArticles` | 逐条：抽取 → 长度校验 → AI（提取 → 归一化）→ 持久化 → 限速 | **隔离**：单条失败只计数，循环继续（抽取失败 / 归一化失败 / 写库失败） |
| 4 | `trimToLimit` | 超出上限时删除最旧文章 | **致命**：`ApplicationError('persistence_failed')` |

每条步骤都会发出结构化事件（`ReadingPipelineEvent`），交付层用它生成日志；
Phase 5 将在同一位置挂接 Trace，**无需改动编排逻辑**（本阶段不实现 Trace 存储）。

---

## 4. 各层职责

### 4.1 Use Case（`IngestReadingArticlesUseCase`）

- 是**唯一的应用入口**（CLI 调用它；未来若有 Route/定时任务，同样调用它）
- 负责配置级校验（feeds 非空、url/tag 非空、maxPerRun/maxArticles 为正整数、可选项非负）
- 负责调用 Workflow 并把结果作为应用 DTO 返回
- 负责把非应用级异常包装为 `ApplicationError('unexpected')`（保留 `cause`）
- **不**包含：HTTP 语义、provider 细节、Prompt 文案、SQL、纯业务规则

### 4.2 Workflow（`ReadingPipelineWorkflow`）

- 编排上述 4 个步骤，使真实存在的流程显式化（**没有发明新步骤**）
- 决定每条文章的容错策略（AI 降级 / 单条失败隔离 / 限速）
- 通过 Ports 调用外部能力，通过 Domain 纯函数做业务判断
- 发出步骤事件（日志 / 未来 Trace）
- **不**包含：Prisma 调用、Prompt 文案、provider 参数、环境变量

### 4.3 Domain（`domain/reading/`）

| 文件 | 内容 | 为何属于 Domain |
|------|------|----------------|
| `types.ts` | `ReadingVocabItem`、`ArticleProcessingResult`、`ArticleDifficulty` | provider-independent 的内容契约 |
| `content-rules.ts` | `MIN_ARTICLE_CONTENT_CHARS`、`MAX_VOCAB_ITEMS`、`MAX_EXCERPT_CHARS`、`hasSufficientContent`、`difficultyFromContentLength`、`buildExcerpt`、`limitVocabItems` | 学习内容的质量/难度规则，纯函数 |
| `ai-response-rules.ts` | `normalizeArticleProcessingPayload`（+ 内部字段归一化） | 对 AI 输出做**归一化与旧语义兜底**（纯函数）；不可安全恢复的负载返回 `ok: false` |

Domain 不依赖 Next.js / Prisma / AI Client / 文件系统，也不 orchestrate 步骤。

> 边界说明：AI 输出的**结构/类型**校验放在 Domain（纯函数），
> 而"如何从模型响应里提取 JSON"属于 Infrastructure（`structured-output.ts`）。

### 4.4 Ports（Application）

| Port | 方法 | 说明 |
|------|------|------|
| `FeedSourcePort` | `fetchFeed(url)` | 取回 feed 条目（不做去重/抓取） |
| `ArticleExtractorPort` | `extract({url, html?})` | 抽取正文 / HTML / 配图 |
| `ReadingArticleRepositoryPort` | `listExistingUrls` / `listExistingTitles` / `createArticle` / `countArticles` / `findOldestArticleIds` / `deleteArticlesWithVocab` | 管线真正用到的**最小**读写集合 |
| `AIClientPort` | `chat` / `chatStructured` | Phase 3 已批准，直接复用 |

- 不引入通用 Repository 框架；不引入工作流框架；不引入 DI 框架。
- Repository 的查询保持与迁移前一致的返回形状（url 原样、title 原样），
  大小写归一化留在 Application 层，避免把既有行为挪进适配器而改变语义。

### 4.5 Infrastructure Adapters

| Adapter | 实现 | 保留的行为 |
|---------|------|-----------|
| `RssFeedSource` | `rss-parser` | 同一个库、同样的 `parseURL` |
| `ReadabilityArticleExtractor` | JSDOM + Readability | 固定 UA、`og:image` → 首个 `<img>`、错误文案 `HTTP {status} for {url}` / `Readability failed to parse content` |
| `PrismaReadingArticleRepository` | Prisma | 嵌套 create、`createdAt asc` 取最旧、先删 ArticleVocab 再删 Article（无事务） |
| `createStandalonePrismaClient` | pg Pool + PrismaPg | CLI 的数据库连接方式与迁移前完全一致（含 DATABASE_URL 去引号），并支持显式 `disconnect` |
| AI Client | Phase 3 `AIClient` + `DeepSeekAdapter` | 未修改；管线只通过 `AIClientPort` 使用 |

### 4.6 Composition Root

`src/bootstrap/reading-composition.ts`：

```
createStandalonePrismaClient() → PrismaReadingArticleRepository
RssFeedSource + ReadabilityArticleExtractor
DeepSeekAdapter + AIClient
  → ReadingPipelineWorkflow(deps, { onEvent })
  → IngestReadingArticlesUseCase
返回 { useCase, disconnect }
```

**为什么与 `src/bootstrap/index.ts`（assistant）分开成两个文件：**

1. 避免把 CLI 专用基础设施（`rss-parser` / `jsdom` / `node-postgres`）拉进 Next 服务端打包；
2. 避免 CLI 加载 `@/lib/prisma`（那是 Next 用的 Neon serverless 单例，会在模块加载时建连 + warmup），
   从而保持 CLI 的数据库连接行为与迁移前一致。

两者同属 Composition Root 层；TARGET_ARCHITECTURE §17.2 R2 允许"按模块分开装配"。

---

## 5. 结构化输出边界（productionization）

### 5.0 旧实现的控制流结构（理解 C6 / C7 的前提）

```js
// scripts/reading-push.ts（迁移前）
let dsResult = null
try {
  dsResult = await processWithDeepSeek(title, contentText)   // 内层：JSON.parse + 逐字段兜底
  console.log(`… DeepSeek: titleZh="${dsResult.titleZh.slice(0, 30)}…", N vocab items`) // ← 日志在同一个 try 内
} catch (err) {
  console.log(`… ⚠ DeepSeek failed: …`)
  dsResult = { titleZh: '', summaryZh: '', vocabItems: [] }   // ← 任何异常都被转成"降级"
}
// 之后：article.create({ titleZh: dsResult.titleZh || null, summary: dsResult.summaryZh || excerpt, … })
```

关键点：**内层抛错** ≠ **文章失败**。外层 catch 会把 AI 步骤的任何异常（包括日志里的 `.slice()` TypeError）
统一降级为空结果，文章仍然入库。只有**写库阶段**的失败才会让该条文章计入 failed。

### 5.1 三个关注点，三段职责（v2 修正后的模型）

| 关注点 | 归属 | 实现 |
|--------|------|------|
| Prompt 文本 | Application | `application/prompts/reading/process-article.prompt.ts`（逐字复制迁移前的 prompt） |
| JSON **提取**（fence 剥离 / 括号切片 / 解析失败判定） | Infrastructure | Phase 3 `structured-output.ts`（**未修改**） |
| 负载 **归一化**（逐字段兜底 + 不可恢复判定） | Domain | `domain/reading/ai-response-rules.ts` → `normalizeArticleProcessingPayload()` |
| 负载 **契约适配** | Application | `articleProcessingPayloadSchema`（`AIStructuredSchema<unknown>`：只表达"已成功解析出 JSON"） |
| 调用 | Application Workflow | `aiClient.chatStructured(request, articleProcessingPayloadSchema, { maxRepairAttempts: 0 })` |

**为什么 schema 是宽松的：** 旧 Reading 管线对 AI 负载是**逐字段兜底**
（`titleZh || ''`、`Array.isArray(vocabItems) ? … : []`），而不是"整包不合法就全部丢弃"。
因此"负载是否可用"不是 JSON 层面的契约，而是领域层的归一化逻辑：
把严格 schema 当作契约会改变旧行为（v1 的错误做法）。
**这不削弱 Phase 3 的通用 AI Client** —— 宽松 schema 只在本管线内部使用。

### 5.2 原始负载 vs 归一化结果（类型模型，v2 修正）

```
RawArticleProcessingPayload / RawReadingVocabItem   （运行时其实是 unknown；type?: string）
        │  normalizeArticleProcessingPayload()  ← 逐字段兜底 + 不可恢复判定
        ▼
ArticleProcessingResult / ReadingVocabItem          （type: string；字段类型确定）
        │  Workflow 映射
        ▼
NewReadingVocabItem / NewReadingArticle             （持久化形状）
```

原始条目允许省略 `type`（旧实现 `v.type || 'word'`），归一化后**保证**为具体字符串，
因此类型守卫与声明类型一致，不需要任何类型断言。

**falsy 兜底的精确规则（v3 修正）** —— 与旧实现的 `||` 完全一致：

| 字段 | 旧实现 | falsy（`undefined` / `""` / `null` / `false` / `0`） | truthy 字符串 | truthy 非字符串（`5` / `{}` / `[]` / `true`） |
|------|--------|--------------------------------------------------|--------------|--------------------------------------------|
| `type` | `v.type \|\| 'word'` | → `"word"` | 原样保留 | **失败**（旧实现会在写库阶段失败） |
| `partOfSpeech` | `v.partOfSpeech \|\| null` | → `null` | 原样保留 | **失败**（同上） |

`word` / `definition` / `contextSentence` 的校验**没有放宽**：必须是字符串（空串合法，与旧实现一致），
非字符串即失败。归一化实现全部使用局部变量 + 控制流收窄，**不包含任何类型断言**。

### 5.3 逐条对齐旧语义（characterization）

| 情况 | 旧管线行为 | Phase 4 归一化行为 |
|------|-----------|-------------------|
| A. 缺少 `vocabItems` + 合法标题摘要 | 保留标题摘要，词汇 `[]`，文章入库 | ✅ 相同 |
| B. `vocabItems` 非数组 + 合法标题摘要 | 保留标题摘要，词汇 `[]`，文章入库 | ✅ 相同 |
| C. 缺少 `titleZh` | `titleZh = ''`，摘要与词汇保留，文章入库 | ✅ 相同 |
| D. 缺少 `summaryZh` | `summaryZh = ''`，标题与词汇保留，文章入库 | ✅ 相同 |
| E. 非法嵌套词汇条目 | 写库阶段抛错 → **该条 failed、不入库** | ✅ 相同结果（在归一化阶段判定失败 → 该条 failed、不入库），仅日志文案不同 |
| F. 完全合法负载 | 全部保留 | ✅ 相同 |
| 根为 `null` | 内层归一化抛 TypeError → **外层 AI catch 转成降级** → 文章入库 | ✅ **相同（C6 = 行为保持）**：Phase 3 边界同样判为 `invalid_response` → 降级 → 文章入库 |
| `summaryZh` 为 truthy 非字符串 | 带到写库 → 该条 failed | ✅ 相同（归一化阶段判定失败） |
| `titleZh` 为 truthy 非字符串（number / boolean / plain object） | **日志 `.slice()` 抛错 → 外层 catch 降级 → 文章入库** | ⚠️ 变更 **C7**：确定性判为失败（该条 failed、不入库） |
| 词汇超过 10 条 | 先 `slice(0, 10)` 再交给写库 | ✅ 相同（第 11 条起不参与校验） |
| `type` / `partOfSpeech` 为 falsy | `\|\|` 兜底 | ✅ 相同（见 §5.2 falsy 规则表） |
| `type` / `partOfSpeech` 为 truthy 非字符串 | 带到写库 → 该条 failed | ✅ 相同（归一化阶段判定失败） |

**C6 = 行为保持（v4 更正）：** 旧实现的**内层** `processWithDeepSeek` 在 `null` 上抛 TypeError，
但**外层** AI try/catch（见 §5.0 的旧代码结构）把它转成空结果并继续持久化 —— 所以旧链路最终是
"降级 + 文章入库"。新链路（Phase 3 边界 → `invalid_response` → Workflow 降级）得到**相同**结果。
`src/application/workflows/__tests__/reading-pipeline.structured-output-boundary.test.ts` 用**真实**
`AIClient` + 内存假 provider 验证了这一点：`chatStructured()` 抛 `AIError('invalid_response')`，
Workflow 端到端 `pushed=1 / degraded=1 / failed=0`。

**C7 = 有意变更（v4 新增）：** 畸形 truthy 非字符串 `titleZh`（number / boolean / plain object）在旧实现中
会因为**操作员日志** `dsResult.titleZh.slice(0, 30)` 抛错而被外层 catch 降级（文章仍入库）。
该结果依赖日志副作用，不应固化为领域行为；新实现由归一化边界确定性地判为失败（该条 failed、不入库）。
特例：数组带 `Array.prototype.slice`，旧实现会继续走到写库并在那里失败 —— 新实现同样失败，结果一致。
影响面仅限畸形 AI 负载，正常 provider 输出不受影响。

**为什么 `maxRepairAttempts: 0`：** 迁移前"解析失败 → 降级"是单次请求语义；
启用解析修复会引入额外 provider 请求并可能改变结果，属于行为变更，需显式授权（见 §7）。

Phase 2 的离线契约测试**未被修改**，继续作为基线；Phase 4 只为本管线生产化归一化逻辑。

---

## 6. 持久化边界

- Workflow 通过 `ReadingArticleRepositoryPort` 写入，**完全不接触 Prisma**。
- 适配器保留迁移前的写法：单条 `create` + 嵌套 `vocabItems.create`（**无事务**）。
- 裁剪同样是两条独立 `deleteMany`（先词汇后文章），**无事务** —— 保持现状（任务文档 D4 记录）。
- 唯一被移除的冗余：无。迁移前在裁剪前与结尾各 `count()` 一次，迁移后**仍是两次**。
- 不修改 schema、不执行 migration。

---

## 7. 错误传播

### 分层模型（本管线）

| 失败类型 | 产生位置 | 归一化 | 交付层表现 |
|---------|---------|--------|-----------|
| 配置非法（feeds 为空等） | Use Case 校验 | `ApplicationError('invalid_input')` | 打印 + `exit(1)` |
| feed 取回失败 | Workflow step 1 | `ApplicationError('feed_unavailable')`（message 保留原文） | 打印 + `exit(1)`，整轮中止（与迁移前一致） |
| 去重查询失败（step 2） | `ReadingArticleRepositoryPort` | `ApplicationError('persistence_failed')` | 打印 + `exit(1)` |
| AI 超时 / provider 失败 / 响应不可解析为 JSON | `AIClientPort` → `AIError` | Workflow **不向上抛**：降级为空结果，文章仍入库 | 日志 `⚠ DeepSeek failed: …` |
| AI 负载无法安全归一化（非法嵌套条目、truthy 非字符串字段） | Domain 归一化 | 记为该条失败（**不降级**） | 日志 `✗ Failed: …`，循环继续 |
| 抽取失败（HTTP / Readability） | Workflow step 3 | 记为该条失败 | 日志 `✗ Failed: …`，循环继续 |
| 单条写库失败（`createArticle`） | Workflow step 3 | **隔离**：记为该条失败，**不中止整轮** | 日志 `✗ Failed: …`，循环继续 |
| 统计 / 取最旧 / 裁剪删除失败（step 4） | `ReadingArticleRepositoryPort` | `ApplicationError('persistence_failed')` | 打印 + `exit(1)` |

- 复用 Phase 3 的归一化 `AIError`，不重复造 AI 错误类型。
- `ApplicationError` 只有 4 个错误码，刻意保持精简。
- **每个错误码都必须由真实路径产生**（v2 修正）：`persistence_failed` 现在确实由运行级仓储操作抛出，
  单条文章写库失败不会被升级为整轮失败，也不会被错标成 `persistence_failed`。
- provider 细节不以结构化形式外泄：交付层只打印 message，`code` 供未来自动化判断，
  `cause` 保留原始错误。**日志分类与控制流与迁移前一致，但底层错误文案可能因归一化而不同**
  （例如 AI 步骤的文案来自归一化 `AIError`，归一化失败来自领域原因字符串）。

---

## 8. 重试与幂等分析

| 步骤 | 是否可安全重试 | 说明 |
|------|---------------|------|
| 读取 feed | ✅ | 只读 |
| 与 DB 去重查询 | ✅ | 只读 |
| 正文抽取（HTTP + Readability） | ✅ | 无副作用 |
| AI 调用（`chatStructured`） | ✅ | 无副作用；本管线**显式关闭**网络重试与解析修复 |
| 负载归一化 | ✅ | 纯函数，无副作用；失败只影响该条（该条不入库） |
| 写库（`article.create`） | ⚠️ 谨慎 | 重复执行会产生重复文章；当前依赖"运行前按 url/title 去重"作为幂等保护 |
| 裁剪删除 | ❌ | 删除最旧文章，重复执行会继续删（但受"总数 > 上限"守卫，正常不会重复触发） |
| 限速 sleep | — | 无副作用 |

**关键结论：**

- AI 重试发生在持久化**之前**，不会产生副作用（且本管线实际只发一次请求）。
- 单条文章的持久化在流程中只执行一次；上游失败（抽取失败）时**不会**执行持久化（有测试覆盖）。
- 幂等保护仅有"运行前的 url/title 去重"，**没有**事务或唯一约束级别的保护：
  同一篇文章若在两次运行之间被并发写入，理论上可能出现重复行。**属于既有行为，本阶段不修复**，
  记录为延后技术债（见 §11）。
- 未引入幂等框架（管线不需要）。

---

## 9. 测试策略

全部离线（fake Ports + fake `AIClientPort`），不访问网络、不调用真实 AI/TTS、不连数据库。

| 层 | 文件 | 测试数 | 覆盖 |
|----|------|--------|------|
| Domain | `domain/reading/__tests__/content-rules.test.ts` | 10 | 阈值、难度边界（1500/3000）、excerpt 顺序、条数上限 |
| Domain | `domain/reading/__tests__/ai-response-rules.test.ts` | 6 | AI 输出契约（合法/空值/类型错误/嵌套非法） |
| Application | `application/workflows/__tests__/reading-pipeline.workflow.test.ts` | 14 | 完整流程、步骤顺序、AI 降级、结构校验失败、抽取失败隔离、写库失败隔离、早期退出、裁剪、AI 请求形状、prompt 截断 |
| Application | `application/use-cases/reading/__tests__/ingest-reading-articles.use-case.test.ts` | 14 | 入口契约、配置校验、错误映射、与真实 Workflow + fake Ports 的端到端组合 |
| Infrastructure | `infrastructure/db/__tests__/reading-article.repository.test.ts` | 6 | 查询形状、写入映射、裁剪顺序、空数组守卫 |
| Infrastructure | `infrastructure/article-extraction/__tests__/readability-article-extractor.test.ts` | 7 | 配图提取、跳过 HTTP、UA、错误文案、空正文 |

**必需覆盖（任务 Part 9）对照：** ① 完整流程 ✅ ② AI 失败 ✅ ③ 结构化校验失败 ✅
④ 持久化失败 ✅ ⑤ 步骤顺序 ✅ ⑥ 上游失败不持久化 ✅ ⑦ Use Case + fake Ports ✅
⑧ Repository Adapter ✅ ⑨ Route — 本管线**没有 HTTP Route**（触发面是 CLI 脚本，无稳定注入缝），
等价 HTTP 面 `/api/reading/push` 是**另一个**非 AI 操作，未迁移（见 §10）。

---

## 10. 延后的迁移（Deferred）

| # | 项 | 说明 |
|---|----|------|
| D1 | `POST /api/reading/push` | 接收已处理好的文章直接写库（无 AI、无多步），属于另一条轻量写路径 |
| D2 | `POST /api/reading/[id]/vocab` | 单词入 SRS + `enrichWord` AI 调用（多表写入） |
| D3 | `GET /api/reading`、`GET /api/reading/[id]` | 只读 + 本地 JSON 音标查询 |
| D4 | Listening refill 管线 | 含 TTS + 音频文件系统 |
| D5 | Words themes / scene / coach | 授权范围或冻结模块 |
| D6 | 其余 9 个 AI 调用点 | 逐模块迁移（Phase 3 清单） |

---

## 11. 已知风险与延后技术债

| # | 项 | 类型 | 处置 |
|---|----|------|------|
| R1 | url 去重大小写不对称（候选小写化 vs DB 原样） | 既有行为 | 保留（B6），记录 |
| R2 | 并发运行可能写入重复文章 | 既有行为 | 延后（需要唯一约束或事务，属 schema/迁移范围） |
| R3 | 裁剪无事务（先词汇后文章） | 既有行为 | 保留并记录（D4） |
| R4 | AI 调用现在有界超时（120s） | **有意变更（C1）** | 审核方已接受 |
| R5 | fence 包裹的 JSON 现在可被解析 | **有意变更（C2）** | 审核方已接受 |
| R6 | 非法嵌套负载的失败时机提前（结果不变） | **有意变更（C3）** | 结果与旧实现一致（该条 failed、不入库），仅日志文案不同 |
| R11 | 运行配置非法时快速失败（`invalid_input`） | **有意变更（C5）** | 旧 CLI 依赖 `slice()` 的隐式行为；新实现明确失败，属安全改进 |
| R12 | 畸形 truthy 非字符串 `titleZh`：旧实现因日志 `.slice()` 副作用而降级入库，新实现确定性判失败 | **有意变更（C7，已获审核接受）** | 旧行为依赖日志运行时意外，不应固化为领域规则；影响面仅限畸形负载 |
| R14 | 根为 JSON `null` 的负载 | ✅ **非变更（C6 = 行为保持）** | 旧实现内层抛错但被外层 AI catch 降级 → 文章入库；新链路结果相同 |
| R7 | `publishedAt` 未校验（可能 Invalid Date） | 既有行为 | 保留并记录 |
| R8 | CLI 脚本本身无自动化测试（自执行、无注入缝） | 结构限制 | 逻辑已 100% 位于可测层；CLI 仅做配置与日志映射 |
| R9 | 无 Trace / 指标持久化 | 属于 Phase 5 | 已预留事件边界 |
| R10 | `chatStructured()` 现在有真实生产调用方，但解析修复仍未启用 | 有意（C4） | 需要显式授权才能改变 |
| R13 | 归一化失败的错误文案由数据库错误变为领域原因 | 有意（C3） | 日志分类（`✗ Failed:`）与控制流保持一致 |
