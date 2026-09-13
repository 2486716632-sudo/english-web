# Phase 4 任务定义 — 重构一条 Content Pipeline 样板

## 任务属性

| 属性 | 值 |
|------|-----|
| **Phase** | 4 |
| **名称** | 重构一条 Pipeline 样板（Reading Content Pipeline） |
| **状态** | In Progress |
| **前置条件** | Phase 0–3 全部 Completed / Approved；Git 基线 `045b642`（分支 `master`，工作区干净）；Phase 2 + Phase 3 受保护基线 184 tests 全绿 |
| **开始日期** | 2026-09-13 |
| **参考 Pipeline** | Reading 内容摄取管线（`npm run push:reading` → `scripts/reading-push.ts`） |
| **复用** | Phase 3 统一 AI Client（`AIClientPort` / `AIClient` / `DeepSeekAdapter`） |

---

## 目标

把**一条**已存在的确定性多步内容管线迁移到已批准的四层架构，证明架构可以承载：
多步骤编排、结构化 AI 输出、校验、持久化与错误传播。

目标链路：

```
触发（CLI / API）
  → Application Use Case
  → Workflow（显式步骤边界）
  → Domain 校验 / 学习规则（纯逻辑）
  → Application Ports
  → Infrastructure Adapters（复用 Phase 3 AI Client）
  → 外部系统（RSS / HTTP / DeepSeek / PostgreSQL）
```

**不**迁移第二条管线；**不**创建 Agent；**不**实现 Trace 系统。

---

## Part 1 — Before 执行地图（以当前仓库为准）

### 1.1 触发与文件

| 项 | 内容 |
|----|------|
| 触发 | `npm run push:reading` → `tsx scripts/reading-push.ts`（**CLI 交付面**，非 HTTP Route） |
| 主要文件 | `scripts/reading-push.ts`（全部逻辑，约 330 行） |
| 相关但独立的 HTTP 面 | `POST /api/reading/push`（接收已处理好的 article + vocabItems 直接写库，**不含 AI**）、`GET /api/reading`（列表）、`GET /api/reading/[id]`（详情 + 音标 JSON 读取）、`POST /api/reading/[id]/vocab`（词汇加入 SRS，含 AI enrich） |
| 数据库模型 | `Article` + `ArticleVocab`（`prisma/schema.prisma`，冻结，不改） |

### 1.2 当前执行步骤（严格顺序）

```
1. 读取配置：MAX_ARTICLES=50、MAX_PER_RUN=env || 8、DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL
2. 若 DEEPSEEK_API_KEY 缺失 → console.error + process.exit(1)
3. 自建 PrismaClient（pg Pool + PrismaPg；DATABASE_URL 去掉首尾引号）
4. 对 5 个 The Conversation Atom feed 依次 parseURL：
     每个 item 按 link 去重进 Map；重复链接合并 tag（tech/environment/health/business/society）
5. shuffleArray(candidates)（就地洗牌，Math.random）
6. 从 DB 读现有 url 集合（原始大小写）与 title 集合（小写+trim）
7. 过滤：candidate.link.toLowerCase().trim() ∈ urls → 丢弃；
        candidate.title.toLowerCase().trim() ∈ titles → 丢弃
8. 取前 MAX_PER_RUN 条
9. 逐条处理（每条独立 try/catch，失败只计数不中断）：
   9a. rssHtml = item.content || ''（非空则用它，否则 HTTP 抓取，UA=Mozilla/5.0 (compatible; EnglishLearningBot/1.0)，
       非 2xx → throw `HTTP {status} for {url}`）
   9b. JSDOM + Readability → textContent / htmlContent / imageUrl（og:image 或首个 <img>）
       解析失败 → throw 'Readability failed to parse content'
   9c. textContent.length < 100 → 记 log、跳过（不计失败、不调 AI、不写库）
   9d. DeepSeek：model=deepseek-chat、temperature=0.3、response_format=json_object、
       **无 max_tokens、无超时、无重试**；user 内容截断到 4000 字符 + '...'
       期望输出 JSON：{ titleZh, summaryZh, vocabItems[{word,type,partOfSpeech,definition,contextSentence}] }
   9e. `JSON.parse(raw)` 直接解析（**不剥离 markdown fence**）；
       任何失败（HTTP 非 2xx / 空内容 / JSON 非法）→ 记 log + 降级为 { titleZh:'', summaryZh:'', vocabItems:[] }
       —— **文章仍然入库**
   9f. vocabItems 截断到 10；difficulty = len>3000?4 : len>1500?3 : 2
   9g. prisma.article.create(...)（含嵌套 vocabItems.create；phonetic 显式为 null）
       summary = summaryZh || excerpt；summaryEn = excerpt；excerpt = textContent 前 300 字符、空白折叠、trim
   9h. pushed++；sleep(1500) 限速
10. 裁剪：count() > 50 → 取 createdAt asc 的最旧 N 条 id →
    先 deleteMany articleVocab(articleId in ids)，再 deleteMany article(id in ids)（**无事务**）
11. 输出统计日志；finally 中 prisma.$disconnect()
12. 未捕获异常 → main().catch → console.error + process.exit(1)
```

### 1.3 关注点归属（现状）

| 关注点 | 现状 | 目标 |
|--------|------|------|
| Prompt | 内联在 `scripts/reading-push.ts` | Application `prompts/reading/` |
| AI 调用 | 直接 `fetch` DeepSeek（未走统一层） | Application `AIClientPort`（Phase 3） |
| 结构化解析 | `JSON.parse` 裸调 + 字段兜底 | Application schema + Infrastructure 结构化边界 |
| 业务规则 | 内联（长度阈值、难度启发式、条数上限、excerpt） | Domain 纯函数 |
| 持久化 | 脚本内直接 Prisma | Application Repository Port + Infrastructure Adapter |
| RSS / 抽取 | 脚本内 rss-parser + JSDOM/Readability | Infrastructure Adapter |
| 编排 | 单函数流水账 | Application Workflow（显式步骤） |

### 1.4 当前测试

**无。** `scripts/reading-push.ts` 没有任何自动化测试；它依赖真实 RSS、真实网络、真实 DeepSeek、真实数据库。
Phase 2 基线明确把它列为"未覆盖行为（依赖 RSS + AI，Phase 4）"。

### 1.5 冻结 / 受保护区域

- `prisma/schema.prisma`：冻结（Article / ArticleVocab 结构不改）
- Phase 2 受保护测试（95）与 Phase 3 AI Client 测试（89）：不得删除/跳过/放宽
- 其余 4 条内容管线（Listening refill / Words themes / Coach / scene）、`/api/reading/*` 的其他端点：不在本阶段

### 1.6 发现但**不在本阶段修复**的技术债

| # | 现象 | 说明 |
|---|------|------|
| D1 | url 去重大小写不一致 | 候选 link 先 `toLowerCase().trim()`，而 DB url 集合存原始值；对 The Conversation（全小写 URL）无影响，但逻辑上不对称。**保持原样**并在设计中记录 |
| D2 | AI 调用无超时 | Phase 3 的 `AIClientPort` 强制有界超时；迁移后必然变为有界（见 B-变更说明） |
| D3 | 失败文章不重试 | 单次尝试，失败即跳过 |
| D4 | 裁剪无事务 | 先删 vocab 再删 article，无事务保护 |
| D5 | `publishedAt` 未做有效性校验 | `new Date(pubDate)` 可能得到 Invalid Date |
| D6 | `POST /api/reading/push` 无输入校验（vocabItems 形状） | 与本管线无关 |

---

## Part 2 — 参考 Pipeline 选择

### 2.1 候选比较

| 候选 | 多步 | 结构化 AI 输出 | 持久化 | 可测试性 | 冻结约束 | 迁移风险 | 结论 |
|------|------|---------------|--------|---------|---------|---------|------|
| **A. Reading 内容摄取管线**（`scripts/reading-push.ts`，`npm run push:reading`） | ✅ 6+ 步 | ✅ JSON（JSON.parse） | ✅ create + 级联删除裁剪 | 目前 0 测试，但端口边界清晰后完全可测 | ❌ 不受冻结 | 中（行为面多但可逐条固定） | ✅ **选中** |
| B. `POST /api/reading/[id]/vocab`（单词入 SRS + AI enrich） | 部分（查表 → AI → 3 次写库） | ✅ | ✅ | 需 DB 与 AI 双 seam | ❌ 不受冻结 | 中 | 单个词汇富化，非"内容管线"；多表写入耦合 SRS |
| C. `POST /api/words/themes/generate`（3 步 AI + 入库） | ✅ | ✅ ×3 | ✅ | 需 DB seam | ⚠️ Words 相关需用户授权 | 中 | 冻结授权范围，Phase 3 已排除 |
| D. Listening refill（`features/listening/lib/listening.ts` + `/api/listening/scenes/[id]`） | ✅ | ✅ | ✅ + 文件系统 + TTS | 依赖 TTS/音频文件 | ⚠️ schema 冻结 | 高（TTS + 文件系统 + 音频资产） | 超出本阶段"内容管线"范围 |
| E. Voice/scene 生成（`/api/scene/*`）、Coach 两步 | ✅ | ✅ | ❌ 无持久化 | — | 🔒 冻结 | — | 冻结模块，禁止迁移 |

### 2.2 选中：Reading 内容摄取管线

理由：

1. **代表性最强** — 真实覆盖"抓取 → 抽取 → AI 结构化输出 → 校验 → 持久化 → 裁剪"完整链路，
   是项目里唯一同时包含"外部内容源 + AI + 数据库 + 运行级清理"的确定性管线。
2. **不受冻结约束** — Reading 模块在 `CLAUDE.md` 的冻结清单之外。
3. **与 Phase 1/2/3 文档一致** — `MIGRATION_PLAN.md` Phase 4 与 `DECISIONS.md` ADR-009 均指定 Reading Pipeline 为首个样板。
4. **能让 Phase 3 的 AI Client 获得真实生产调用方** — 包括 `chatStructured()`（Phase 3 遗留 D2）。
5. **持久化边界最小** — 只需 Article/ArticleVocab 两张表的少量操作，无需通用 Repository 框架。
6. **可测性改造空间最大** — 目前 0 测试，全部依赖可通过端口注入替换。

> 未选 B：它是"单词级富化 + SRS 写入"，不是内容管线，且会把 SRS 规则拉进本阶段。
> 未选 C/D/E：分别属授权范围、含 TTS/文件系统、属冻结模块。

### 2.3 必须保持不变的既有行为（B 清单）

| # | 行为 | 现状 |
|---|------|------|
| B1 | 触发方式 | `npm run push:reading` 仍可直接运行 |
| B2 | 缺少 `DEEPSEEK_API_KEY` | 打印错误并 `exit(1)` |
| B3 | Feed 列表与 tag | 5 个 The Conversation feed（tech/environment/health/business/society） |
| B4 | 跨 feed 去重 | 按 link 去重，重复链接合并 tag |
| B5 | 候选洗牌 | 洗牌后再选取（多样性） |
| B6 | DB 去重规则 | 候选 link 小写化后与 DB url 比较；候选 title 小写+trim 后与 DB title 比较（**保留 D1 不对称**） |
| B7 | 单次运行条数 | `MAX_PER_RUN`（默认 8） |
| B8 | 抓取策略 | 优先 RSS HTML，否则 HTTP 抓取（UA 固定），非 2xx 抛错 |
| B9 | 正文抽取 | JSDOM + Readability；失败即该条失败 |
| B10 | 正文过短 | `< 100` 字符 → 跳过（不计失败、不调 AI、不入库） |
| B11 | AI 参数 | `deepseek-chat`、`temperature=0.3`、`json_object`、无 `max_tokens`、prompt 文案逐字不变 |
| B12 | AI 失败降级 | 任何 AI 失败 → 空结果；**文章仍入库** |
| B13 | 词汇条数 | 最多 10 条 |
| B14 | 难度启发式 | `>3000 → 4`，`>1500 → 3`，否则 `2` |
| B15 | 入库字段与取值 | 与现状逐字段一致（含 `phonetic: null`、`summaryEn = excerpt`、`tags.join(',')`、`source='The Conversation'`、`sourceEmoji='📰'`） |
| B16 | excerpt 规则 | 前 300 字符 + 空白折叠 + trim |
| B17 | 限速 | 每条之间 sleep 1500ms |
| B18 | 单条失败隔离 | 提取/写库失败只计数，循环继续 |
| B19 | 裁剪规则 | 多于 50 条时删除最旧 N 条（先 ArticleVocab 后 Article，无事务） |
| B20 | 收尾 | 结束时断开数据库连接；致命错误 → 打印 + `exit(1)` |
| B21 | **AI 负载逐字段兜底**（v2 补充） | `titleZh` / `summaryZh` 缺失或 falsy → `''`；`vocabItems` 缺失或非数组 → `[]`；**保留其余合法字段**（旧实现是逐字段兜底，而不是整包校验） |
| B22 | **非法嵌套词汇条目 → 该条失败**（v2 补充） | 旧实现不校验嵌套条目，直接交给 Prisma；`word` / `definition` / `contextSentence` 缺失或类型不符会在写库阶段抛错 → 该条计入 failed 且**不入库** |
| B23 | **词汇条数上限的生效顺序**（v2 补充） | 旧实现先 `slice(0, 10)` 再交给数据库；因此第 11 条起即使格式非法也不影响该条 |
| B24 | **`type` / `partOfSpeech` 的 falsy 兜底**（v3 补充） | 旧实现映射为 `type: v.type \|\| 'word'`、`partOfSpeech: v.partOfSpeech \|\| null`：`undefined` / `""` / `null` / `false` / `0` 一律走兜底（→ `"word"` / `null`）；只有 **truthy 非字符串**（`5` / `{}` / `[]` / `true`）才会在写库阶段失败 |
| B25 | **AI 步骤的外层 try/catch 语义**（v4 补充） | 旧实现把 AI 调用与**操作员日志**放在同一个 try/catch：`dsResult = await processWithDeepSeek(...)` 与 `console.log(\`… titleZh="${dsResult.titleZh.slice(0, 30)}…"\`)`。因此**任何**异常（内层解析抛错、或日志里 `.slice()` 抛错）都会被转成"空 AI 结果 + 文章仍然入库" |

### 2.4 有意且有文档记录的行为变更（需审核确认）

| # | 变更 | 原因 | 影响面 |
|---|------|------|--------|
| C1 | AI 调用现在**有界超时** | `AIClientPort` 强制每次请求有超时（架构要求，不存在无超时路径）。本管线显式传入宽裕超时 | 极端慢响应不再无限等待 |
| C2 | 结构化输出使用**生产解析边界** | Phase 3 已批准的 `chatStructured()` 会剥离 markdown fence 后再解析 | 模型返回 ```json 包裹时，从"降级为空"变为"正常使用" |
| C3 | **非法嵌套负载的失败时机提前**（v2 修正） | 旧实现在写库阶段才会因数据库类型拒绝而失败；现在在归一化阶段就判定失败 | **结果不变**（该条计失败且不入库）；只有日志里的错误文案不同（由数据库错误变为归一化原因）。注意：v1 曾错误地把它实现为"整包校验失败 → 全字段丢弃的降级"，v2 已恢复为旧语义（见 B21–B23） |
| C4 | 明确**不启用**网络重试与解析修复（`retry: {maxAttempts:1}`、`maxRepairAttempts:0`） | 保持"单次请求 + 失败即降级"的既有语义（与 Phase 3 参考迁移同一原则） | 无（保持现状） |
| C5 | **运行配置非法时快速失败**（v2 新增） | 旧 CLI 直接把 `MAX_PER_RUN` 交给 `Array.prototype.slice()`（`0`/负数/`NaN` 都会产生隐式行为，例如取 0 条或取全部）；新 Use Case 要求 `maxPerRun` / `maxArticles` 为正整数，否则抛 `ApplicationError('invalid_input')` 并终止 | 配置错误时从"静默异常行为"变为"明确失败"。这是**有意的安全改进**；正常运行路径（默认 8 / 50）行为完全不变 |
| C7 | **畸形 truthy 非字符串 `titleZh`**（v4 新增） | 旧实现里 `processWithDeepSeek` 会把 truthy 值原样返回，随后**操作员日志**的 `dsResult.titleZh.slice(0, 30)` 在 number / boolean / plain object 上抛 TypeError，被外层 AI catch 转成"降级 + 文章入库" | 新实现由归一化边界**确定性地**判为无效负载 → 该条 failed、不入库。理由：旧结果依赖日志副作用，不应被固化为领域行为；影响面仅限畸形 AI 负载，正常 provider 输出不变 |

> **注意（v4 更正）：** 根为 JSON `null` **不是**行为变更。
> 旧实现的内层归一化确实抛 TypeError，但该异常被外层 AI try/catch 转成"空结果 + 文章入库"（B25）；
> 新链路的最终结果同样是"降级 + 文章入库"。因此 **C6 属行为保持**，已从变更清单移出。

---

## Part 3 — 目标结构

```
层次              文件
────────────────────────────────────────────────────────────────
Domain            src/domain/reading/types.ts                领域类型
                  src/domain/reading/content-rules.ts        长度阈值/难度/excerpt/条数上限（纯函数）
                  src/domain/reading/ai-response-rules.ts    AI 输出契约校验（纯函数，生产 validator）

Application       src/application/errors.ts                  ApplicationError（少量错误码）
                  src/application/ports/feed-source.ts        FeedSourcePort
                  src/application/ports/article-extractor.ts  ArticleExtractorPort
                  src/application/ports/reading-article-repository.ts  ReadingArticleRepositoryPort
                  src/application/prompts/reading/process-article.prompt.ts  Prompt + 结构化 schema
                  src/application/workflows/reading-pipeline.workflow.ts     Workflow（显式步骤）
                  src/application/use-cases/reading/ingest-reading-articles.use-case.ts  Use Case（入口）

Infrastructure    src/infrastructure/rss/rss-feed-source.ts             rss-parser 实现
                  src/infrastructure/article-extraction/readability-article-extractor.ts
                                                                         JSDOM + Readability + og:image
                  src/infrastructure/db/reading-article.repository.ts    Prisma 实现
                  src/infrastructure/db/standalone-prisma.ts            CLI 专用 Prisma 工厂（保留原连接方式）

Composition       src/bootstrap/reading-composition.ts        装配 Reading 管线（不加载 Next/Neon 单例）

Delivery          scripts/reading-push.ts                     薄 CLI：配置 + 调用 Use Case + 日志/退出码
```

### 步骤边界（Workflow 内部显式命名，供 Phase 5 Trace 挂钩）

```
step 1  collectCandidates   → 读取 feeds、跨 feed 去重合并 tag
step 2  selectNewArticles   → 与 DB 去重、洗牌后取前 N
step 3  processArticle      → extract → checkLength → summarize(AI) → persist（每条独立）
step 4  trimToLimit         → 超出上限时删除最旧文章
```

---

## Part 4–8 设计要点（详见 `docs/refactor/CONTENT_PIPELINE_DESIGN.md`）

- **Use Case**：外部有意义的应用动作入口（`execute(config)`），负责输入校验、调用 Workflow、把结果/错误映射为应用级 DTO 与 `ApplicationError`。
- **Workflow**：编排显式步骤，不含 provider 细节、不含 Prisma、不含 Prompt 文案（从 Application prompt 文件取）。
- **Domain**：纯规则（长度阈值、难度、excerpt、条数上限、AI 输出契约校验），无 AI / Prisma / Next / 文件系统。
- **Ports**：FeedSourcePort、ArticleExtractorPort、ReadingArticleRepositoryPort（+ 复用 AIClientPort）。
- **Infrastructure**：rss-parser、JSDOM/Readability、Prisma；**复用** Phase 3 的 AIClient/DeepSeekAdapter，不绕过 AIClientPort。
- **结构化输出**：生产 validator = `domain/reading/ai-response-rules.ts`；由 Application schema 包装交给 `chatStructured()`。
- **持久化**：最小 Repository Port；保持"逐条 create + 无事务裁剪"的现状。
- **错误传播**：AI 错误在管线内降级（既有语义）；基础设施错误包装为 `ApplicationError` 后由交付层翻译；provider 细节不外泄到交付层文案之外（保持现状日志文本）。
- **重试/幂等**：单次尝试；AI 失败发生在持久化之前且无副作用；入库去重是唯一的幂等保护，见设计文档分析。

---

## 允许修改

- 选中的 Reading 管线：CLI、Use Case、Workflow、所需 Domain、Application Ports、Infrastructure Adapters、Composition Root
- 该管线所需的结构化输出生产 validator
- 本迁移所需测试与 fixture、Phase 4 文档、`PHASE_STATUS.md`、`DECISIONS.md`（仅当产生真实长期决策）
- 必要时最小配置变更（本阶段计划**不新增依赖**）

## 禁止修改

- 迁移第二条管线、进入 Phase 5、实现完整 Trace 系统
- 创建 Agent / Memory / RAG
- 移动无关 SM-2 逻辑、重设计 UI
- 修改 Prisma schema、执行数据库迁移
- 重构无关 Route（含 `/api/reading/*` 其它端点、其它模块 Route）
- 替换 Phase 3 AI Client、绕过 AIClientPort
- 引入工作流框架 / Kafka / 队列 / Temporal
- 为"作品集效果"添加抽象
- 修复无关技术债（D1–D6 仅记录）
- 在自动化测试中调用真实 AI / TTS

---

## 测试要求（不调用真实 AI/TTS）

至少覆盖：

1. 完整成功流程（多篇）
2. AI 失败 → 降级但仍入库
3. 结构化输出校验失败 → 降级
4. 持久化失败 → 该条计失败、流程继续
5. 步骤顺序（先抽取后 AI；先 AI 后持久化；过短内容不调 AI）
6. 上游失败后**不得**发生持久化
7. Use Case 使用 fake Ports 可测
8. Repository Adapter 行为（用 stub client）
9. Domain 纯规则

---

## 验收标准

1. Reading 管线可完全离线测试（fake Ports + fake AIClientPort）
2. B1–B25 行为保持不变；C1–C5 与 C7 有文档记录（C1/C2/C4 已获审核接受，C7 经外部审核接受）
3. Prisma 只出现在 Infrastructure；Domain 无 AI/Prisma/Next
4. 复用 Phase 3 AIClientPort，无直接 provider fetch
5. Phase 2（95）+ Phase 3（89）受保护基线全绿
6. `npx tsc --noEmit`、`npx next build`、Phase 3 lint 范围、新增 Phase 4 文件 lint 全部通过
7. HTTP 冒烟 14/14 不回归
8. Phase 4 = In Review；Phase 5 = Not Started（**不自行批准**）

---

## 状态管理

- 开始：Phase 4 → **In Progress**
- 实现完成：Phase 4 → **In Review**；Phase 5 → **Not Started**
- 执行者**不得**标记 Completed / Approved
