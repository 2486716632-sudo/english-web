import { NextRequest, NextResponse } from 'next/server'

/* ---- POST ---- */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, reference } = body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const refText = reference
      ? `\n\n## DOMAIN INHERITANCE (strict)
The user wants a NEW scenario that is DIFFERENT in plot but belongs to the SAME domain as their current scenario. Inherit these from the reference scenario below:
- badge / badgeZh — SAME emoji and category (e.g. 🎬 American TV Drama)
- Difficulty — SAME number of goals (3) and same initiate→negotiate→resolve trajectory
- aiRole / setting style — SAME general type of character and environment
- BUT the actual plot, description, conflict, aiFirstLine must be COMPLETELY DIFFERENT — never reuse the reference's story.

Reference scenario:
badge: "${reference.badge}"
title: "${reference.title}"
setting: "${reference.setting}"
aiRole: "${reference.aiRole}"
goals: ${JSON.stringify(reference.goals)}`
      : ''

    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
    }

    const systemPrompt = `You are a scenario generator for an English learning conversation practice app. Generate a complete, immersive English conversation scenario based on the user's request.

Output ONLY valid JSON with this exact structure:
{
  "id": "short-kebab-case-id",
  "badge": "emoji Category Name in English",
  "badgeZh": "emoji 中文分类名",
  "title": "Scenario Title — Subtitle",
  "titleZh": "情景标题 — 副标题",
  "description": "2-3 sentence English description setting up the situation and conflict",
  "descriptionZh": "2-3 sentence Chinese translation of the description",
  "imageSeed": "same-as-id",
  "userRole": "English description of who the user plays",
  "aiRole": "English description of the AI character role",
  "setting": "English description of where/when this takes place",
  "aiFirstLine": "The AI character's opening dialogue line in natural English (2-3 sentences)",
  "aiFirstLineZh": "Chinese translation of the opening line",
  "aiFirstLineExpr": [
    { "phrase": "key English phrase from opening line", "explanation": "Chinese explanation why this phrase is useful" },
    { "phrase": "another key English phrase", "explanation": "Chinese explanation" }
  ],
  "goals": [
    { "text": "First progressive goal in English", "textZh": "中文翻译" },
    { "text": "Second progressive goal in English", "textZh": "中文翻译" },
    { "text": "Third progressive goal in English", "textZh": "中文翻译" }
  ]
}

RULES:
- 3 goals must follow trajectory: initiate → negotiate → resolve
- Description must include a clear conflict or challenge the user needs to navigate
- Setting should be specific and feel real-world
- aiFirstLine must sound like natural spoken English, 2-3 sentences
- badge/badgeZh should match the theme (🚇 Travel, 🍽️ Dining, 💼 Business, 🏥 Medical, 🎓 Academic, 🎬 Entertainment, 🛍️ Shopping, 🏨 Hotel, etc.)
- id and imageSeed use kebab-case, all lowercase
- User's request may be in English or Chinese — generate English scenario content regardless
- aiFirstLineExpr: highlight exactly 2 useful English phrases from the opening line with Chinese explanations of why they're valuable${refText}`

    const msgs = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt.trim() },
    ]

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let content = ''
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: msgs,
          max_tokens: 2048,
          temperature: 0.9,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
      const data = await res.json()
      content = data.choices?.[0]?.message?.content || ''
    } finally {
      clearTimeout(timeoutId)
    }

    if (!content) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 })
    }

    /* Extract JSON */
    const firstBrace = content.indexOf('{')
    const lastBrace = content.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return NextResponse.json({ error: 'Failed to parse scenario JSON' }, { status: 502 })
    }

    let scenario: Record<string, unknown>
    try {
      scenario = JSON.parse(content.slice(firstBrace, lastBrace + 1))
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 502 })
    }

    return NextResponse.json(scenario)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scene/generate] Error:', msg)
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 502 })
  }
}
