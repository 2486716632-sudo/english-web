# Phase Execution Protocol / Phase 执行协议

**Status:** Canonical governance document / 权威治理文档
**Created:** 2026-09-14 — pre-Phase-7 governance supplement
**Scope:** cross-session Phase execution governance — entry, command reconstruction, execution, validation, review, correction, closeout, recovery
**本项目角色:** 本文件是**跨会话 Phase 执行治理的唯一权威归属**

This document is the single canonical owner of the process rules below. It does not own architecture rules, decisions, roadmap, phase state, or design intent — those keep their existing owners and are referenced, not restated.
本文件是下列流程规则的唯一权威归属。它不拥有架构规则、决策记录、路线图、阶段状态或设计意图——那些仍由各自的既有文档拥有,本文件只引用、不重述。

| Area / 领域 | Canonical owner / 权威归属 |
|---|---|
| Architecture rules / 架构规则 | `docs/refactor/ARCHITECTURE_RULES.md`, `docs/refactor/TARGET_ARCHITECTURE.md` |
| Accepted decisions / 已接受决策 | `docs/refactor/DECISIONS.md` |
| Roadmap and core principles / 路线图与核心原则 | `docs/refactor/MASTER_PLAN.md` |
| Phase state and approval history / 阶段状态与批准历史 | `docs/refactor/PHASE_STATUS.md` |
| Migration path / 迁移路径 | `docs/refactor/MIGRATION_PLAN.md` |
| Per-Phase design intent / 各阶段设计意图 | the relevant design doc for that Phase / 该阶段对应的设计文档 |
| Cross-session execution governance / 跨会话执行治理 | **this document** / **本文件** |

---

## 1. Purpose / 目的

This protocol exists so that a new coordinator or executor can reconstruct and continue this refactor from the repository and Git alone.
本协议存在的目的,是让新的协调者或执行者能够**仅凭仓库与 Git**重建并继续这次重构。

Three rules follow from that purpose:
由此产生三条规则:

- Previous chat history is **not** authoritative.
  以往的聊天记录**不具权威性**。
- Old ChatGPT/Codex command wording is **not** authoritative.
  旧的 ChatGPT/Codex 命令措辞**不具权威性**。
- Future Phase commands must be **reconstructed from the current repository state**.
  未来的 Phase 命令**必须依据当前仓库状态重建**。

Conflict rules: / 冲突规则:

- Remembered or chat-based instructions never override canonical repository evidence.
  记忆中的或来自聊天记录的指令,永不覆盖权威的仓库证据。
- If this protocol and current repository evidence appear inconsistent, apply the source-of-truth hierarchy and the discrepancy-reconciliation rule in section 2.
  若本协议与当前仓库证据看似不一致,应适用第 2 节的源头权威层级与不一致对齐规则。
- Do not silently choose one side; inspect and reconcile before execution.
  不要静默选择其中一方;先检查并对齐,再执行。

---

## 2. Source-of-truth hierarchy / 源头权威层级

| # | Source / 来源 | Authoritative for / 权威范围 |
|---|---|---|
| A | Git working tree and current diff / Git 工作区与当前 diff | What files actually exist now, and what is currently changed / 当前实际存在哪些文件,以及当前改动了什么 |
| B | Committed Git history / 已提交的 Git 历史 | Approved historical baselines / 已批准的历史基线 |
| C | `docs/refactor/` canonical documentation / `docs/refactor/` 权威文档 | Accepted architecture, governance, Phase state, decisions, design intent / 已接受的架构、治理、阶段状态、决策、设计意图 |
| D | Current Phase task / 当前 Phase 任务书 | The allowed scope of the active Phase / 当前阶段允许的范围 |
| E | Immediately previous Phase handoff and review / 上一阶段交接与评审 | Inherited context and approval history / 继承的上下文与批准历史 |
| F | Chats and remembered commands / 聊天与记忆中的命令 | Temporary working context only — never a durable source of truth / 仅临时工作上下文——永不作为持久真相 |

**Nuance — when code/Git and documentation disagree: / 细节——当代码/Git 与文档不一致时:**

- Do not silently choose one side.
  不要静默地选择其中一方。
- Inspect the discrepancy.
  先检查该不一致。
- Treat Git and the diff as truth for *what actually changed*.
  把 Git 与 diff 视为*实际改了什么*的真相。
- Treat the canonical documents as truth for *intended approved architecture, governance, and scope*.
  把权威文档视为*意图中的已批准架构、治理与范围*的真相。
- Reconcile before proceeding whenever the disagreement affects execution.
  只要该分歧影响执行,就必须先完成对齐再继续。

---

## 3. Phase entry conditions / 阶段入口条件

Before a new Phase may start: / 新的 Phase 启动前:

- The previous Phase is **externally Approved**.
  上一阶段**已通过外部审核**。
- The previous Phase's administrative closeout is complete.
  上一阶段的行政收尾已完成。
- The approved baseline is committed.
  已批准的基线已提交。
- The working tree is normally clean.
  工作区通常应为干净状态。
- `PHASE_STATUS.md` identifies the next Phase as **Ready / Not Started**.
  `PHASE_STATUS.md` 已把下一阶段标为 **Ready / Not Started**。
- Branch, HEAD, and working-tree state have been inspected.
  已检查分支、HEAD 与工作区状态。

If the working tree is unexpectedly dirty, do **not** assume those changes belong to the new Phase — investigate first.
如果工作区意外地不干净,**不要**假定这些改动属于新阶段——先调查清楚。

---

## 4. Future Phase command reconstruction protocol / 未来 Phase 命令重建协议

**Never reconstruct a future Phase command from memory of an old chat.**
**绝不依据旧聊天的记忆重建未来的 Phase 命令。**

Before generating the execution command for Phase N, inspect: / 在生成 Phase N 的执行命令之前,检查:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/refactor/MASTER_PLAN.md`
4. `docs/refactor/PHASE_STATUS.md`
5. `docs/refactor/DECISIONS.md`
6. Relevant architecture or design documents produced by earlier Phases / 早期阶段产出的相关架构或设计文档
7. The current Phase task, if one already exists / 当前 Phase 任务书(若已存在)
8. The immediately previous Phase task / 紧邻的上一阶段任务书
9. The immediately previous Phase handoff / 紧邻的上一阶段交接文档
10. The immediately previous Phase review / 紧邻的上一阶段评审记录
11. Current Git branch / 当前 Git 分支
12. Current HEAD / 当前 HEAD
13. `git status` and the working-tree baseline / `git status` 与工作区基线
14. Relevant current source and tests, when the next Phase depends on actual implementation details / 当下一阶段依赖真实实现细节时,相关的当前源码与测试

Then reconstruct the new Phase command from the **current** state.
然后依据**当前**状态重建新的 Phase 命令。

### 4.1 Required contents of a Phase execution command / Phase 执行命令必须具备的内容

| | Section / 部分 | Content / 内容 |
|---|---|---|
| A | Entry verification / 入口校验 | branch, HEAD, working tree, previous Phase approval, protected baseline / 分支、HEAD、工作区、上一阶段批准、受保护基线 |
| B | Phase objective / 阶段目标 | What capability is being established, and why it exists in the roadmap / 要建立什么能力,以及它在路线图中的位置 |
| C | Current-state inspection / 现状检查 | Inspect real repository state before assuming old documents remain exact / 在假定旧文档仍然精确之前,先检查真实仓库状态 |
| D | Architecture constraints / 架构约束 | Dependency direction, ownership boundaries, approved infrastructure to reuse / 依赖方向、所有权边界、可复用的已批准基础设施 |
| E | Reference implementation scope / 参考实现范围 | Prefer one controlled vertical or reference integration when appropriate / 在适当情况下优先选择一条受控的纵向或参考集成 |
| F | Allowed modifications / 允许的修改 | Explicit file and layer scope / 明确的文件与层次范围 |
| G | Explicit prohibitions / 明确禁止事项 | Especially future-Phase capabilities that must not be pulled forward / 尤其是不得提前引入的后续阶段能力 |
| H | Behaviour-preservation requirements / 行为保持要求 | What must stay byte-for-byte or semantically identical / 哪些必须保持逐字节或语义一致 |
| I | Test requirements / 测试要求 | New and protected tests / 新增测试与受保护测试 |
| J | Validation requirements / 验证要求 | Exact commands expected to pass / 期望通过的确切命令 |
| K | Documentation outputs / 文档产出 | Which documents must be created or updated / 必须创建或更新哪些文档 |
| L | Git discipline / Git 纪律 | No auto-commit, no destructive Git commands, no rewriting approved commits / 不自动提交、不使用破坏性 Git 命令、不重写已批准提交 |
| M | Review-pack requirements / 审核包要求 | See section 9 / 见第 9 节 |
| N | Phase status rules / 阶段状态规则 | Allowed status transitions, and that only external review may mark Approved / 允许的状态流转,以及只有外部评审才能标记 Approved |
| O | Completion-report format / 完成报告格式 | The report the executor must return / 执行者必须返回的报告格式 |

The command must be Phase-specific.
该命令必须是**该阶段专属**的。

Do not mechanically copy an old command template when repository state has changed.
当仓库状态已变化时,不得机械复制旧命令模板。

If roadmap, documentation, and Git disagree, inspect and report the discrepancy before generating or executing the Phase command.
若路线图、文档与 Git 相互矛盾,应在生成或执行该 Phase 命令之前检查并报告该不一致。

Never invent capabilities that previous Phases did not actually establish.
绝不可臆造此前阶段并未真正建立的能力。

---

## 5. Execution context / session rule / 执行上下文规则

Tool-neutral rule: / 工具中立的规则:

- Where practical, keep the implementation and correction cycle for one Phase within one execution context.
  在可行的情况下,把一个 Phase 的实现与修正循环保留在同一个执行上下文中。
- After that Phase is Approved and closed out, start a fresh execution context for the next Phase.
  在该 Phase 通过批准并完成收尾后,为下一阶段开启新的执行上下文。
- If a new Phase was accidentally started in the previous Phase's execution context and substantial work already exists, do not switch contexts mid-Phase merely for formality — finish the active Phase safely, then restore the fresh-context rule for the following Phase.
  如果新阶段被误在上一阶段的执行上下文中启动,且已存在大量工作,不要仅为形式而中途切换上下文——先安全完成当前阶段,再对后续阶段恢复"新上下文"规则。

The invariant is continuity and traceability, not the chat product itself.
真正的不变式是**连续性与可追溯性**,而不是聊天产品本身。

---

## 6. Session / chat loss recovery / 会话丢失恢复

If an execution session disappears, do **not** restart the Phase blindly.
如果执行会话消失,**不要**盲目重启该阶段。

First reconstruct from: / 先从以下内容重建:

- `AGENTS.md`, `CLAUDE.md`
- `docs/refactor/MASTER_PLAN.md`, `docs/refactor/PHASE_STATUS.md`, `docs/refactor/DECISIONS.md`
- the current Phase design docs / 当前阶段设计文档
- the current Phase task / 当前阶段任务书
- the current Phase handoff / 当前阶段交接文档
- the current Phase review, if present / 当前阶段评审记录(若有)
- Git branch, HEAD, `git status`, `git diff` / Git 分支、HEAD、`git status`、`git diff`
- changed source and tests / 已变更的源码与测试

Then determine: / 然后判断:

- what was already implemented / 已经实现了什么
- what was reviewed / 已经评审了什么
- what corrections remain / 还剩哪些修正
- whether the work is committed or uncommitted / 工作是已提交还是未提交
- whether the next Phase has already started / 下一阶段是否已经开始

Only after that reconstruction may implementation resume.
只有完成该重建之后,才能恢复实施。

If repository evidence differs from remembered chat context, the repository and Git win for execution purposes.
若仓库证据与记忆中的聊天上下文不一致,出于执行目的,以仓库与 Git 为准。

---

## 7. Phase execution boundaries / 阶段执行边界

Durable rules: / 持久规则:

- Follow `MASTER_PLAN.md` and the current Phase task.
  遵循 `MASTER_PLAN.md` 与当前 Phase 任务书。
- No unrelated cleanup and no opportunistic refactoring.
  不做无关清理,不做顺手重构。
- Do not pull future-Phase capabilities forward.
  不提前引入后续阶段的能力。
- Reuse approved architecture and infrastructure.
  复用已批准的架构与基础设施。
- Keep the application runnable.
  保持应用可运行。
- Preserve protected behaviour unless the Phase explicitly authorizes a change.
  除非该阶段明确授权改变,否则保持受保护的行为不变。

Layer, dependency, ownership, and interface rules live in `ARCHITECTURE_RULES.md`; accepted trade-offs live in `DECISIONS.md`. This section deliberately does not restate them.
层次、依赖、所有权与接口规则见 `ARCHITECTURE_RULES.md`;已接受的取舍见 `DECISIONS.md`。本节刻意不重述它们。

---

## 8. Validation contract / 验证契约

Every Phase task must define the validation required for that Phase.
每个 Phase 任务书都必须定义该阶段所需的验证。

Typical validation categories, when relevant to the Phase: Phase-specific tests, protected previous-Phase tests, type checking, build, scoped lint, Prisma validation and generation, and smoke tests.
与该阶段相关时,典型验证类别包括:该阶段专属测试、受保护的既有阶段测试、类型检查、构建、限定范围的 lint、Prisma validate 与 generate,以及冒烟测试。

Test layering, test types, and their run commands are owned by `docs/refactor/TEST_STRATEGY.md`; the distinction between build verification, HTTP reachability, and manual interaction verification is owned by `docs/refactor/EVALUATION_BASELINE.md`. Both are referenced here rather than restated.
测试分层、测试类型及其运行命令由 `docs/refactor/TEST_STRATEGY.md` 拥有;构建验证、HTTP 可达性与人工交互验证三者的层级区分由 `docs/refactor/EVALUATION_BASELINE.md` 拥有。这里只引用、不重述。

Validation requirements are Phase-specific; do not claim every Phase always runs every command.
验证要求是**阶段专属**的;不要声称每个阶段都会运行全部命令。

If protected baseline regressions occur, do not close or approve the Phase until they are resolved or explicitly accepted through review.
若出现受保护基线的回归,在解决或经评审明确接受之前,不得关闭或批准该阶段。

---

## 9. Review-pack contract (default) / 审核包契约(默认)

When a Phase produces a review pack, the default expected contents are: / 当某阶段产出审核包时,默认应包含:

- the current Phase task / 当前 Phase 任务书
- relevant design documents / 相关设计文档
- the current Phase handoff / 当前 Phase 交接文档
- the current Phase review, if one exists / 当前 Phase 评审记录(若已存在)
- `PHASE_STATUS.md`
- `DECISIONS.md`, if changed / `DECISIONS.md`(若已变更)
- changed production source / 变更的生产源码
- relevant tests / 相关测试
- Prisma schema and migration, if relevant / 相关的 Prisma schema 与迁移
- validation results / 验证结果
- git status / git status
- git diff stat / git diff stat
- the complete Phase diff / 完整的 Phase diff
- review manifest / 审核清单(manifest)
- file-hash verification / 文件哈希校验

Individual Phase tasks may add Phase-specific evidence.
各阶段任务书可以追加该阶段专属的证据。

Default exclusions: / 默认排除项:

- `.env` and API keys / `.env` 与 API Key
- credentials and database secrets / 凭据与数据库密钥
- recovery or security codes / 恢复码或安全码
- `node_modules`
- `.next`
- unrelated temporary files / 无关临时文件
- old review ZIPs nested inside new ZIPs / 嵌套在新 ZIP 中的旧审核 ZIP
- real or private user data / 真实或私有用户数据
- unnecessary binary or audio assets / 非必要的二进制或音频资产

**Packaging boundary rule: use the Git repository root as the project boundary. Do not blindly archive the parent workspace directory.**
**打包边界规则:以 Git 仓库根目录作为项目边界。不要盲目打包父级工作区目录。**

After creating a review pack: / 创建审核包之后:

- reopen and list the actual archive / 重新打开并列出实际归档内容
- verify the expected contents are present / 验证预期内容确实存在
- hash-verify copied working-tree files against their source files when required / 需要时,对复制的文件与其源文件做哈希校验
- ensure excluded secret or private material is absent / 确认被排除的密钥或私有材料不在包内

The review pack is **evidence**, not a permanent repository artifact.
审核包是**证据**,不是永久的仓库产物。

---

## 10. External review contract / 外部评审契约

Executor self-review is **not** final approval.
执行者的自审**不是**最终批准。

Normal flow: / 正常流程:

```
implementation → validation → handoff / review evidence → external review
实施 → 验证 → 交接 / 评审证据 → 外部评审
```

- A Phase cannot mark itself Completed / Approved merely because its own tests pass.
  一个阶段不能仅仅因为自身测试通过就自行标记 Completed / Approved。
- External review plus explicit user approval is the quality gate.
  外部评审加上用户明确批准,才是质量闸门。

---

## 11. Changes Requested / correction cycle / 修改要求与修正循环

If external review returns Changes Requested: / 若外部评审返回 Changes Requested:

- remain in the current Phase / 留在当前 Phase 内
- preserve review history / 保留评审历史
- apply only the requested or otherwise necessary corrections / 只做被要求的或确属必要的修正
- do not start the next Phase / 不启动下一阶段
- re-run the required validation / 重新运行所需验证
- regenerate review evidence / 重新生成评审证据
- undergo external re-review / 再次接受外部评审

Do not erase or rewrite the earlier review verdict.
不得抹除或改写先前的评审结论。

Review history should show progression, for example: / 评审历史应体现推进过程,例如:

```
v1 Changes Requested → v2 Minor Changes Requested → v3 Approved
```

---

## 12. Approval and closeout contract / 批准与收尾契约

After external approval, complete these steps **before** creating the approved baseline commit: / 外部批准之后,请在创建已批准基线提交**之前**完成以下步骤:

1. Finalize the current Phase review. / 定稿当前阶段评审记录。
2. Finalize the handoff. / 定稿交接文档。
3. Update `PHASE_STATUS.md` to record the current Phase as **Completed / Approved** and the next Phase as **Ready / Not Started**. / 更新 `PHASE_STATUS.md`,记录当前阶段为 **Completed / Approved**,下一阶段为 **Ready / Not Started**。
4. Run the required final validation. / 运行所需的最终验证。
5. Remove temporary review artifacts. / 移除临时评审产物。
6. Inspect `git status` and `git diff`, then stage only the approved Phase changes. / 检查 `git status` 与 `git diff`,然后只暂存已批准的该阶段改动。

Then, and only then: / 然后,且只有到这一步:

7. Create the approved Phase baseline commit. / 创建该阶段的已批准基线提交。
8. Verify the working tree is clean. / 确认工作区干净。
9. Verify that `PHASE_STATUS.md` already records the next Phase as **Ready / Not Started**, so no documentation mutation is required after the clean-tree check. / 确认 `PHASE_STATUS.md` 已记录下一阶段为 **Ready / Not Started**,因此在干净检查之后不再需要任何文档改动。

Do not start the next Phase inside the closeout operation.
不要在收尾操作中启动下一阶段。

Do not use destructive Git commands, and do not rewrite previously approved commits.
不要使用破坏性 Git 命令,也不要重写已批准的提交。

---

## 13. Next-Phase transition / 下一阶段过渡

A new Phase starts only after: / 新的 Phase 仅在以下条件满足后才开始:

- the previous Phase is Approved / 上一阶段已批准
- administrative closeout is complete / 行政收尾已完成
- the baseline is committed / 基线已提交
- the working tree is clean / 工作区干净
- `PHASE_STATUS.md` is updated / `PHASE_STATUS.md` 已更新

The next Phase command is then reconstructed using section 4.
随后使用第 4 节重建下一阶段的命令。

---

## 14. Remote durability / 远端持久化

A durable local Git history is still vulnerable to machine loss.
即使本地 Git 历史很完整,仍会因机器丢失而受损。

Important approved governance and history should eventually exist on the intended remote repository.
重要的已批准治理内容与历史,最终应当存在于目标远端仓库上。

However: / 但是:

- pushing is an explicit operation / 推送是显式操作
- do not auto-push merely because a Phase is complete / 不要仅因某阶段完成就自动推送
- confirm the intended remote and branch, and obtain user approval before pushing when required by the workflow / 在流程要求时,先确认目标远端与分支,并在推送前取得用户批准

---

## Related documents / 相关文档

- `AGENTS.md` — session entry point and navigation map / 会话入口与导航地图
- `CLAUDE.md` — long-term project rules and constraints / 长期项目规则与约束
- `docs/refactor/MASTER_PLAN.md` — roadmap, phases, and core principles / 路线图、阶段与核心原则
- `docs/refactor/PHASE_STATUS.md` — current Phase state and approval history / 当前阶段状态与批准历史
- `docs/refactor/DECISIONS.md` — accepted architecture decisions / 已接受架构决策
- `docs/refactor/ARCHITECTURE_RULES.md` — executable architecture rules / 可执行架构规则
- `docs/refactor/tasks/phase-<N>-task.md`, `handoffs/phase-<N>-handoff.md`, `reviews/phase-<N>-review.md` — per-Phase records / 逐阶段记录
