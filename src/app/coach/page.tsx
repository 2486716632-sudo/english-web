'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/* ================================================================
   Types
   ================================================================ */
interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  translation?: string
}

interface ScenarioGoal {
  text: string
  textZh: string
}

interface AuditItem {
  type: string
  wrong: string
  correct: string
  why: string
}

interface NativeUpgrade {
  expression: string
  why: string
}

interface CorrectionsData {
  hasError: boolean
  original: string
  optimized: string
  auditDetails: AuditItem[]
  nativeUpgrade: NativeUpgrade | null
}

interface HintsData {
  pillars: string[]
  vocabulary: string[]
}

interface ScenarioSeed {
  id: string
  badge: string
  badgeZh: string
  title: string
  titleZh: string
  description: string
  descriptionZh: string
  imageSeed: string
  userRole: string
  aiRole: string
  setting: string
  aiFirstLine: string
  aiFirstLineZh: string
  aiFirstLineExpr: { phrase: string; explanation: string }[]
  goals: ScenarioGoal[]
}

/* ================================================================
   Seed Scenarios — identity + goals only, no scripts
   ================================================================ */
const SEED_SCENARIOS: ScenarioSeed[] = [
  {
    id: 'racecar-engine',
    badge: '🔧 Mechanical Engineering',
    badgeZh: '🔧 机械工程',
    title: 'Racing Engine — Tolerance Showdown',
    titleZh: '赛车发动机 — 公差对攻',
    description: 'You are a fellow Formula Student team member working late on the racecar engine. Your teammate has been analyzing the spindle speed calculations all night and noticed a 2-micron discrepancy in the main bearing tolerance.',
    descriptionZh: '你是方程式赛车队的一名队员，正在加班研究发动机。你的队友整晚分析了主轴转速，发现主轴承公差差了 2 微米。',
    imageSeed: 'racecar-engine',
    userRole: 'A fellow Formula Student team member equally deep into the engine design',
    aiRole: 'A teammate who has been analyzing the spindle speed calculations all night',
    setting: 'University Formula Student workshop, late night before the competition deadline',
    aiFirstLine: 'Hey teammate, I\'ve been staring at the spindle speed calculations all morning. The tolerance on the main bearing seems off by 2 microns. What\'s your read on the blueprint?',
    aiFirstLineZh: '嘿队友，我整个早上都在盯着主轴转速计算。主轴承的误差似乎偏了 2 微米。你对蓝图怎么看？',
    aiFirstLineExpr: [
      { phrase: 'What\'s your read on...', explanation: '你对此怎么看？技术场景中委婉征求意见' },
      { phrase: 'seems off by', explanation: '似乎偏差了... 比 is wrong 更专业' },
    ],
    goals: [
      { text: 'Show engineering concern & analysis', textZh: '展现工程关切和分析能力' },
      { text: 'Propose alternative solution', textZh: '提出替代方案' },
      { text: 'Reach a design compromise', textZh: '达成设计折中方案' },
    ],
  },
  {
    id: 'ai-agent-audit',
    badge: '🤖 Cutting-edge AI',
    badgeZh: '🤖 前沿人工智能',
    title: 'AI Agent — Hallucination Autopsy',
    titleZh: 'AI Agent — 幻觉纠错会',
    description: 'You are an AI startup founder whose multi-agent pipeline went rogue — one Agent hallucinated a fake function call, another trusted it, and you lost $500 in bogus API credits.',
    descriptionZh: '你是一个 AI 创业公司创始人，你的多 Agent 管线跑飞了——一个 Agent 幻觉出了假函数调用，另一个直接相信了它，你因此损失了 500 美元。',
    imageSeed: 'ai-hacker',
    userRole: 'An AI startup founder whose multi-agent pipeline hallucinated and cost $500',
    aiRole: 'An experienced AI engineer in an open-source Discord who has dealt with this exact problem',
    setting: 'A technical support Discord channel for an open-source multi-agent framework',
    aiFirstLine: 'I\'ve seen this pattern before — hallucination chaining. One agent fabricates an output and the next agent trusts it blindly. Walk me through your pipeline — what does your agent topology look like?',
    aiFirstLineZh: '我之前见过这种模式——幻觉链。一个 Agent 编造了输出，下一个 Agent 盲目相信了它。跟我讲讲你的管线——你的 Agent 拓扑是什么样的？',
    aiFirstLineExpr: [
      { phrase: 'hallucination chaining', explanation: '幻觉链：一个 AI 的幻觉被另一个 AI 当作真实输入传播' },
      { phrase: 'Walk me through', explanation: '带我过一遍——引导对方详细解释的礼貌请求' },
    ],
    goals: [
      { text: 'Describe your agent pipeline', textZh: '描述你的 Agent 管线拓扑' },
      { text: 'Discuss hallucination fixes', textZh: '讨论幻觉修复方案' },
      { text: 'Decide on implementation approach', textZh: '确定实施方向' },
    ],
  },
  {
    id: 'autonomous-lidar',
    badge: '🚗 Vehicle Engineering',
    badgeZh: '🚗 车辆工程',
    title: 'Smart Cabin & LiDAR — Design Face-off',
    titleZh: '智能座舱与激光雷达 — 设计对决',
    description: 'You are a university student presenting your novel LiDAR fusion algorithm at an international autonomous vehicle design competition.',
    descriptionZh: '你是一名大学生，在国际自动驾驶设计大赛上展示你新型激光雷达融合算法。',
    imageSeed: 'autonomous',
    userRole: 'A university student presenting a LiDAR fusion algorithm at a competition',
    aiRole: 'A judge on the competition panel from the automotive industry',
    setting: 'International university autonomous vehicle design competition, with judges from Tesla and Waymo',
    aiFirstLine: 'Good morning. Interesting approach — feature-level fusion of solid-state LiDAR and mmWave radar. But I\'m concerned about the computational overhead at highway speeds. Walk me through your latency budget.',
    aiFirstLineZh: '早上好。有意思的方案——特征级融合固态激光雷达和毫米波雷达。但我担心高速下的计算开销。讲讲你的延迟预算。',
    aiFirstLineExpr: [
      { phrase: 'latency budget', explanation: '延迟预算——系统中允许从输入到输出的最大延迟' },
      { phrase: 'real-time constraints', explanation: '实时性约束——必须在规定时间内完成处理' },
    ],
    goals: [
      { text: 'Defend latency & computational budget', textZh: '捍卫延迟与计算预算' },
      { text: 'Address sensor limitation challenges', textZh: '回应传感器局限性质疑' },
      { text: 'Justify your architecture choice', textZh: '证明你的架构选择正确性' },
    ],
  },
  {
    id: 'friends-bar',
    badge: '🎬 American TV Drama',
    badgeZh: '🎬 美剧日常',
    title: 'Friends-Themed — Bar Night Banter',
    titleZh: '《老友记》主题 — 微醺酒吧夜',
    description: 'It\'s Friday night at your favorite New York bar. Your witty friend just dropped an embarrassing work story and is now waiting for your reaction.',
    descriptionZh: '周五晚上，在你最爱的纽约酒吧里。你那个搞笑的朋友刚刚爆了一个尴尬的工作糗事，正等你的反应。',
    imageSeed: 'cozy-bar',
    userRole: 'One of the close friends hanging out at the bar on Friday night',
    aiRole: 'The witty friend who just told an embarrassing story and keeps the banter going',
    setting: 'A cozy New York bar on Friday night with your closest friends',
    aiFirstLine: 'Okay okay okay, but hear me out — if we\'re really talking about bad life decisions, I need to tell you what happened at the lab meeting yesterday. So I\'m presenting my research, right? And I accidentally called our new algorithm... well, let\'s just say I used a word that rhymes with "ducking."',
    aiFirstLineZh: '好好好，但听我说完——如果真要聊人生糟糕决定，我必须告诉你们昨天实验室例会发生的事。',
    aiFirstLineExpr: [
      { phrase: 'hear me out', explanation: '听我把话说完——争取话语权的经典表达' },
      { phrase: 'rhymes with', explanation: '与...押韵——委婉暗示而不直接说出口' },
    ],
    goals: [
      { text: 'React to the embarrassing story', textZh: '反应并追问糗事细节' },
      { text: 'Share your own relatable disaster', textZh: '分享你自己的同类翻车经历' },
      { text: 'Keep the banter rolling', textZh: '延续酒吧逗趣对话氛围' },
    ],
  },
  {
    id: 'restaurant-standoff',
    badge: '🍽️ Survival English',
    badgeZh: '🍽️ 海外生存',
    title: 'Fine Dining — Wrong Order Showdown',
    titleZh: '高档西餐厅 — 点错菜维权记',
    description: 'You are celebrating a milestone at an upscale Parisian restaurant. The waiter has just served you a ribeye steak — but you ordered medium-rare and this is clearly well-done.',
    descriptionZh: '你在一家高档巴黎餐厅庆祝重要时刻。服务员刚刚端上了肋眼牛排——但你点的是五分熟，这盘明显是全熟。',
    imageSeed: 'fine-dining',
    userRole: 'A customer who ordered medium-rare steak but received well-done',
    aiRole: 'A waiter at an upscale Parisian restaurant serving your table',
    setting: 'An upscale Parisian fine dining restaurant, celebrating a special occasion',
    aiFirstLine: 'Here is your ribeye steak, sir. Medium-rare, seared to perfection. Is there anything else I can get for you at this moment?',
    aiFirstLineZh: '先生，这是您的肋眼牛排。五分熟，煎得恰到好处。请问现在还有什么需要的吗？',
    aiFirstLineExpr: [
      { phrase: 'seared to perfection', explanation: '煎得恰到好处——高端餐厅描述菜品用语' },
      { phrase: 'at this moment', explanation: '此刻——比 "now" 更礼貌正式的时间表达' },
    ],
    goals: [
      { text: 'Flag the incorrectly cooked steak', textZh: '指出牛排做错了' },
      { text: 'Push back against excuses firmly', textZh: '拒绝诡辩，态度坚定' },
      { text: 'Secure a satisfactory resolution', textZh: '获得满意解决方案' },
    ],
  },
]

/* ---- TTS ---- */
function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.95
  utterance.pitch = 1.0
  const voices = window.speechSynthesis.getVoices()
  const enVoice = voices.find((v) => v.lang.startsWith('en'))
  if (enVoice) utterance.voice = enVoice
  if (onEnd) utterance.onend = onEnd
  window.speechSynthesis.speak(utterance)
}

/* ---- SVG Icons ---- */
function MicIcon({ active }: { active: boolean }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-rose-500' : 'text-stone-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}

function TranslateIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
    </svg>
  )
}


/* ================================================================
   Page Component
   ================================================================ */
export default function CoachPage() {
  const router = useRouter()
  /* ---- State ---- */
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [scenario, setScenario] = useState<ScenarioSeed | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [showChinese, setShowChinese] = useState(false)
  const [heroKey, setHeroKey] = useState(0)
  const [showHints, setShowHints] = useState(false)
  const [nextHints, setNextHints] = useState<HintsData>({ pillars: [], vocabulary: [] })
  const [corrections, setCorrections] = useState<CorrectionsData | null>(null)
  const [missionProgress, setMissionProgress] = useState<boolean[]>([false, false, false])
  const [isLoading, setIsLoading] = useState(false)
  const [isSessionComplete, setIsSessionComplete] = useState(false)
  const [showFinishSuggestion, setShowFinishSuggestion] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [translatedIds, setTranslatedIds] = useState<Set<string>>(new Set())
  const toggleTranslate = useCallback((id: string) => {
    setTranslatedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  /* ---- Scene Generator state ---- */
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [searchPrompt, setSearchPrompt] = useState('')

  /* ---- Recommendations ---- */
  interface RecommendItem {
    badge: string; badgeZh: string; title: string; prompt: string
  }
  const [recommendations, setRecommendations] = useState<RecommendItem[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('coach_recommendations') || '[]') } catch { return [] }
  })
  const [recsLoading, setRecsLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    return !localStorage.getItem('coach_recommendations')
  })
  const [practicedTags, setPracticedTags] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('coach_practiced_tags') || '[]') } catch { return [] }
  })
  const updatePracticedTags = useCallback((tags: string[]) => {
    setPracticedTags(tags)
    if (typeof window !== 'undefined') localStorage.setItem('coach_practiced_tags', JSON.stringify(tags))
  }, [])

  const setRecsWithCache = useCallback((recs: RecommendItem[]) => {
    setRecommendations(recs)
    if (typeof window !== 'undefined') localStorage.setItem('coach_recommendations', JSON.stringify(recs))
  }, [])

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const messagesRef = useRef<Message[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])

  /* ---- Voice / send-safety refs ---- */
  const inputTextRef = useRef('')
  useEffect(() => { inputTextRef.current = inputText }, [inputText])
  const isSendingRef = useRef(false)
  const shouldSendOnEndRef = useRef(false)
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {})

  /* ---- Hydration-safe ---- */
  useEffect(() => {
    setScenario(SEED_SCENARIOS[Math.floor(Math.random() * SEED_SCENARIOS.length)])
  }, [])

  /* ---- Fetch recommendations on mount ---- */
  useEffect(() => {
    setRecsLoading(true)
    fetch('/api/scene/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practicedTags }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.recommendations) setRecsWithCache(data.recommendations) })
      .catch(() => {})
      .finally(() => setRecsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Auto-scroll ---- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ---- Generate Scenario ---- */
  const generateScenario = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/scene/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      if (!res.ok) {
        let detail = ''
        try { const e = await res.json(); detail = e.detail || e.error || '' } catch {}
        throw new Error(detail || `Generation failed: ${res.status}`)
      }
      const data = await res.json()
      setScenario(data as ScenarioSeed)
      setShowChinese(false)
      setHeroKey((k) => k + 1)
      setSearchPrompt('')
      /* Refresh recommendations excluding this new tag */
      const newBadge = ((data as ScenarioSeed).badge || '').match(/[A-Za-z\s]+/)
      const newTag = newBadge ? newBadge[0].trim() : ''
      const updatedTags = newTag ? [newTag, ...practicedTags.filter((t) => t !== newTag)].slice(0, 20) : practicedTags
      if (newTag) updatePracticedTags(updatedTags)
      setRecsLoading(true)
      fetch('/api/scene/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practicedTags: updatedTags }),
      })
        .then((r) => r.json())
        .then((recData) => { if (recData.recommendations) setRecommendations(recData.recommendations) })
        .catch(() => {})
        .finally(() => setRecsLoading(false))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setGenerateError(msg)
      console.error('[generate] Error:', msg)
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating])

  /* ---- Start session ---- */
  const startScenario = useCallback(() => {
    if (!scenario) return
    setSessionStarted(true)
    setShowHints(false)
    setShowChinese(false)
    setNextHints({ pillars: [], vocabulary: [] })
    setCorrections(null)
    setMissionProgress([false, false, false])
    setIsLoading(false)
    setIsSessionComplete(false)
    setShowOverlay(false)
    const aiMsg: Message = {
      id: crypto.randomUUID(), role: 'ai', text: scenario.aiFirstLine,
      translation: scenario.aiFirstLineZh,
    }
    setMessages([aiMsg])
    setIsSpeaking(true)
    speak(scenario.aiFirstLine, () => setIsSpeaking(false))
    setTimeout(() => inputRef.current?.focus(), 500)
  }, [scenario])

  /* ---- API call ---- */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sessionStarted || !scenario || isLoading) return
    if (isSendingRef.current) return
    isSendingRef.current = true

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)

    try {
      const allMessages = [...messagesRef.current, userMsg]
      console.log('【前端真实发出的全量历史】:', JSON.stringify({ messages: allMessages, scenario: { id: scenario.id, badge: scenario.badge, title: scenario.title } }))
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, scenario }),
      })

      if (!res.ok) {
        let detail = ''
        try { const e = await res.json(); detail = e.detail || '' } catch {}
        throw new Error(detail || `API error: ${res.status}`)
      }

      const data = await res.json()

      const aiMsg: Message = {
        id: crypto.randomUUID(), role: 'ai', text: data.aiReply,
        translation: data.translationZh || '',
      }

      setMessages((prev) => [...prev, aiMsg])
      if (data.corrections) setCorrections(data.corrections)
      if (data.nextHints) setNextHints(data.nextHints)

      /* — Mission progress: track how many goals user has likely completed — */
      if (scenario.goals) {
        const turnN = Math.floor(allMessages.length / 2)
        const progress = scenario.goals.map((_, i) => turnN > i)
        setMissionProgress(progress)
      }

      /* — Session completion (user decides when to end) — */
      if (data.isFinished) {
        setShowFinishSuggestion(true)
      } else {
        const turnCount = Math.floor((allMessages.length) / 2) + 1
        if (turnCount >= 8) {
          setShowFinishSuggestion(true)
        }
      }

      setIsSpeaking(true)
      speak(data.aiReply, () => setIsSpeaking(false))
    } catch (err) {
      console.error('Coach API call failed:', err)
      const errMsg = err instanceof Error ? err.message : 'Connection failed'
      const fallbackMsg: Message = {
        id: crypto.randomUUID(), role: 'ai', text: `I'm sorry, I'm having trouble connecting: ${errMsg}.`,
        translation: `抱歉，AI 连接出错：${errMsg}。`,
      }
      setMessages((prev) => [...prev, fallbackMsg])
    } finally {
      setIsLoading(false)
      isSendingRef.current = false
    }
  }, [sessionStarted, scenario, isLoading])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  /* ---- Track practiced tags on session end & refresh recommendations ---- */
  const prevCompleteRef = useRef(false)
  useEffect(() => {
    if (isSessionComplete && !prevCompleteRef.current && scenario) {
      const existingTags = [...practicedTags]
      const badgeMatch = scenario.badge.match(/[A-Za-z\s]+/)
      const tag = badgeMatch ? badgeMatch[0].trim() : scenario.title.toLowerCase().slice(0, 20)
      const updated = [tag, ...existingTags.filter((t) => t !== tag)].slice(0, 20)
      updatePracticedTags(updated)
      setRecsLoading(true)
      fetch('/api/scene/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practicedTags: updated }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.recommendations) setRecsWithCache(data.recommendations) })
        .catch(() => {})
        .finally(() => setRecsLoading(false))
    }
    prevCompleteRef.current = isSessionComplete
  }, [isSessionComplete, scenario, practicedTags, updatePracticedTags])
  const toggleHints = useCallback(() => {
    setShowHints((v) => !v)
  }, [])

  /* ---- Speech Recognition ---- */
  const toggleListening = useCallback(() => {
    if (isListening) {
      shouldSendOnEndRef.current = true
      recognitionRef.current?.stop()
      return
    }
    const API = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!API) { alert('Speech recognition requires Chrome or Edge.'); return }
    const recognition = new API()
    recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        event.results[i].isFinal ? (final += t) : (interim += t)
      }
      setInputText(final + interim)
    }
    recognition.onend = () => {
      setIsListening(false)
      if (shouldSendOnEndRef.current) {
        shouldSendOnEndRef.current = false
        const text = inputTextRef.current.trim()
        if (text) sendMessageRef.current(text)
      }
    }
    recognition.onerror = () => {
      setIsListening(false)
      shouldSendOnEndRef.current = false
    }
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); window.speechSynthesis.cancel() }
  }, [])

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    if (!sessionStarted) return
    if (isListening) {
      shouldSendOnEndRef.current = true
      recognitionRef.current?.stop()
      return
    }
    sendMessage(inputText)
    setShowEmojiPicker(false)
  }, [isListening, sessionStarted, inputText, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }, [handleSubmit])

/* ---- Theme-based gradient + decorative pattern ---- */
interface ThemeStyle {
  gradient: string
  accent: string
  dotColor: string
  emoji: string
  circles: { bg: string; size: string; top?: string; left?: string; right?: string; bottom?: string }[]
}

const THEME_STYLES: [RegExp, ThemeStyle][] = [
  [/engine|mechanical|racecar|spindle|bearing|formula student/i, {
    gradient: 'linear-gradient(145deg, #E8D5C0, #D4B89A, #C4A68A)',
    accent: '#C48050', dotColor: 'rgba(196,128,80,0.10)',
    emoji: '🔧',
    circles: [
      { bg: 'rgba(196,128,80,0.10)', size: '300px', top: '-80px', left: '-80px' },
      { bg: 'rgba(196,128,80,0.06)', size: '200px', bottom: '-40px', right: '-40px' },
    ],
  }],
  [/ai |artificial intelligence|agent|hallucination|pipeline|discord|hacker|startup/i, {
    gradient: 'linear-gradient(145deg, #D0D8F0, #B8C4EA, #A0B0E0)',
    accent: '#5A7AD8', dotColor: 'rgba(90,122,216,0.08)',
    emoji: '🤖',
    circles: [
      { bg: 'rgba(90,122,216,0.08)', size: '300px', top: '-60px', right: '-60px' },
      { bg: 'rgba(90,122,216,0.05)', size: '220px', bottom: '-50px', left: '-30px' },
    ],
  }],
  [/vehicle|autonomous|lidar|radar|self.?driving|car|sensor|competition/i, {
    gradient: 'linear-gradient(145deg, #C4D4E8, #A8C0D8, #8EAEC8)',
    accent: '#4A90C8', dotColor: 'rgba(74,144,200,0.08)',
    emoji: '🚗',
    circles: [
      { bg: 'rgba(74,144,200,0.08)', size: '280px', top: '-40px', left: '-40px' },
      { bg: 'rgba(74,144,200,0.05)', size: '200px', bottom: '-30px', right: '-30px' },
    ],
  }],
  [/bar|friends|tv drama|american|banter|friday night|cozy/i, {
    gradient: 'linear-gradient(145deg, #F0E0C8, #E4CEB0, #D8BC9A)',
    accent: '#D4A050', dotColor: 'rgba(212,160,80,0.10)',
    emoji: '🍸',
    circles: [
      { bg: 'rgba(212,160,80,0.10)', size: '300px', top: '-70px', right: '-50px' },
      { bg: 'rgba(212,160,80,0.06)', size: '180px', bottom: '-20px', left: '-20px' },
    ],
  }],
  [/restaurant|dining|steak|waiter|parisian|fine.?dining|order|kitchen|cooking|food|survival/i, {
    gradient: 'linear-gradient(145deg, #F0D0C8, #E4BEB4, #D8ACA0)',
    accent: '#C88060', dotColor: 'rgba(200,128,96,0.10)',
    emoji: '🍽️',
    circles: [
      { bg: 'rgba(200,128,96,0.10)', size: '280px', top: '-50px', left: '-60px' },
      { bg: 'rgba(200,128,96,0.06)', size: '220px', bottom: '-40px', right: '-40px' },
    ],
  }],
  [/medical|hospital|emergency|doctor|nurse|patient|clinic|health/i, {
    gradient: 'linear-gradient(145deg, #C0E0D8, #A8D0C8, #90C0B8)',
    accent: '#48A898', dotColor: 'rgba(72,168,152,0.08)',
    emoji: '🏥',
    circles: [
      { bg: 'rgba(72,168,152,0.08)', size: '260px', top: '-40px', right: '-30px' },
      { bg: 'rgba(72,168,152,0.05)', size: '200px', bottom: '-20px', left: '-20px' },
    ],
  }],
  [/travel|hotel|airport|flight|booking|vacation|tourist|h.tel/i, {
    gradient: 'linear-gradient(145deg, #E8DCC8, #D8CAB0, #C8B89A)',
    accent: '#C89460', dotColor: 'rgba(200,148,96,0.10)',
    emoji: '✈️',
    circles: [
      { bg: 'rgba(200,148,96,0.10)', size: '300px', top: '-60px', left: '-50px' },
      { bg: 'rgba(200,148,96,0.06)', size: '200px', bottom: '-30px', right: '-30px' },
    ],
  }],
  [/meeting|office|business|presentation|negotiation|interview|conference/i, {
    gradient: 'linear-gradient(145deg, #E0D8D0, #D0C8C0, #C0B8B0)',
    accent: '#9A8A6A', dotColor: 'rgba(154,138,106,0.08)',
    emoji: '💼',
    circles: [
      { bg: 'rgba(154,138,106,0.08)', size: '280px', top: '-40px', right: '-40px' },
      { bg: 'rgba(154,138,106,0.05)', size: '200px', bottom: '-30px', left: '-20px' },
    ],
  }],
  [/shopping|mall|store|market|buy|price|refund|exchange/i, {
    gradient: 'linear-gradient(145deg, #F0D8E0, #E4C6D0, #D8B4C0)',
    accent: '#C87890', dotColor: 'rgba(200,120,144,0.10)',
    emoji: '🛍️',
    circles: [
      { bg: 'rgba(200,120,144,0.10)', size: '260px', top: '-30px', left: '-40px' },
      { bg: 'rgba(200,120,144,0.06)', size: '220px', bottom: '-40px', right: '-30px' },
    ],
  }],
  [/school|class|lesson|teacher|student|exam|test|classroom|university|college|study/i, {
    gradient: 'linear-gradient(145deg, #D0E0C8, #B8D0B0, #A0C098)',
    accent: '#6A9A5A', dotColor: 'rgba(106,154,90,0.08)',
    emoji: '📚',
    circles: [
      { bg: 'rgba(106,154,90,0.08)', size: '280px', top: '-50px', right: '-50px' },
      { bg: 'rgba(106,154,90,0.05)', size: '200px', bottom: '-20px', left: '-20px' },
    ],
  }],
]

const DEFAULT_STYLE: ThemeStyle = {
  gradient: 'linear-gradient(145deg, #E0D8D0, #D0C8C0, #C0B8B0)',
  accent: '#B0A090', dotColor: 'rgba(176,160,144,0.08)',
  emoji: '✨',
  circles: [
    { bg: 'rgba(176,160,144,0.08)', size: '260px', top: '-40px', right: '-40px' },
    { bg: 'rgba(176,160,144,0.05)', size: '200px', bottom: '-30px', left: '-20px' },
  ],
}

function pickThemeStyle(scenario: ScenarioSeed): ThemeStyle {
  const haystack = `${scenario.badge} ${scenario.title} ${scenario.setting}`
  for (const [pattern, style] of THEME_STYLES) {
    if (pattern.test(haystack)) return style
  }
  return DEFAULT_STYLE
}

/* ---- Display helpers ---- */
  const themeStyle = scenario ? pickThemeStyle(scenario) : DEFAULT_STYLE
  const displayBadge = scenario ? (showChinese ? scenario.badgeZh : scenario.badge) : ''
  const displayTitle = scenario ? (showChinese ? scenario.titleZh : scenario.title) : ''
  const displayDesc = scenario ? (showChinese ? scenario.descriptionZh : scenario.description) : ''

  /* ---- Hydration guard ---- */
  if (scenario === null) {
    return <div className="bg-[#f6f4ef] h-screen w-screen" />
  }

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="bg-[#f6f4ef] h-screen w-screen overflow-hidden text-stone-900 flex flex-col relative">

      {sessionStarted && (
        <div className="pointer-events-none fixed inset-0 z-0"
          style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(200,180,160,0.13), transparent)' }} />
      )}

      <div className="relative z-10 flex flex-col h-full">

        {/* ====== Top Navigation ====== */}
        <header className="shrink-0 w-full px-6 md:px-10 pt-5 pb-3">
          <div className="mx-auto w-full grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex justify-start">
              <button onClick={() => {
                if (sessionStarted) {
                  setSessionStarted(false); setMessages([]); setCorrections(null); setShowChinese(false); setShowHints(false);
                  setNextHints({ pillars: [], vocabulary: [] }); setMissionProgress([false, false, false]);
                  setIsLoading(false); setIsSessionComplete(false); setShowFinishSuggestion(false); setShowOverlay(false); window.speechSynthesis.cancel()
                } else {
                  router.push('/')
                }
              }}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 hover:bg-stone-200/80 hover:scale-105 active:scale-[0.95]"
                style={{ backgroundColor: '#F0F0F0', color: '#757575' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </button>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-widest uppercase text-center">AI Coach</h1>
            <div className="flex justify-end items-center gap-3">
              {isSpeaking && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Speaking
                </span>
              )}
              {sessionStarted && (
                <button onClick={() => {
                  if (!scenario || isGenerating) return
                  setSessionStarted(false); setMessages([]); setCorrections(null); setShowChinese(false); setShowHints(false);
                  setNextHints({ pillars: [], vocabulary: [] }); setMissionProgress([false, false, false]);
                  setIsLoading(false); setIsSessionComplete(false); setShowFinishSuggestion(false); setShowOverlay(false); window.speechSynthesis.cancel()
                  generateScenario(`similar to "${scenario.title}" (${scenario.badge}), same theme and difficulty`)
                }}
                  className="rounded-full px-5 py-2 text-sm font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_28px_-8px_rgba(38,38,38,0.4)] active:scale-[0.95] shadow-md"
                  style={{ backgroundColor: '#262626' }}>
                  Similar Session →
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ====== Scene Banner (during session) ====== */}
        {sessionStarted && (
          <div className="coach-banner shrink-0 w-full px-6 md:px-10 pb-2">
            <div className="mx-auto max-w-6xl w-full flex items-center gap-3">
              <span className="rounded-full px-3 py-1 text-[11px] font-bold tracking-wide"
                style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
                {scenario.badge}
              </span>
              <span className="text-[13px] font-medium" style={{ color: '#888888' }}>{scenario.title}</span>
            </div>
          </div>
        )}

        {/* ====== Main Content ====== */}
        {!sessionStarted ? (
          /* -------- HERO -------- */
          <div key={heroKey} className="flex-1 flex min-h-0 pb-10">
            <div className="w-full max-w-6xl mx-auto px-8 md:px-16 flex-1 flex flex-col justify-center">

              {/* ---- AI Scene Search Bar ---- */}
              <div className="coach-search mb-8 flex items-center gap-3">
                <div className="relative flex-1 flex items-center bg-white/80 backdrop-blur-sm rounded-xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-stone-200/50 transition-all duration-300 hover:border-stone-300/60 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] focus-within:border-stone-300/70 focus-within:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)]">
                  <input
                    value={searchPrompt}
                    onChange={(e) => setSearchPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (searchPrompt.trim()) generateScenario(searchPrompt) } }}
                    placeholder='Describe any scenario... 描述你想练习的场景 (e.g. "地铁退票" / "hotel noise complaint")'
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-stone-700 placeholder:text-stone-400 outline-none min-w-0"
                    disabled={isGenerating}
                  />
                  <button
                    onClick={() => { if (searchPrompt.trim()) generateScenario(searchPrompt) }}
                    disabled={!searchPrompt.trim() || isGenerating}
                    className="shrink-0 mr-1.5 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 disabled:text-stone-300 disabled:bg-transparent bg-slate-900 text-white hover:bg-slate-800 hover:scale-105 hover:shadow-lg active:scale-[0.95] disabled:hover:scale-100 disabled:hover:shadow-none"
                  >
                    {isGenerating ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      'Generate ✦'
                    )}
                  </button>
                </div>
                <button
                  onClick={() => generateScenario('surprise me')}
                  disabled={isGenerating}
                  className="group shrink-0 bg-stone-200/70 hover:bg-stone-300/70 text-stone-600 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5 hover:scale-105 hover:shadow-md"
                >
                  <span className="inline-block transition-all duration-500 group-hover:rotate-[360deg] group-hover:scale-125">🎲</span>
                  <span className="hidden sm:inline transition-all duration-300 group-hover:tracking-widest group-hover:text-stone-800">Surprise Me</span>
                </button>
              </div>

              {/* ---- Error toast ---- */}
              {generateError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50/80 border border-rose-200/40 px-4 py-2.5 text-xs text-rose-600">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{generateError}</span>
                  <button onClick={() => setGenerateError('')} className="ml-auto text-rose-400 hover:text-rose-600">✕</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center w-full">
                <div className="flex flex-col items-start">
                  <span className="coach-badge inline-block w-fit rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-500">{displayBadge}</span>
                  <h2 className="coach-title text-3xl md:text-4xl font-black text-slate-950 tracking-tight mt-4">{displayTitle}</h2>
                  <p className="coach-desc text-xl text-slate-700 leading-relaxed tracking-wide max-w-lg mt-6">{displayDesc}</p>
                  <button onClick={() => setShowChinese((v) => !v)}
                    className="coach-cta inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-200/60 hover:bg-stone-200 text-xs text-stone-600 transition-all duration-200 cursor-pointer mt-4 hover:scale-105 active:scale-95">
                    <TranslateIcon />
                    <span>{showChinese ? 'English' : '中文'}</span>
                    <span className="text-stone-300 ml-0.5">🌐</span>
                  </button>
                  <div className="flex items-center gap-4 mt-8">
                    <button onClick={startScenario}
                      className="coach-cta whitespace-nowrap flex items-center justify-center bg-slate-950 text-white rounded-xl px-6 py-3 font-bold tracking-wide shadow-lg transition-all duration-300 hover:bg-slate-800 hover:scale-105 hover:shadow-[0_12px_36px_-8px_rgba(30,30,50,0.35)] active:scale-[0.95] active:shadow-md">
                      Start Immersive Training ⚡
                    </button>
                  </div>
                </div>
                <div style={{ boxShadow: '0 20px 50px rgba(68,64,60,0.18)' }} className="coach-image relative w-full h-[55vh] rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_28px_64px_-16px_rgba(68,64,60,0.25)]">
                  <div className="absolute inset-0" style={{ background: themeStyle.gradient }}>
                    {/* Decorative blurred circles */}
                    {themeStyle.circles.map((c, i) => (
                      <div key={i} className="absolute rounded-full blur-3xl"
                        style={{ background: c.bg, width: c.size, height: c.size, top: c.top, left: c.left, right: c.right, bottom: c.bottom }}
                      />
                    ))}
                    {/* Dot pattern overlay */}
                    <div className="absolute inset-0 opacity-40"
                      style={{ backgroundImage: `radial-gradient(circle, ${themeStyle.dotColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
                    />
                    {/* Accent glow line */}
                    <div className="absolute left-8 right-8 top-10 h-px rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${themeStyle.accent}, transparent)`, opacity: 0.4 }} />
                    <div className="absolute left-8 right-8 bottom-10 h-px rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${themeStyle.accent}, transparent)`, opacity: 0.2 }} />
                    {/* Emoji centerpiece */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="opacity-70 select-none transition-all duration-500 hover:scale-110 hover:opacity-90" style={{ fontSize: 'clamp(7rem, 16vw, 12rem)', filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.4))' }}>
                        {themeStyle.emoji}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---- Recommended For You ---- */}
              <div className="mt-10" style={{ minHeight: recsLoading || recommendations.length === 0 ? '72px' : 'auto' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Recommended For You</span>
                  <span className="text-[10px] text-stone-300">✨</span>
                  <span className="text-[10px] text-stone-400">(基于你的练习记录智能推荐)</span>
                </div>
                <div className="transition-all duration-700 ease-out" style={{ opacity: recsLoading ? 0.3 : 1, transform: recsLoading ? 'translateY(4px)' : 'translateY(0)' }}>
                {recsLoading ? (
                  <div className="flex gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 w-48 rounded-xl bg-stone-100/60 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                ) : recommendations.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {recommendations.map((rec, i) => (
                      <button
                        key={i}
                        onClick={() => { if (!isGenerating) generateScenario(rec.prompt) }}
                        disabled={isGenerating}
                        className="group flex items-center gap-2.5 rounded-xl border border-stone-200/50 bg-white/60 backdrop-blur-sm px-4 py-2.5 text-sm shadow-[0_2px_8px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-white/90 hover:border-stone-300/70 hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.15)] active:scale-[0.97] disabled:opacity-50 hover:-translate-y-0.5"
                        style={{ animation: `recIn 0.6s cubic-bezier(0.21, 0.89, 0.32, 1) ${i * 0.1}s both` }}
                      >
                        <span className="text-base">{rec.badge.match(/^\S+/)?.[0] || '🎯'}</span>
                        <div className="text-left">
                          <p className="text-xs font-medium text-stone-700">{rec.title}</p>
                          <p className="text-[10px] text-stone-400">{rec.badgeZh}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
                </div>
              </div>

              {/* ---- Generation Overlay ---- */}
              {isGenerating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-stone-200/60 px-10 py-8 text-center max-w-sm mx-4">
                    <div className="relative mx-auto mb-5 h-16 w-16">
                      <div className="absolute inset-0 rounded-full border-2 border-stone-200" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-slate-900 animate-spin" style={{ animationDuration: '1s' }} />
                      <div className="absolute inset-2 rounded-full bg-stone-100 flex items-center justify-center text-xl">✨</div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Crafting Your Scenario</h3>
                    <p className="text-sm text-stone-500 leading-relaxed">DeepSeek is generating a custom immersive scenario based on your request...</p>
                    <div className="mt-5 flex justify-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* -------- SESSION ACTIVE (70/30 layout) -------- */
          <>
            <div className="flex-1 flex min-h-0 px-6 md:px-10 pb-4">
              <div className="mx-auto max-w-6xl w-full flex gap-6 min-h-0">

                {/* ========== LEFT: Chat (70%) ========== */}
                <div className="flex-[6.5] flex flex-col min-w-0">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin"
                    style={{
                      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(230,215,200,0.08), transparent 70%)',
                    }}
                  >
                    {messages.map((msg) => (
                      <div key={msg.id} className="animate-in">
                        {msg.role === 'ai' ? (
                          /* ---- AI Bubble: light left ---- */
                          <div className="flex items-start gap-3">
                            <img
                              src="/nailong/nailong.webp"
                              alt="Nai"
                              className="shrink-0 mt-1 w-9 h-9 rounded-full object-cover"
                              style={{ backgroundColor: '#F5F3F0' }}
                            />
                            <div className="max-w-prose">
                              <p className="text-lg leading-relaxed text-stone-800 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-xs"
                                style={{
                                  backgroundColor: '#F5F3F0',
                                  borderLeft: '3px solid rgba(0,0,0,0.06)',
                                }}>
                                {msg.text}
                              </p>
                              {msg.translation && translatedIds.has(msg.id) && (
                                <p className="text-sm text-stone-500 bg-stone-50/80 rounded-xl px-4 py-2 mt-1.5 ml-1">
                                  {msg.translation}
                                </p>
                              )}
                              {msg.translation && (
                                <button onClick={() => toggleTranslate(msg.id)}
                                  className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors mt-1.5 ml-1"
                                >
                                  <TranslateIcon />
                                  <span>{translatedIds.has(msg.id) ? 'Hide' : 'Translate'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* ---- User Bubble: dark right ---- */
                          <div className="flex items-start justify-end gap-3">
                            <div className="max-w-prose">
                              <p className="text-base leading-relaxed text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-xs"
                                style={{ backgroundColor: '#2F2F2F' }}>
                                {msg.text}
                              </p>
                            </div>
                            <img
                              src="/nailong/OIP-C.webp"
                              alt="You"
                              className="shrink-0 mt-1 w-11 h-11 rounded-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* ========== RIGHT: Panel (30%) ========== */}
                <div className="flex-[3.5] shrink-0 hidden md:block">
                  <div className="sticky top-0 rounded-3xl border border-stone-200/60 bg-white/70 backdrop-blur-xl p-5 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)] max-h-full overflow-y-auto">

                    {/* 🏆 Mission Goals */}
                    {scenario.goals && (
                      <div className="coach-panel-item mb-4 pb-3 border-b border-stone-200/40">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400 flex items-center gap-1.5">
                          <span>🏆</span> Mission Goals
                        </p>
                        <div className="space-y-1.5">
                          {scenario.goals.map((goal, i) => {
                            const done = missionProgress[i] || isSessionComplete
                            return (
                              <div key={i} className={`flex items-start gap-2 text-xs ${done ? 'text-emerald-600' : 'text-stone-400'}`}>
                                <span className={`shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-300'}`}>
                                  {done ? '✓' : `${i + 1}`}
                                </span>
                                <span className={done ? 'line-through decoration-emerald-300/50' : ''}>
                                  {showChinese ? goal.textZh : goal.text}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 📝 CORRECTIONS & SUGGESTIONS */}
                    <div className="coach-panel-item mb-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                        {corrections ? 'Corrections & Suggestions' : 'Feedback'}
                      </p>

                      {!corrections ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <div className="mb-2 rounded-full bg-stone-100 p-3">
                            <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-xs text-stone-400 leading-relaxed">Start speaking to receive instant feedback.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Original → Optimized */}
                          {corrections.optimized && (
                            <div className="rounded-xl bg-stone-50/80 border border-stone-200/40 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">You said</p>
                              <p className="text-sm text-stone-600 line-through decoration-rose-300/70 mb-2">{corrections.original}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Optimized</p>
                              <p className="text-sm font-medium text-stone-800">{corrections.optimized}</p>
                            </div>
                          )}

                          {/* Audit Details */}
                          {corrections.auditDetails.length > 0 && (
                            <div className="space-y-2">
                              {corrections.auditDetails.map((item, i) => (
                                <div key={i} className="rounded-xl bg-rose-50/60 border border-rose-200/40 p-3">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${item.type === 'Typo' ? 'bg-rose-200 text-rose-700' : 'bg-amber-200 text-amber-700'}`}>
                                      {item.type}
                                    </span>
                                  </div>
                                  <p className="text-xs">
                                    <span className="text-rose-500 line-through">{item.wrong}</span>
                                    <span className="text-stone-300 mx-1">→</span>
                                    <span className="text-emerald-600 font-medium">{item.correct}</span>
                                  </p>
                                  <p className="text-[11px] text-stone-500 mt-1">{item.why}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Native Upgrade */}
                          {corrections.nativeUpgrade && (
                            <div className="rounded-xl bg-indigo-50/60 border border-indigo-200/40 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 mb-1">✦ Native Upgrade</p>
                              <p className="text-sm font-medium text-stone-800">{corrections.nativeUpgrade.expression}</p>
                              <p className="text-[11px] text-stone-500 mt-1">{corrections.nativeUpgrade.why}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 💡 Hints */}
                    <div>
                      <button onClick={toggleHints} type="button"
                        className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors px-2 py-1 rounded-lg hover:bg-stone-100/60 cursor-pointer w-full">
                        <span>💡 Reply Hints</span>
                        <span className="text-stone-300">(不会接话？点我)</span>
                        <svg className={`h-3 w-3 ml-auto transition-transform ${showHints ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      {showHints && (
                        <div className="mt-2 rounded-2xl bg-white/80 border border-stone-200/50 shadow-sm p-3 animate-fade-in">
                          {nextHints.pillars.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mb-2">Conversation Pillars</p>
                              <p className="text-[10px] text-stone-300 mb-1.5">(完整长句 · 可直接照读救场)</p>
                              <div className="space-y-1">
                                {nextHints.pillars.map((s, i) => (
                                  <div key={i} onClick={() => { setInputText(s); setShowHints(false); setTimeout(() => inputRef.current?.focus(), 100) }}
                                    className="text-xs text-stone-700 bg-white border border-stone-200/60 rounded-lg px-3 py-2 hover:bg-amber-50/50 hover:border-amber-200/40 transition-colors cursor-pointer">
                                    💬 {s}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {nextHints.vocabulary.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mb-2">Power Vocabulary</p>
                              <p className="text-[10px] text-stone-300 mb-1.5">(地道短语弹药库 · 自由组句)</p>
                              <div className="flex flex-wrap gap-1.5">
                                {nextHints.vocabulary.map((phrase, j) => (
                                  <span key={j} onClick={() => { setInputText(phrase); setShowHints(false); setTimeout(() => inputRef.current?.focus(), 100) }}
                                    className="text-xs text-stone-700 bg-amber-50/60 border border-amber-200/30 rounded-lg px-3 py-1.5 hover:bg-amber-100/50 transition-colors inline-flex items-center gap-1 cursor-pointer">
                                    <span>⚡</span> {phrase}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {nextHints.pillars.length === 0 && nextHints.vocabulary.length === 0 && (
                            <p className="text-xs text-stone-400">Start the conversation to receive live hints from AI.</p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* ========== Input Footer ========== */}
            <footer className="shrink-0 w-full px-6 md:px-10 pb-6 pt-2">
              <div className="mx-auto max-w-2xl">
                {/* View Results button — right aligned */}
                {isSessionComplete && !showOverlay && (
                  <div className="mb-3 flex justify-end">
                    <button onClick={() => setShowOverlay(true)}
                      className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-300 hover:bg-slate-800 hover:scale-105 hover:shadow-[0_8px_24px_-8px_rgba(30,30,50,0.3)] active:scale-[0.95] shadow-lg animate-pulse">
                      View Results → 查看结算
                    </button>
                  </div>
                )}

                {/* Finish suggestion — user can keep chatting or end */}
                {showFinishSuggestion && !isSessionComplete && (
                  <div className="mb-3 flex items-center justify-between rounded-xl px-4 py-2.5"
                    style={{ backgroundColor: '#F8F6F4' }}>
                    <p className="text-xs" style={{ color: '#888888' }}>
                      Scenario goals met — keep chatting or end the session
                    </p>
                    <button onClick={() => setIsSessionComplete(true)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
                      style={{ backgroundColor: '#262626' }}>
                      End Session
                    </button>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-10 rounded-2xl border bg-white/95 backdrop-blur-xl p-3 shadow-xl"
                      style={{ borderColor: 'rgba(0,0,0,0.06)', maxWidth: '320px' }}>
                      <div className="flex flex-wrap gap-1">
                        {['😊','😂','🥹','😅','🤣','😏','😤','😡','😢','😭','🤔','😳','🙄','😴','🥱','😎','🤩','🥳','😰','😱','🤗','😈','🤡','💀','👍','👎','👊','✌️','🤝','🫶','💪','🙏','🎉','🔥','✨','💯','❤️','💔','👏','🙌','😆','😋','🤭','😌','😇','🥺','😒','😜','🤪','😝','🤑','🤠','😺','🙈','💩','⭐','🌈','🎯','🎊','🎁','🎈','🚀','💡','📌','💎','🃏','♠️','♥️','♣️','♦️','🔄','✔️','❌','⭕','🛑','💬','🗣️','👀','🫣'].map((emoji) => (
                          <button key={emoji} type="button" onClick={() => { setInputText((t) => t + emoji); inputRef.current?.focus() }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-lg hover:bg-stone-100 transition-colors">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="relative flex-1 flex items-center bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 shadow-slate-900/5 transition-all duration-300 hover:border-stone-300/60 hover:shadow-[0_6px_28px_-10px_rgba(0,0,0,0.15)] focus-within:border-stone-300/70 focus-within:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.18)]">
                    <button type="button" onClick={toggleListening}
                      className={`shrink-0 ml-3 p-2 rounded-xl transition-all duration-200 ${isListening ? 'bg-rose-100 text-rose-600 animate-pulse shadow-sm' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100/60'}`}
                      title={isListening ? 'Stop recording' : 'Start voice input'}>
                      <MicIcon active={isListening} />
                    </button>
                    <button type="button" onClick={() => setShowEmojiPicker((v) => !v)}
                      className="shrink-0 p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100/60 transition-all"
                      title="Emoji">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                      </svg>
                    </button>
                    <input ref={inputRef} type="text" value={inputText}
                      onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder={isListening ? 'Listening...' : 'Type a message or click mic to speak...'}
                      className="flex-1 bg-transparent px-3 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none min-w-0"
                      disabled={isListening || isSessionComplete} />
                    <button type="submit" disabled={!inputText.trim() || isListening || isSessionComplete}
                      className={`shrink-0 mr-2 rounded-xl p-2.5 transition-all duration-200 ${inputText.trim() && !isListening ? 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-110 active:scale-95 shadow-sm' : 'bg-stone-100 text-stone-300'}`}>
                      <SendIcon />
                    </button>
                  </div>
                </form>
              </div>
            </footer>

            {/* ———— Scenario Clear Overlay ———— */}
            {showOverlay && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[2px] animate-fade-in">
                <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-stone-200/60 p-8 max-w-md w-full mx-4 text-center animate-in">
                  <div className="text-4xl mb-3">🎬</div>
                  <h2 className="text-2xl font-black text-slate-900">Scenario Clear!</h2>
                  <p className="text-sm text-stone-500 mt-2 mb-6">You&apos;ve completed this conversation practice.</p>

                  {/* Mission Goals Summary */}
                  {scenario.goals && (
                    <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/30 p-4 mb-4 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400 mb-2">🏆 Mission Goals</p>
                      {scenario.goals.map((goal, i) => (
                        <p key={i} className="text-xs text-stone-600 mb-1 last:mb-0">
                          <span className={missionProgress[i] ? 'text-emerald-600' : 'text-stone-400'}>
                            {missionProgress[i] ? '✓' : '○'} {goal.text}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Corrections Summary */}
                  {corrections && corrections.auditDetails.length > 0 && (
                    <div className="bg-amber-50/60 rounded-2xl border border-amber-200/30 p-4 mb-6 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400 mb-3">Corrections Summary</p>
                      {corrections.auditDetails.map((item, i) => (
                        <div key={i} className="mb-2 last:mb-0 text-xs">
                          <span className="text-rose-500 line-through">{item.wrong}</span>
                          <span className="text-stone-300 mx-1">→</span>
                          <span className="text-emerald-600 font-medium">{item.correct}</span>
                          <span className="text-stone-400 ml-1">({item.why})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button onClick={() => {
                      setSessionStarted(false); setMessages([]); setCorrections(null); setShowChinese(false);
                      setShowHints(false); setNextHints({ pillars: [], vocabulary: [] });
                      setMissionProgress([false, false, false]); setIsLoading(false);
                      setIsSessionComplete(false); setShowFinishSuggestion(false); setShowOverlay(false); window.speechSynthesis.cancel()
                    }}
                      className="w-full bg-slate-900 text-white rounded-xl px-5 py-3 font-bold tracking-wide hover:bg-slate-800 transition-all active:scale-[0.97]">
                      Try Another Scenario 🎲
                    </button>
                    <button onClick={() => {
                      setSessionStarted(false); setMessages([]); setCorrections(null); setShowChinese(false);
                      setShowHints(false); setNextHints({ pillars: [], vocabulary: [] });
                      setMissionProgress([false, false, false]); setIsLoading(false);
                      setIsSessionComplete(false); setShowFinishSuggestion(false); setShowOverlay(false); window.speechSynthesis.cancel()
                      setScenario(SEED_SCENARIOS[Math.floor(Math.random() * SEED_SCENARIOS.length)])
                    }}
                      className="w-full bg-stone-100 text-stone-600 rounded-xl px-5 py-3 font-medium hover:bg-stone-200 transition-all active:scale-[0.97]">
                      Shuffle to Next → 换一个 🎲
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .animate-in { animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .animate-hero { animation: heroIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes heroIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes recIn { 0% { opacity: 0; transform: translateY(16px) scale(0.95); } 60% { opacity: 1; transform: translateY(-2px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 99px; }
      `}</style>
    </div>
  )
}
