# Portfolio Engineering Criteria — 作品集级 AI 应用工程证据契约

**日期:** 2026-09-20
**状态:** **生效 / Active**（2026-09-20 经外部评审 **Approved**，Blocking Issues: None；
post-Phase-6 第二次路线修订产出的跨领域成功契约。该契约此前以
`Proposed / Pending External Review` 状态送审，R-01–R-07 修正已全部 resolved，
由本次行政收尾命令转为 `生效 / Active`）
**归属:** 本文件拥有**项目完成时必须存在的作品集级工程证据**。
`docs/refactor/MASTER_PLAN.md` 拥有**执行顺序**（Phase 路线图与核心原则）；
`docs/refactor/PHASE_STATUS.md` 拥有阶段状态与批准历史；`docs/refactor/DECISIONS.md`
拥有已接受决策（见 ADR-017 / ADR-018）。本文件不重述它们的权威内容。

> **这是什么。** 本文件是“这个项目要算作一个**强作品集级 AI 应用工程项目**，完成时必须
> 存在哪些证据”的合同。它不是技术名词清单，也不是“用什么框架”的规定。

---

## 0. 目的与边界

本文件与 `MASTER_PLAN.md` 的分工是刻意的：

| 文件 | 拥有的问题 |
|------|-----------|
| `MASTER_PLAN.md` | 我们**按什么顺序**执行（Phase 路线图与核心原则） |
| 本文件 | 项目完成时，必须存在**哪些证据**才算作品集级工程 |

**一条贯穿全文的规则：** 一项技术只有在具备**真实的产品或工程理由**时才可以进入生产。
本文件因此区分“必须存在的**工程实验**”与“必须存在的**生产能力**”——
做一次严肃、可测量的调查，**不等于**必须把该技术放进生产。

**证据形态规则。** 证据指可被第三方检查的**仓库产物**：文档、ADR、测试与评估数据集、
基准 / 实验报告、指标表、架构图、可运行的部署与验证命令。口头声称、一次性截图、
或“跑通了一次”不构成证据。

---

## 1. 分类模型（双轴）

每个标准由**两个正交的轴**描述。单轴分类会把 ADR、benchmark 报告、架构图、golden-set harness
或面试指南错误地标成“生产运行时能力”，因此本文件**不使用**单轴模型。

### 轴 A — 义务（obligation）

| 标记 | 名称 | 含义 |
|------|------|------|
| **MC** | Mandatory capability / evidence by completion / 完成时必须存在的能力或证据 | 到项目完成时必须存在，并由可检查的证据支撑 |
| **ME** | Mandatory engineering experiment / 强制工程实验 | 必须完成一次**可测量的工程调查**并留下证据；**生产采纳由证据决定** |
| **CP** | Conditional production adoption / 条件性生产采纳 | 只有在证据支持时才进入生产；**不进入生产是合法结果** |

### 轴 B — 证据 / 运行时表面（evidence / runtime surface）

| 标记 | 名称 | 含义 |
|------|------|------|
| **PR** | Production runtime / operational system | 真实运行中的系统能力（部署、运行、线上行为） |
| **ER** | Engineering / repository / CI / evaluation infrastructure | 仓库内工程产物：测试、CI、评估 harness、实验脚本与报告 |
| **DOC** | Documentation / demo / portfolio evidence | 文档、ADR 摘要、架构图、benchmark 表、demo、面试指南 |

**一个标准可以同时拥有多个表面。** 例如 Evaluation 的运行时表面是 `ER`（评估基础设施），
而它**不**天然要求 `PR` 生产部署；Portfolio / Interview Evidence 的表面是 `DOC`。

一个重要区分：**ME / CP 的对象可以“实验后不采纳”**。允许的合法结论包括
“语义 / 向量检索对某个语料不值得其复杂度”“确定性 Workflow 优于 Agent”。
这些结论只要**由证据支持**，就算满足标准，不构成失败的 Phase。

---

## 2. 通用实验记录约定

任何标记为 **ME** 的调查（以及任何 baseline vs candidate 对比）必须记录以下八项：

```
Hypothesis → Baseline → Candidate → Dataset → Metrics → Result → Limitation → Decision
```

| 字段 | 要求 |
|------|------|
| Hypothesis | 被检验的、可证伪的假设 |
| Baseline | 可复现的对照基线（先有更简单的方案） |
| Candidate | 被评估的新方案 |
| Dataset | 固定的评估数据集 / golden set，带版本 |
| Metrics | 为什么这些指标能度量**真实任务**，而不是因为时髦 |
| Result | 实际测量结果（含延迟 / 成本影响，若适用） |
| Limitation | 结论的适用边界与已知弱点 |
| Decision | 采纳 / 不采纳 / 延后，以及理由 |

**至少两个有意义的工程对照研究**必须在项目完成前存在（见 3.11）。

---

## 3. 逐项标准

### 3.1 Architecture — 清晰的分层架构与可强制执行的边界

- **能力:** 四层架构 + Port/Adapter + Composition Root，且依赖边界**可被强制执行**。
- **为什么重要:** 面试会追问“边界靠什么保证、改动如何不破坏它、为什么这里用 Workflow 而不是 Agent”。
- **最低证据:**
  - 依赖 / 架构图（基于 `TARGET_ARCHITECTURE.md`）；
  - **可强制执行**的边界（如导入约束 / lint / 类型检查，而非口头约定）；
  - ADR 列表 + 关键 ADR 摘要；
  - 至少一个清晰的**依赖倒置（Dependency Inversion）**实例（Port 定义在 Application、
    Adapter 在 Infrastructure、Composition Root 装配）；
  - 对“**为什么此处选 Workflow 而非 Agent**”的书面解释。
- **什么不算数:** 只是有很多文件夹；只有一张手绘草图而没有可执行或可验证的边界。
- **可能归属 Phase:** Phase 1（设计）、Phase 3–6（已建立）、Phase 11（遗留收敛）、Phase 16（图与讲解）。
- **分类:** 义务 = **MC**；表面 = **ER**（可强制执行边界）+ **DOC**（架构图与 ADR 摘要）。

### 3.2 Deterministic Workflow — 确定性的步骤编排

- **能力:** 至少一条重要的、步骤边界显式的确定性 Workflow。
- **为什么重要:** 它是“确定性执行优先”原则的可验证实例，也是 Workflow / Agent 对比的基线。
- **最低证据:**
  - 至少一条重要 Workflow（Phase 4 的 Reading 内容摄取管线已建立参考样板）；
  - 步骤级测试；
  - traceability（Phase 5 的 Trace 挂点）；
  - 错误 / fallback 行为（含降级与隔离语义）。
- **什么不算数:** 把一个大函数称作 workflow；没有步骤边界、没有测试。
- **可能归属 Phase:** Phase 4（已建立）、后续新增管线。
- **分类:** 义务 = **MC**；表面 = **PR**（真实编排）+ **ER**（测试与 trace）。

### 3.3 User State / Memory — 显式的用户态与有界记忆

- **能力:** 显式区分 User State / Memory / Chat-Event History / Working Context，并按用户归属。
- **为什么重要:** 面试会追问“记忆与状态如何区分、归属如何权威、上下文如何有界、隐私如何保护”。
- **最低证据:**
  - **State vs Memory 的显式区分**（canonical 当前事实 vs 持久历史上下文）；
  - **ownership**（权威归属身份来自 `ExecutionContext.userId`，payload 不携带 `userId`）；
  - **有界上下文检索**（条数 / 单条长度 / 整段长度上限；无 select-all 扩大路径）；
  - **privacy / safety**（trace 只记录计数与尺寸，不记录内容与 `userId`；记忆注入是“数据非指令”）。
- **什么不算数:** 把完整对话历史当作记忆；无界检索；把语义键绕过 canonical state 所有权。
- **可能归属 Phase:** Phase 6（地基）、Phase 11 / Phase 12。
- **分类:** 义务 = **MC**；表面 = **PR**（真实状态与记忆）+ **ER**（有界性测试）。

### 3.4 Retrieval / RAG — 检索工程的可测量调查

- **能力:** 知识检索层的设计、实现与**评估**；RAG 是否进生产由证据决定。
- **为什么重要:** 这是 AI 应用工程最常被追问的能力之一；也是“调查”与“堆技术”的分水岭。
- **最低证据:**
  - 至少一个**更简单的基线**（结构化 / 数据库 / 词法 / 关键词）；
  - 候选检索架构（按证据递进到语义 embedding / hybrid / reranking）；
  - **固定评估数据集**（带版本）；
  - 检索指标（如 Recall@K / Precision@K / MRR / nDCG / context precision / context recall /
    groundedness / task usefulness，按真实任务选择）；
  - 延迟 / 成本影响（P50 / P95 延迟、token 影响、可测量的金钱成本）；
  - **架构决策**：哪种方法胜出、为什么、被测量的 trade-off、RAG 是否属于生产、
    更简单检索在何处仍然更优。
- **什么不算数:** 安装一个向量数据库；展示一次成功的语义搜索；
  没有固定数据集、没有对照基线、没有指标。
- **可能归属 Phase:** Phase 13（主）、Phase 11（评估基础设施）、Phase 12（Coach 基线）。
- **最小安全（R-02，同阶段）:** 因为检索**引入**风险，检索的最小安全边界必须在 Phase 13 内建立：
  检索内容为不可信数据（非系统权威）、provenance / 来源元数据、
  prompt-injection / 间接注入边界、恶意 / “指令式”检索内容测试用例、
  检索证据与治理性 system 指令的隔离。**不得**把首次边界推迟到 Phase 15。
- **分类:** 义务 = **ME**（检索调查必须完成）+ **CP**（生产采纳由证据决定）；
  表面 = **ER**（检索实验与评估）→ **PR**（**仅当**被证据采纳时）。

### 3.5 Agent — 有界的、相对基线被评估的 Agent 工程

- **能力:** 有界的单一 Agent + 工具系统，且相对确定性基线做对照评估。
- **为什么重要:** 面试会追问“为什么这里真的需要动态决策、工具边界如何、循环如何停止、
  失败如何恢复、相比确定性方案到底改善了什么”。
- **最低证据:**
  - **真实的模型驱动动态决策需求**（路径 / 工具 / 动作无法预先确定）；
  - **tool contracts**（allowlisted registry、tool schemas、tool-result 处理）；
  - **loop / stopping 控制**（循环与停止条件、retry / failure 行为、budgets / limits）；
- **相对确定性基线的对照比较**（Phase 12 的基线）；
  - eval 数据集与任务 / 工具指标（task success rate、tool-selection accuracy、
    tool-argument / schema validity、unnecessary-tool-call rate、trajectory length、
    recovery、latency、token / cost impact）；
  - 失败案例记录。
- **什么不算数:** 把一个普通 Workflow 称作 Agent；使用 LangGraph（或任何框架）却没有动态决策；
  为架构外观引入 Multi-Agent。
- **可能归属 Phase:** Phase 14（主）、Phase 12（基线）。
- **入口门（R-06，同阶段）:** 实现前必须指出无法充分预定的具体决策 / 路径 / 工具 / 动作选择、
  解释为什么确定性 Workflow 不足，并定义用于对比的确定性基线。若不存在合法动态决策问题，
  **不得制造虚假 Agent 自主性**——改而识别另一个与产品一致的有界 Agent 用例，或走治理流程修订。
- **最小安全（R-02，同阶段）:** allowlist 工具、权威用户身份 / user isolation、显式 permission
  边界、read vs write 区分、高风险写入的 confirmation / HITL、有界预算 / 循环上限、
  tool 失败隔离、足以重建关键工具决策的 audit / trace 钩子。
- **分类:** 义务 = **ME**（有界 Agent 工程；受入口门约束，除非证据表明该用例应被放弃）
  + **CP**（生产采纳；若未改善 workflow 则保留确定性 workflow）；
  表面 = **ER**（Agent / tool 评估）→ **PR**（**仅当**被证据采纳时）。

### 3.6 MCP — 一个合法的互操作边界

- **能力:** 至少一个真实的 MCP 互操作实现，具备**真实协议价值**。
- **为什么重要:** 它证明在 Application / Domain 之上可以暴露标准协议边界，而不污染核心。
- **最低证据:**
  - 真实的**外部互操作使用场景**（例如外部 MCP 兼容客户端复用选定的学习能力）；
  - MCP tool / resource 契约（适当处）；
  - 从 MCP 兼容客户端进行的 demo 证据；
  - **Application / Domain 层保持协议无关**（`Application Use Cases → 多个 adapter`）；
  - permission / ownership 边界；
  - traceability。
- **什么不算数:** 把一个内部函数包进 MCP、再由同一组件调用，仅为简历价值；
  为证明 MCP 而强行拆出外部微服务。
- **可能归属 Phase:** Phase 15。
- **分类:** 义务 = **ME**（至少一个合法互操作实现是作品集目标）+ **CP**（生产采纳要求真实协议价值）；
  表面 = **ER**（adapter 与契约）+ **DOC**（MCP 客户端 demo）→ **PR**（**仅当**被采纳时）。

### 3.7 Evaluation — 系统级评估能力

- **能力:** 跨领域、可复用的评估能力（不只是单元测试）。
- **为什么重要:** 它是“用数据判断变好还是变差”的落地方式，也是所有 AI 结论可信的前提。
- **最低证据（按适用性）:**
  - golden datasets / golden set；
  - 自动化回归评估；
  - 检索评估；Agent / tool 评估；
  - baseline vs candidate 对比；
  - bad-case 追踪；
  - 在有理由处的质量门禁。
- **什么不算数:** 把 Evaluation 等同于 unit testing；只测 schema 合法性而不测任务质量。
- **可能归属 Phase:** Phase 2（基线，已建立）、Phase 11（基础设施）、Phase 12–15（各领域）、Phase 16（汇总）。
- **分类:** 义务 = **MC**；表面 = **ER**（评估 harness、golden set、回归与报告）。
  **不天然要求 PR**——评估基础设施本身不是生产运行时能力。

### 3.8 Observability — 跨边界的可观测性

- **能力:** 能回答“这一次 AI 任务为什么失败”的应用级 Trace。
- **为什么重要:** 面试会追问“出了问题如何定位到具体步骤、如何区分降级与致命失败”。
- **最低证据:**
  - 跨 Application / Workflow / AI / Tool / Retrieval 边界可传播的 trace；
  - 延迟 / 错误测量；
  - 模型使用 / token / 成本信息（可行处）；
  - 能定位 AI 任务失败原因的能力。
- **什么不算数:** 把 Observability 等同于 console logging；只打印自由文本日志而没有执行级结构。
  （**不要求**特定厂商；OpenTelemetry / Langfuse / Braintrust 等可在后续按需评估。）
- **可能归属 Phase:** Phase 5（已建立）、Phase 11（导出策略）、Phase 16（生产化）。
- **分类:** 义务 = **MC**；表面 = **PR**（运行中的 trace）+ **ER**（导出 / 聚合策略）。

### 3.9 Reliability — 有界的失败处理

- **能力:** 明确的失败边界与有界重试 / 降级。
- **为什么重要:** AI 应用的可靠性不是“不失败”，而是“失败可控、可解释、可恢复”。
- **最低证据:**
  - bounded retries；timeout budgets；
  - fallback 行为；
  - idempotency（适当处）；
  - failure-mode tests。
- **什么不算数:** 无超时路径；无限重试；把确定性格式错误当可重试错误反复消耗额度。
- **可能归属 Phase:** Phase 3 / 4 / 5（已建立）、Phase 11、Phase 14（Agent 预算）。
- **分类:** 义务 = **MC**；表面 = **PR** + **ER**（失败模式测试）。

### 3.10 AI Safety / Security — 与已实现能力相称的安全边界

- **能力:** 用户隔离、权限边界与不可信内容处理。
- **为什么重要:** 一旦引入检索 / 工具 / 写入，安全就成为正确性的一部分。
- **最低证据（按已实现能力适用）:**
  - user isolation；
  - tool permissions；
  - prompt-injection 边界；
  - 不可信检索内容处理；
  - read / write 区分；
  - 高影响动作的 confirmation gate；
  - auditability。
- **什么不算数:** 声称“prompt injection 不可能”；把安全边界写成口头承诺而没有实现或测试。
- **可能归属 Phase:** Phase 6（用户隔离地基）、Phase 11、Phase 14 / 15。
- **安全时序不变量（R-02）:** **引入新风险的 Phase 必须在该 Phase 内建立该风险的最小安全边界**；
  后续 Phase 只能硬化或生产化，**不得**成为首次边界。因此 Phase 13 建立检索最小安全、
  Phase 14 建立最小 Agent / tool 安全，Phase 15 只做 MCP 专属与生产风格硬化。
- **分类:** 义务 = **MC**；表面 = **PR**（运行时边界与隔离）+ **ER**（安全测试与审计钩子）。

### 3.11 Experimentation — 可测量的工程对照研究

- **能力:** 至少**两个**有意义的工程对照研究。
- **为什么重要:** 这是“工程”而非“演示”的核心证据，也是面试最能被追问的部分。
- **最低证据:**
  - 至少两个对照研究，例如 lexical vs semantic vs hybrid retrieval；
    确定性 Coach vs Agentic Coach；model / provider 对比；tool-selection 策略对比；
  - 每个研究按第 2 节的八字段记录完整。
- **什么不算数:** 只有一个轶事；没有基线；没有固定数据集。
- **可能归属 Phase:** Phase 13 / 14 / 15（研究）、Phase 11（基础设施）、Phase 16（汇总）。
- **分类:** 义务 = **ME**；表面 = **ER**（实验脚本与评估器）+ **DOC**（实验报告与基准表）。

### 3.12 Production — 可部署的系统

- **能力:** 可部署、可迁移、可运行的完整系统。
- **为什么重要:** 面试会追问“它真的能跑起来吗、迁移与配置如何管理”。
- **最低证据:**
  - deployable system；
  - migrations；
  - CI；
  - auth；
  - environment setup；
  - operational documentation。
- **什么不算数:** 只有本地 dev server；迁移链未验证就声称 production-ready。
- **可能归属 Phase:** Phase 11（CI / 边界）、Phase 16（部署与运维）。
- **分类:** 义务 = **MC**；表面 = **PR**（可部署运行的系统）+ **ER**（CI、迁移、环境配置）。

### 3.13 Portfolio / Interview Evidence — 可讲解的作品集材料

- **能力:** 让审阅者 / 面试官能独立理解的展示材料。
- **为什么重要:** 这是本项目“可作为面试项目完整讲解”这一目标的最终交付形态。
- **最低证据:**
  - 架构图；
  - 关键 ADR 摘要；
  - **benchmark 表**；
  - 实验报告；
  - demo 场景 / 数据；
  - README；
  - 覆盖**架构、trade-off、失败与测量**的面试讲解材料。
- **什么不算数:** 只有功能截图；只有功能列表而没有 trade-off 与失败记录。
- **可能归属 Phase:** Phase 16（主）。
- **分类:** 义务 = **MC**；表面 = **DOC**（架构图、ADR 摘要、benchmark 表、实验报告、demo、README、面试指南）。

---

## 4. 必须保持的语义区分

这些等式**不成立**，本项目必须把它们当作不同的东西：

| 左 | ≠ | 右 |
|----|---|----|
| Workflow | ≠ | Agent |
| Retrieval / RAG | ≠ | Agent |
| MCP | ≠ | Agent |
| Vector database | ≠ | RAG itself |
| Evaluation | ≠ | unit testing only |
| Observability | ≠ | console logging |
| Memory | ≠ | complete conversation history |
| Portfolio technology target | ≠ | mandatory production architecture |

**关键区分:** 路线图可以**要求一次工程实验或实现练习**以满足作品集深度，
同时允许生产采纳被证据**拒绝**。这条区分必须在所有路线图与标准文档中保持清晰。

---

## 5. fine-tuning / specialization 门

**fine-tuning 不是强制 Phase，也不是强制技术。**

只有当后续评估暴露出一个**狭窄、可重复、可测量、且具有经济意义**的失败模式，
并且该失败模式**无法**由以下途径充分解决时，才可以提出一个有界的 specialization 实验：

- 更好的 prompting；
- 工具 / schema 设计；
- 检索；
- 模型选择；
- 工作流架构。

该实验必须经过**未来已批准的修订 / 任务**，不得在当前阶段夹带。

要保留的教训：

```
fine-tune because evidence identifies a specialization bottleneck
  而不是
fine-tune because fine-tuning looks impressive
```

（见 `DECISIONS.md` ADR-018 第 4 条。）

---

## 6. 完成判定（Definition of Done 摘要）

项目完成时，以下必须为真：

| # | 判定 | 义务 | 表面 |
|---|------|------|------|
| 1 | 分层架构 + 可强制执行边界 + 至少一个依赖倒置实例 + ADR 摘要 | MC | ER + DOC |
| 2 | 至少一条重要的确定性 Workflow（含测试与 trace） | MC | PR + ER |
| 3 | 显式的 User State / Memory 区分、ownership 与有界上下文 | MC | PR + ER |
| 4 | 检索工程的可测量调查 + 架构决策（RAG 生产采纳由证据决定） | ME + CP | ER → PR（若采纳） |
| 5 | 有界 Agent + 工具系统（受入口门约束），且相对确定性基线对照评估 | ME + CP | ER → PR（若采纳） |
| 6 | 至少一个合法 MCP 互操作边界，核心层协议无关 | ME + CP | ER + DOC → PR（若采纳） |
| 7 | 系统级 Evaluation 能力（golden set / 回归 / 领域评估 / bad-case） | MC | ER（不天然要求 PR） |
| 8 | 跨边界 Observability（可定位 AI 任务失败原因） | MC | PR + ER |
| 9 | 有界 Reliability（retry / timeout / fallback / 失败测试） | MC | PR + ER |
| 10 | 与已实现能力相称的 AI Safety / Security 边界（在引入风险的 Phase 内建立） | MC | PR + ER |
| 11 | 至少两个可测量的工程对照研究（八字段记录） | ME | ER + DOC |
| 12 | 可部署系统 + migrations + CI + auth + 运维文档 | MC | PR + ER |
| 13 | 架构图 / ADR 摘要 / benchmark 表 / 实验报告 / demo / README / 面试指南 | MC | DOC |
| 14 | fine-tuning 由被测量的 specialization 瓶颈把门（否则不做） | 门 | — |

---

## 7. 相关文档

- `docs/refactor/MASTER_PLAN.md` — Phase 路线图与核心原则（执行顺序）
- `docs/refactor/PHASE_STATUS.md` — 阶段状态与批准历史
- `docs/refactor/MIGRATION_PLAN.md` — 各 Phase 的迁移路径与出口条件
- `docs/refactor/DECISIONS.md` — ADR-017（作品集证据 / 跨领域评估）、ADR-018（AI 能力采纳门槛）
- `docs/refactor/ARCHITECTURE_RULES.md` — 可执行架构规则（APP-004 Agent 准入门槛）
- `docs/refactor/EVALUATION_BASELINE.md` — 评估基线与迁移验证门
- `docs/refactor/TEST_STRATEGY.md` — 测试分层策略
