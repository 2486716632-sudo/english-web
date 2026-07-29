# Phase 0 交接文档

**日期:** 2026-07-27
**阶段状态:** 已完成，等待审核
**下一阶段:** Phase 1 — 设计目标架构（未经审核确认不得开始）

---

## Phase 0 目标

完成项目现状盘点（Project Audit），为后续重构建立基线。具体目标：

1. 摸清当前所有功能模块及其入口、主要文件、状态
2. 了解当前技术栈和项目架构
3. 审计所有 AI 模型调用位置、参数、错误处理
4. 分析数据库 Schema 和数据模型
5. 分析内容 Pipeline 流程（阅读、听力、词汇、Coach）
6. 识别技术债和重复代码
7. 建立运行基线
8. 为 Phase 1 目标架构设计提供输入

---

## 已完成工作

### 创建/修改的文档

| 文档 | 操作 | 说明 |
|------|------|------|
| `docs/refactor/phase-0-audit.md` | ✅ 新建 | 完整项目现状审计（见下方内容索引） |
| `docs/refactor/PHASE_STATUS.md` | ✅ 更新 | Phase 0 标记为 Completed |

### 审计内容索引

`phase-0-audit.md` 包含以下章节：

1. **项目概览** — 技术栈、内容量
2. **功能清单** — 词汇、阅读、听力、Coach、AI Assistant、RAG
3. **当前架构** — 目录结构、API 路由清单、架构图、Service 层分析
4. **AI 调用分析** — 10 个调用点、参数、问题汇总
5. **数据模型分析** — 7 个数据库表、严重问题
6. **Pipeline 分析** — 阅读、听力、词汇、Coach 四条流程
7. **技术债** — 18 项（P0-P3）、4 类重复代码
8. **Phase 1 重构建议** — 优先级排序
9. **关键结论证据索引** — 18 个 Finding（F-001~F-018），含定位、影响、验证方式
10. **模块依赖与调用关系图** — 页面→API→lib→外部依赖，含细粒度调用链
11. **环境变量和外部依赖清单** — 变量、服务、本地依赖、文件系统依赖
12. **当前运行基线** — tsc/eslint/build 结果 + dev server 只读验证、数据库实际连通性
13. **已知风险与未知事项** — 已确认、推测、未验证、环境限制
14. **冻结模块说明** — 范围和后续规则

---

## 关键发现

### 架构性问题（P0）

| ID | 问题 | 影响 |
|----|------|------|
| F-001 | AI 调用分散在 10 个独立文件 | 更换模型需改 10 个文件 |
| F-002 | 无重试机制 | 网络故障时功能完全失效 |
| F-005 | API Routes 职责过重 | 代码混在一起无法独立测试 |
| F-009 | WordReview 无用户维度 | 无法多用户，无复习历史 |
| F-013 | 无认证 | 部署到公网时数据完全公开 |

### 代码质量问题（P1）

| ID | 问题 | 影响 |
|----|------|------|
| F-004 | Prompt 管理混乱 | 大部分内联在路由中 |
| F-006 | JSON 提取重复 | 至少 6 处相同模式 |
| F-007 | AbortController 重复 | 7+ 处模板代码 |
| F-008 | DailyProgress 未使用 | 无用模型，开发者迷惑 |
| F-010 | 模块级缓存不可控 | 不过期不清除 |
| F-011 | 本地音频存储风险 | 构建性能影响 |
| F-012 | 端点路径不一致 | 一处缺 `/v1/` |
| F-015 | `$queryRawUnsafe` 安全与维护风险 | 当前值参数通过占位符传递，未确认实际注入漏洞，但该模式降低了安全保证 |
| F-018 | 标签字符串格式 | 查询效率低 |

### 可观测性（P2）

| ID | 问题 |
|----|------|
| F-003 | 无 Token 统计/耗时跟踪 |
| F-014 | 无测试覆盖 |
| F-016 | refill 并发风险 |
| F-017 | 听力场景生成无超时 |

---

## 当前运行基线

### 静态验证

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `node_modules/` 存在 | ✅ | `npm install` 已完成 |
| Prisma Client 生成 | ✅ | `postinstall` 中自动完成 |
| `npx tsc --noEmit` | ✅ **通过** | 约 7.2s |
| `npx eslint src/` | ⚠️ **39 errors, 38 warnings** | 主要来自 React 19 新 lint 规则 |
| `npx next build` | ✅ **通过** | 13.0s 编译，33/33 pages |
| Build 警告 | ⚠️ 2条 | `public/listening/` 文件模式过宽 |
| `.env` 文件 | ✅ 存在 | 含 DATABASE_URL + DEEPSEEK_API_KEY |
| 数据库迁移 | ✅ 3 次 | baseline + publishedAt + favoritedAt |

### 运行时验证（2026-07-27，dev server port 3456）

| 检查项 | 结果 |
|--------|------|
| Dev server 启动 | ✅ 3.6s 内 Ready，Turbopack |
| Neon 数据库连接 | ✅ **通过** — `/api/warmup` → `{"status":"ok"}` |
| 首页 `/` | ✅ 200 |
| `/words` 词汇入口 | ✅ 200 |
| `/reading` 阅读列表 | ✅ 200 |
| `/listening` 听力入口 | ✅ 200 |
| `/coach` Coach 入口 | ✅ 200 |
| `/listening/scenes` 场景列表 | ✅ 200 |
| `/listening/knowledge` 知识听力 | ✅ 200 |
| `/reading/[id]` 动态文章 | ✅ 200 |
| `/api/warmup` 健康检查 | ✅ 200 — `{"status":"ok"}` |
| `/api/reading` 文章列表 | ✅ 200 — 50 篇文章 |
| `/api/listening/categories` | ✅ 200 — 8 个分类 |
| `/api/listening/scenes` | ✅ 200 — 290 个场景 |
| `/api/words/queues` | ✅ 200 — total=2000, review=12, new=1967, mastered=21 |
| Dev server 错误输出 | ✅ 无任何错误或警告 |

### 实际内容量

| 模块 | 数据 |
|------|------|
| 词汇 | 2000 IELTS 词 + 主题词 |
| 阅读 | 50 篇英语文章 |
| 听力 | 290 个场景 |
| MP3 音频 | 5709 个文件，297 个场景目录 |

### 未验证项目

| 项目 | 原因 |
|------|------|
| DeepSeek API 有效性 | 需实际请求验证，会消耗额度。Key 在 `.env` 中 |
| 听力音频可播放性 | 未逐文件验证 MP3 完整性 |
| Coach 对话端到端体验 | 需要 DeepSeek Key + 浏览器环境 |

---

## Phase 1 必须继承的约束

1. **渐进式重构** — 不推倒重写，始终保持可运行
2. **每阶段审核** — Phase 1 完成后暂停等待确认
3. **不提前实现后续 Phase** — Phase 1 只设计目标架构，不实现
4. **冻结模块** — 见 `phase-0-audit.md` §14 冻结模块说明章节。核心规则：
   - AI Coach + 场景系统：严格冻结产品行为
   - Words 页面 UI：UI 和学习交互冻结，内部 API 可迁移（需授权）
   - `schema.prisma`：最严格冻结，任何修改需明确授权
   - Reading：不在明确冻结范围内，可受控重构
   - 对任何明确冻结文件进行内部迁移，修改前仍须获得用户授权
5. **Workflow/Agent 分离** — 固定步骤用 Workflow，动态决策用 Agent
6. **AI Client 单一职责** — 只负责模型调用，不负责业务编排
7. **需求驱动引入** — 不为"显得高级"引入新技术

### Phase 1 的输入范围

| 输入 | 来源 |
|------|------|
| 当前架构 | `phase-0-audit.md` §当前架构 |
| 功能清单 | `phase-0-audit.md` §功能清单 |
| AI 调用现状 | `phase-0-audit.md` §AI 调用分析 |
| 数据库现状 | `phase-0-audit.md` §数据模型分析 |
| Pipeline 现状 | `phase-0-audit.md` §Pipeline 分析 |
| 技术债清单 | `phase-0-audit.md` §技术债 + §关键结论证据索引 |
| 推荐优先级 | `phase-0-audit.md` §Phase 1 重构建议 |

### Phase 1 应避免的越界

Phase 1 的设计阶段应**仅产出文档**（目标架构设计文档），不应包含：

- 实际代码重构
- 安装新依赖
- 修改 schema
- 创建 Service 类
- 统一 AI Client 的实现

---

## 本阶段声明

- ✅ **已阅读** CLAUDE.md、MASTER_PLAN.md、PHASE_STATUS.md、DECISIONS.md
- ✅ **未修改**任何核心业务代码
- ✅ **未进入** Phase 1
- ✅ **未引入**新框架或依赖
- ✅ **未提前实现**后续 Phase 的内容
- ✅ **审计文档**基于代码阅读 + 构建验证 + 逻辑推演
- ✅ **运行基线**通过 `npx tsc`、`npx eslint`、`npx next build` + dev server 只读端点实测验证
- ✅ **冻结模块规则**已记录但未修改 `CLAUDE.md`

---

## 交付物清单

```
docs/refactor/
  ├── MASTER_PLAN.md          # 已存在 — 重构总体规划
  ├── PHASE_STATUS.md         # ✅ 已更新 — Phase 0 标记完成
  ├── DECISIONS.md            # 已存在 — 架构决策记录
  ├── phase-0-audit.md        # ✅ 新建 — 完整项目审计（含补充章节）
  └── handoffs/
      └── phase-0-handoff.md  # ✅ 本文件 — Phase 0 交接文档
```
