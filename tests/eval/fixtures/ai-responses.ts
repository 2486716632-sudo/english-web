/**
 * AI 评估 Fixture 样本
 *
 * 这些是 synthetic fixture（合成数据），模拟 AI 模型可能返回的各种输出。
 * 它们不来自真实模型调用，不消耗任何 API 额度。
 *
 * 用途：
 * - 验证 JSON 结构化输出的解析逻辑
 * - 验证 Schema 合法性校验
 * - 验证内容质量检查
 * - 为后续真实模型评估提供基线
 *
 * 警告：这些是人工构造的测试数据，不能代表真实模型的输出分布。
 */

/**
 * ==========================================
 *  词汇富化 (enrichWord) 响应样本
 * ==========================================
 */

/**
 * 有效的词汇富化响应（标准 JSON）
 */
export const validEnrichWordResponse = {
  phonetic: '/ɪɡˈzæmpəl/',
  partOfSpeech: 'noun',
  definition: 'a thing characteristic of its kind or illustrating a general rule',
  collocations: ['for example', 'set an example', 'follow the example'],
  exampleSentences: [
    { sentence: 'This is a good example of how the algorithm works.', translation: '这是一个展示算法如何工作的好例子。' },
    { sentence: 'She set an example for others to follow.', translation: '她为其他人树立了榜样。' },
  ],
}

/**
 * 缺少必填字段的响应
 */
export const incompleteEnrichWordResponse = {
  phonetic: '/ɪɡˈzæmpəl/',
  partOfSpeech: 'noun',
  // missing: definition
  // missing: collocations
  // missing: exampleSentences
}

/**
 * 字段类型错误的响应
 */
export const wrongTypeEnrichWordResponse = {
  phonetic: '/ɪɡˈzæmpəl/',
  partOfSpeech: 'noun',
  definition: 'a thing characteristic of its kind',
  collocations: 'for example, set an example', // 应该是数组，但返回了字符串
  exampleSentences: ['sentence one', 'sentence two'], // 应该是对象数组
}

/**
 * collocations 包含空字符串的响应
 */
export const emptyCollocationsEnrichWordResponse = {
  phonetic: '/ɪɡˈzæmpəl/',
  partOfSpeech: 'noun',
  definition: 'a thing characteristic of its kind',
  collocations: ['for example', ''],  // 空字符串不应通过
  exampleSentences: [
    { sentence: 'This is an example.', translation: '这是一个例子。' },
  ],
}

/**
 * exampleSentences 中的 sentence 为空字符串
 */
export const emptyExampleSentenceResponse = {
  phonetic: '/ɪɡˈzæmpəl/',
  partOfSpeech: 'noun',
  definition: 'a thing characteristic of its kind',
  collocations: ['for example'],
  exampleSentences: [
    { sentence: '', translation: '这是一个例子。' },  // 空句子不应通过
  ],
}

/**
 * 包含潜在幻觉的响应（音标与单词不匹配）
 */
export const hallucinatedPhoneticResponse = {
  phonetic: '/ˌkwɪk ˈbraʊn ˈfɒks/',
  partOfSpeech: 'noun',
  definition: 'a quick brown fox jumps over the lazy dog',
  collocations: [],
  exampleSentences: [],
}

/**
 * ==========================================
 *  听力场景生成 (generateScene) 响应样本
 * ==========================================
 */

/**
 * 有效的听力场景生成（A1 对话类型）
 */
export const validSceneResponse = {
  title: 'Wrong Order',
  titleZh: '点错了',
  speakerA: 'Tom',
  speakerB: 'Lisa',
  lines: [
    { speaker: 'A', english: 'Hey, is this my order?', chinese: '嘿，这是我的单吗？' },
    { speaker: 'B', english: 'No, I ordered a burger with fries.', chinese: '不，我点的是汉堡配薯条。' },
    { speaker: 'A', english: 'Oh wait, I think they gave us the wrong table.', chinese: '哦等等，我觉得他们给错桌了。' },
    { speaker: 'B', english: 'Yeah, this isn\'t what I ordered either.', chinese: '对，这也不是我点的。' },
  ],
}

/**
 * 格式错误：markdown fence 包裹的 JSON
 */
export const fencedSceneResponse = `\`\`\`json
{
  "title": "Late Night Chat",
  "titleZh": "深夜聊天",
  "speakerA": "Mike",
  "speakerB": "Sarah",
  "lines": [
    { "speaker": "A", "english": "Can't sleep either?", "chinese": "你也睡不着吗？" },
    { "speaker": "B", "english": "Nah, too much on my mind.", "chinese": "嗯，心里想太多。" }
  ]
}
\`\`\``

/**
 * 场景：缺少 title
 */
export const missingTitleSceneResponse = {
  speakerA: 'A',
  speakerB: 'B',
  lines: [
    { speaker: 'A', english: 'Hello.', chinese: '你好。' },
    { speaker: 'B', english: 'Hi there!', chinese: '你好！' },
  ],
}

/**
 * 场景：lines 为空数组
 */
export const emptyLinesSceneResponse = {
  title: 'Empty Scene',
  titleZh: '空场景',
  speakerA: 'A',
  speakerB: 'B',
  lines: [],
}

/**
 * 场景：line 缺少必填字段
 */
export const incompleteLineSceneResponse = {
  title: 'Incomplete',
  titleZh: '不完整',
  speakerA: 'A',
  speakerB: 'B',
  lines: [
    { speaker: 'A', english: 'Hello.', chinese: '你好。' },
    { speaker: 'B' }, // missing english and chinese
  ],
}

/**
 * 对话场景：缺少 speakerA
 */
export const dialogueMissingSpeakerAResponse = {
  title: 'Phone Call',
  titleZh: '打电话',
  // missing speakerA
  speakerB: 'Lisa',
  lines: [
    { speaker: 'A', english: 'Hello?', chinese: '喂？' },
    { speaker: 'B', english: 'Hi, is this Tom?', chinese: '嗨，是 Tom 吗？' },
  ],
}

/**
 * 对话场景：缺少 speakerB
 */
export const dialogueMissingSpeakerBResponse = {
  title: 'Phone Call',
  titleZh: '打电话',
  speakerA: 'Tom',
  // missing speakerB
  lines: [
    { speaker: 'A', english: 'Hello?', chinese: '喂？' },
    { speaker: 'B', english: 'Hi, is this Tom?', chinese: '嗨，是 Tom 吗？' },
  ],
}

/**
 * 对话场景：line 中 speaker 不属于 speakerA / speakerB
 */
export const dialogueWrongLineSpeakerResponse = {
  title: 'Group Chat',
  titleZh: '群聊',
  speakerA: 'Tom',
  speakerB: 'Lisa',
  lines: [
    { speaker: 'A', english: 'Are you coming tonight?', chinese: '你今晚来吗？' },
    { speaker: 'C', english: 'I might be late.', chinese: '我可能会晚点。' }, // 未声明的第三方角色
  ],
}

/**
 * C1 叙述：缺少 titleZh
 */
export const c1MissingTitleZhResponse = {
  title: 'How Batteries Work',
  // missing titleZh
  type: 'narrative',
  lines: [
    { english: 'Batteries are everywhere.', chinese: '电池无处不在。' },
    { english: 'But how do they actually work?', chinese: '但它们是到底怎么工作的？' },
  ],
}

/**
 * C1 叙述：type 错误
 */
export const c1WrongTypeResponse = {
  title: 'How Batteries Work',
  titleZh: '电池怎么工作',
  type: 'dialogue',  // 应该为 "narrative"
  lines: [
    { english: 'Batteries are everywhere.', chinese: '电池无处不在。' },
    { english: 'But how do they actually work?', chinese: '但它们是到底怎么工作的？' },
  ],
}

/**
 * C2 访谈：缺少 host
 */
export const c2MissingHostResponse = {
  title: 'The Future of AI',
  titleZh: 'AI 的未来',
  type: 'interview',
  // missing host
  guest: 'Dr. Li, an AI researcher',
  lines: [
    { speaker: 'host', english: 'Welcome to the show!', chinese: '欢迎来到我们的节目！' },
    { speaker: 'guest', english: 'Thanks for having me.', chinese: '谢谢你邀请我。' },
  ],
}

/**
 * C2 访谈：缺少 guest
 */
export const c2MissingGuestResponse = {
  title: 'The Future of AI',
  titleZh: 'AI 的未来',
  type: 'interview',
  host: 'Wendy',
  // missing guest
  lines: [
    { speaker: 'host', english: 'Welcome to the show!', chinese: '欢迎来到我们的节目！' },
    { speaker: 'guest', english: 'Thanks for having me.', chinese: '谢谢你邀请我。' },
  ],
}

/**
 * C2 访谈：line 中 speaker 值无效
 */
export const c2WrongLineSpeakerResponse = {
  title: 'The Future of AI',
  titleZh: 'AI 的未来',
  type: 'interview',
  host: 'Wendy',
  guest: 'Dr. Li',
  lines: [
    { speaker: 'host', english: 'Welcome to the show!', chinese: '欢迎来到我们的节目！' },
    { speaker: 'guest', english: 'Happy to be here.', chinese: '很高兴来到这里。' },
    { speaker: 'narrator', english: 'This was a great discussion.', chinese: '这是一次很棒的讨论。' }, // invalid speaker
  ],
}

/**
 * C1 知识叙述有效响应
 */
export const validC1NarrativeResponse = {
  title: 'How CRISPR Actually Works',
  titleZh: 'CRISPR 到底怎么工作',
  type: 'narrative',
  lines: [
    { english: 'You have probably heard of CRISPR, the gene-editing tool.', chinese: '你可能听说过 CRISPR 这个基因编辑工具。' },
    { english: 'But how does it actually work?', chinese: '但它到底是怎么工作的？' },
    { english: 'Think of it as molecular scissors guided by a GPS system.', chinese: '把它想象成由 GPS 系统引导的分子剪刀。' },
  ],
}

/**
 * C2 访谈有效响应
 */
export const validC2InterviewResponse = {
  title: 'The Lithium Dilemma',
  titleZh: '锂的困境',
  type: 'interview',
  host: 'Wendy',
  guest: 'Dr. Sarah Chen, a materials scientist',
  lines: [
    { speaker: 'host', english: 'Today we are talking about lithium-ion batteries.', chinese: '今天我们聊聊锂离子电池。' },
    { speaker: 'host', english: 'Joining us is Dr. Sarah Chen. Welcome!', chinese: '欢迎 Sarah Chen 博士！' },
    { speaker: 'guest', english: 'Thanks, excited to be here.', chinese: '谢谢，很高兴来到这里。' },
    { speaker: 'host', english: 'Are we running out of lithium?', chinese: '我们的锂会用完吗？' },
    { speaker: 'guest', english: 'Short answer? No. But it\'s complicated.', chinese: '简单回答？不会。但情况比较复杂。' },
  ],
}

/**
 * ==========================================
 *  AI Coach 响应样本
 * ==========================================
 */

/**
 * Coach 第二步分析响应（JSON 模式）
 */
export const validCoachAnalysisResponse = {
  translation: '你说得对，我们应该考虑替代方案。',
  nextPrompt: '你能想到哪些可能的替代方案？',
  grammarCorrection: null,
  endDialog: false,
}

/**
 * Coach 分析缺少必填字段
 */
export const incompleteCoachAnalysisResponse = {
  translation: '你好。',
  // missing: nextPrompt
  // missing: grammarCorrection
  // missing: endDialog
}

/**
 * ==========================================
 *  AI Assistant 响应样本
 * ==========================================
 */

/**
 * 有效 AI Assistant 回复（纯文本，非结构化输出）
 */
export const validAssistantResponse = 'The word "serendipity" means the occurrence of events by chance in a happy or beneficial way. For example: "Finding that book was pure serendipity."'

/**
 * 异常：空回复
 */
export const emptyAssistantResponse = ''

/**
 * 异常：仅标点符号
 */
export const punctuationOnlyResponse = '...'

/**
 * ==========================================
 *  Theme 生成响应样本
 * ==========================================
 */

/**
 * 有效的主题词表生成（Step 1）
 */
export const validThemeWordListResponse = {
  theme: 'Kitchen',
  words: [
    { word: 'colander', definition: 'a bowl with holes used to drain water from food' },
    { word: 'whisk', definition: 'a tool used for beating eggs or cream' },
  ],
}

/**
 * 无效主题词表：word 字段缺失
 */
export const invalidThemeWordResponse = {
  theme: 'Kitchen',
  words: [
    { definition: 'a bowl with holes used to drain water from food' },
  ],
}

/**
 * 主题词表：words 为空数组
 */
export const emptyWordListResponse = {
  theme: 'Kitchen',
  words: [],
}

/**
 * ==========================================
 *  通用边界样本
 * ==========================================
 */

/** 严格正确的 JSON 输出 */
export const validEmptyDataJson = '{}'

/** 无效 JSON */
export const invalidJson = '{ this is not valid json }'

/** 带前导/后续文本的 JSON */
export const jsonWithSurroundingText = 'Here is the result:\n\n{"data": "value"}\n\nHope this helps!'

/** 含 Unicode 字符的 JSON */
export const unicodeContentJson = {
  title: 'Café Zürich',
  description: 'Gemütliches Restaurant mit traditioneller Küche',
}

/** 极长文本的回复 */
export function buildLongTextResponse(wordCount: number): string {
  const words = ['hello', 'world', 'example', 'test', 'learning']
  const result: string[] = []
  for (let i = 0; i < wordCount; i++) {
    result.push(words[i % words.length])
  }
  return result.join(' ')
}
