import { NextRequest, NextResponse } from 'next/server'

interface RecommendRequest {
  practicedTags?: string[]
  count?: number
  excludeTitles?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json()
    const practicedTags = body.practicedTags ?? []
    const count = body.count ?? 4
    const excludeTitles = body.excludeTitles ?? []

    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 })
    }

    const systemPrompt = `You are a smart scenario recommendation engine for an English learning app.

Output ONLY valid JSON with this structure:
{
  "recommendations": [
    {
      "badge": "emoji English category",
      "badgeZh": "emoji 中文分类",
      "title": "Short scenario title in English",
      "prompt": "A 1-2 sentence detailed prompt describing the scenario for generating later. Include setting, conflict, and roles."
    }
  ]
}

RULES — strict:
1. HIGH-FREQUENCY TRAINING: Survival basics (ordering food, asking directions, shopping, hotel check-in) MUST reappear in varied forms (steak → coffee order, street → subway directions) if the user hasn't practiced them recently. These are core seeds.
2. ANTI-BUBBLE DIVERSITY: If the user has practiced a tag recently, DEMOTE it. Prioritize untouched dimensions: housing rental, medical, complaint/refund, job interview, small talk, academic discussion, tech support.
3. WEAKNESS TARGETING: Each recommendation should cover a different life dimension — no two same-category scenarios in one response.
4. Generate exactly ${count} recommendations.
5. Titles should be short and catchy (under 50 chars).
6. Prompts should be specific enough for a scenario generator to produce a full scene.

User's practiced tags so far: ${practicedTags.length > 0 ? practicedTags.join(', ') : 'none — first visit'}
${practicedTags.length === 0 ? 'Start with 4 essential survival scenarios from different categories (e.g. dining, transportation, shopping).' : 'Ensure none of the recommended categories overlap with recently practiced tags. Prioritize uncovered areas.'}
${excludeTitles.length > 0 ? `DO NOT recommend these specific scenarios (already shown): ${excludeTitles.join('; ')}` : ''}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let content = ''
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Recommend ${count} scenarios for my next practice.` },
          ],
          max_tokens: 1024,
          temperature: 0.85,
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

    const firstBrace = content.indexOf('{')
    const lastBrace = content.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return NextResponse.json({ error: 'Failed to parse JSON' }, { status: 502 })
    }

    let result: { recommendations?: unknown }
    try {
      result = JSON.parse(content.slice(firstBrace, lastBrace + 1))
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 502 })
    }

    const recs = (Array.isArray(result.recommendations) ? result.recommendations : []).slice(0, count)
    return NextResponse.json({ recommendations: recs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[scene/recommend] Error:', msg)
    return NextResponse.json({ error: 'Internal server error', detail: msg }, { status: 502 })
  }
}
