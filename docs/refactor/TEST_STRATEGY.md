# Test Strategy — English Learning PWA

**日期:** 2026-07-29（修正版）
**状态:** 生效（Phase 2 建立）
**用途:** 定义测试分层策略、测试职责边界、以及后续 Phase 重构时如何使用这些测试。

---

## 1. 测试金字塔

```
          ╱╲
         ╱  ╲         E2E / Manual Smoke
        ╱    ╲        (少量关键路径)
       ╱──────╲
      ╱        ╲     Integration / API Tests
     ╱          ╲    (依赖 DB/AI/外部服务)
    ╱────────────╲
   ╱              ╲  Unit + Characterization Tests
  ╱                ╲ (纯逻辑 + Schema 校验)
 ╱──────────────────╲
```

| 层级 | 当前覆盖 | 目标覆盖（Phase 11） |
|------|---------|-------------------|
| **Unit + Characterization**（当前） | 95 tests | 200+ tests |
| **Integration / API**（Phase 4+） | 脚本化冒烟 | CI 集成测试 |
| **E2E / Manual**（Phase 11） | 人工冒烟清单 | Playwright E2E |

---

## 2. 测试类型定义

### Unit Test（单元测试）

**测什么:**
- 纯函数：给定输入，验证输出
- 无外部依赖（无 DB、AI、TTS、文件系统、网络）
- 可独立运行，不依赖环境配置

**当前覆盖:**
- `formatPhonetic` — 音标格式化（10 tests）
- `clearWordCaches` — 缓存管理（6 tests）
- 未来新增的 Domain 纯函数

**不测什么:**
- ❌ 含有副作用的函数（DB 读写、AI 调用）
- ❌ React 组件渲染
- ❌ 模块间交互

**运行方式:** `npx vitest run`

### Characterization Test（表征测试 / 黄金测试）

**测什么:**
- 记录和固定**当前实现**的具体行为
- 不验证"逻辑是否正确"，而是验证"行为是否改变"
- 在重构前建立，重构后作为回归依据

**当前覆盖:**
- SM-2 算法所有评分路径、间隔计算、边界输入（32 tests）

**与 Contract Test 的区别:**
- Characterization Test = 记录当前行为（无论对错）
- Contract Test = 验证契约规定的行为

**何时使用:**
- Phase 2 对 `src/lib/sm2.ts` 建立基线
- Phase 4+ 对当前 API Route 的行为建立基线
- 重构前为现有代码建立防护网

### Contract Test（契约测试）

**测什么:**
- 模块/服务之间的接口契约
- Port 接口的实现是否满足约定

**当前覆盖:**
- 无（Phase 2 不涉及）

**何时引入:**
- Phase 4 引入 Workflow 后，为 Workflow 步骤间接口建立契约测试
- Phase 3 AI Client 实现后，为 AIClientPort 建立契约测试

### Integration Test（集成测试）

**测什么:**
- 跨模块/跨层的交互
- 带有真实或 mock 外部依赖的测试

**当前覆盖:**
- 无自动化测试（仅脚本化 API 冒烟，需 dev server）

**何时引入:**
- Phase 4：Reading Pipeline 的步骤级集成
- Phase 11：API Route 的全量集成

### AI Evaluation Test（离线评估 / 契约校验）

**测什么:**
- AI 结构化输出的 JSON 合法性
- 输出内容的 Schema 校验
- 基础质量检查（非空、格式正确）

**当前覆盖:**
- 结构化输出 Schema 校验（35 tests）
- 内容基础质量（12 tests）
- 基于 synthetic fixture 的离线评估

**重要限制（当前阶段）：**
- ⚠️ 当前未接入生产 Route 的实际解析代码
- ⚠️ 是离线契约校验，非端到端验证
- ⚠️ Phase 3 实现 AI Client 后需要升级为接入真实 `chatStructured()`

### Manual Smoke Test（人工冒烟）

**测什么:**
- 关键页面可达性
- 核心功能路径可走通
- 无明显渲染错误

**当前覆盖:**
- 14 项脚本化检查：5 个 API 端点 + 7 个关键页面路径 + 2 个安全 POST（需 dev server）
- 测试脚本 + 人工检查清单
- 每个检查只发送 1 个 HTTP 请求；无 jq 时结构校验记为 SKIP 而非 PASS

---

## 3. 测试文件组织

```
src/
├── lib/
│   ├── __tests__/
│   │   ├── sm2.test.ts           # SM-2 表征测试 (32 tests)
│   │   ├── utils.test.ts         # 工具函数单元测试 (10 tests)
│   │   └── word-cache.test.ts    # 缓存管理单元测试 (6 tests)
│   ├── sm2.ts
│   ├── utils.ts
│   └── word-cache.ts

tests/
├── eval/
│   ├── fixtures/
│   │   └── ai-responses.ts       # AI evaluation fixture (33 static + 1 function)
│   ├── structured-output.test.ts # 结构化输出合法性 (35 tests)
│   └── content-quality.test.ts   # 内容基础质量 (12 tests)
├── smoke/
│   └── api-smoke.sh              # API 冒烟脚本
```

**原则:**
- 与源码同目录的 `__tests__/` 放置紧密相关的单元/表征测试
- `tests/eval/` 放置 AI 评估相关测试（独立于源码目录）
- `tests/smoke/` 放置冒烟测试脚本

---

## 4. 后续 Phase 使用方式

### 重构前

```bash
# 运行全部测试，确认基线通过
npx vitest run

# 记录结果
npx vitest run --reporter=junit > test-results.xml
```

### 重构后验证

```bash
# 运行全部测试，确认无回归
npx vitest run

# 如果测试失败：
# 1. 确认是否是有意为之的行为变更
# 2. 更新 characterization test 记录新行为
# 3. 在 DECISIONS.md 记录变更理由
```

### 按 Phase 的关键测试

| Phase | 关注测试 | 预期行为 |
|-------|---------|---------|
| Phase 3（AI Client） | `structured-output.test.ts` | `chatStructured()` 必须能处理所有 fixture 格式 |
| Phase 4（Pipeline 重构） | `sm2.test.ts`, `utils.test.ts` | SM-2 和工具函数行为不变 |
| Phase 4（Route 薄化） | `api-smoke.sh` | API 端点可达性不变 |
| Phase 6（记忆系统） | `word-cache.test.ts` | 缓存行为可能需兼容新记忆系统 |
| Phase 11（Reliability, Ownership & Evaluation Platform Convergence） | 所有现有测试 | 全部通过 + 补充新测试 + 建立评估 harness / golden-set 约定 |
| Phase 12（Coach 重构） | Coach 相关测试 | 行为保持 + 确定性 Coach 评估基线 |
| Phase 13（检索工程） | 检索评估数据集 | baseline vs candidate 检索对比 + 架构决策 |
| Phase 14（Agent 工具系统） | Agent / tool 评估 | 相对确定性基线的对照评估 |
| Phase 16（生产与作品集） | 全部 | 汇总基准 / 实验报告；复验迁移与部署 |

> **2026-09-20 补充（第二次路线修订 — 已批准 / 生效）。** 评估已被提升为
> **系统级跨领域能力**（ADR-017，**Accepted**；2026-09-20 外部评审 Approved）：
> 本文件仍拥有测试分层与运行命令；**评估 / 实验的证据契约**归
> `PORTFOLIO_ENGINEERING_CRITERIA.md`。golden set / fixture 约定的**基础设施**在 **Phase 11** 建立，
> 供 Phase 12–14 复用。

### 关键风险

1. **AI Client 迁移导致的输出差异**: `structured-output.test.ts` 和 `content-quality.test.ts` 在 Phase 3 需要接入真实 `chatStructured()` 代码，而不仅是当前的安全提取模拟函数
2. **SM-2 移动**: 如果 Phase 4+ 将 `sm2.ts` 移动到 `domain/vocabulary/`，测试文件需同步移动（测试内容不变）
3. **Fixture 过期**: AI 评估 fixture 可能随 Prompt 变化而过时，需同步更新

---

## 5. 测试质量门禁

### 当前门禁（Phase 2）

```bash
# Phase 2 最小检查
npx tsc --noEmit                      # 必须通过
npx vitest run                        # 必须全部通过
```

### 扩展门禁（Phase 11 目标）

```bash
npx tsc --noEmit
npx vitest run
npx eslint src/                        # 无新增错误
npx next build                         # 编译成功
```

### 例外处理

- 已知 ESLint 历史错误（35 errors, 36 warnings）不阻碍开发
- 新代码不得引入新的 ESLint 错误
- 测试失败需在 PR 中说明原因

---

## 6. Mock / Fixture 策略

### Unit Test
- 无 mock，测试纯函数
- 输入为显式参数或预设 fixture

### Characterization Test
- 无 mock，直接调用被测函数
- 输入覆盖典型值和边界值

### AI Evaluation（当前）
- 使用 synthetic fixture（非真实模型输出）
- Fixture 覆盖有效响应、格式异常、结构缺失、空值、嵌套错误等情况
- Fixture 文件在 `tests/eval/fixtures/` 中集中管理
- 后续可添加真实模型响应的 annotation
- **当前为离线契约校验，未接入生产解析代码**

### Integration Test（Phase 4+）
- Mock: AIClientPort, RepositoryPort, TTSPort
- 不连接真实数据库、不调用真实 AI

---

## 7. 测试数据管理

### 当前方案
- 纯逻辑测试：在测试代码中内联构造输入数据
- AI 评估：集中式 fixture 文件（`tests/eval/fixtures/ai-responses.ts` — 33 个静态 fixture + 1 个动态生成函数）

### 不引入
- 测试数据库（需要真实 PostgreSQL 连接）
- 大型 JSON 数据文件（需要管理文件路径）

### 未来方案（Phase 4+）
- 引入种子数据（`prisma/seed.ts` 的子集）
- 引入数据库 fixture 管理
