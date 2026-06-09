# Ethan's English Learning Assistant — 项目总览与作战手册

> 最后更新: 2026-06-08  
> 当前冻结阶段: 词汇 SRS 模块完工 ✅ | AI Coach 模块完工 ✅ | 场景系统完工 ✅ | AI Assistant 全局组件 ✅ | 词汇 UI 动画 ✅  
> 进行中: Reading 外刊模块 🚧（已读标记+推荐机制 ✅）| 部署方案 🚧  
> 下一阶段方向: RSS 自动推送 → 内容积累 → 部署上线

---

## 一、项目愿景与用户背景

### 用户身份
华南理工大学 大二 机械工程学生，已过四六级，对英语有浓厚兴趣。

### 核心目标
"擅长英语"而不仅仅是"会说英语"——让英语成为出国深造或求职的核心竞争力加分项。具体包括：

| 能力维度 | 目标 |
|---------|------|
| **日常口语** | 流利的日常对话，覆盖各种生活场景 |
| **生活词汇** | 能说出生活中肉眼所见事物的英语名称 |
| **专业英语** | 涵盖机械工程、汽车、计算机、AI、外贸等行业术语 |
| **IELTS** | 为将来考雅思做准备，保持备考状态 |

### 平台板块
1. **词汇** — IELTS 词汇 SRS 记忆 + 场景词包（已上线）
2. **AI Coach** — AI 口语对练舱 + 动态场景系统（已上线）
3. **YouTube 视频** — 计划中
4. **外刊** — 计划中

---

## 二、技术栈与配置

Next.js 16.2.6 全栈英语学习 PWA，核心是 AI 沉浸式口语对练舱 + SM-2 单词复习。

### 技术栈
- **框架**: Next.js 16.2.6 (App Router, Turbopack)
- **样式**: Tailwind CSS v4（⚠️ 有坑: `shadow-[rgba(...)]` 等含括号任意值失效，用 inline `style`）
- **AI**: DeepSeek API（OpenAI 兼容），`deepseek-chat` 模型
- **数据库**: Prisma + SQLite（仅 words 模块使用，口语舱无状态）
- **构建检查**: `npx tsc --noEmit`（`npx next build` 会被 auto mode 拦截）

### 环境变量
```
DEEPSEEK_API_KEY=sk-05f45b3b5e054f489d1092fea7d527f5
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

---

## 三、项目文件结构

```
src/app/
├── api/
│   ├── assistant/route.ts           # AI Assistant 问答 API（查词+DeepSeek）
│   ├── coach/route.ts               # 口语对练核心 API — 两步 DeepSeek
│   ├── scene/
│   │   ├── generate/route.ts        # 动态场景生成（AI 搜索框）
│   │   └── recommend/route.ts       # 智能场景推荐（防茧房）
│   └── words/
│       ├── route.ts                 # GET 每日 20 词 / POST 评分 — 不要动
│       ├── queues/route.ts          # GET 双队列看板计数（新词/复习队列）
│       └── ai-train/route.ts        # POST DeepSeek 生成对话场景+口语妙招
├── components/
│   └── AIAssistant.tsx              # ~380 行 — 全局悬浮 AI 问答面板
├── coach/
│   ├── page.tsx                     # ~1120 行 — 口语舱全部 UI + 状态
│   └── types.d.ts                   # Web Speech API 类型声明
├── words/
│   ├── page.tsx                     # ~320 行 — IELTS 单词学习卡片页全 UI+交互
│   └── themes/
│       ├── page.tsx                 # 词包选择列表页
│       └── [theme]/
│           └── page.tsx             # 场景词包卡片页（带配图）
├── layout.tsx                       # 根布局（含 <AIAssistant />）
├── globals.css
└── .env
```

### 各文件职责速查

| 文件 | 行数 | 核心逻辑 |
|------|------|---------|
| `coach/page.tsx` | ~1120 | 21+ useState、语音识别/TTS、场景生成/推荐联动、7:3 布局、审计面板、渐变主题图、hover 动画、emoji 选择器、奶龙头像 |
| `api/coach/route.ts` | ~278 | Step1 纯文本回复 → Step2 json_object 翻译+审计+isFinished |
| `api/assistant/route.ts` | ~125 | 查词（Prisma Word 表）+ DeepSeek 问答，role 映射 `ai`→`assistant` |
| `api/scene/generate/route.ts` | 112 | prompt → DeepSeek → ScenarioSeed 完整 JSON |
| `api/scene/recommend/route.ts` | 97 | practicedTags → 3 条智能推荐（复训/防茧房/弱点定向） |
| `api/words/route.ts` | 113 | GET 每日 20 词（复习+新词混合）、POST 提交 SM-2 评分 — **不要动** |
| `api/words/queues/route.ts` | ~40 | GET 双队列看板计数（new/review 条数） |
| `api/words/ai-train/route.ts` | ~80 | POST DeepSeek 生成对话场景 + 中文口语妙招 |
| `words/page.tsx` | ~320 | 翻牌卡片页：正面单词+音标 → 点击翻转 → 背面释义/搭配/例句 |
| `components/AIAssistant.tsx` | ~380 | 全局悬浮球+可拖拽面板，wordData 卡片展示，气泡对话，localStorage 位置持久化 |
| `prisma/seed.ts` | ~1700 | 数据灌装：ECDICT 权威词典 + DeepSeek 批量生成 + 硬编码 550 词，三源合并 |

---

## 四、已完成功能

### Stage 1 — 核心词汇 SRS ✅

**数据规模**: 2000 雅思词汇（550 手写核心词 + 1450 DeepSeek 生成，SQLite 数据库）

**SM-2 遗忘曲线算法**
- 4 档评分: Forgot (1) / Good (3) / Easy (4) / Mastered (5)
- 核心字段: `interval` / `easiness` / `repetitions` / `nextReviewAt`
- 每日出词: GET `/api/words` 返回 20 词（先取到期复习词，不足则补新词）
- 评分提交: POST `/api/words` 提交 `{ wordId, rating }` 或 `{ wordId, mastered: true }`

**翻牌卡片 UI**（`words/page.tsx`）
- 底色: `#F8F6F4`（暖白），全屏 `min-h-screen flex flex-col`
- 顶部栏: Back 按钮 ← | Daily Study 居中标题（带下划线装饰）| New N 计数 + 页码 `index/total`
- 进度条: 百分比进度条 + 百分比文字，`#262626` 深色填充
- **正面**（未翻转）:
  - 词性胶囊（如 `v.`，灰底灰字圆角）
  - 单词大字 `font-extrabold tracking-tight`，`clamp(3.5rem, 15vw, 7rem)`
  - 音标灰色文字
  - 3 个前置按钮: `Forgot`（浅红底粉字, `#FCEAEB/#FC6F7B`）、`Good`（浅蓝底蓝字, `#E1EDFA/#64B0FA`）、`Easy`（深灰底白字, `#4F677E`）、`Mastered`（最深灰底白字, `#2B384A`） — 点击翻牌
- **背面**（点击后翻转，白色卡片 `#FFFFFF` 圆角 3xl，柔和阴影）:
  - 单词 + 音标（顶栏）
  - **DEFINITION** 区块: 多义分行显示，`partOfSpeech` 粗体灰色 + 中文释义
  - **COLLOCATIONS** 区块: 灰底圆角芯片，每项 `English 中文` 格式
  - **EXAMPLE** 区块: 双语对照，每个例句单独段落，目标单词 `font-extrabold underline` 高亮
  - 例句内单词用 `highlightWord()` 函数正则匹配加粗
  - 例句使用 ` ||| ` 分隔符支持多条
  - 3 个后置按钮: `Misremembered`（浅红底红字）、`Mastered`（灰蓝底白字）、`Next ➡`（深黑底白字带箭头图标）
  - `submitting` 锁定防重复提交
- **完成状态**: "🎉 Study Complete!" + 今日学习数量摘要
- **空状态**: "No words available right now."
- **加载态**: 居中旋转加载动画

**数据API**（`api/words/route.ts`）
- GET: 返回 `{ words: WordData[], total, reviewCount, newCount }`
- POST: 接收 `{ wordId, rating? | mastered? }`，更新 SM-2 字段
- **双队列看板**（`api/words/queues/route.ts`）: GET 返回 `{ newCount, reviewCount }` — 用于首页入口计数
- **AI 对话训练**（`api/words/ai-train/route.ts`）: POST 接收 `{ word }` → DeepSeek 生成对话场景 + 中文口语妙招

**数据模型**（Prisma Schema）
- `Word`: id, word, phonetic?, partOfSpeech, definition, collocations?, example?, exampleZh?, difficulty (default "IELTS"), source (default "built-in")
- `WordReview`: id, wordId, interval, easiness, repetitions, nextReviewAt, createdAt — SM-2 核心状态

**种子脚本**（`prisma/seed.ts`）
- 硬编码 550 条手写词汇（`getBuiltInWords()`）— 含 word, phonetic, partOfSpeech, definition, example
- `EXTRA_WORDS` 常量约 800 个额外雅思词汇（纯单词列表）
- DeepSeek 批量生成（20 词/批，`temperature: 0.3`）：为非手写词生成搭配/3个不同用法双语例句
- ECDICT 提供音标和中文释义（`stardict.translation`），手写词音标释义完全保留
- 缓存到 `prisma/generated_data.json`，重复 seed 秒完成
- 三源合并（手写 > ECDICT > DeepSeek），`buildExamples()` 只保留成对 en+zh 例句
- 写入数据库 100 条/批，自动清旧重灌
- `MAX_WORDS = 2000` 上限

### Stage 2 — AI 口语对练舱 ✅

**核心架构**
- [x] 两步 API 架构: Step1 无 `response_format` 纯文本自然回复 → Step2 短上下文 `json_object` 提取结构化数据
- [x] 纯净台词: System Prompt 禁止 `*动作描写*`，只输出可朗读对话
- [x] Conversation Facilitator: 每 1-2 轮 AI 必须提问交还话筒
- [x] Dynamic Pacing: 回复长短随情绪动态变化，拒绝公式化

**视觉**
- [x] 7:3 黄金比例: 左侧聊天 `flex-[6.5]`、右侧面板 `flex-[3.5]`
- [x] 气泡撞色: 用户 `bg-slate-900 text-white` 靠右 `rounded-2xl rounded-tr-sm` / AI `bg-[#F5F3F0]` 靠左 `rounded-2xl rounded-tl-sm` 带 `border-left: 3px accent`
- [x] 暖色系: `#f6f4ef` 底色，柔和阴影，圆角呼吸感排版
- [x] **奶龙头像**: AI 头像 `/nailong/nailong.webp`（`w-9 h-9`），用户头像 `/nailong/OIP-C.webp`（`w-11 h-11`），`rounded-full object-cover`
- [x] **渐变主题图**（英雄区右栏）: 关键词匹配 10 套浅色渐变方案，大号透明 emoji 居中（🔧🤖🚗🍸🍽️🏥✈️💼🛍️📚✨）+ 模糊光晕 + 点阵纹理，hover 微放大，零加载延迟
- [x] **顶部导航**: `grid grid-cols-[1fr_auto_1fr]` 实现 AI Coach 标题居中；Back 胶囊按钮（`rounded-full`）；Similar Session → 深色大按钮；Speaking 脉冲绿点指示器
- [x] **Emoji 支持**: AI 回复 system prompt 要求按情绪使用 emoji；输入框自带 emoji picker（~80 个 emoji，绝对定位弹出）
- [x] **Staggered entrance 动画**: 英雄区 `.coach-search` → `.coach-badge` → `.coach-title` → `.coach-desc` → `.coach-cta` → `.coach-image` 步进 0.05-0.1s 延迟；session `.coach-banner` + `.coach-panel-item` 逐级出现
- [x] **Hover 动画体系**: 全部交互元素遵守 `hover:scale-105 + hover:shadow` 抬升模式；Surprise Me 🎲 悬停旋转 360° + 字距拉宽；输入框悬停增强边框+阴影

**右侧审计面板**
- [x] Mission Goals: 3 个任务目标 + 完成勾选
- [x] CORRECTIONS & SUGGESTIONS: original→optimized、auditDetails（拼写/语法红标+中文原因）、nativeUpgrade（地道升舱+中文解析）
- [x] Hints 双区: `pillars` 完整长句 + `vocabulary` 地道短语，点击填入输入框

**语音交互**
- [x] 纯手动挡: `recognition.continuous = true`，用户按 Enter 或再点 mic 才停+发
- [x] 双发铁律锁: `isSendingRef` + `shouldSendOnEndRef` 防重复气泡
- [x] 闭包安全: `inputTextRef` + `sendMessageRef` 保证 `onend` 回调拿最新值

**会话结束**
- [x] isFinished AI 判断 + 8 轮硬上限兜底，但**结束权交给用户**（显示 suggestion bar，不强制终止）
- [x] View Results 悬浮按钮（右下角）+ 杀青弹窗（任务摘要+纠错总结）

### Stage 3 — 动态场景系统 ✅

**Phase 1: 场景生成**
- [x] `/api/scene/generate`: 接收 prompt → DeepSeek → ScenarioSeed JSON
- [x] AI 搜索框（英雄区顶部）+ Generate 按钮
- [x] Surprise Me 随机生成按钮（🎲 hover 旋转动画）
- [x] 生成错误 toast（可关闭）
- [x] 图片系统: 5 个内置场景用 Unsplash 写死图片（已废除）→ 改为**渐变主题图系统**（10 套浅色 CSS 渐变 + 关键词匹配 + emoji 中心 + 点阵纹理），AI 生成场景同样由关键词匹配主题色

**Phase 2: 智能推荐**
- [x] `/api/scene/recommend`: 接收 `practicedTags` → 3 条推荐
- [x] 高频复训循环: 基础生存场景自动变形召回
- [x] 防茧房去噪: 刚练标签降权，推未触及维度
- [x] Recommended For You: 3 个精美胶囊卡片阵列
- [x] localStorage 历史追踪: `coach_practiced_tags`，session 完成自动记录+刷新推荐
- [x] 移除冗余 Shuffle 按钮（只在 5 个写死场景轮转，无意义）

---

## 五、核心接口规范

### POST `/api/coach`
```json
// Request
{ "messages": Message[], "scenario": ScenarioSeed }
// Response
{ "aiReply": "", "translationZh": "", "nextHints": {"pillars":[],"vocabulary":[]},
  "corrections": CorrectionsData, "isFinished": boolean }
```

### POST `/api/scene/generate`
```json
// Request
{ "prompt": "subway refund in Shanghai" }
// Response → 完整 ScenarioSeed JSON
```

### POST `/api/scene/recommend`
```json
// Request
{ "practicedTags": ["Dining","Travel"], "count": 3 }
// Response
{ "recommendations": [{ "badge":"","badgeZh":"","title":"","prompt":"" }] }
```

### ScenarioSeed 结构
```typescript
interface ScenarioSeed {
  id: string; badge: string; badgeZh: string;
  title: string; titleZh: string;
  description: string; descriptionZh: string;
  imageSeed: string;
  userRole: string; aiRole: string; setting: string;
  aiFirstLine: string; aiFirstLineZh: string;
  aiFirstLineExpr: { phrase: string; explanation: string }[];
  goals: { text: string; textZh: string }[];
}
```

### CorrectionsData 结构
```typescript
interface CorrectionsData {
  hasError: boolean;
  original: string;           // 用户原话
  optimized: string;          // 修正后的完整句子
  auditDetails: AuditItem[];  // 逐条错误（type/wrong/correct/why）
  nativeUpgrade: { expression: string; why: string } | null;
}
```

---

## 六、已知技术坑（血的教训）

### 5.1 DeepSeek `response_format` 大坑
**症状**: 消息 ≥ 7 条时 `json_object` 返回空内容。  
**修复**: 两步法 — Step1 不用 `response_format`（取最近 6 条），Step2 短上下文（~4 条）+ `json_object`。  
**永远不要在长上下文中依赖 `json_object`**。

### 5.2 Tailwind CSS v4 括号坑
`shadow-[rgba(0,0,0,0.06)]` 等含括号的任意值编译报错。  
→ 改用内联 `style={{ boxShadow: '...' }}`。

### 5.3 AGENTS.md 强制要求
Next.js 16.2.6 有 breaking changes。写代码前 **必须先读** `node_modules/next/dist/docs/` 对应指南。

### 5.4 构建验证流程
- `npx tsc --noEmit` — 快速 TS 检查（推荐，不会被拦截）
- `npx next build` — 完整构建（auto mode 可能拦截，需用户授权）
- 测试新路由 → 必须用 `npx next dev`（production build 不会自动编译新增文件）

### 5.5 Edit 工具字符串匹配
缩进空格/tab 不一致会导致替换失败。  
→ 用 `sed -n 'N,Mp' file | cat -A` 确认确切 whitespace。

---

## 七、自我反思（我的错误记录）

1. **TypeScript 属性不存在硬伤**: 在 `setMessages` 中直接 `{ ...m, showTranslation: !m.translation }`，但 `showTranslation` 不在 `Message` 接口上。tsc 没跑就不知道。
   - *教训: 改完对象扩展立刻 `tsc --noEmit` 检查。*

2. **过度简化删了用户要的功能**: 初版重写删了 `goals`、`aiFirstLineExpr`、`missionProgress`，用户要求恢复。
   - *教训: "简化"≠"删除功能"。保留字段只简化数据流。*

3. **DeepSeek 长上下文 JSON 模式走了很多弯路**: 不知道 7 条消息的阈值，浪费大量时间调试重试。
   - *教训: LLM 行为异常先查已知问题，别盲目重试。*

4. **测试新 API 路由用了 production build**: `npx next start` 不会编译新文件 → 404。
   - *教训: 新增路由用 `npx next dev` 测试。*

5. **Edit 缩进匹配失败多次**: 空格和 tab 混用导致 Edit 找不到 old_string。
   - *教训: 先 `cat -A` 确认实际 whitespace。*

6. **Unsplash 图片匹配场景翻车**: 下载了布加迪、酒吧配急诊室等图片 → 主题不匹配。
   - *教训: 不要依赖真实照片库匹配动态生成的内容。改用 CSS 渐变 + emoji，零加载延迟、零配图翻车。*

7. **hover 动画被忽略**: 只加了 Coach 页 entrance 动画但没做 hover 效果，用户指出后才补。
   - *教训: entrance 动画是"出场"，hover 动画是"手感"，两个都要做。*

8. **词汇页动画遗漏**: Coach 页 hover 动画完善后，词汇页的按钮和书图标入口动画没有同步做，需另外提醒。
   - *教训: 同一套 hover 规范应全局检查一致性，避免遗漏页面。*

---

## 八、已完成阶段性工作（后续方向）

### ✅ 已完成 — ECDICT 权威词典接入 (2026-06-04)
从 GitHub `skywind3000/ECDICT` 下载 `ecdict-sqlite-28.zip`（207MB），解压得到 `stardict.db`（340 万词条）。用 ECDICT 的 `tag` 字段含 `ielts` 标签筛选词汇。

**数据流水线**:
- 手写 550 词: 音标/释义完全保留，ECDICT 仅作空缺补充
- ECDICT 词: 提供权威音标和中文释义（来源 `stardict.translation`）
- DeepSeek: 只负责生成搭配 + 3 个不同用法的双语例句
- 优先级: 手写 > ECDICT > DeepSeek

**实现细节**:
- 下载: `curl` + `adm-zip` 解压（Node.js fetch 对 200MB+ 文件不可靠）
- ECDICT 音标格式: 非标准 IPA（如 `æb'nɒ:mәl`），手写词不受影响
- 例句: `buildExamples()` 只保留成对 (en+zh) 的句子
- Highlight: `\\b(word\\w*)\\b` 匹配词形变体（`abandon`→`abandoned`）
- 涉及文件: `prisma/seed.ts`（修改 `ensureEcdictDb`、`mergeEntry()`、DeepSeek prompt）
- 数据源: `https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip`

### 短期收尾
- 更多场景主题关键词覆盖，减少 fallback 到中性灰的概率
- 学习数据看板: 练习时长、纠错统计、进步趋势
- 已练场景历史: 回顾之前练过的场景和对话记录

### Stage 4 — 全局 AI Assistant 悬浮问答 ✅

**组件**: `src/components/AIAssistant.tsx` | `src/app/api/assistant/route.ts`
**上线**: 2026-06-05

**功能**
- [x] 全局悬浮球（右下角 `bottom-24px right-24px`），深色 `#262626` 圆形 + 💡 图标 + hover "Ask me anything" 标签
- [x] 点击打开浮层面板（420×580px，`rounded-20px`，半透明遮罩），可拖拽移动（localStorage 持久化位置 `{right, bottom}`）
- [x] 查词功能: 输入 → API 在 `Word` 表精确查询 → 如有匹配展示音标/释义/搭配（wordData 卡片）
- [x] 通用英语问答: 查词/翻译/语法 → 调 DeepSeek（role 映射 `ai` → `assistant`）
- [x] 气泡对话: 用户 `#2F2F2F` 深色气泡右对齐、AI `#F3F1EF` 浅色气泡左对齐带 "A" 头像
- [x] input 自动聚焦+发送后保持焦点

### Stage 5 候选 — 场景词包（已完成 — 2026-06-04）

**系统设计**: Got It / Not Yet 二元记忆（非 SRS）。Got It = 掌握不再出现，Not Yet = 始终出现。每轮随机抽 15 个 Not Yet 词。

**存储**: localStorage key `wordpack_${theme}`，无服务端存储。

**UI 流程**: 前脸（单词+音标+图片）→ "Show Answer" 翻转 → 背面（定义+搭配+例句）→ Got It / Not Yet 按钮 → 下一词  
**按钮动画**: Show Answer → `hover:scale-105 hover:shadow-md`，Not Yet → `hover:scale-105 hover:shadow-md`，Got It → `hover:scale-105 hover:shadow-lg`（均 `duration-300`）

**词汇入口页**: `/words` 两张卡片 — Daily Study（IELTS SRS → `/words/study`）和 Word Packs（场景词包 → `/words/themes`）

**页面结构**:
- `/words/themes` — 词包选择列表（16 个主题，emoji + 名称 + 词数 + Word List 入口）
- `/words/themes/[theme]` — 卡片学习页（Got It / Not Yet）
- `/words/themes/[theme]/list` — 双栏单词表（Learning / Mastered，✔/✗ 切换按钮）

**已上线 20 个主题**:

| 主题 | 词数 | Emoji |
|------|------|-------|
| Kitchen | 97 | 🍳 |
| Car | 48 | 🚗 |
| Clothing | 49 | 👕 |
| Restaurant | 36 | 🍽️ |
| Hotel | 36 | 🏨 |
| Body & Health | 50 | 💪 |
| Office | 41 | 💼 |
| Technology | 43 | 💻 |
| School | 44 | 📚 |
| Sports & Fitness | 35 | ⚽ |
| Shopping | 37 | 🛍️ |
| Transportation | 34 | 🚌 |
| Entertainment | 30 | 🎬 |
| Weather | 32 | 🌤️ |
| Home | 34 | 🏠 |
| People & Family | 35 | 👨‍👩‍👧‍👧 |
| Mechanical Engineering | 45 | ⚙️ |
| Computer & AI | 42 | 🤖 |
| Automotive | 40 | 🏎️ |
| Foreign Trade | 41 | 🌐 |

**扩展方式**: 在 seed.ts 的 `getThemeWords()` 加词表 → `THEMES` 数组加名 → 前端 `THEME_LABELS/THEME_ICONS` 加配置 → 跑 seed。

**专业领域词包（已上线 — 2026-06-05）**:
- **Mechanical Engineering** (机械工程) — 力学/材料/制造/机械元件/设计分析
- **Computer & AI** (计算机/AI) — 编程/机器学习/深度学习/数据基础设施
- **Automotive** (汽车) — 发动机/电控/悬架制动/车身/新能源/维修保养
- **Foreign Trade** (外贸) — 贸易基础/Incoterms/支付/单证/谈判/物流供应链

### Stage 6 — Reading 外刊阅读模块 🚧 (2026-06-07)

**上线范围**: 文章列表（YouTube 式网格卡片） + 文章详情（正文 + 侧栏词汇面板）

**核心架构**: AI（Claude）选文 → 人工录入/脚本推送 → `/api/reading/push` 存入 SQLite → 前端展示

**目前状态**: 已上线 2 篇测试文章，UI 骨架完成，等待细节调整

#### 已实现功能

**文章列表** (`/reading`, `src/app/reading/page.tsx`)
- [x] YouTube 风格全宽网格布局（grid-cols-1/2/3/4 响应式）
- [x] 16:9 缩略图卡片：OG 图（Plan A）/ 标签匹配渐变色+emoji（Plan B fallback）
- [x] 来源 badge 覆盖层（emoji + 名称，半透明黑底）
- [x] 难度星级（★ 1-5）右上角覆盖层
- [x] 英文标签（#{tag}，显示前 2 个）
- [x] 中文标题切换按钮（"中文" toggle 按钮在 tag 旁，点击切换 title ↔ titleZh）
- [x] 时间显示（daysAgo: Today / Yesterday / N days ago）
- [x] 加载骨架屏（4 个 pulse 占位）
- [x] 空状态提示
- [x] 卡片 hover:scale-103 + shadow 抬升，active:scale-98 点击反馈
- [x] 图片 hover 微放大（duration-500）

**文章详情** (`/reading/[id]`, `src/app/reading/[id]/page.tsx`)
- [x] 顶部导航（Back + Reading 标题）
- [x] Hero 图（OG 图 / 渐变+emoji fallback），底部渐变 fade-out
- [x] 元信息行（来源 emoji + 名称 · 难度星级 · 日期）
- [x] 英文标签
- [x] 标题
- [x] **摘要**: 英文摘要（summaryEn）默认显示，旁有"中文"切换按钮显示中文摘要（summary）
- [x] 正文（段落分隔，highlight 词汇）
- [x] 右侧词汇面板（sticky）：词汇表 + 类型标签（单词/词组/表达）+ 音标/词性/释义/语境句
- [x] 单词 → "+ 加入复习"按钮 → POST `/api/reading/[id]/vocab` → 加入 SRS 队列
- [x] 词组/表达 → "参考"标签（不加入 SRS）
- [x] "+ All" 一键添加全部未加入单词
- [x] "✓ Added" 状态标记

**数据模型** (Prisma `Article` + `ArticleVocab`)
- `Article`: id, title, titleZh?, url?, imageUrl?, source, sourceEmoji, content, summary, **summaryEn?**, difficulty, tags, createdAt
- `ArticleVocab`: id, articleId, word, type(word/phrase/expression), partOfSpeech?, phonetic?, definition, contextSentence, example?, exampleZh?, addedToReview
- 双向 `vocabItems` 级联删除

**API 接口**:
- `GET /api/reading` — 文章列表（含 titleZh, imageUrl, summaryEn）
- `GET /api/reading/[id]` — 文章详情 + 词汇
- `POST /api/reading/push` — 推送文章（含可选 titleZh, imageUrl, summaryEn, vocabItems）
- `POST /api/reading/[id]/vocab` — 添加词汇到 SRS（单条或批量）

**图片策略**:
- Plan A: 源文章 OG image（`imageUrl`）
- Plan B: 标签匹配渐变色+大号 emoji（10 套方案: ai/tech/science/engineering/environment/economics/history/society/health/business）

**词汇处理**:
- AI 提取文中重点词汇，区分 type: `word` / `phrase` / `expression`
- `word` → 可加入 SRS（与 Daily Study 队列互通）
- `phrase` / `expression` → 仅作参考、不加入复习
- 正文中词汇彩色下划线高亮（颜色按 type 区分: 单词蓝 #4A90D9 / 词组紫 #7B68AE / 表达橙 #C97B7A）

**推广认知目标**: 用户本身缺乏浏览新闻/国际形势的习惯，希望通过外刊在学英语的同时拓宽知识面（tech, science, current events, engineering, 各领域话题）

#### 待调整（用户 2026-06-07 反馈"明天再弄"）
- 大量细节待修改，用户指出"有很多要改的地方"

**P2 — AI Coach 专业场景包扩充**
- 英文技术面试、商务会议、机械工程沟通、外贸场景
- 预设场景包，现有 AI Coach 框架不动

**P3 — YouTube 学习模式**
- 粘贴链接 → 拉取字幕 → 提取关键短语 → SRS 复习
- 听力理解题生成
- ⚠️ 依赖字幕可用性，技术风险较高

**其他候选**
- **移动端适配**: 7:3 布局在手机上右侧面板挤占，需要 responsive 重构
- **学习数据看板**: 练习时长、纠错统计、进步趋势
- **已练场景历史**: 回顾之前练过的场景和对话记录
- **场景收藏**: 用户收藏喜欢的 AI 生成场景
- **难度分级**: 初级/中级/高级
- **TTS 多音色**: 更多语音选择
- **PWA 离线支持**: Service Worker 缓存

## 部署方案（2026-06-08 确定）

**平台**: Vercel（免费）+ Neon PostgreSQL（免费）

**改动**:
1. SQLite → PostgreSQL（Prisma provider 切换）
2. ECDICT 运行时查音标 → 改用预提取的 JSON 文件（`prisma/ecdict_phonetic.json`）
3. 阅读内容刷新 → GitHub Actions 免费定时触发
4. 开发方式：本地继续 SQLite + 生产 PostgreSQL 双模式

**费用**: 平台 $0，DeepSeek token 月几十元

**用户系统**: 后续通过 Supabase Auth / NextAuth.js 接入，Neon PostgreSQL 天然支持多用户

---

## 九、用户偏好

- **沟通语言**: 中文为主，产品 UI 中英混杂
- **沟通风格**: 直接精确的指令式；不满时措辞严厉（"毁灭级""铁律""大清洗"）
- **需求下发**: 通过 `词汇` 文件（PowerShell 调用）下发 PRD
- **质量要求**: 满分交付、零报错编译、curl 实测验证才算完成
- **视觉审美**: 暖色 `#f6f4ef` 底、柔和阴影、圆角、呼吸感、极简高档
- **权限**: auto mode 下 `npx next build` 等操作可能被拦截，优先 `tsc --noEmit`

---

## 十、AI Coach 模块 — 锁定规格（严禁修改）

> AI Coach（口语对练舱 + 动态场景系统）已全部完成并冻结。
> **任何重构、重写、样式调整均需用户明确授权。**

### 10.1 涉及文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/app/coach/page.tsx` | ~1006 | 全部 UI + 状态管理 |
| `src/app/coach/types.d.ts` | — | Web Speech API 类型声明 |
| `src/app/api/coach/route.ts` | ~278 | 两步 DeepSeek: Step1 纯文本 → Step2 json_object |
| `src/app/api/scene/generate/route.ts` | 112 | prompt → ScenarioSeed JSON |
| `src/app/api/scene/recommend/route.ts` | 97 | practicedTags → 3 条智能推荐 |

### 10.2 视觉设计

**底色**: `bg-[#f6f4ef]`（暖黄纸纹）+ 径向渐层 `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(200,180,160,0.13), transparent)`  
**全屏**: `h-screen w-screen overflow-hidden`，session 激活时再加一层 `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(200,180,160,0.13), transparent)` 固定背景

**顶部导航**: `grid grid-cols-[1fr_auto_1fr]` 居中布局，AI Coach 标题 `text-2xl md:text-3xl font-black text-slate-900 tracking-widest uppercase center`。左: 胶囊 Back 按钮（`rounded-full px-3.5 py-1.5 bg-[#F0F0F0] text-[#757575]`，session 中返回英雄区，英雄区返回首页）。右: Speaking 绿点脉冲指示器 + Similar Session → 深色胶囊大按钮（生成同类场景）

**英雄区（未开始）**:
- 顶部 AI 搜索框（白色毛玻璃 `bg-white/80 backdrop-blur-sm rounded-xl`，支持 Enter 提交 + Generate ✦ 按钮 + 🎲 Surprise Me 按钮）
- 左右 2 列 `grid-cols-1 md:grid-cols-2 gap-12`
- 左侧: badge → title → description → 中英切换 → Start Immersive Training ⚡ 按钮
- 右侧: **渐变主题图** — 深色?改为浅色渐变（关键词匹配 10 套方案）:
  - 机械: `#E8D5C0 → #D4B89A → #C4A68A` + 🔧
  - AI: `#D0D8F0 → #B8C4EA → #A0B0E0` + 🤖
  - 汽车: `#C4D4E8 → #A8C0D8 → #8EAEC8` + 🚗
  - 酒吧: `#F0E0C8 → #E4CEB0 → #D8BC9A` + 🍸
  - 餐饮: `#F0D0C8 → #E4BEB4 → #D8ACA0` + 🍽️
  - 医疗: `#C0E0D8 → #A8D0C8 → #90C0B8` + 🏥
  - 旅行: `#E8DCC8 → #D8CAB0 → #C8B89A` + ✈️
  - 商务: `#E0D8D0 → #D0C8C0 → #C0B8B0` + 💼
  - 购物: `#F0D8E0 → #E4C6D0 → #D8B4C0` + 🛍️
  - 学校: `#D0E0C8 → #B8D0B0 → #A0C098` + 📚
  - 默认: 中性灰 + ✨
  每套含: 3 色渐变 background + 模糊光晕圆 + 点阵纹理 overlay + 大号半透明 emoji 居中（`clamp(7rem, 16vw, 12rem) opacity-70`）+ 上下渐变装饰线
- 底部 Recommended For You 胶囊卡片阵列（10 个分类，按练习历史智能推荐）

**聊天布局（进行中）**: 70/30 分栏 — 左侧 `flex-[6.5]` 聊天区（`backgroundImage: radial-gradient(ellipse at 50% 0%, rgba(230,215,200,0.08), transparent 70%)`），右侧 `flex-[3.5]` 审计面板（`hidden md:block`，移动端隐藏）

**气泡**:
- AI: `bg-[#F5F3F0] text-stone-800 rounded-2xl rounded-tl-sm` + `border-left: 3px solid rgba(0,0,0,0.06)` + 奶龙头像（`/nailong/nailong.webp` `w-9 h-9 rounded-full`）靠左
- 用户: `bg-[#2F2F2F] text-white rounded-2xl rounded-tr-sm` + 奶龙头像（`/nailong/OIP-C.webp` `w-11 h-11 rounded-full`）靠右
- 翻译按钮: Translate/Hide 切换，显示 AI 中文翻译

**右侧面板**: `rounded-3xl border border-stone-200/60 bg-white/70 backdrop-blur-xl p-5 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)]`，含:
- Mission Goals（编号圆圈+完成勾线）
- Corrections & Suggestions（original→optimized 划线对比、auditDetails 拼写/语法红标+中文原因、nativeUpgrade 地道升舱+中文解析）
- Hints 双区（pillars 完整句 + vocabulary 短语芯片，点击填入输入框），折叠展开

**输入栏**: `bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200`，hover 增强阴影+边框。内含:
- 麦克风按钮（玫瑰红脉冲录音 / 灰色静息，`rounded-xl`）
- Emoji 按钮（弹出 ~80 emoji picker，`rounded-2xl border bg-white/95 backdrop-blur-xl p-3 shadow-xl`，绝对定位 bottom-full）
- 文本输入（`px-3 py-3.5`，sendMessageRef 闭包安全）
- 发送按钮（`bg-slate-900 text-white` active 时 `hover:scale-110` / 禁用 `bg-stone-100 text-stone-300`）

**结束弹窗**: 毛玻璃遮罩 `bg-black/10 backdrop-blur-[2px]`，白卡 `bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl`，显示任务摘要 + 纠错总结，两个按钮（Try Another Scenario 🎲 + Shuffle to Next 🎲）

**动画体系**:
- Entrance: `.animate-in` (fadeUp 0.4s cubic-bezier(0.16,1,0.3,1))、`.animate-hero` (heroIn 0.6s)、`.animate-fade-in` (fadeIn 0.3s)
- Staggered: `.coach-search`(0.05s) → `.coach-badge`(0.15s) → `.coach-title`(0.25s) → `.coach-desc`(0.35s) → `.coach-cta`(0.45s) → `.coach-image`(0.55s) | session: `.coach-banner`(0.1s) → `.coach-panel-item`(0.15s/0.3s/0.45s)
- Hover: 全部交互元素 `hover:scale-105 + hover:shadow` 抬升模式，`duration-200~500` 随元素大小调整。Surprise Me 🎲 `rotate-[360deg] + scale-125` + 字距拉宽。输入框 `hover:border + hover:shadow` 增强。active 统一 `scale-[0.95~0.97]`
- 滚动条: 4px 细条 `scrollbar-thin`

### 10.3 核心交互

- **会话流程**: 英雄区选场景 → "Start Immersive Training" → AI TTS 开场 → 用户语音/文字回复 → AI 回复+翻译+纠错+提示 → 8 轮或 AI 判定完成 → View Results 弹窗
- **语音**: `SpeechRecognition` continuous=true，Enter 或再次点击麦克风停止+发送，`isSendingRef` + `shouldSendOnEndRef` 防重复
- **场景生成**: 搜索框或 Surprise Me → `/api/scene/generate` → 更新推荐列表 → localStorage 记录标签
- **智能推荐**: `/api/scene/recommend` 接收 `practicedTags` → 返回 3 条，刚练标签降权防茧房

### 10.4 两步 API 模式

Step1: 无 `response_format`，取最近 6 条消息 → DeepSeek 纯文本回复  
Step2: 短上下文（~4 条）+ `response_format: json_object` → 提取 translationZh、corrections、nextHints、isFinished

---

## 十一、词汇 SRS 模块 — 当前完整规格（严禁未经授权的修改）

> 词汇模块 UI / 交互 / 配色已定型并冻结。任何改动（含样式调整、布局变更、功能增强）均需用户明确授权。
>
> **Frontend UI freeze**（CLAUDE.md 规则）: 除非用户明确要求，不改现有页面的 UI/配色/布局。

### 11.1 涉及文件

| 文件 | 职责 |
|------|------|
| `src/app/words/page.tsx` | ~320 行 — 全部翻牌卡片 UI + 状态管理 + 评分逻辑 |
| `src/app/api/words/route.ts` | GET 每日 20 词 + POST SM-2 评分 — **不要动** |
| `src/app/api/words/queues/route.ts` | GET 双队列看板计数 |
| `src/app/api/words/ai-train/route.ts` | POST DeepSeek 对话场景生成 |
| `prisma/seed.ts` | 数据灌装流水线（硬编码 + DeepSeek 生成） |
| `prisma/schema.prisma` | Word + WordReview 模型定义 |

### 11.2 视觉设计

**页面底色**: `bg-[#F8F6F4]`（暖白，偏暖灰，区别于 Coach 的 `#f6f4ef`）  
**布局**: `min-h-screen flex flex-col`，内容居中 `flex-1 flex flex-col items-center justify-center`  
**最大内容宽度**: `max-w-2xl mx-auto`

**入口动画**（`globals.css`）:
- 书图标: `.animate-book-icon` — `scale(0.7) rotate(-12deg)` → `scale(1) rotate(0deg)`，0.9s cubic-bezier，0.1s 延迟；hover `scale-105` + 棕色阴影抬升（`duration-300`）
- Title: `.animate-vocab-title` — fade-slide-up 0.7s，0.25s 延迟
- Subtitle: `.animate-vocab-subtitle` — fade-slide-up 0.6s，0.4s 延迟

**顶部导航栏**（全宽 `w-full px-6 md:px-12 pt-6 pb-2`）:
- 左: Back 按钮（`←` 箭头 + "Back" 文字，`color: #757575`，`hover:opacity-70`）
- 中: "Daily Study" 标题（`font-bold uppercase tracking-[0.25em] color: #262626` + 底部 3px 装饰线 `bg-[#262626] w-90%`）
- 右: "New N" 计数胶囊（`bg-[#F0F0F0] color: #757575 rounded-full px-3 py-1`）+ 页码 `index/total`（`tabular-nums`）

**进度条**（header 下方）:
- 标签 "Progress" 灰色小字 + 灰色圆角轨道 `h-1.5 bg-[#E8E8E8]` + 深色填充 `bg-[#262626]` `transition-all duration-500 ease-out` + 百分比数字

**卡片正面**（未翻转，点击前）:
- `select-none cursor-pointer`，`min-height: min(60vh, 560px)`，flex 垂直居中
- 词性胶囊（可选）: `rounded-full px-4 py-1.5 font-semibold uppercase tracking-wide bg-[#F0F0F0] color: #AAAAAA mb-6 md:mb-8`
- 单词: `font-extrabold tracking-tight text-center leading-[1.1] color: #262626`，字号 `clamp(3.5rem, 15vw, 7rem)`
- 音标: `mt-6 md:mt-8 text-base md:text-lg color: #757575`

**前置按钮**（正面下方，点击翻转）:
- 4 个等宽按钮 `flex-1 py-4 md:py-5 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 active:scale-[0.96] rounded-[40px]`
- Forgot: `bg-[#FCEAEB] color: #FC6F7B` + `hover:shadow-md`
- Good: `bg-[#E1EDFA] color: #64B0FA` + `hover:shadow-md`
- Easy: `bg-[#4F677E] text-white` + `hover:shadow-lg`
- Mastered: `bg-[#2B384A] text-white` + `hover:shadow-lg`
- 引导文字: "Do you remember this word?" (`color: #757575 text-center text-sm mb-5`)

**卡片背面**（翻转后）:
- 白色卡片: `bg-[#FFFFFF] rounded-3xl border px-8 md:px-12 py-8 md:py-10 overflow-y-auto`，`border-color: rgba(0,0,0,0.06)`，`box-shadow: 0 2px 20px -4px rgba(0,0,0,0.06)`，`min-height: min(60vh, 560px)`
- 顶部: 单词 `text-3xl md:text-4xl font-extrabold tracking-tight color: #2F2F2F` + 音标（可选）
- **DEFINITION** 区块: 标题灰色小字 "DEFINITION"（`uppercase tracking-[0.15em] color: #888888`），多义逐行 `pos` 粗体灰 + `meaning`
- **COLLOCATIONS** 区块: 标题灰色小字，灰底圆角芯片 `bg-[#F0F0F0] rounded-[10px] px-4 py-2`，每项 `en` 深灰 `#555555` + `zh` 浅灰 `#888888`
- **EXAMPLE** 区块: 标题灰色小字，每例句独立段落，英文斜体 `leading-relaxed italic color: #2F2F2F` + 中文对照 `color: #555555`。目标单词 `font-extrabold underline underline-offset-4 decoration-2` 高亮（`color: #2F2F2F, textDecorationColor: rgba(0,0,0,0.2)`）

**后置按钮**（背面下方）:
- 3 个等宽按钮 `flex-1 py-3.5 md:py-4 rounded-[14px] transition-all duration-300 hover:scale-105 active:scale-[0.96]`
- Misremembered: `bg-[#FFDEDE] color: #FF4D4D` + `hover:shadow-md`
- Mastered: `bg-[#5A6B7E] text-white` + `hover:shadow-lg`
- Next ➡: `bg-[#202020] text-white` + `hover:shadow-lg`，带右箭头 SVG 图标
- 提交中 `disabled:opacity-40` 防重复

**状态页**:
- **加载中**: 居中 `animate-spin rounded-full border-2 border-stone-200 border-t-stone-800`
- **完成**: 🎉 emoji + "Study Complete!" + "You studied N words today."
- **空**: "No words available right now."

### 11.3 核心交互

- **数据加载**: `useEffect` → GET `/api/words` → `setWords(data.words || [])`
- **翻转**: 点击卡片正面或前置按钮 → `setFlipped(true)`（仅允许正→反，无反→正）
- **前置按钮逻辑**（Forgot/Good/Easy/Mastered）: 点击仅触发翻牌（`flipCard`），评分在背面按钮提交
- **后置按钮逻辑**:
  - `Misremembered`: `submitAndAdvance(1)` — SM-2 rating=1
  - `Mastered`: `masterAndAdvance()` — POST `{ mastered: true }`
  - `Next`: `submitAndAdvance(3)` — SM-2 rating=3
- **提交后**: `setIndex(i+1)` → `setFlipped(false)` → 下一词
- **Back 按钮**: `router.back()` 返回上级页面
- **完成判断**: `index >= words.length` 时显示 Study Complete

### 11.4 API 规范

**GET `/api/words`**
```json
// Response
{ "words": WordData[], "total": 20, "reviewCount": N, "newCount": N }
// WordData: { id, word, phonetic, partOfSpeech, definition, collocations, example, exampleZh, difficulty, review: {...} | null }
```
逻辑: 取到期复习词（`nextReviewAt <= now`）→ 若不足 20，补新词。`WordData.review` 非空表示复习词。

**POST `/api/words`**
```json
// Request (rating mode)
{ "wordId": 1, "rating": 1 | 3 | 4 }
// Request (mastered mode)
{ "wordId": 1, "mastered": true }
// Response
{ "success": true, "review": { "interval", "easiness", "repetitions", "nextReviewAt" } }
```
SM-2 算法: rating 1→重置(interval=0, easiness-0.2)、rating 3→渐进递增、rating 4→大幅递增+bonus。mastered=true →interval 永久大值。

**GET `/api/words/queues`**
```json
// Response
{ "newCount": 1800, "reviewCount": 42 }
```

**POST `/api/words/ai-train`**
```json
// Request
{ "word": "abandon" }
// Response
{ "scenario": "对话场景...", "tip": "中文口语妙招..." }
```

### 11.5 Prisma Schema

```prisma
model Word {
  id           Int           @id @default(autoincrement())
  word         String
  phonetic     String?
  partOfSpeech String
  definition   String
  collocations String?
  example      String?
  exampleZh    String?
  difficulty   String        @default("IELTS")
  source       String        @default("built-in")
  reviews      WordReview[]
}

model WordReview {
  id          Int      @id @default(autoincrement())
  wordId      Int
  interval    Int      @default(0)
  easiness    Float    @default(2.5)
  repetitions Int      @default(0)
  nextReviewAt DateTime
  createdAt   DateTime @default(now())
  word        Word     @relation(fields: [wordId], references: [id])
}
```

### 11.6 数据流水线（`prisma/seed.ts`）

- **`getBuiltInWords()`**: 硬编码 550 条手写词汇（word→zone，完整音标/词性/释义/例句）
- **`EXTRA_WORDS`**: 约 5500 个候选雅思词汇（A-Z 纯单词列表）
- **`ensureEcdictDb()`**: 下载 skywind3000/ECDICT 的 `stardict.db`（340 万词条），缓存到 `prisma/ecdict/`
- **IELTS 过滤**: 用 ECDICT `tag` 字段含 `ielts` 过滤 EXTRA_WORDS → 2844 候选，取前 1450 个
- **`generateWithDeepSeek()`**: 20 词/批 → DeepSeek API（`temperature: 0.3, max_tokens: 4096`）→ 返回音标/词性/释义/搭配/3 个不同用法例句+翻译
- **缓存**: `prisma/generated_data.json`，增量更新，重复 seed 只补缺
- **`mergeEntry()`**: 手写词 > ECDICT > DeepSeek。手写词保留原始数据，ECDICT 补充音标/释义，DeepSeek 补充搭配+例句
- **`buildExamples()`**: 只保留成对的 en+zh 例句，不存在孤儿句子（第三个句子没中文的 bug 已修复）
- **写库**: 100 条/批 `prisma.word.createMany()`，旧数据自动清空
- **`MAX_WORDS = 2000`** 上限
- **Highlight**: `words/page.tsx` 的 `highlightWord()` 使用 `\\b(word\\w*)\\b` 匹配词形变体
