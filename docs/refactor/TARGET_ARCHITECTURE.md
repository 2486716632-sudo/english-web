# Target Architecture — English Learning PWA

**Phase:** 1
**日期:** 2026-07-29 (修正版)
**状态:** 修正完成，等待复审

---

## 1. 总体架构

目标架构采用**四层结构**，依赖方向严格自上而下。层间采用 **Port/Adapter（端口-适配器）模式**：层间通过接口（Port）交互，具体实现（Adapter）在运行时通过 Composition Root 装配。

```


┌─────────────────────────────────────────────────────────────────────────┐
│  Layer 1: UI / API Layer (Presentation)                                  │
│  ┌──────────────────────┐  ┌───────────────────────────────────────┐   │
│  │  Pages               │  │  API Routes (thin)                    │   │
│  │  (React Server/Client│  │  · 请求验证 (schema/zod)              │   │
│  │   Components)        │  │  · 调用 Application Use Case          │   │
│  │  · 渲染与交互          │  │  · 响应格式化                          │   │
│  │  · 状态(页面级)        │  │  · 不包含业务逻辑                      │   │
│  └──────────────────────┘  └───────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ 源码依赖 ↓（import 方向）
┌──────────────────────────────────▼──────────────────────────────────────┐
│  Layer 2: Application Layer (Use Cases / Orchestration)                  │
│  ┌──────────────────────────┐ ┌────────────────────┐                   │
│  │  Application Use Case/   │ │  Workflow (可选)    │                   │
│  │  Service                 │ │  · 复杂用例内部的    │                   │
│  │  · API 的应用入口         │ │    显式步骤编排      │                   │
│  │  · 编排 Domain Service   │ │  · 步骤级状态/      │                   │
│  │  · 调用 Output Port      │ │    Trace/恢复/重试  │                   │
│  │  · 构建 Prompt          │ │  · 仅在需要时引入    │                   │
│  │  · 不包含领域规则        │ └────────────────────┘                   │
│  └──────────────────────────┘                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Output Ports (接口定义)                                       │      │
│  │  · AIClient, Repository, TTS, Storage, Cache, Telemetry...  │      │
│  │  · 只有接口，没有实现                                          │      │
│  └──────────────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  Prompts (按用例组织的 Prompt 函数)                             │      │
│  └──────────────────────────────────────────────────────────────┘      │
└──┬──────────────────────────────┬──────────────────────────────────────┘
   │ 源码依赖 ↓                    │ 依赖 ↓
┌──▼──────────────────────────────▼──────────────────────────────────────┐
│  Layer 3: Domain Layer (Pure Business Logic)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Vocab     │ │ Reading  │ │Listening │ │ Coach    │ │User      │     │
│  │Domain    │ │ Domain   │ │ Domain   │ │ Domain   │ │ Domain   │     │
│  │· SM-2    │ │· Phonetic│ │· Category│ │· Dialogue│ │· 预留     │     │
│  │· Review  │ │· Vocab   │ │· Scene   │ │· Grammar │ │          │     │
│  │· Queue   │ │  Extract │ │  Rules   │ │  Check   │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│  ┌──────────────────────────────────────────────┐                      │
│  │  Shared Domain                               │                      │
│  │  · Domain Types / Errors / Events            │                      │
│  │  · Memory 模型 (预留)                         │                      │
│  └──────────────────────────────────────────────┘                      │
└──┬──────────────────────────────────────────────────────────────────────┘
   │ 依赖 ↓（仅依赖接口定义，不依赖具体实现）
   │ 运行时调用 ↑（由 Composition Root 注入 Adapter 实现）
┌──▼──────────────────────────────────────────────────────────────────────┐
│  Layer 4: Infrastructure Layer (Adapters / Implementations)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ AI Client│ │ Prisma   │ │ Storage  │ │ TTS      │ │ Telemetry│     │
│  │·Adapters │ │ Client   │ │·File Sys │ │·Edge TTS │ │·Logger   │     │
│  │·Retry    │ │·Neon     │ │·CDN 预留  │ │·Kokoro  │ │·Tracer   │     │
│  │·Token    │ │·迁移      │ │          │ │·多角色   │ │·Metrics  │     │
│  │·Timeout  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│  │·Error Map│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │·SO       │ │ Cache    │ │ RSS      │ │ Audio    │ │ External API │ │
│  └──────────┘ │·实现      │ │·实现      │ │·Gen/Play │ │·预留         │ │
│               └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│  Composition Root (bootstrap/)                                           │
│  · 装配 Use Case、Repository、AI Client、TTS、Storage 等具体实现        │
│  · 是唯一 import Infrastructure 具体实现的地方                          │
│  · Application / Domain / API 只依赖接口                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 核心依赖模型

```
源码编译依赖（import）方向：
  UI/API Layer → Application Layer → Domain Layer
  Domain → (无外部依赖)
  Application Layer → Output Ports (接口定义在 Application 层)
  Infrastructure → Application Layer 的 Port 接口
  Infrastructure → Domain Types（可引用领域类型）

运行时调用方向：
  Application → Output Port (接口) ← Infrastructure Adapter (实现)
  调用链由 Composition Root 在启动时装配

关键规则：
  - Output Port 只定义在 Application Layer
  - Infrastructure 实现并依赖 Application Layer 定义的 Port
  - Infrastructure 可以引用 Domain Types（如 Entity ID）
  - Domain 不定义外部服务 Port，也不依赖 Infrastructure
  - Application 不 import Infrastructure 的具体实现
  - Infrastructure 不 import Application 的 Use Case、Domain 的 Service
```

---

## 2. 各层职责

### Layer 1: UI / API Layer

| 子层 | 职责 | 禁止事项 |
|------|------|---------|
| **Pages** | 渲染 UI、用户交互、页面级客户端状态、调用 API Route | 不直接调用 AI/DB；不包含业务逻辑 |
| **API Routes** | 请求参数验证、调用 Application Use Case、格式化响应 | 不包含业务逻辑；不直接调用 AI/DB |

**"薄 API Route"的边界定义：**
- ✅ 请求参数解析和类型验证
- ✅ 调用 Application Use Case
- ✅ 格式化 `NextResponse`
- ✅ 单一的错误映射（catch → 统一错误格式）
- ❌ 不构建 Prompt
- ❌ 不编排多步流程
- ❌ 不包含领域业务规则
- ❌ 不直接调用 AI Client、Prisma（除非是纯运维端点）

**纯 CRUD 例外（限缩）：** 纯 CRUD 例外仅限无产品语义的技术端点（如 `/api/warmup`）。有业务含义的简单读写（如标记已读）需通过轻量 Application Handler，不要求套 Domain 层。

### Layer 2: Application Layer

| 组件 | 职责 | 使用场景 |
|------|------|---------|
| **Application Use Case / Service** | API 的应用入口；编排 Domain Service、调用 Output Port 接口、构建 Prompt | 每个 API Route 对应一个 Use Case |
| **Workflow** (可选) | 复杂用例内部的显式步骤编排机制 | 当步骤需要独立 Trace、局部重试、恢复、补偿时引入 |
| **Output Ports** | 定义 Application 需要的外部服务接口 | AIClient、Repository、TTS、Storage 等 |
| **Prompts** | 按用例组织的 Prompt 构建函数 | 与 Use Case/Workflow 同层 |

**Application Use Case 的特征：**
- 是每个 API 端点（或 CLI 脚本）的应用入口
- 构建 Prompt（调用 Prompt 函数）
- 编排 Domain Service 完成业务规则计算
- 通过 Output Port 接口调用外部服务（AI、DB、TTS、Storage）
- 不包含领域业务规则（规则在 Domain 中）
- 返回 DTO 给 API Route

**Workflow 的特征：**
- 是 Use Case 内部的可选机制，不是独立组件
- 仅在需要时引入：步骤级状态、Trace、恢复、局部重试、补偿
- 不是"有 AI 调用就 Workflow"也不是"3 步以上就 Workflow"

**Output Ports（接口定义）：**
```typescript
// Application 层定义的外部服务接口（只有接口，没有实现）
// 路径示例: src/application/ports/ai-client.ts

interface AIClientPort {
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;
  chatStructured<T>(request: ChatRequest, schema: Schema<T>): Promise<T>;
}

interface WordRepositoryPort {
  findReview(wordId: string): Promise<ReviewState | null>;
  updateReview(wordId: string, review: NextReview): Promise<void>;
}
```

### Layer 3: Domain Layer

| 组件 | 职责 | 纯逻辑要求 |
|------|------|-----------|
| **Domain Service** | 领域内的业务规则计算 | ✅ 纯函数，无副作用 |
| **Domain Types** | 领域实体、值对象、事件 | ✅ 无外部依赖 |
| **Domain Errors** | 领域特定的错误类型 | ✅ 无外部依赖 |
| **Domain Validation** | 对 AI 输出进行业务校验 | ✅ 输入 → 校验结果 |

**Domain 只负责：**
- 领域计算（如 SM-2 公式计算、学习队列安排）
- 领域状态转换（如复习状态转换：new → learning → review → mastered）
- 领域规则校验（如评分是否合法、复习间隔是否合规）
- 对 AI 输出进行业务合理性校验（如判断 AI 生成的例句是否包含目标词）

**Domain 不负责：**
- ❌ AI 调用、Prompt 构建
- ❌ TTS/Storage 调用
- ❌ 数据库读写
- ❌ 跨领域编排
- ❌ 文件系统操作

**每个领域模块的典型组成：**
- `domain/vocabulary/`:
  - `sm2.ts` — SM-2 算法（纯函数）
  - `types.ts` — 词汇领域类型（Word, ReviewState, StudyQueue）
  - `queue-rules.ts` — 队列计算规则（每日配额、新词/复习比例）
  - `validation.ts` — 对 AI 生成内容的业务校验（如音标格式检查）

- `domain/reading/`:
  - `types.ts` — 阅读领域类型
  - `phonetic-rules.ts` — 音标查询和回退规则
  - `vocab-extract-rules.ts` — 文章词汇提取规则

- `domain/listening/`:
  - `types.ts` — 听力领域类型
  - `scene-rules.ts` — 场景生成规则（对话行数、难度校验）
  - `category-rules.ts` — 分类规则

### Layer 4: Infrastructure Layer

| 组件 | 职责 | 说明 |
|------|------|------|
| **AI Client** | 统一 AI 模型调用 | 实现 Application 层定义的 AIClientPort |
| **Prisma Client** | 数据库访问 | 实现 Repository Port 接口 |
| **Storage** | 文件存储 | 实现 StoragePort 接口 |
| **TTS** | 文本转语音封装 | 实现 TTSPort 接口 |
| **RSS** | RSS 解析封装 | 实现 RSSPort 接口 |
| **Cache** | 缓存抽象 | 实现 CachePort 接口 |
| **Telemetry** | 日志、Trace、指标 | 实现 TelemetryPort 接口 |

### Composition Root（`src/bootstrap/`）

由 Composition Root 负责在应用启动时装配所有层的具体实现：

```typescript
// src/bootstrap/index.ts — 仅设计，不实现
function bootstrap() {
  // 1. 创建 Infrastructure 实例
  const aiClient = new DeepSeekClient(/* config */);
  const prisma = new PrismaClient();
  const wordRepo = new PrismaWordRepository(prisma);
  const tts = new EdgeTTSService(/* config */);

  // 2. 创建 Domain Service（纯函数，无需注入）
  const sm2 = new Sm2Service();

  // 3. 创建 Application Use Case（注入 Port 的实现）
  const vocabExerciseUseCase = new CompleteVocabularyExerciseUseCase(
    wordRepo,   // Infrastructure 实现
    sm2,        // Domain 纯逻辑
  );

  return { vocabExerciseUseCase, /* ... */ };
}
```

---

## 3. 依赖方向与禁止规则

### 源码依赖（import 方向）

```
UI/API (src/app/) → Application (src/application/) → Domain (src/domain/)
  │                     │                                  │
  │                     ▼                                  │
  │              Output Ports (接口)                        │
  │                     ▲                                  │
  └─────────────────────┼──────────────────────────────────┘
                        │
              Infrastructure (src/infrastructure/)
                实现 Application 中定义的 Port 接口
```

### 运行时调用（方法调用）

```
API Route → Application Use Case → Output Port (接口) ← Infrastructure Adapter (实现)
                                         │
                                    Domain Service (纯计算)
```

### 允许的依赖

- ✅ **UI/API → Application** — API Route import Application Use Case
- ✅ **Application → Domain** — Use Case import Domain Service
- ✅ **Application → Output Ports** — Use Case 使用接口（不 import 实现）
- ✅ **Infrastructure → Application Ports** — Adapter 实现 Application 定义的接口
- ✅ **Infrastructure → Domain Types** — Adapter 可以使用 Domain 类型（如 Entity ID）
- ✅ **Infrastructure ↔ Infrastructure** — 同一层内可互相调用
- ✅ **Bootstrap (Composition Root) → 所有层** — 装配时 import 具体实现

### 禁止的依赖

- ❌ **Domain → Application** — Domain 不能 import Application 的任何内容
- ❌ **Domain → Infrastructure** — Domain 不能 import Infrastructure 的任何内容
- ❌ **Infrastructure → Application Use Case** — Infrastructure 不能 import Use Case
- ❌ **Application → Infrastructure 具体实现** — Application 只能依赖接口
- ❌ **Domain → Next.js/Prisma/DeepSeek/文件系统** — Domain 不依赖外部系统
- ❌ **循环依赖**

### 例外

- **纯运维端点**（如 `/api/warmup`）可以直接调用 Prisma，文件头标记 `// @ops-endpoint`
- **Page Component** 可以直接从 Data JSON 读取静态配置（如分类文件）

---

## 4. 当前代码模块 → 目标架构映射

### 现有文件映射表

| 当前文件 | 当前问题 | 目标位置 | 对应层次 | 迁移优先级 |
|---------|---------|---------|---------|-----------|
| `src/app/api/words/route.ts` | 业务逻辑 + AI 调用 + DB | 薄 Route + Application Use Case | Layer 1→2 | P0 |
| `src/app/api/words/ai-train/route.ts` | 同上 | 同上 | Layer 1→2 | P0 |
| `src/app/api/words/themes/generate/route.ts` | 内联 3 步 AI 流程 | Application Use Case + Workflow (如需) | Layer 2 | P0 |
| `src/app/api/reading/[id]/vocab/route.ts` | AI 调用混合 | Application Use Case | Layer 2 | P0 |
| `src/app/api/coach/route.ts` | 两步 AI 调用内联 | Application Use Case + Workflow (冻结，延迟) | Layer 2 | P3 |
| `src/app/api/scene/generate/route.ts` | AI 调用内联 | Application Use Case | Layer 2 | P3 |
| `src/app/api/scene/recommend/route.ts` | AI 调用内联 | Application Use Case | Layer 2 | P3 |
| `src/app/api/assistant/route.ts` | AI 调用内联 | Application Use Case | Layer 2 | P1 |
| `src/app/api/listening/scenes/[id]/route.ts` (POST) | 包含 refill Pipeline | Application Use Case + Workflow (如需) | Layer 2 | P1 |
| `src/app/api/reading/push/route.ts` | 数据写入 | Application Use Case | Layer 2 | P1 |
| `src/features/listening/lib/listening.ts` | 混合 AI/DB/TTS/FS | 拆分: Application + Domain + Infrastructure | 各层 | P1 |
| `src/features/listening/lib/listening-prompts.ts` | ✅ 好模式 | `src/application/prompts/listening/` | Layer 2 | P1 |
| `src/lib/sm2.ts` | ✅ 纯函数 | `domain/vocabulary/sm2.ts` (Phase 4+) | Layer 3 | P3 |
| `src/lib/prisma.ts` | ✅ 基础设施 | Infra (保持不变) | Layer 4 | — |
| `src/lib/types.ts` | 共享类型 | 拆分到各层 | 各层 | P2 |
| `src/lib/utils.ts` | 工具函数 | 拆分 | 各层 | P2 |
| `src/lib/word-cache.ts` | 模块级缓存 | Infra/Cache 服务 | Layer 4 | P2 |
| `src/components/AIAssistant.tsx` | UI 组件 | 保持 | Layer 1 | — |
| `src/data/listening-categories.json` | 静态数据 | 保持 | Layer 4 (data) | — |
| `scripts/reading-push.ts` | CLI 脚本 | 共享 Application Use Case | Layer 2 | P2 |
| `scripts/` (audio) | CLI 脚本 | Infra 层 TTS 服务的 CLI 入口 | Layer 4 | P2 |
| `public/listening/` | 运行时写入 | Infrastructure/Storage 管理 | Layer 4 | P2 |

### 映射原则

1. **冻结模块**（AI Coach、Words UI、schema.prisma）保持当前位置不动，仅在后续 Phase 中按需迁移
2. **新功能**应直接按新架构创建
3. **迁移路径**遵循 MIGRATION_PLAN.md 定义的顺序
4. **不一次性移动** — 先将逻辑拆分到新模块，再删除旧代码

---

## 5. Application Use Case / Service 与 Workflow

### 5.1 Application Use Case / Service

**定义：** 每个 API 端点的应用入口。负责编排、调用外部服务，不包含领域规则。

**特征：**
- 是 API Route 调用的唯一入口
- 构建 Prompt（调用 Application 层的 Prompt 函数）
- 编排 Domain Service 完成业务规则计算
- 通过 Output Port 接口调用外部服务（AI、DB、TTS、Storage）
- 不包含领域业务规则（规则在 Domain 中）
- 返回值是 DTO

**示例：**
```typescript
// Application Use Case 示例（仅设计，不实现）
class CompleteVocabularyExerciseUseCase {
  constructor(
    private readonly wordRepo: WordRepositoryPort,  // Output Port 接口
    private readonly progressService: ProgressService, // Domain Service
  ) {}

  async execute(input: { userId: string; wordId: string; rating: number }): Promise<ExerciseResultDTO> {
    const review = await this.wordRepo.findReview(input.wordId);
    // Domain 纯计算
    const next = progressService.calculateNextReview(
      review?.state ?? null,
      input.rating,
    );
    await this.wordRepo.updateReview(input.wordId, next);
    return { nextReviewAt: next.nextReviewAt, isMastered: next.isMastered };
  }
}
```

### 5.2 Workflow

**定义：** 复杂 Application Use Case 内部的可选步骤编排机制。只有需要步骤级状态、Trace、恢复、局部重试、补偿时才引入 Workflow。

**特征：**
- 是 Use Case 的组成部分，不是独立层
- 每一步有明确的输入、输出、错误处理
- 仅在必要时引入
- 是否有 AI 调用、步骤数量只是参考，不是硬规则

**示例：**
```typescript
// Workflow 示例（仅设计，不实现）
class ListeningSceneGenerationWorkflow {
  constructor(
    private readonly aiClient: AIClientPort,
    private readonly ttsService: TTSPort,
    private readonly storage: StoragePort,
    private readonly sceneRepo: SceneRepositoryPort,
    private readonly promptBuilder: ScenePromptBuilder,
  ) {}

  async execute(input: GenerateSceneInput): Promise<SceneResult> {
    // 生成场景是一个多步流程，需要步骤级 Trace 和重试
    const scene = await this.retryStep('generate-scene', () => this.generateScene(input));
    const saved = await this.retryStep('save-scene', () => this.sceneRepo.create(scene));
    await this.retryStep('generate-audio', () => this.ttsService.generateLines(saved.lines, saved.id));
    return { sceneId: saved.id };
  }

  private async retryStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
    // 步骤级重试 + Trace 记录
  }
}
```

### 5.3 选择决策

```
每个 API Route → 一个 Application Use Case
  │
  └─ Use Case 内部逻辑是否需要步骤级 Trace / 恢复 / 局部重试 / 补偿？
       ├─ 是 → 在 Use Case 内部引入 Workflow
       └─ 否 → Use Case 直接编排
```

**当前实例的判断：**
| 场景 | 方案 |
|------|------|
| AI Assistant 问答 | Use Case（直接编排，1 步 AI 调用） |
| Scene Recommendation | Use Case（直接编排，1 步 AI 调用） |
| Reading Pipeline | Use Case + Workflow（多步编排，需要步骤级 Trace） |
| Listening Scene Generation | Use Case + Workflow（refill 逻辑含多步） |
| Theme Pack Generation | Use Case + Workflow（3 步 AI 调用） |
| Coach 两步对话 | Use Case + Workflow（冻结模块，延迟处理） |

### 5.4 Infrastructure Service

**定义：** 对外部依赖的封装，实现 Application 层定义的 Port 接口。

**特征：**
- 接口（Port）定义在 Application 层
- 实现（Adapter）在 Infrastructure 层
- 可替换（如 AI 模型从 DeepSeek 切换到 GPT，只需换 Adapter）

**示例：**
```typescript
// Application 层定义接口 (Port)
// src/application/ports/ai-client.ts
interface AIClientPort {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

// Infrastructure 层实现 (Adapter)
// src/infrastructure/ai/adapters/deepseek.ts
class DeepSeekClient implements AIClientPort {
  // 包含 fetch、重试、超时、Token 统计
}
```

---

## 6. 固定 Workflow 与动态 Agent 的边界

| 维度 | Workflow（Use Case 内部机制） | Agent |
|------|----------------------------|-------|
| **路径确定性** | 步骤硬编码 | 步骤由 LLM 动态决定 |
| **适用场景** | 需要步骤级 Trace/恢复/重试的确定性流程 | 学习路径规划、个性化推荐 |
| **状态管理** | 步骤级状态 | 可能需要多轮状态维护 |
| **可测试性** | 高（步骤明确） | 低（路径不确定） |
| **成本** | 可预测 | 不可预测 |
| **当前阶段** | Phase 4 开始引入 | Phase 7 预留 |

### 当前实例的判断

| 场景 | 方案 | 理由 |
|------|------|------|
| AI Assistant 问答 | Use Case | 单步，无状态 |
| Scene Recommendation | Use Case | 单步 AI 调用 |
| Reading Pipeline | Use Case + Workflow | 多步 AI/DB 操作，需步骤级 Trace |
| Listening Scene Generation | Use Case + Workflow | refill 含多步（AI+DB+TTS），需重试 |
| Theme Pack Generation | Use Case + Workflow | 3 步 AI 调用串联 |
| Coach 两步对话 | Use Case + Workflow | 两步 AI 调用，冻结延迟处理 |
| Personalized Learning Path | Agent (Phase 7) | 动态路径，AI 决定步骤 |

---

## 7. 统一 AI Client 设计

### 7.1 接口定义（Application 层 Port）

```typescript
// src/application/ports/ai-client.ts — Port 接口定义（仅设计，不实现）

interface AIClientPort {
  /** 纯文本聊天 */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** 流式聊天 */
  chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;

  /** 结构化输出（通过 response_format 或两步法） */
  chatStructured<T>(request: ChatRequest, schema: Schema<T>): Promise<T>;
}

// ChatRequest — 统一的请求格式
interface ChatRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  options?: ChatOptions;
}

// ChatOptions — 调用参数
interface ChatOptions {
  model?: string;          // 默认使用配置的模型
  temperature?: number;    // 默认 0.7
  maxTokens?: number;
  timeoutMs?: number;      // 默认 30_000
  retry?: RetryConfig;
  signal?: AbortSignal;
  userId?: string;         // 追踪用
  tags?: string[];         // 追踪标签
}

// ChatResponse — 统一的响应格式
interface ChatResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: TokenUsage;
  latencyMs: number;
  model: string;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}
```

> **说明：** AI Client 本身不定义缓存职责，因此 `chatFresh` 在此版本中已移除。缓存由上层（Use Case / Infrastructure Cache Port）在需要时自行控制。

### 7.2 AI Client 的职责边界

| 属于 AI Client (Port 实现) | 不属于 AI Client |
|--------------------------|-----------------|
| 调用模型 API | 构建 System/User Prompt（由 Application 层 Prompt 函数完成） |
| 超时控制 | 业务编排 |
| 指数退避重试（针对网络/限流错误） | 决定调用哪个 Use Case |
| JSON 安全提取 / 结构化输出 | 校验输出内容的业务合理性 |
| Token 统计和成本计算 | 翻译、生成例句等业务逻辑 |
| 错误映射（API 错误 → 统一格式） | 降级策略（返回空 vs 使用缓存 vs 切换 Provider） |
| Provider 路由 | 内容审核 |
| 流式处理 | 缓存（由 Use Case 或 Cache Port 控制） |
| **解析恢复**（格式错误的 JSON 重新调用修复） | — |

### 7.3 Provider Adapter 接口

```typescript
// infrastructure/ai/adapter.ts — Adapter 接口（仅设计，不实现）

interface AIProviderAdapter {
  readonly provider: string;
  readonly defaultModel: string;
  readonly capabilities: ProviderCapabilities;

  chat(request: InternalRequest): Promise<InternalResponse>;
  chatStream(request: InternalRequest): AsyncIterable<InternalChunk>;
}

interface ProviderCapabilities {
  supportsJsonMode: boolean;
  supportsStructuredOutput: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  streaming: boolean;
}
```

### 7.4 两层法适配（DeepSeek json_object 回退）+ 解析恢复

DeepSeek 的 `json_object` 模式在 ≥7 条消息后返回空，因此需要两层法。另外，模型可能返回格式不正确的 JSON，需要解析恢复机制。

```
AIClient.chatStructured()
  │
  ├─ 尝试 response_format: json_object
  │    ├─ 成功 → 返回结构化结果
  │    ├─ 空内容 → 回退两层法
  │    └─ 解析错误 → 解析恢复
  │
  ├─ 解析恢复（invalid_response 处理）:
  │    ├─ 1. 安全 JSON 提取（从 fence/markdown 中提取）
  │    ├─ 2. JSON 语法修复（补缺失引号、括号等）
  │    └─ 3. 重新调用修复（带提示要求修复格式）
  │
  └─ 两层法回退:
       ├─ Step 1: 纯文本回复（无 response_format）
       ├─ Step 2: 短上下文 + json_object（清理历史消息）
       └─ 或使用纯文本 + JSON 提取

  - 网络重试（timeout/5xx/429）：由 retry 层处理（指数退避 + jitter）
  - 解析恢复（格式错误）：由 structured-output 层处理
  - 这是两种不同的"重试"机制，分工明确
```

---

## 8. Provider Adapter（设计，不实现）

### 8.1 Adapter 注册

```typescript
// infrastructure/ai/provider-registry.ts — 设计

class AIProviderRegistry {
  private adapters = new Map<string, AIProviderAdapter>();

  register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: string): AIProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new UnknownProviderError(provider);
    return adapter;
  }

  getDefault(): AIProviderAdapter {
    return this.get(process.env.DEFAULT_AI_PROVIDER || 'deepseek');
  }
}
```

### 8.2 错误映射

```typescript
// infrastructure/ai/errors.ts — 设计

class AIError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public provider: string,
    public statusCode?: number,
    public retryable: boolean = false,
  ) { super(message); }
}

type AIErrorCode =
  | 'rate_limited'          // 限流 — 可网络重试
  | 'timeout'               // 超时 — 可网络重试
  | 'context_overflow'      // 上下文超长
  | 'invalid_response'      // 响应解析失败 — 用解析恢复机制处理
  | 'auth_error'            // API Key 无效
  | 'provider_error'        // 服务端错误 — 可网络重试
  | 'unknown';

// 错误处理分工:
// - rate_limited / timeout / provider_error → 网络重试（retry 层）
// - invalid_response → 解析恢复（structured-output 层）
// - auth_error / context_overflow → 不重试，向上传播
```

---

## 9. 关注点归属

| 关注点 | 归属层 | 实现方式 | 说明 |
|--------|-------|---------|------|
| **超时** | Infrastructure (AI Client) | AbortController | 每个 AI 调用有独立超时；Workflow/Use Case 有整体超时 |
| **网络重试** | Infrastructure (AI Client) | 指数退避 + jitter | 仅对可网络重试的错误（rate_limit、5xx、timeout） |
| **解析恢复** | Infrastructure (AI Client) | 格式修复 + 重新调用 | 针对模型返回的格式错误（invalid_response），不属网络重试 |
| **错误模型** | 分层 | 见下方 | 每层有各自的错误类型，统一在 API Route 格式化 |
| **Token 统计** | Infrastructure (AI Client) | 从 API response 读取 usage | 逐调用记录，汇总到 Trace |
| **延迟追踪** | Infrastructure + Application | performance.now() / OpenTelemetry | AI Client 记录调用耗时；Workflow/Use Case 记录步骤耗时 |
| **Trace** | Application + Infrastructure | 注入 Trace ID (Phase 5) | Trace ID 从 API Route 传入，贯穿所有层 |

### 分层错误模型

```
Layer 1 (API Route):     catch (e) → { error: e.code, message: e.message }
                            ↓ 统一为 NextResponse JSON
Layer 2 (Application):   ApplicationError { code, message, cause }
                           ↓ catch Infrastructure/ 转换为业务上下文
Layer 3 (Domain):        DomainError { code, message, details? }
                           ↓ 纯业务错误，不含 HTTP/NET 语义
Layer 4 (Infrastructure): AIError | PrismaError | StorageError
                           ↓ Provider-specific 错误，已统一映射
```

### HTTP 响应格式

```typescript
// 成功
{ "data": T }

// 错误
{ "error": { "code": string, "message": string, "details?: unknown" } }

// 分页
{ "data": T[], "pagination": { "total": number, "page": number, "pageSize": number } }
```

---

## 10. Prompt 组织方案

### 10.1 目录结构（Prompt 属于 Application Layer）

```
src/application/prompts/
  ├── vocabulary/
  │   ├── enrich-word.prompt.ts      # enrichWord
  │   ├── ai-train.prompt.ts         # 对话训练
  │   └── theme-generate.prompt.ts   # 主题词包
  ├── reading/
  │   ├── process-article.prompt.ts  # reading-push 的 AI 处理
  │   └── enrich-vocab.prompt.ts     # 阅读词汇富化
  ├── listening/
  │   ├── scene-a1.prompt.ts         # A1 对话类型
  │   ├── scene-a2.prompt.ts         # A2 服务场景
  │   ├── scene-a3.prompt.ts         # A3 亲密关系
  │   ├── scene-a4.prompt.ts         # A4 权力关系
  │   ├── scene-a5.prompt.ts         # A5 陌生人社交
  │   ├── scene-b.prompt.ts          # B 专业讨论
  │   ├── scene-c1.prompt.ts         # C1 知识叙述
  │   └── scene-c2.prompt.ts         # C2 知识访谈
  ├── coach/
  │   ├── dialogue.prompt.ts         # Coach 回复生成
  │   └── analysis.prompt.ts         # Coach 分析步骤
  ├── scene/
  │   ├── generate.prompt.ts         # 场景生成
  │   └── recommend.prompt.ts        # 场景推荐
  └── assistant/
      └── qa.prompt.ts              # AI 助手问答
```

### 10.2 Prompt 函数规范

每个 Prompt 文件导出一个**函数**，接受类型化的输入，返回 `ChatRequest` 格式：

```typescript
// 示例（仅设计，不实现）
// src/application/prompts/vocabulary/enrich-word.prompt.ts

export interface EnrichWordInput {
  word: string;
  contextSentence?: string;
}

export function buildEnrichWordPrompt(input: EnrichWordInput): { system: string; messages: Array<{ role: string; content: string }> } {
  const system = `You are an English vocabulary assistant. Given a word, provide:
- phonetic transcription (IPA)
- part of speech
- common collocations
- example sentences (use "|||" to separate pairs)
Return in JSON format.`;

  const messages = [
    { role: 'user', content: `Word: ${input.word}${input.contextSentence ? `\nContext: ${input.contextSentence}` : ''}` }
  ];

  return { system, messages };
}
```

### 10.3 Prompt 版本管理

- 每个 Prompt 文件头部包含版本号：
  ```typescript
  // @version 1.2
  // @last-reviewed 2026-07-29
  ```
- 修改记录在 DECISIONS.md 中
- 可选的 `promptVersion` 字段用于 Trace

### 10.4 调用方式

```typescript
// Application Use Case → 调用 Prompt 函数 + AI Client（仅设计，不实现）
import { buildEnrichWordPrompt } from '@/application/prompts/vocabulary/enrich-word.prompt';
// AiClientPort 接口，通过构造注入
class EnrichWordUseCase {
  constructor(private readonly aiClient: AIClientPort) {}

  async execute(word: string): Promise<EnrichedWord> {
    const prompt = buildEnrichWordPrompt({ word });
    return this.aiClient.chatStructured(prompt, EnrichedWordSchema);
  }
}
```

### 10.5 从当前内联 Prompt 的迁移路径

1. 将每个内联 Prompt 抽取到 `src/application/prompts/<domain>/` 下的独立文件
2. 保持内容完全一致（不修改 prompt 文本）
3. Application Use Case 从 prompt 文件导入
4. 后续再逐步优化 prompt 内容

---

## 11. Structured Output 统一处理边界

### 11.1 定义

Structured Output（结构化输出）指 AI 返回可解析的 JSON 数据的处理逻辑。当前在 5+ 处重复实现。

### 11.2 统一位置

所有结构化输出处理统一在 `AIClient.chatStructured()` 中：

```typescript
// infrastructure/ai/structured-output.ts — 统一处理（仅设计，不实现）

class StructuredOutputHandler {
  /**
   * 支持三种模式 + 解析恢复:
   * 1. response_format: json_object — API 原生 JSON
   * 2. 两步法（DeepSeek ≥7 消息回退）
   * 3. 纯文本 + JSON 安全提取（通用回退）
   * 4. 解析恢复（格式修复、重新调用）
   */
  async extract<T>(response: RawResponse, schema: Schema<T>): Promise<T> {
    if (response.jsonObject) {
      return this.parseJsonObject<T>(response.jsonObject, schema);
    }
    // 安全提取
    const text = this.extractJsonBlock(response.text);
    return this.parseAndValidate<T>(text, schema);
  }

  /** 解析恢复：尝试从损坏的响应中恢复 */
  private attemptRecovery<T>(raw: string, schema: Schema<T>): T | null {
    // 1. 安全 JSON 提取
    // 2. 语法修复
    // 3. 尝试 parse
    // 4. 如果仍然失败，重新调用（带修复指令）
  }
}
```

### 11.3 边界

| 属于 Structured Output | 不属于 |
|----------------------|--------|
| JSON 安全提取 | 内容校验（领域层做业务校验） |
| Schema 验证（类型检查） | 业务合理性校验 |
| 解析恢复（格式修复、重新调用） | 数据转换/映射 |
| 错误报告（格式错误详情） | 降级响应生成 |

---

## 12. 外部依赖的架构位置

| 依赖 | 架构位置 | Port 接口位置 | Adapter 实现位置 |
|------|---------|--------------|-----------------|
| **Prisma / Neon PostgreSQL** | `infrastructure/db/` | `application/ports/repository/` | `infrastructure/db/repository/` |
| **文件存储 (音频)** | `infrastructure/storage/` | `application/ports/storage.ts` | `infrastructure/storage/` |
| **TTS (Edge TTS / Kokoro)** | `infrastructure/tts/` | `application/ports/tts.ts` | `infrastructure/tts/` |
| **RSS (rss-parser + Readability)** | `infrastructure/rss/` | `application/ports/rss.ts` | `infrastructure/rss/` |
| **ECDICT 音标数据** | `infrastructure/db/` | `application/ports/phonetic-dict.ts` | `infrastructure/db/phonetic-dict.ts` |
| **静态 JSON 数据** | `src/data/` | — | 直接读取 |
| **外部 HTTP API** | `infrastructure/http/` | 预留 | 预留 |

### 关于音频文件存储

当前 `public/listening/` 目录在 build 时被扫描，在 Serverless 环境下不可写入。通过 `StoragePort` 接口抽象，本地实现写文件系统，云存储预留。

---

## 13. 四大功能模块迁移方式

### 13.1 Reading — 可作为首个迁移样板

| 属性 | 值 |
|------|-----|
| 冻结状态 | ✅ 不受冻结约束 |
| 迁移策略 | 作为 Phase 4 的 Pipeline 样板 |
| 关键步骤 | 1. 抽取 Prompt → `application/prompts/reading/`<br>2. 创建 Use Case / Workflow<br>3. 薄化 API Route |

### 13.2 Listening — Pipeline 解耦优先

| 属性 | 值 |
|------|-----|
| 冻结状态 | ⚠️ schema 冻结，代码可重构 |
| 拆分方向 | `features/listening/lib/listening.ts` → Application Use Case + Domain Scene Rules + Infrastructure TTS/Storage |

### 13.3 Words — 内部 API 重构

| 属性 | 值 |
|------|-----|
| 冻结状态 | ⚠️ UI 冻结，内部 API 可迁移（需授权） |
| 注意事项 | SM-2 算法测试在 Phase 2 对当前 `src/lib/sm2.ts` 建基线，不移动；移动到 Domain 在 Phase 4+ 进行 |

### 13.4 Coach — 最晚迁移

| 属性 | 值 |
|------|-----|
| 冻结状态 | 🔒 严格冻结 |
| 迁移策略 | 在所有非冻结模块完成后获得授权再处理 |

---

## 14. 预留架构空间

### 14.1 User 模型（Phase 6）

- **Domain 层**：`domain/user/` — User 实体、Profile、Settings 类型
- **Infrastructure 层**：`infrastructure/db/user-repository.ts` — 用户数据存取
- **Application 层**：`application/services/user-service.ts` — 用户管理编排

### 14.2 State 管理

- **短期**：保持 React 页面级状态 + 模块级缓存
- **长期 (Phase 6)**：引入 Application State Store

### 14.3 Memory 系统（Phase 6）

- `domain/memory/` — 记忆模型
- `infrastructure/memory/` — 记忆存储

### 14.4 RAG（Phase 7）

- `infrastructure/rag/` — 知识检索基础设施
- 当前不引入

### 14.5 Evaluation（Phase 2）

- 评估指标设计在 Phase 2 完成
- 针对当前代码位置建立 characterization baseline
- 不提前创建 Domain 实现

### 14.6 Agent（Phase 7）

- `application/agents/` — Agent 实现
- 当前不引入任何 Agent 框架

---

## 15. 目标目录结构

```
english-web/
├── prisma/                          # 保持 — schema.prisma 冻结
│   ├── schema.prisma                # 冻结，不可修改
│   ├── seed.ts
│   └── migrations/
│
├── src/
│   ├── app/                          # Next.js App Router (Layer 1)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── words/                    # 页面 (保持当前结构)
│   │   ├── reading/
│   │   ├── listening/
│   │   ├── coach/
│   │   └── api/                      # 薄 API Route (Layer 1)
│   │       └── */route.ts           # 只做验证 + 调用 Use Case
│   │
│   ├── application/                 # Layer 2: Application Layer 【新增】
│   │   ├── use-cases/               # Application Use Case / Service
│   │   │   ├── vocabulary/
│   │   │   ├── reading/
│   │   │   ├── listening/
│   │   │   └── coach/
│   │   ├── workflows/               # Workflow（复杂用例内部步骤编排）
│   │   ├── ports/                   # Output Port 接口定义
│   │   │   ├── ai-client.ts
│   │   │   ├── repository/
│   │   │   ├── storage.ts
│   │   │   ├── tts.ts
│   │   │   ├── rss.ts
│   │   │   └── cache.ts
│   │   ├── prompts/                 # Prompt 构建函数（按用例组织）
│   │   │   ├── vocabulary/
│   │   │   ├── reading/
│   │   │   ├── listening/
│   │   │   ├── coach/
│   │   │   ├── scene/
│   │   │   └── assistant/
│   │   ├── agents/                  # Agent 定义 (Phase 7, 预留)
│   │   └── dto/                     # 数据传输对象
│   │
│   ├── domain/                      # Layer 3: Domain Layer 【新增】
│   │   ├── vocabulary/
│   │   │   ├── types.ts            # 领域类型
│   │   │   ├── sm2.ts              # SM-2 算法 (纯函数)
│   │   │   ├── queue-rules.ts      # 学习队列规则
│   │   │   └── validation.ts       # AI 输出业务校验
│   │   ├── reading/
│   │   │   ├── types.ts
│   │   │   ├── phonetic-rules.ts   # 音标查询和回退
│   │   │   └── vocab-extract-rules.ts
│   │   ├── listening/
│   │   │   ├── types.ts
│   │   │   ├── scene-rules.ts      # 场景生成规则 (不含 AI 调用)
│   │   │   └── category-rules.ts
│   │   ├── coach/                   # 冻结
│   │   │   └── types/
│   │   ├── user/                    # Phase 6 预留
│   │   ├── memory/                  # Phase 6 预留
│   │   ├── evaluation/             # Phase 2 预留
│   │   └── shared/
│   │       ├── types.ts
│   │       └── errors.ts
│   │
│   ├── infrastructure/             # Layer 4: Infrastructure Layer 【新增】
│   │   ├── ai/                      # AI Client
│   │   │   ├── default-client.ts   # AIClientPort 默认实现
│   │   │   ├── adapters/           # Provider Adapter
│   │   │   ├── structured-output.ts# 结构化输出统一处理
│   │   │   ├── retry.ts            # 网络重试
│   │   │   └── errors.ts           # AI 错误映射
│   │   ├── db/                      # 数据库访问
│   │   │   ├── prisma.ts           # Prisma Client
│   │   │   └── repository/         # Repository Port 实现
│   │   ├── storage/                 # 文件存储
│   │   ├── tts/                     # TTS 服务
│   │   ├── rss/                     # RSS 服务
│   │   ├── cache/                   # 缓存实现
│   │   ├── telemetry/              # Phase 5
│   │   └── http/                    # HTTP 客户端抽象
│   │
│   ├── bootstrap/                  # Composition Root 【新增】
│   │   ├── index.ts                # 装配所有层
│   │   └── providers.ts            # Provider 注册
│   │
│   ├── components/                 # 保持 — 共享 UI 组件
│   │
│   ├── data/                       # 保持 — 静态 JSON 数据
│   │
│   ├── lib/                        # 【逐步迁移，最后移除】
│   │   ├── prisma.ts               # → infrastructure/db/
│   │   ├── sm2.ts                   # → domain/vocabulary/ (Phase 4+)
│   │   ├── types.ts                 # → 拆分到各层
│   │   ├── utils.ts                 # → 拆分
│   │   └── word-cache.ts            # → infrastructure/cache/
│   │
│   └── generated/prisma/
│
├── scripts/
├── public/
│   └── listening/                   # 【待迁移】
│
└── docs/refactor/
```

### 目录迁移阶段

| 阶段 | 新建目录 | 保持目录 | 待迁移/移除 |
|------|---------|---------|------------|
| Phase 3 | `infrastructure/ai/`, `application/ports/`, `application/use-cases/` | `app/`, `components/`, `data/` | — |
| Phase 4 | `application/workflows/`, `application/prompts/`, `domain/{reading,listening}/`, `infrastructure/tts/`, `infrastructure/storage/` | 同上 | `features/listening/` |
| Phase 5 | `infrastructure/telemetry/` | 同上 | — |
| Phase 6 | `domain/user/`, `domain/memory/`, `infrastructure/db/repository/` | 同上 | `lib/` |
| Phase 7 | `application/agents/`, `infrastructure/rag/` | 同上 | — |
| Phase 8 | — | 同上 | — |
| Phase 9 | `docs/deployment/` | 同上 | — |

---

## 16. 后续 Phase 推荐迁移顺序

| Phase | 名称 | 焦点 |
|-------|------|------|
| **2** | 建立评估基线 | 针对当前代码位置建立 characterization baseline |
| **3** | 统一 AI Client | AI Client + Provider Adapter + 首个纵向迁移 Use Case |
| **4** | 重构一条 Pipeline 样板 | Reading Pipeline 完整迁移 |
| **5** | Trace 与可观测性 | Trace ID 贯穿、Logger、调用链 |
| **6** | 用户状态与记忆系统 | User 模型、会话记忆、偏好 |
| **7** | 学习路径 Agent | Agent 运行时、学习路径规划 |
| **8** | 测试与可靠性加固 | 补齐测试、安全、边界处理 |
| **9** | 部署与作品集包装 | 部署、安全、演示数据、README、架构图、面试材料 |

---

## 17. 关键权衡、风险、替代方案和未决定问题

### 17.1 关键权衡

| 权衡 | 选择 | 理由 | 代价 |
|------|------|------|------|
| Port/Adapter 模式 | 采用 | 解决"接口定义在 Domain vs Infrastructure"矛盾 | 增加接口定义文件 |
| Application Use Case 作为入口 | 采用 | 统一 API Route 的调用目标 | 每个端点多一个文件 |
| Workflow 可选 | 采用 | 不强制使用，仅在需要时引入 | 需要 Design Review 判断 |
| Prompt 入 Application 层 | 采用 | Prompt 是"如何使用 AI"的编排逻辑，不是基础设施 | 与纯 Domain 分离 |
| Repository 模式 | 可选 | Prisma 直接使用足够，过度工程无益 | 可后期按需引入 |

### 17.2 风险

| # | 风险 | 严重度 | 缓解措施 |
|---|------|--------|---------|
| R1 | Port/Adapter 增加文件数量 | 低 | 每个 Output Port 一个接口文件 |
| R2 | Composition Root 成为瓶颈 | 中 | 按模块分开装配，不全部集中在一个文件 |
| R3 | 冻结模块限制迁移 | 中 | 先验证非冻结模块 |
| R4 | 架构过于理想化 | 低 | Phase 4 样板验证后可调整 |

### 17.3 替代方案

| 方案 | 已考虑 | 未选择理由 |
|------|-------|-----------|
| Clean Architecture (完全解耦) | ✅ | 当前项目规模不需要 |
| 单 Service 层 | ✅ | 重蹈当前覆辙 |
| DI 容器 | ✅ | 手动注入足够 |
| 状态管理库 | ✅ | 当前不需要 |

### 17.4 尚未决定的问题

| # | 问题 | 需要决策的 Phase | 背景 |
|---|------|-----------------|------|
| TBD-1 | Repository 模式是否必须 | Phase 4 | Pipeline 样板中试用后决定 |
| TBD-2 | AI Client 降级策略 | Phase 3 | 统一接口但允许 Workflow 指定 |
| TBD-3 | Token 统计持久化位置 | Phase 5 | 根据 Trace 方案决定 |
| TBD-4 | Prompt 版本管理自动化程度 | Phase 3 | 先用人工方式 |
| TBD-5 | 音频存储长期方案 | Phase 4 | 本地 vs CDN vs S3 |
| TBD-6 | 用户模型 ID 策略 | Phase 6 | UUID vs cuid |
| TBD-7 | Agent 运行时框架 | Phase 7 | LangChain vs 自研 |
| TBD-8 | ECDICT 音标数据迁移到 DB | Phase 4 | 当前 JSON 读取性能可接受 |

---

## 附录：设计变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-07-29 | 初始定稿 | Phase 1 初次产出 |
| 2026-07-29 | **修正版** — 依赖模型改为 Port/Adapter + Composition Root；Domain 去除 AI Client/Prompt；Prompt 归 Application；Application Use Case 作为入口；Workflow 改为可选；纯 CRUD 限缩；移除 chatFresh；区分解析恢复与网络重试；Phase 9 恢复 | 审核 Changes Requested |
