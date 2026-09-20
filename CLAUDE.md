@AGENTS.md

# English Learning PWA

Next.js 16.2.6 + DeepSeek + Tailwind v4 + Prisma/PostgreSQL (Neon).
架构与设计规则 → `docs/refactor/ARCHITECTURE_RULES.md` / `docs/refactor/TARGET_ARCHITECTURE.md`;重构路线 → `docs/refactor/MASTER_PLAN.md`。冻结模块规则见本文件「禁止修改」一节。不用 ~/.claude/ 记忆系统

## 关键约束
- **DeepSeek json_object**: ≥7 条返回空 → 两步法（纯文本回复 + 短上下文 json_object）
- **Tailwind v4**: 含括号任意值失效 → 用 inline `style`
- **构建检查**: `npx tsc --noEmit`（`npx next build` 会被 auto mode 拦截）
- **新路由测试**: `npx next dev`（production build 不编译新文件）
- **写代码前**: 读 `node_modules/next/dist/docs/`（16.2.6 有 breaking changes）

## 禁止修改（默认冻结）
AI Coach 口语对练 + 场景系统 / Words 页面 UI / `schema.prisma`
以上三项**默认保持冻结**。只有当**当前已批准的 Phase 任务书**明确包含该修改、**且**用户明确授权时，才可以在任务书限定的范围内做最小修改。这条规则本身不授予任何实现授权（见 `docs/refactor/DECISIONS.md` ADR-015 第 7 条）。

## 导航
- 列表页 → `router.push('/specific-route')`
- 详情/History → `router.back()`（History 额外带 `?from=` 参数）

## 行为规则
- 外部依赖失败 → **立即停止，告诉用户**
- 单词优先级: 手写550 > ECDICT > DeepSeek。例句 ` ||| ` 分隔配对
- Hover: `hover:scale-105` + `hover:shadow-*`，`active:scale-[0.95]`；输入框只 hover 边框
- Strict mode 防双重调用: `fetchedRef` 或 `ignore` 模式，`ignore` 不在 setState 之后
- 卡片: 外层 div onClick + 内层 `pointer-events-none`；次要按钮 `e.stopPropagation()`
- 性能: 模块缓存优先，乐观 UI，loading 骨架屏，toggle 无 loading/disabled 态

## 局部开发状态（非权威）
- **重构当前 Phase 的唯一权威归属是 `docs/refactor/PHASE_STATUS.md`**（当前 Phase 7 — Vocabulary Platform Design & Data Provenance，Ready / Not Started）。本节只记录本地开发上下文，不是重构阶段状态。
- 本地开发，Neon 正常。以下为历史遗留的本地产品开发记录（**非**当前重构 Phase）: Listening Edge TTS 音频批量生成（~25% 为当时的记录，未重新统计）
- 词汇(2000 SRS+681场景词)、Reading(~43篇)、AI Coach 均完成并冻结
- 滚动恢复: 模块级 `{scrollY, tabId}` → useState 懒初始化 → useLayoutEffect

## Refactor Rules
- 跨会话的 Phase 执行 / 会话恢复 / 评审与修正 / 收尾 / 未来 Phase 命令重建,遵循 `docs/refactor/PHASE_EXECUTION_PROTOCOL.md`
- 遵循 docs/refactor/MASTER_PLAN.md 定义的 Phase 顺序
- 修改前先读 docs/refactor/PHASE_STATUS.md 了解当前阶段
- 每阶段完成后更新 PHASE_STATUS.md 并产出 handoff
- 重要架构决策写入 docs/refactor/DECISIONS.md
- 不提前实现后续 Phase 的内容
