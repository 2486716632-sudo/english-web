# Architecture Rules — English Learning PWA

**日期:** 2026-07-29 (修正版)
**状态:** 生效
**适用范围:** 所有 Phase 2-9 的代码实现

---

## 1. 分层依赖规则

### 规则 D-001：四层结构

所有代码必须属于以下四层 + Composition Root 之一：

| 层 | 名称 | 目录前缀 |
|----|------|---------|
| Layer 1 | UI / API Layer | `src/app/` |
| Layer 2 | Application Layer | `src/application/` |
| Layer 3 | Domain Layer | `src/domain/` |
| Layer 4 | Infrastructure Layer | `src/infrastructure/` |
| — | Composition Root | `src/bootstrap/` |

### 规则 D-002：源码依赖方向（import）

```
UI/API → Application → Domain
    ↘                    ↗ （通过 Port 接口）
       Infrastructure
        （依赖 Port 接口定义）
```

- **UI/API → Application** — API Route import Application Use Case
- **Application → Domain** — Use Case import Domain Service（纯计算）
- **Application → Ports** — Use Case 依赖 Output Port 接口（不依赖实现）
- **Infrastructure → Application Ports** — Adapter 实现 Application 定义的接口
- **Infrastructure → Domain Types** — Adapter 可以使用 Domain 类型（如 Entity ID）
- **Composition Root → 所有层** — 启动时 import 具体实现完成装配

### 规则 D-003：禁止反向依赖

- ❌ **Domain → Application** — Domain 不能 import Application 任何内容
- ❌ **Domain → Infrastructure** — Domain 不能 import Infrastructure 任何内容
- ❌ **Infrastructure → Application Use Case** — Infrastructure 不能 import Use Case
- ❌ **Application → Infrastructure 具体实现** — Application 只能依赖 Port 接口
- ❌ **Domain → Next.js / Prisma / DeepSeek / 文件系统**
- ❌ **循环依赖**

### 规则 D-004：同层调用

- Application Use Case 之间可以互相调用
- Domain Service 之间可以互相调用（跨领域通过 Application 协调）
- Infrastructure 组件之间可以互相调用

### 规则 D-005：运行时调用方向

运行时调用通过 Composition Root 从 Application 指向 Infrastructure Adapter：

```
API Route → Use Case → Port (接口) ← Adapter (Infrastructure 实现)
                               ↑
                          Domain Service (纯计算，无外部依赖)
```

---

## 2. API Route 规则

### 规则 API-001：薄 Route

API Route 文件的职责边界：

```
✅ 请求参数解析和类型验证
✅ 调用 Application Use Case
✅ 格式化 NextResponse（统一响应格式）
✅ 单一的错误映射（catch → 统一错误 JSON）
❌ 不构建或包含 Prompt
❌ 不编排多步流程
❌ 不包含领域业务规则
❌ 不直接调用 AI Client
❌ 不直接操作文件系统
❌ 不直接调用 Prisma（纯运维端点除外）
```

### 规则 API-002：统一响应格式

```typescript
// 成功
{ "data": T }

// 错误
{ "error": { "code": string, "message": string, "details?: unknown" } }

// 分页
{ "data": T[], "pagination": { "total": number, "page": number, "pageSize": number } }
```

### 规则 API-003：纯运维端点例外

纯运维端点可以直接调用 Prisma，但必须：

1. 文件头注释标明 `// @ops-endpoint — 无产品语义`
2. 确认确实没有任何产品业务语义（如 `/api/warmup`）
3. 有业务含义的简单读写（如标记已读、获取队列统计）需通过轻量 Application Use Case

---

## 3. Application Layer 规则

### 规则 APP-001：Application Use Case 定义

Application Use Case 是每个 API 端点的应用入口，特征：

- 构造时通过构造参数注入 Output Port 接口
- 构建 Prompt（调用 Application 层的 Prompt 函数）
- 编排 Domain Service 完成纯逻辑计算
- 通过 Output Port 接口调用外部服务（AI、DB、TTS、Storage 等）
- **不包含领域业务规则**（规则在 Domain 中）
- 返回 DTO

### 规则 APP-002：Workflow 定义

Workflow 是复杂 Use Case 内部的可选步骤编排机制：

- 仅在需要步骤级状态、Trace、恢复、局部重试、补偿时引入
- 是 Use Case 的组成部分，不是独立组件
- 是否有 AI 调用、步骤数量只是参考，不是硬性判断规则

### 规则 APP-003：Workflow 引入决策

```
Use Case 内部是否需要：
  ├─ 步骤级 Trace / 恢复 / 局部重试 / 补偿？
  │    ├─ 是 → 在 Use Case 内部引入 Workflow
  │    └─ 否 → Use Case 直接编排
  │
  └─ Workflow 是 Use Case 的组成部分，二者不互斥
```

### 规则 APP-004：Agent 预留

Agent 模式（LLM 驱动的动态流程）在本架构中预留，**Phase 7 之前不实现**。
Agent 相关代码必须放在 `src/application/agents/` 目录。

---

## 4. Domain Layer 规则

### 规则 DOM-001：纯计算

Domain 层只包含纯计算、状态转换和规则校验。**不包含** AI 调用、Prompt 构建、外部服务编排。

```typescript
// ✅ 正确 — 纯函数
function calculateNextReview(review: ReviewState | null, rating: number): NextReview { ... }

// ✅ 正确 — 对 AI 输出做业务校验（纯函数）
function validateEnrichedWord(word: EnrichedWord): ValidationResult { ... }

// ❌ 错误 — Domain 中编排 AI 调用
class EnrichWordService {
  constructor(private aiClient: AIClient) {}  // ❌ Domain 不注入 AI Client
}

// ❌ 错误 — Domain 中构建 Prompt
function buildEnrichWordPrompt(word: string): ChatRequest { ... }  // ❌ 属于 Application 层
```

### 规则 DOM-002：禁止的外部依赖

Domain 层**绝对不允许**直接引用以下内容：

- Next.js (Request, Response, NextResponse, cookies, headers)
- Prisma Client 的具体实现
- DeepSeek / OpenAI / 任何 AI Provider 的具体实现
- 文件系统 (fs, path)
- 网络请求 (fetch)
- 环境变量 (process.env)

### 规则 DOM-003：Domain 的唯一职责

Domain 只负责：

1. **领域计算** — 纯数学/逻辑计算（如 SM-2 公式、队列安排）
2. **领域状态转换** — 确定性状态变换（如 `new → learning → review → mastered`）
3. **领域规则校验** — 业务规则验证（如评分范围、间隔合规性）
4. **AI 输出业务校验** — 对 Application 层传递来的 AI 生成内容做合理性检查

### 规则 DOM-004：领域划分

```
domain/{domain-name}/
  types.ts              — 领域类型定义
  *.ts                  — 领域 Service/Rules（纯函数）
```

跨领域共享类型放在 `domain/shared/`。

### 规则 DOM-005：领域错误

每个领域模块定义自己的错误类型，继承自 `DomainError`：

```typescript
class VocabularyError extends DomainError {
  code: 'WORD_NOT_FOUND' | 'INVALID_RATING' | 'QUEUE_EMPTY';
}
```

---

## 5. Infrastructure Layer 规则

### 规则 INFRA-001：AI Client 单一职责

AI Client 的职责边界：

```
✅ 模型 API 调用                    ❌ 构建 Prompt（由 Application 层完成）
✅ 超时控制                          ❌ 业务编排
✅ 指数退避重试（网络重试）           ❌ 决定调用哪个 Use Case
✅ 结构化输出统一处理                ❌ 校验输出内容业务合理性（由 Domain 层完成）
✅ 解析恢复（格式修复+重新调用）     ❌ 降级策略决策
✅ Token 统计和成本计算              ❌ 内容审核
✅ 错误映射 (Provider → 统一格式)   ❌ 缓存（由 Use Case / Cache Port 控制）
✅ 流式处理                          —
```

### 规则 INFRA-002：Provider Adapter 模式

所有 AI Provider 必须通过 Adapter 接入，实现 Application 层定义的 `AIClientPort` 接口。

### 规则 INFRA-003：Port 实现模式

Infrastructure 组件实现 Application 层定义的 Port 接口：

```typescript
// Application 层: application/ports/ai-client.ts — 只有接口
interface AIClientPort { chat(...): Promise<...>; }

// Infrastructure 层: infrastructure/ai/adapters/deepseek.ts — 实现
class DeepSeekClient implements AIClientPort { ... }
```

---

## 6. Prompt 规则

### 规则 PROMPT-001：Prompt 属于 Application 层

- 所有 Prompt 文件放在 `src/application/prompts/` 下
- 按用例分子目录
- 每个 Prompt 文件导出一个**函数**，接受类型化输入，返回 `{ system, messages }` 结构

### 规则 PROMPT-002：禁止内联

路由文件、Use Case 文件中**不允许**包含超过 5 行的长字符串 Prompt。

### 规则 PROMPT-003：版本标记

每个 Prompt 文件头部标记版本：

```typescript
// @version 1.0
// @last-reviewed 2026-07-29
```

---

## 7. 结构化输出规则

### 规则 SO-001：统一入口

所有 AI 结构化输出（JSON 解析）必须通过 `AIClientPort.chatStructured()` 处理。禁止 JSON 提取模式散落在业务代码中。

### 规则 SO-002：回退透明

DeepSeek 两层法（json_object 回退）封装在 `chatStructured()` 内部，对调用者完全透明。

### 规则 SO-003：重试分工

- **网络重试**（timeout/5xx/429）：由 retry 层处理（指数退避 + jitter）
- **解析恢复**（invalid_response / 格式错误）：由 structured-output 层处理（格式修复 + 重新调用）

---

## 8. 错误处理规则

### 规则 ERR-001：分层错误

| 层 | 错误类型 | 说明 |
|----|---------|------|
| API Route | HTTP 错误响应 | NextResponse.json({ error: {...} }, { status }) |
| Application | ApplicationError | 包装下层错误，添加业务上下文 |
| Domain | DomainError | 纯业务错误 |
| Infrastructure | AIError, PrismaError, StorageError | 原始技术错误，已统一映射 |

### 规则 ERR-002：错误传播

- Infrastructure 错误在 Application 层转换为 ApplicationError
- DomainError 直接向上传播
- API Route 统一 catch → 格式化为 HTTP 响应

### 规则 ERR-003：网络重试标记

AIError 必须携带 `retryable: boolean` 标记。仅对以下错误进行网络重试：
- `rate_limited` (429)
- `provider_error` (5xx)
- `timeout`

`auth_error` 和 `context_overflow` 不重试。`invalid_response` 通过解析恢复处理。

---

## 9. 外部依赖规则

### 规则 EXT-001：外部依赖封装

所有外部依赖通过 Infrastructure 层实现 Port 接口。业务代码通过 Port 接口调用：

```typescript
// ✅ 正确
const result = await aiClientPort.chat(request);  // 通过 Port 接口

// ❌ 禁止 — 直接调用外部依赖
const result = await fetch('https://api.deepseek.com/...');
const audio = await new EdgeTTS().ttsPromise(text, path);
```

### 规则 EXT-002：音频文件管理

- 通过 `StoragePort` 接口抽象文件操作
- 当前 `public/listening/` 的运行时可写入问题在 Phase 4 解决

### 规则 EXT-003：schema.prisma 冻结

`prisma/schema.prisma` 严格冻结，任何修改需要用户明确授权。

---

## 10. 测试规则（Phase 2 生效）

### 规则 TEST-001：Characterization Baseline

Phase 2 针对当前代码位置建立 characterization baseline：
- 测试 `src/lib/sm2.ts`（不移动到 `src/domain/`）
- 不提前创建未来 Domain 实现
- 不移动业务代码

### 规则 TEST-002：可测试性要求（Phase 4+ 生效）

- Domain Service 必须可纯逻辑测试
- Workflow 必须可步骤级测试
- API Route 必须可集成测试

---

## 11. 现有代码迁移规则

### 规则 MIG-001：渐进迁移

- 一次只迁移一个模块
- 迁移后保持行为一致（回归验证）
- 旧代码在新代码验证通过后方可删除

### 规则 MIG-002：冻结模块保护

- 冻结模块（AI Coach、Words UI、schema.prisma）的修改必须获得用户明确授权
- 冻结模块的 AI 调用可以在 Phase 3 替换（行为一致），但修改前需获得授权

### 规则 MIG-003：不提前实现

禁止在当前 Phase 实现后续 Phase 的内容。

---

## 12. 命名与文件约定

### 命名

| 类型 | 后缀 | 示例 |
|------|------|------|
| Application Use Case | `*.use-case.ts` | `vocab-exercise.use-case.ts` |
| Workflow | `*.workflow.ts` | `listening-generation.workflow.ts` |
| Output Port | `*.ts` (放在 ports/) | `ai-client.ts` |
| Domain Service | `*.ts` | `sm2.ts`, `queue-rules.ts` |
| Provider Adapter | `*.adapter.ts` | `deepseek.adapter.ts` |
| Infrastructure Service | `*.ts` | `edge-tts.ts` |
| Prompt | `*.prompt.ts` | `enrich-word.prompt.ts` |

### 目录

- `src/application/use-cases/{domain}/` — Use Case
- `src/application/workflows/` — Workflow
- `src/application/ports/` — Output Port 接口
- `src/application/prompts/{domain}/` — Prompt 构建函数
- `src/domain/{domain}/` — 领域逻辑
- `src/infrastructure/{component}/` — 基础设施实现
- `src/bootstrap/` — Composition Root

---

## 附录：本规则更新流程

1. 任何架构规则的修改需经当前 Phase 的工程师 + 审核者同意
2. 修改记录在 `docs/refactor/DECISIONS.md`（ADR 格式）
3. 本文件同步更新
