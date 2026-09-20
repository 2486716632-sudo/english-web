# Master Plan — English Learning PWA 重构路线

## 项目一句话

一个以 AI 为引擎、覆盖听说读写的英语学习 Web 应用（Next.js + DeepSeek + PostgreSQL）。

## 重构目标

最终项目应具备：

- **清晰的系统架构** — 分层明确，模块职责单一
- **标准化 Workflow** — 内容 Pipeline 有统一的编排模式
- **统一 AI Client** — 所有 AI 调用收敛到同一层，统一重试/降级/Trace
- **可评估** — 每次修改能用数据判断变好还是变差
- **Trace 与可观测性** — 出现问题能定位到具体步骤
- **用户状态与长期记忆** — 系统能记住用户弱项和偏好
- **必要时使用 Agent** — 动态决策场景由 Agent 驱动；用户可见功能必须在**不依赖 Agent** 的情况下保持可用
- **可作为面试项目完整讲解** — 架构、选型、trade-off 都能说清楚

## 重构目的 / Refactor Purpose

本项目最初是一个 vibe-coded 的 AI 英语学习助手。

这次重构**不只是代码清理**。目标是逐步把这个应用变成**工程级的应用型 AI 系统**,同时**保持它仍然是一个可用的英语学习产品**。

系统应当越来越**可理解、可测试、可观测、可扩展、可靠、可部署**,并且适合在 AI 应用工程的作品集 / 面试场景中可信地演示与讲解。

架构复杂度**只在解决真实产品或工程问题时**才引入。Agent、Memory、RAG、Trace 或任何额外基础设施,都不得仅仅为了让项目"看起来更高级"而引入。

## Phase 路线图（Phase 0–13）

**归属:** 本节是 Phase 路线图的权威归属；每个 Phase 的**状态与批准历史**由
`docs/refactor/PHASE_STATUS.md` 拥有，迁移路径由 `docs/refactor/MIGRATION_PLAN.md` 拥有，
已接受决策由 `docs/refactor/DECISIONS.md` 拥有。本节不重述它们的权威内容。

**Phase 0–6 的已批准含义不可更改。** 它们是已完成并外部批准的阶段；本路线图不使用
重新编号、重新解释或追溯改写来表达未来计划的变化。

**Phase 7 及以后由 post-Phase-6 路线重新基线确定**（2026-09-16；见 `DECISIONS.md`
ADR-015 / ADR-016）。优先级为：**Vocabulary 平台工作在前，AI Coach 的 Agentic 工作
排在后面的独立阶段**。

**Phase 数量从属于「范围可控 + 可审核」。** 阶段划分的目的是让每个阶段拥有有边界的范围、
可验证的产物和可执行的外部审核——不是为了凑出阶段数量、或让技术名词看起来完整。
若后续证据表明某个阶段应拆分、合并或重排，必须经过同样的治理流程
（任务书 + 外部审核 + 用户明确批准），不得在当前阶段内夹带实现。

| Phase | 名称 | 一句话目标 |
|-------|------|-----------|
| 0 | 项目现状盘点 | 摸清当前所有功能、AI 调用、数据库、技术债 |
| 1 | 设计目标架构 | 画出施工图，定好分层和模块边界 |
| 2 | 建立评估基线 | 核心功能有测试样本和衡量指标 |
| 3 | 统一 AI Client | 所有 AI 调用收敛到统一基础设施 |
| 4 | 重构一条 Pipeline 样板 | 一条完整链路示范标准化 Workflow |
| 5 | Trace 与可观测性 | 每步可追踪，出问题可定位 |
| 6 | 用户状态与记忆系统 | 跨会话记住用户学习状态 |
| 7 | Vocabulary Platform Design & Data Provenance | 定清 Vocabulary 产品域与数据来源合规，只做证据与设计 |
| 8 | Vocabulary Books Implementation | 落地已批准的 Book 模型、导入管线与选书体验 |
| 9 | Themed Packs Convergence | Default Packs 与 User-created Packs 归位到已批准架构 |
| 10 | Reliability, Ownership & Architecture Convergence | 补齐归属、测试、CI、安全边界与遗留收敛 |
| 11 | AI Coach Foundation Refactor | 先把既有 AI Coach 重构到已批准架构 |
| 12 | Agentic AI Coach | 只在产品行为需要动态决策时引入有界 Agent 能力 |
| 13 | Production & Portfolio Hardening | 生产就绪、演示数据、README、架构图、面试材料 |

### Phase 7 之后的重新基线（2026-09-16）

Phase 6 通过外部批准之后、Phase 7 尚未开始时，产品方向被重新确认。以下内容是**当前**
权威方向，取代旧的 future Phase 7–9 路线：

1. **不设立网站级 / master Learning Path Agent。** 不会有横跨 Vocabulary、Reading、
   Listening、AI Coach 的学习路径编排 Agent。旧的「Phase 7 = 学习路径 Agent」方向在实现
   开始前即被退役（历史记录保留；见 `DECISIONS.md` ADR-015 的取代范围）。
2. **AI Coach 可能成为有界的 Agentic 子系统，但刻意延后。** Agentic 工作排在独立的后续
   阶段（Phase 12），且必须由真实产品行为需求驱动。
3. **Vocabulary 是下一个产品 / 领域优先级。** Vocabulary 平台设计（Phase 7）先于任何
   多书实现与数据导入。
4. **Vocabulary 有两个不同的产品域，不得为了架构整齐而合并为一个通用抽象：**
   - **Vocabulary Books** — 结构化、可选择的词书（例如 CET-4 / CET-6 / IELTS 取向 /
     General English / Business English，以及未来可能新增的词书）。**具体书单与数据集
     不因本次路线修订而确定**；Phase 7 必须先做来源 / provenance / 许可 / 数据质量调研。
   - **Themed Packs** — **Default Packs** 与**用户创建的自定义 Packs**。即使共享底层
     词汇数据，它们与 Vocabulary Books 仍是**概念上不同**的产品。

   共享的词汇基础设施是可接受的；产品 / 领域概念在后续证据证明应当收敛之前保持独立。
5. **当前以 IELTS 为中心的词汇实现不是目标成熟形态。** 现有模型把词书语义压在
   `Word.difficulty` / `Word.source` / `Word.theme` 的组合上；Phase 7 负责审计并设计演进路径。
6. **数据不得仅因「上游 GitHub 仓库是公开的」就被导入。** 未来任何 Vocabulary 数据集的引入
   都必须先有文档化的：provenance、上游来源、许可 / 使用条件、转换方法、版本、质量检查。
7. **CET-4 / CET-6、精选 IELTS 词表、General English 核心词表、Business English 等方向
   目前只是 Phase 7 的候选调研对象，不是已批准的导入。**
8. **高级 AI 技术不得成为路线图的强制项。** RAG、MCP、LangGraph、向量数据库、fine-tuning
   只有在出现被验证的真实需求时才评估；不得为了让项目显得更高级而变成交付承诺。
9. **既有治理原则继续生效：** 渐进迁移；确定性执行优先用 Workflow 而非 Agent；
   架构复杂度只在真实的工程 / 产品问题上引入；用户可见功能必须在不依赖 Agent 的前提下可用。

### Phase 7 出口与 Phase 8 范围决策门（2026-09-16 复审修正 R-01）

当前路线图把若干条**互相独立的高风险变更**放在同一个 Phase 8 中：迁移链前置修复、
`WordReview` 的 user-scoping、Vocabulary Book schema / 模型实现、数据导入管线、选书 UI、
既有 SRS 行为保持、跨词书重叠词语义。

**不在本次修订中机械拆分 Phase 8。** 取而代之，Phase 7 必须承担一个显式的出口 / 架构决策：

> Phase 7 must determine whether migration-chain repair and Vocabulary Books implementation can
> safely remain in one bounded Phase. If they are independently reviewable high-risk changes, the
> roadmap must be split again before Phase 8 implementation starts. Phase numbering is not
> protected; bounded scope and reviewability take priority.

即：

1. **Phase 7 必须判定**「迁移链修复」与「Vocabulary Books 实现」能否安全地留在**同一个有界 Phase** 内；
2. 若二者属于**可以独立审核的高风险变更**，则必须在 **Phase 8 实现开始之前**再次拆分路线图；
3. **Phase 编号不受保护**——有界范围与可审核性优先于编号连续性；
4. 本次修订**不新增 Phase 编号**（现有设计尚未要求），拆分决定由 Phase 7 依据真实证据作出并走正常治理流程。

配套的迁移正确性要求见 `EVALUATION_BASELINE.md` 的迁移验证门（无论 Phase 8 是否拆分，
修复 / 变更迁移的那个已批准 Phase 必须**自行**通过迁移正确性验收，不得把首次验证推迟到 Phase 13）。

## 核心原则

1. **渐进式重构** — 不推倒重写，项目始终保持可运行
2. **每阶段审核** — 完成一个 Phase 后暂停，等待确认再继续
3. **不提前实现** — 不实现后续 Phase 的内容
4. **Workflow 优先** — 固定步骤用 Workflow，只有动态决策才用 Agent
5. **AI Client 单一职责** — 只负责模型调用，不负责业务编排
6. **需求驱动引入** — 不为了"显得高级"而引入新技术
7. **阶段数量从属于范围** — Phase 的拆分与数量服务于有界范围与可审核产物，而非相反
8. **产品域概念不因架构整齐而合并** — 只有证据支持时才收敛概念（见 ADR-016）
