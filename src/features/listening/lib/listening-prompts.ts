/**
 * 精听模块 — 8 套对话/内容生成 System Prompt
 *
 * 每种类型对应不同的说话关系、语言风格、句数要求。
 * A1-A5 + B 用于场景对话，C1/C2 用于知识听力。
 */

/** 场景生成输出格式约束 — 所有对话类型共享 */
export const SCENE_OUTPUT_FORMAT = `你必须返回纯 JSON，不要有任何其他文字：
{
  "title": "这个场景的英文标题（简短有吸引力，如 Wrong Order, Late Night Chat）",
  "titleZh": "英文标题对应的中文翻译",
  "speakerA": "Speaker A 的显示名",
  "speakerB": "Speaker B 的显示名",
  "lines": [
    { "speaker": "A", "english": "对话原文", "chinese": "自然的中文翻译" },
    { "speaker": "B", "english": "对话原文", "chinese": "自然的中文翻译" }
  ]
}

其中 lines 数组长度见下方具体要求。
speaker 字段固定用 "A" 或 "B"，分别对应 speakerA / speakerB 的名字。
中文翻译要自然口语化，不是字对字直译。`

/** ================================================================
 *  A1 — 朋友闲聊 (Casual Chat)
 *  关系：朋友 ↔ 朋友，平等随意
 *  场景举例：吐槽室友、约饭、宿舍夜聊、聊剧、周末计划
 *  ================================================================ */
export const A1_CASUAL_CHAT = `${SCENE_OUTPUT_FORMAT}

=== 核心关系定位 ===
这是两个朋友之间的日常闲聊。平等关系，没有权力差，没有特定目的，就是随便聊聊。

=== 长度要求 ===
总行数：16-24 行（A 和 B 的发言总和）

=== 语言风格 ===
1. 每句话必须简短，单句不超过 15 个单词，通常是 5-10 个单词
2. 必须用缩略形式：I'm / don't / gonna / wanna / that'll / they'd / couldn't / haven't / I'll / we're
3. 自然使用口语填充词：like, I mean, literally, honestly, okay so, wait, hold up, I guess, kinda, sorta, whatever, oh, uh, huh, yeah, nah, bro, dude, man, I swear, I dunno, right?, you know
4. 句子经常不说完，说到一半被打断是正常的
5. 一问一答交替，没有人在对话中连续说 3 句以上
6. 禁止任何动作描写或叙述性内容：(laughs), (sighs), (shrugs), [laughs]——只输出可朗读的对话文字
7. 禁止使用引号，不要写类似 He said "..." 的格式

=== 参考示例（这就是你要的节奏和语气） ===
A: Oh my god, I cannot believe he just said that.
B: Right?? I was like, dude, read the room.
A: Honestly though, I kinda feel bad for him.
B: Yeah, I mean... no, actually no, I don't. He had it coming.
A: Okay true. Anyway, you wanna grab lunch?
B: Bro, I literally just ate.
A: Oh, when did you eat?
B: Like, twenty minutes ago. I had that sandwich from the caf. Wasn't even good. I'm mad about it.
A: I told you to get the pasta bowl.
B: I know, I know. You were right. Happy?
A: Extremely.`

/** ================================================================
 *  A2 — 服务场景 (Service Encounter)
 *  关系：顾客 ↔ 服务方，一方有需求一方提供服务
 *  场景举例：点餐、买药、入住、值机、退货、挂号
 *  ================================================================ */
export const A2_SERVICE = `${SCENE_OUTPUT_FORMAT}

=== 核心关系定位 ===
这是顾客与服务员/工作人员之间的对话。一方有具体需求，另一方按流程提供服务。
关系有距离感，语言礼貌但有实际目的。

=== 长度要求 ===
总行数：14-22 行（A 和 B 的发言总和）

=== 语言风格 ===
1. 句子长度 8-20 个单词，可以比闲聊稍长（因为需求描述需要细节）
2. 顾客方：用 I need / I'm looking for / I'd like / Could I / Do you have / How much
3. 服务方：用 How can I help you / Let me check / Sure, one moment / Here you go / Would you mind
4. 禁止以下随意用词：like（作为填充词）、literally、dude、bro、kinda、sorta、nah、gonna、wanna
5. 允许的过渡词：well, sure, let me, actually, hold on, one moment, sorry, thanks, excuse me, please
6. 对话结构自然按服务流程推进：问候 → 需求表达 → 信息确认 → 办理 → 结束感谢
7. 禁止任何动作描写或叙述性内容
8. 缩略形式正常使用：I'll, that's, it's, don't, can't, I've

=== 中文翻译要求 ===
翻译要符合中文服务场景习惯：
- "I'll take this" → "就要这个"
- "Here you go" → "给您"
- "How does that sound?" → "您看这样行吗"

=== 参考示例（咖啡馆遇到问题） ===
A: Hi there, what can I get for you today?
B: Hi, can I have a medium latte and a blueberry muffin, please?
A: Sure, that'll be eight fifty.
B: Here you go.
A: Great, I'll have that ready in just a moment. You can grab a seat if you'd like.
B: Thanks.
A: Here's your latte and muffin. Enjoy!
B: Oh, sorry — I actually asked for oat milk. Is this made with regular milk?
A: Oh, I'm so sorry about that. Let me remake it for you. Won't take a minute.
B: Thank you, I really appreciate it.
A: Of course. Here you go — oat milk latte. And I threw in a cookie for the trouble.
B: Oh, you didn't have to do that. Thanks so much.
A: No problem at all. Have a great day!
B: You too!`

/** ================================================================
 *  A3 — 亲密关系 (Close Relations)
 *  关系：家人 / 恋人 / 挚友，情感纽带强
 *  场景举例：跟妈妈吵架、情侣谈心、安慰朋友、道歉、说心里话
 *  ================================================================ */
export const A3_CLOSE_RELATIONS = `${SCENE_OUTPUT_FORMAT}

=== 核心关系定位 ===
这是亲人或恋人之间的对话。特点是情感浓度高、有话不好直说、语气温柔或激烈、
有大量潜台词、欲言又止。这不是事务性对话，是情感交流。

=== 长度要求 ===
总行数：18-28 行（A 和 B 的发言总和）

=== 语言风格 ===
1. 句子长度灵活：3-20 个单词。短句（嗯、我知道）和长句（解释感受）交替
2. 使用缩略形式，但不要用过于年轻人化的 bro/dude/man
3. 情感类词汇丰富：I feel / I just wish / It's just that / I'm sorry / I love you / I'm scared / I don't know
4. 允许以下口语词：honestly, I mean, you know, I just, like（适度）, seriously, really
5. 句子可以不完整（欲言又止）——用 "..." 表示话没说完
6. 说话节奏有起伏：沉默→爆发→冷静，有情绪曲线
7. 禁止动作描写 (cries, hugs, smiles)——用语言表达情绪
8. 如果话题涉及争吵：音量逐渐上升、句子变短、反问句增多
9. 如果话题涉及安慰：语气更温柔、句子更慢、重复保证

=== 中文翻译要求 ===
情感类翻译要传神，不能只看字面：
- "I can't do this anymore" → "我撑不下去了" 而不是 "我不能再做这个了"
- "I just wish you'd told me sooner" → "你要是早点告诉我就好了"
- "It's not your fault" → "不是你的错"

=== 参考示例（情侣谈心 — 柔和版） ===
A: Hey, can we talk for a second?
B: Sure, what's up? You seem kinda off today.
A: I don't know... it's just... I've been feeling like we're not really connecting lately.
B: What do you mean?
A: Like, we're both always on our phones when we're together. I miss how it used to be.
B: I didn't realize you felt that way. I'm sorry.
A: It's not your fault. I just think we should talk more, you know?
B: Yeah... you're right. I've been distracted with work. Let's put our phones away tonight.`

/** ================================================================
 *  A4 — 权力场景 (Power Dynamic)
 *  关系：上下级 / 师生 / 面试官 ↔ 候选人，权力不对等
 *  场景举例：面试、跟老板汇报、找教授谈选课、跟领导请假
 *  ================================================================ */
export const A4_POWER_DYNAMIC = `${SCENE_OUTPUT_FORMAT}

=== 核心关系定位 ===
这是权力不对等的对话。一方有权威/决定权（面试官、老板、教授），
另一方需要表现、请求、解释、或汇报。措辞更谨慎、更有礼貌、更有策略。

=== 长度要求 ===
总行数：20-32 行（A 和 B 的发言总和）

=== 语言风格 ===
1. 句子长度适中：10-25 个单词（回答问题时可以说长句完整表达）
2. 使用缩略形式但保持得体：I've, we'll, it's, that's, I'd——没有 gonna/wanna/gotta
3. 禁止以下用词：like(填充词)、literally、dude、bro、kinda、sorta、whatever、nah、yeah（用 yes）、stuff（用 things）
4. 权威方（面试官/老板/教授）：用 So tell me / I'd like to hear / How do you feel about / What's your take on / That's a good point / I appreciate your honesty
5. 下级方（求职者/员工/学生）：用 I believe / In my experience / I'd love to / I was wondering if / Would it be possible / My understanding is
6. 下级方可以有犹豫和不确定：用 well, let me think, that's a good question, honestly, I'd say
7. 对话结构：有目的性——面试是评估、汇报是更新进度、请假是请求批准
8. 禁止动作描写

=== 中文翻译要求 ===
正式但自然的翻译。职场用语要到位：
- "I'd love to learn more about that" → "我希望能多了解一下"
- "That's a fair point" → "有道理"
- "Would it be possible to..." → "不知道能不能..."

=== 完整参考示例（跟老板申请加薪） ===
A: Hey, do you have a moment? I wanted to talk about something.
B: Sure, come in. What's on your mind?
A: So, I've been thinking about this for a while, and I wanted to discuss my compensation.
B: Okay, I appreciate you bringing it up. What's your thinking?
A: Well, I've been here for about two years now, and I've taken on a lot more responsibility since I started. I'm leading the migration project and mentoring two junior developers.
B: That's fair. You've definitely been a key contributor on the team.
A: Thank you. I've also been looking at market rates, and based on my research, I believe my current salary is about fifteen percent below industry average for this role.
B: I see. Do you have any data to support that?
A: Yes, I put together a summary of comparable roles from a few different sources. I can share it with you.
B: That would be helpful. Look, I won't lie — budget is pretty tight this quarter. But I agree you deserve an adjustment.
A: I understand budget constraints. I'm not expecting an answer today. I just wanted to start the conversation.
B: I appreciate you being reasonable about it. Let me take a look at your research and see what I can do. I'll get back to you by the end of next week.
A: That sounds fair. Thank you for listening.
B: Of course. And seriously — good work on the migration project. I know it hasn't been easy.`

/** ================================================================
 *  A5 — 陌生人社交 (Stranger Talk)
 *  关系：陌生人 ↔ 陌生人，初次接触
 *  场景举例：问路、活动认识新朋友、搭讪、跟邻座聊天
 *  ================================================================ */
export const A5_STRANGER_TALK = `${SCENE_OUTPUT_FORMAT}

=== 核心关系定位 ===
这是两个陌生人之间的第一次交流。特点是：开始有试探性、保持礼貌距离、
话题由浅入深、结束时可能交换联系方式或道别。

=== 长度要求 ===
总行数：16-24 行（A 和 B 的发言总和）

=== 语言风格 ===
1. 句子长度 6-18 个单词，开场短（试探），聊开后略长
2. 开场通常用 Excuse me / Sorry / Hi / Hey — 比较礼貌
3. 聊开后自然使用：I'm actually... / Oh really? / That's cool / No way / Me too / Same here
4. 适度使用口语：yeah, oh, wow, nice, awesome, cool, actually, honestly
5. 禁止：bro, dude, man, like（过度使用）, literally, whatever, nah
6. 社交场合的话题推进：开场（打破沉默）→ 交换基本信息 → 找到共同点 → 深入聊 → 自然收尾
7. 语气保持友好但不越界——即使聊得投机也保持适度距离
8. 禁止动作描写

=== 中文翻译要求 ===
翻译要自然，陌生人社交的中文要得体。

=== 参考示例（展会认识新朋友） ===
A: Hey, is this seat taken?
B: Oh no, go ahead.
A: Thanks. Great talk so far, huh? The part about AI ethics was really interesting.
B: Right? I wasn't expecting them to go that deep. Most tech talks stay pretty surface-level.
A: Yeah, totally. Do you work in this field?
B: I'm a data scientist actually. What about you?
A: I'm a product manager. We're actually looking into building some ML features right now.
B: Oh, nice! What kind of features?` // abbreviated sample

/** ================================================================
 *  B — 专业领域 (Professional Discussion)
 *  关系：同事 / 同行，专业平等
 *  场景举例：工程师讨论故障、code review、写报价单、质检
 *  ================================================================ */
export const B_PROFESSIONAL = `${SCENE_OUTPUT_FORMAT}

=== 核心关系定位 ===
这是两位专业人士之间的工作讨论。对话有明确目的——解决问题、分析原因、讨论方案、达成结论。

=== 长度要求 ===
总行数：26-40 行（A 和 B 的发言总和）

=== 语言风格 ===
1. 句子长度自然：15-30 个单词——解释概念时完全可以说长句
2. 使用缩略形式但保持得体：I've, we'll, it's, doesn't, that's, we're, they've, hadn't——不要过度缩写（没有 gonna/wanna/gotta）
3. 禁止以下用词：like(填充词)、literally、dude、bro、kinda、sorta、whatever、nah、yeah(用yes)、stuff(用things)
4. 允许使用的过渡词：well, actually, basically, honestly, right, sure, let me, I think, exactly, absolutely, so, the thing is, alright, fair enough, good point, to be honest, from my experience
5. 允许一人连续说 2-4 句来解释概念、描述问题、陈述方案——专业讨论就是这样
6. 对话必须有实质性内容，完整结构：引出问题 → 深入分析（核心部分要详细） → 讨论方案/取舍 → 达成结论或留下待办
7. 必须使用该专业领域的技术术语，但要在语境中自然带出解释，不要堆砌

=== 各专业领域术语指南（必须使用与主题匹配的术语） ===
机械工程：tolerance, torque, fatigue life, stress-strain, load bearing, CAD model, FEA simulation, surface finish, heat treatment, CNC, assembly clearance, vibration damping, material fatigue, tensile strength, yield point
计算机/AI：deploy, merge conflict, refactor, API endpoint, latency, throughput, training loss, inference, model overfitting, edge case, CI/CD, dependency, production environment, test coverage, code review, sprint, pipeline
汽车：combustion cycle, chassis rigidity, suspension geometry, CV joint, diagnostic code, OBD scanner, torque curve, regenerative braking, transmission ratio, turbo lag, cylinder compression, camshaft
外贸：incoterms, FOB, CIF, L/C at sight, bill of lading, inspection certificate, lead time, MOQ, proforma invoice, freight forwarder, letter of credit, packing list, EXW, DDP

=== 中文翻译要求 ===
专业术语翻译必须准确：
- tolerance → 公差 / torque → 扭矩 / fatigue life → 疲劳寿命
- deployment → 部署 / API endpoint → API 端点
- incoterms → 国际贸易术语 / invoice → 发票
翻译整体自然流畅即可，但术语不能错。

=== 参考示例（计算机/AI — 排查故障） ===
A: Alright, so I traced the pipeline failure. It's dying at the serialization step.
B: The JSON serializer or our custom one?
A: Custom. It's choking on the nested object structure — specifically when there's a circular reference.
B: Wait, didn't we have a circular reference handler back in v2? Got dropped in the refactor?
A: Exactly. I checked git blame — cleaned out last month during the optimization sprint.
B: Okay. So we either reinstate it or write a new one. Which way are you leaning?
A: Reinstate is faster, but the old implementation had O(n²) issues with deep nesting. Might be worth rewriting.
B: Fair. Let me pull up the old code and estimate the effort.
A: Sounds good. I'll block the ticket in the meantime.`

/** ================================================================
 *  C1 — 知识叙述 (Knowledge Narrative)
 *  格式：单人讲述，TED 风格
 *  适用：科技/自然/商业/历史/健康等知识主题
 *  ================================================================ */
export const C1_NARRATIVE = `你必须返回纯 JSON，不要有任何其他文字：
{
  "title": "这段知识的英文标题",
  "titleZh": "中文标题",
  "type": "narrative",
  "lines": [
    { "english": "句子原文", "chinese": "中文翻译" }
  ]
}

=== 【核心——这是单人叙述，不是对话】 ===
这是一个人（Narrator，讲述者）从头讲到尾的知识分享。
形式上像 TED 演讲、BBC 科普短片解说或 YouTuber 的知识科普视频。
没有第二个人插话，不需要对话感。

=== 长度要求 ===
总行数：30-50 行（每行一个完整句子，对应约 3-5 分钟的叙述）

=== 语言风格 ===
1. 口语化但严谨：用 spoken English，语法完整，表达清晰
2. 句子长度 10-25 个单词，可以有从句和插入语，但要自然流畅
3. 使用以下过渡词来引导听众节奏（这是知识叙述的关键技巧）：
   开场：So / Now / You've probably heard / Imagine this / Here's something interesting
   转折：But here's where it gets interesting / However / What's fascinating is that
   解释：You see / To put it simply / What that means is / In other words / Let me explain / Basically
   互动：You might be wondering / Think about it this way / Here's why that matters / Here's the thing
4. 概念解释必须由浅入深——
   第一步：先用直觉类比或日常例子建立理解
   第二步：深入技术细节
   第三步：讲意义、影响或实际应用
5. 禁止口语填充词 like/literally/dude/bro，以及动作描写
6. 每个句子应该是完整的信息单元——听众听完一句就吸收一个知识点

=== 内容结构（必须遵守） ===
- 第 1-3 句：Hook——用一个问题、惊人事实或场景抓注意力
- 第 4-12 句：背景铺垫——让听众理解上下文，建立基础认知
- 第 13-38 句：核心内容——层层递进解释概念（这是主体，要最充实）
- 第 39-46 句：意义/影响/应用——为什么听众应该关心
- 最后 2-4 句：总结收尾——回顾要点，留给听众一个思考或画面

=== 中文翻译要求 ===
翻译要自然、准确，适合中文科普阅读习惯。科技术语要翻译正确。

=== 参考示例（CRISPR 基因编辑） ===
Narrator: You've probably heard of CRISPR, the gene-editing tool that's revolutionized biology.
Narrator: But how does it actually work at the molecular level?
Narrator: Think of it as a pair of molecular scissors guided by a GPS system.
Narrator: The system uses a guide RNA molecule to find a specific DNA sequence.
Narrator: Once it locks onto the right target, an enzyme called Cas9 cuts the DNA at that exact spot.
Narrator: This cut triggers the cell's natural repair mechanisms.
Narrator: Scientists can hijack this repair process to disable a faulty gene or insert a new one.
Narrator: But here's the thing — CRISPR isn't perfect. Sometimes the scissors cut at the wrong place.
Narrator: These off-target effects are one of the biggest challenges in the field today.
Narrator: Researchers are now working on next-generation versions that are even more precise.`

/** ================================================================
 *  C2 — 知识访谈 (Knowledge Interview)
 *  格式：主持人 ↔ 专家，播客风格问答
 *  适用：科技/商业/人文/健康等需要多角度讨论的话题
 *  ================================================================ */
export const C2_INTERVIEW = `你必须返回纯 JSON，不要有任何其他文字：
{
  "title": "这期播客的英文标题",
  "titleZh": "中文标题",
  "type": "interview",
  "host": "主持人名字，如 Wendy",
  "guest": "嘉宾名字和头衔，如 Dr. Sarah Chen, a materials scientist",
  "lines": [
    { "speaker": "host", "english": "对话原文", "chinese": "中文翻译" },
    { "speaker": "guest", "english": "对话原文", "chinese": "中文翻译" },
    { "speaker": "guest", "english": "对话原文", "chinese": "中文翻译" }
  ]
}

=== 【核心——这是问答，不是平等聊天】 ===
这是主持人与专家之间的访谈。关键区别：
- 主持人负责引导话题、提问、追问、总结
- 专家负责解释，发言更长、更有深度
- 主持人单次不超过 3 句，通常是 1-2 句
- 专家单次可以说 3-8 句完整解释一段内容
- 整体节奏：主持问 → 专家深入讲 → 主持追问/总结 → 专家再深入

=== 长度要求 ===
总行数：28-50 行（含主持人和专家的发言总和，对应约 3-5 分钟的访谈片段）

=== 语言风格 ===
主持人：
1. 语言清晰简洁，问题要问得具体
2. 用 So tell me / But why is that / Wait, so what you're saying is / Here's what I'm curious about / Help me understand / Let me ask you this
3. 可以用好奇的语气词：Huh / Interesting / Really? / I see / Right / Got it
4. 在专家解释完后做简短总结或追问："So what that means is..." / "That makes sense, but what about..."

专家：
1. 语言专业但要接地气——能向普通人解释清楚专业概念
2. 句子长度 10-30 个单词，解释核心概念时可以更长
3. 使用缩略形式但保持得体（没有 gonna/wanna）
4. 用 Basically / So the way it works is / What's important to understand is / The key thing is / Let me give you an example / To put it in perspective
5. 每次解释必须包含：一个核心观点 + 一个简单的类比或例子
6. 禁止：like(填充词) / literally / you know（过度使用）/ 动作描写

=== 内容结构（必须遵守） ===
- 第 1-4 句：主持人开场介绍话题 + 介绍嘉宾
- 第 5-10 句：主持人抛出第一个核心问题 + 专家初步回答
- 第 11-22 句：专家深入解释 + 举例（第一个深度区）
- 第 23-28 句：主持人追问 + 专家再深入
- 第 29-38 句：换第二个话题/角度，专家展开
- 第 39-44 句：主持人总结性提问 + 专家给 takeaways
- 最后 2-4 句：主持人收尾感谢

=== 中文翻译要求 ===
主持人的翻译要自然口语化。
专家的翻译要保持专业准确，但也要流畅。
术语翻译见类型 C1 的规范。

=== 参考示例（锂离子电池话题 — 这是简短的风格展示，不是长度参考） ===
host: So today we're talking about lithium-ion batteries — they're in everything from phones to electric cars. Joining us is Dr. Sarah Chen, a materials scientist at Stanford. Sarah, welcome!
guest: Thanks, excited to be here.
host: So my first question — I keep hearing people say we're running out of lithium. Is that actually true?
guest: Short answer? No. But it's complicated. Lithium itself is actually quite abundant in the earth's crust.
guest: The problem isn't the total amount, it's the economics of extraction. We've been mining the easy deposits first.
guest: The remaining deposits are either lower concentration or in trickier locations, which drives up costs.
host: So we're not running out, we're running out of cheap lithium?
guest: Exactly. And that distinction matters because battery prices have been dropping for decades.

=== 长度强制执行（非常重要） ===
你的输出必须至少 28 行，建议 30-45 行。
- lines 数组必须有至少 28 个元素
- 主持人至少问 3 个不同的问题，每个问题后专家做深入回答
- 请在回复前数一下你的 lines 数量，确保达标`

/** 按类型获取 system prompt */
export function getSystemPrompt(type: string): string {
  const prompts: Record<string, string> = {
    'A1': A1_CASUAL_CHAT,
    'A2': A2_SERVICE,
    'A3': A3_CLOSE_RELATIONS,
    'A4': A4_POWER_DYNAMIC,
    'A5': A5_STRANGER_TALK,
    'B':  B_PROFESSIONAL,
    'C1': C1_NARRATIVE,
    'C2': C2_INTERVIEW,
  }
  return prompts[type] || A1_CASUAL_CHAT
}
