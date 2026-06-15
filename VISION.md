# 设计规格

> 最后更新: 2026-06-13

## §1 愿景
华南理工大学 大二 机械工程，已过四六级。目标：日常口语流利、生活词汇丰富、专业英语（机械/汽车/CS/外贸）、IELTS 备考。

## §2 用户偏好
中文沟通，直接指令式。满分交付、零报错、实测验证。暖色视觉 `#F8F6F4`，圆角柔和，极简高档。

## §3 部署
本地开发 + Neon PostgreSQL。Vercel 因信用卡不可用。GitHub: `2486716632-sudo/english-web` (public)

## §4 AI Coach（锁定）
两步 API（纯文本→json_object）。7:3 分栏聊天+审计面板。暖黄底 `#f6f4ef`。语音 manual 触发。双发锁。场景系统（DeepSeek 生成 + 智能推荐防茧房）。渐变主题图+staggered 动画。8轮/AI判定结束。

## §5 词汇 SRS（锁定）
2000 IELTS 词(550手写+1450 DeepSeek)。SM-2 遗忘曲线。双队列看板。手写550 > ECDICT > DeepSeek 流水线。20 主题场景词包。UI 暖白底 `#F8F6F4`。

## §6 Reading
~43 篇 AI 推文（The Conversation）。YouTube 式网格卡片。详情页：Hero+正文+右侧 sticky 词汇面板。词汇类型: word→SRS, phrase/expression→仅参考。正文彩色下划线。

## §7 已完成
词汇 SRS / AI Coach / 场景系统 / 全局 AI Assistant / 场景词包 / Reading / 精听唱片机 / 导航统一 / 滚动+Tab恢复 / Custom word pack

## §8 候选方向
Edge TTS 全覆盖（进行中）| 学习数据看板 | 移动端+PWA | 专业场景扩充 | YouTube 学习模式
