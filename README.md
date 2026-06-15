<div align="center">
  <br/>
  <h1>English Assistant</h1>
  <p><b>An all-in-one English learning companion for Chinese-speaking IELTS learners</b></p>
  <br/>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16"/>
    <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma" alt="Prisma 7"/>
    <img src="https://img.shields.io/badge/PostgreSQL-Neon-316192?style=flat-square&logo=postgresql" alt="PostgreSQL"/>
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS v4"/>
    <img src="https://img.shields.io/badge/AI-DeepSeek-4F46E5?style=flat-square" alt="DeepSeek"/>
  </p>

  <br/>
</div>

---

English Assistant 是一个面向 Chinese-speaking IELTS 学习者的英语学习 Web 应用，融合 **词汇 SRS（间隔重复）**、**精听训练**、**Reading 推文阅读**、**AI 口语教练** 四大核心模块，内容由 DeepSeek 实时生成，覆盖日常生活、学术、专业领域（机械工程、计算机/AI、汽车、外贸）等场景。

<br/>

<div align="center">
  <img src="public/screenshots/screenshot-home.png" alt="Home" width="80%"/>
</div>

<br/>

## ✨ Features

### 📖 Reading — 阅读中积累词汇
<div align="center">
  <img src="public/screenshots/screenshot-reading.png" alt="Reading list" width="48%"/>&nbsp;&nbsp;
  <img src="public/screenshots/screenshot-reading-article.png" alt="Article detail" width="48%"/>
</div>

- 自动抓取 **The Conversation** RSS，每日更新英文推文
- DeepSeek 自动提取词汇 + 生成中文摘要
- 右侧 sticky 词汇面板，**word** 可加入 SRS 记忆库，**phrase / expression** 随看随学
- 正文彩色下划线标注，点击即查

### 📝 Vocabulary SRS — 智能记忆
<div align="center">
  <img src="public/screenshots/screenshot-words-daily.png" alt="Daily study" width="32%"/>&nbsp;&nbsp;
  <img src="public/screenshots/screenshot-words-front.png" alt="Card front" width="32%"/>&nbsp;&nbsp;
  <img src="public/screenshots/screenshot-words-back.png" alt="Card back" width="32%"/>
</div>

- **2000 IELTS 核心词汇**（550 手写精编 + 1450 AI 生成）
- **SM-2 遗忘曲线算法**，双队列看板（待复习 → 掌握）
- 20 个主题场景词包（厨房 / 汽车 / 机械工程 / 外贸 / 计算机…）
- 每日目标追踪 + Custom word pack 自定义词包

### 🎧 Listening — 精听唱片机
<div align="center">
  <img src="public/screenshots/screenshot-scenes.png" alt="Scenes list" width="32%"/>&nbsp;&nbsp;
  <img src="public/screenshots/screenshot-cdplayer.png" alt="CD player" width="32%"/>&nbsp;&nbsp;
  <img src="public/screenshots/screenshot-subtitles.png" alt="Subtitles" width="32%"/>
</div>

- **场景对话**：基于 A1-A5 + B 六类关系模型（闲聊 / 服务 / 亲密 / 权力 / 陌生人 / 专业讨论），模拟真实对话
- **知识听力**：C1 TED 风格单人叙述 + C2 播客风格专家访谈
- DeepSeek 实时生成新场景，按需自动补货
- TTS 音频逐行播放，中英对照

### 🤖 AI Coach — 口语对练
<div align="center">
  <img src="public/screenshots/screenshot-coach-1.png" alt="AI Coach" width="48%"/>&nbsp;&nbsp;
  <img src="public/screenshots/screenshot-coach-2.png" alt="AI Coach chat" width="48%"/>
</div>

- 情景口语练习，自然对话，随时可以结束
- 场景系统：DeepSeek 按主题生成练习场景
- 智能推荐防茧房，语音输入（手动触发）
- 对话审计面板，回溯每一轮表现

<br/>

## 🚀 Quick Start

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 填入 DATABASE_URL（Neon PostgreSQL）和 DEEPSEEK_API_KEY

# 3. 初始化数据库
npm run seed

# 4. 启动
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

<br/>

## 🏗️ Tech Stack

| Category | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **Database** | PostgreSQL (Neon Serverless) |
| **ORM** | Prisma 7 |
| **AI** | DeepSeek Chat API (json_object mode) |
| **Animation** | GSAP, Motion, Three.js / OGL |
| **TTS** | Edge TTS (node-edge-tts) |
| **Audio** | Kokoro.js |

<br/>

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── coach/                # AI Coach 口语对练
│   ├── listening/            # 精听模块页面
│   ├── reading/              # Reading 模块
│   └── words/                # 词汇 SRS + 主题词包
│
├── features/
│   └── listening/            # 精听业务逻辑（组件 + lib）
│       ├── components/       # SectionRow, ListSection, 等
│       └── lib/              # DeepSeek prompt 模板、场景生成
│
├── components/               # 全局共享 UI（AI Assistant, 动画组件等）
├── lib/                      # 共享工具（Prisma client, types, utils）
├── data/                     # 静态配置数据
├── generated/prisma/         # Prisma Client 输出
└── scripts/                  # CLI 工具脚本
```

<br/>

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run seed` | 初始化数据库（词汇 + 分类） |
| `npm run push:reading` | 推送 Reading 文章 |
| `npx tsx scripts/generate-listening-dialogue.ts` | 批量生成精听场景 |
| `npx tsx scripts/generate-listening-audio.ts` | 批量生成 TTS 音频 |
| `npx tsx scripts/reset-srs.ts` | 重置 SRS 记忆数据 |

<br/>

## 🧭 Design

- 暖色调 **#F8F6F4** 基底，极简柔和
- 圆角 + 微阴影，低干扰高专注
- 渐进式动画（GSAP / Motion），不喧宾夺主
- Mobile-friendly 响应式布局

详见 [`VISION.md`](VISION.md)。

<br/>

---

<div align="center">
  <p>Built with Next.js, TypeScript & DeepSeek</p>
</div>
