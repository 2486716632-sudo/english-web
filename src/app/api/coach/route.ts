import { NextRequest, NextResponse } from 'next/server'

/* ---- Types ---- */
interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
}

interface ScenarioSeed {
  id: string
  badge: string
  title: string
  userRole: string
  aiRole: string
  setting: string
  aiFirstLine: string
  goals: { text: string; textZh: string }[]
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

interface Step2Response {
  translationZh: string
  nextHints: { pillars: string[]; vocabulary: string[] }
  corrections: CorrectionsData
  isFinished: boolean
}

interface CoachResponse {
  aiReply: string
  translationZh: string
  nextHints: { pillars: string[]; vocabulary: string[] }
  corrections: CorrectionsData
  isFinished: boolean
}

/* ---- POST ---- */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, scenario }: { messages: Message[]; scenario: ScenarioSeed } = body

    if (!messages || !scenario) {
      return NextResponse.json({ error: 'Missing messages or scenario' }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
    }

    const turnCount = Math.floor(messages.length / 2)

    async function callDeepSeek(
      msgs: { role: 'system' | 'user' | 'assistant'; content: string }[],
      useJsonFormat: boolean
    ): Promise<string> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const reqBody: Record<string, unknown> = {
          model: 'deepseek-chat',
          messages: msgs,
          max_tokens: 1024,
          temperature: 0.85,
        }
        if (useJsonFormat) reqBody.response_format = { type: 'json_object' }

        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(reqBody),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
        return (await res.json()).choices?.[0]?.message?.content || ''
      } finally {
        clearTimeout(timeoutId)
      }
    }

    /* ========== Step 1: Get AI reply ========== */
    const goalTexts = (scenario.goals || [])
      .map((g, i) => `${i + 1}. ${g.text}`)
      .join('\n')

    const replyMsgs: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `You are a waiter at an upscale Parisian restaurant.
Setting: ${scenario.setting}

## CRITICAL — Clean Dialogue Only
- You MUST respond with ONLY pure spoken dialogue.
- NEVER include asterisk actions, stage directions, or scene descriptions like *sighs*, *nods*, *smiles*, *pauses*, *looking concerned*.
- Only output words your character would actually speak out loud.

## Conversation Facilitator — Dynamic Mic Handover
- Every 1-2 turns you MUST end your line with a question, an opinion solicitation, or a natural prompt that hands the conversation back to the user. Do NOT let the user become a passive listener.
- Examples: "Have you had similar dining experiences in Europe?" / "What exactly would it take to make this evening right for you, sir?" / "How does that sound to you?"

## Dynamic Pacing — No Formulaic Length
- DO NOT write the same length every turn. Vary it naturally.
- When the situation is casual, agreeable, or routine: keep responses SHORT (1-2 sentences, crisp and realistic).
- When the user shares a long story or the conflict escalates: only then allow longer, deeper responses (3-4 sentences).
- Match the emotional intensity of the moment. Create breathing room — short friendly exchanges AND intense negotiation are both valuable practice.

## Rules
- React directly to the user's last message.
- Never speak for the user.
- Use emojis frequently — at least one per reply, matching the mood. 😅 awkward moments, 🎉 good news, 😏 banter, 🤔 thoughtful, 😤 frustrated, 💪 encouraging. Makes practice more lively.
- Mission goals you facilitate (don't force-rush):
${goalTexts}`,
      },
    ]
    for (const msg of messages.slice(-6)) {
      replyMsgs.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.text,
      })
    }

    const aiReply = (await callDeepSeek(replyMsgs, false)).trim()

    if (!aiReply) {
      return NextResponse.json({
        aiReply: 'Could you repeat that? I missed your last point.',
        translationZh: '',
        nextHints: { pillars: [], vocabulary: [] },
        corrections: { hasError: false, original: '', optimized: '', auditDetails: [], nativeUpgrade: null },
        isFinished: false,
      })
    }

    /* ========== Step 2: Translation + Corrections + Hints ========== */
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const goalsForPrompt = (scenario.goals || [])
      .map((g, i) => `${i + 1}. "${g.text}"`)
      .join('\n')

    const step2Msgs: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `You are an English learning assistant. Analyze the conversation and output ONLY valid JSON.

Mission goals for this scenario:
${goalsForPrompt}

## Output JSON structure — ALL fields required:
{
  "translationZh": "Chinese translation of the AI's reply only",
  "nextHints": {
    "pillars": ["complete English sentence user could say next", "another complete sentence"],
    "vocabulary": ["short native phrase 1", "collocation 2", "native chunk 3", "power word 4"]
  },
  "corrections": {
    "hasError": true/false,
    "original": "user's original sentence exactly as written",
    "optimized": "corrected version of user's sentence (fix typos, grammar, word choice)",
    "auditDetails": [
      {"type": "Typo or Grammar", "wrong": "misspelled word", "correct": "fixed word", "why": "中文原因"}
    ],
    "nativeUpgrade": {"expression": "more native alternative phrase", "why": "中文亮点解析"}
  },
  "isFinished": true/false
}

## Rules:
- "translationZh": translate ONLY the AI reply below, not the user message
- "pillars": exactly 2 full English sentences (SVO structure) the user could say next. Vary their length naturally — short and sharp in quick exchanges, longer when the topic has depth.
- "vocabulary": exactly 3-4 short native phrases or collocations (NOT full sentences). Match tone to context — casual everyday chunks for routine chat, more precise language for serious discussion.
- "corrections.auditDetails": list EVERY typo and grammar error in user's message. Empty array if none.
- "corrections.nativeUpgrade": even if grammar is correct, suggest a more natural-sounding alternative when applicable. null if none.
- "isFinished": true ONLY when conversation has naturally concluded (user signaled resolution with "thanks"/"goodbye"/"agreed" and the story arc has completed). Otherwise false.`,
      },
      {
        role: 'user',
        content: `AI reply: "${aiReply}"
User's last message: "${lastUserMsg?.text || ''}"
Turn ${turnCount + 1}. Conversation phase: ${turnCount <= 2 ? 'opening' : turnCount <= 4 ? 'middle' : 'closing'}`,
      },
    ]

    const rawStep2 = await callDeepSeek(step2Msgs, true)

    /* Parse Step 2 JSON */
    function safeJsonParse(raw: string): Record<string, unknown> | null {
      const firstBrace = raw.indexOf('{')
      const lastBrace = raw.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace <= firstBrace) return null
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1))
      } catch {
        return null
      }
    }

    const emptyCorrections: CorrectionsData = {
      hasError: false, original: '', optimized: '', auditDetails: [], nativeUpgrade: null,
    }

    let translationZh = ''
    let nextHints: { pillars: string[]; vocabulary: string[] } = { pillars: [], vocabulary: [] }
    let corrections: CorrectionsData = emptyCorrections
    let isFinished = false

    const step2Parsed = safeJsonParse(rawStep2)
    if (step2Parsed) {
      translationZh = (step2Parsed.translationZh as string) || ''
      const hints = step2Parsed.nextHints as { pillars?: string[]; vocabulary?: string[] } | undefined
      if (hints) {
        nextHints = {
          pillars: Array.isArray(hints.pillars) ? hints.pillars : [],
          vocabulary: Array.isArray(hints.vocabulary) ? hints.vocabulary : [],
        }
      }
      const corr = step2Parsed.corrections as Record<string, unknown> | undefined
      if (corr) {
        corrections = {
          hasError: corr.hasError === true,
          original: (corr.original as string) || '',
          optimized: (corr.optimized as string) || '',
          auditDetails: Array.isArray(corr.auditDetails)
            ? corr.auditDetails.map((a: Record<string, unknown>) => ({
                type: (a.type as string) || '',
                wrong: (a.wrong as string) || '',
                correct: (a.correct as string) || '',
                why: (a.why as string) || '',
              }))
            : [],
          nativeUpgrade: corr.nativeUpgrade
            ? {
                expression: ((corr.nativeUpgrade as Record<string, unknown>).expression as string) || '',
                why: ((corr.nativeUpgrade as Record<string, unknown>).why as string) || '',
              }
            : null,
        }
      }
      isFinished = step2Parsed.isFinished === true
    }

    const response: CoachResponse = {
      aiReply,
      translationZh,
      nextHints,
      corrections,
      isFinished,
    }

    return NextResponse.json(response)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[coach] Error:', msg)
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 502 })
  }
}
