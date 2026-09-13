// @version 1.0
// @last-reviewed 2026-09-12
// @layer Application — Prompt builder

import type { AIMessage } from '@/application/ports/ai-client'
import type { WordCard } from '@/application/ports/word-lookup'

/**
 * AI Assistant 问答 Prompt。
 *
 * 说明：Phase 3 为**行为保持不变**的迁移，因此这里的 Prompt 文本
 * 与迁移前 `src/app/api/assistant/route.ts` 中的内联 system prompt 逐字一致。
 * 后续如需调整文案，应作为独立变更记录（PROMPT-003 版本标记）。
 */

export interface AssistantQaTurn {
  role: string
  content: string
}

export interface AssistantQaPromptInput {
  turns?: AssistantQaTurn[]
  wordCard: WordCard | null
}

export interface AssistantQaPrompt {
  system: string
  messages: AIMessage[]
}

const BASE_SYSTEM_PROMPT = `You are an English learning assistant integrated into a vocabulary app. Your role is to help users learn English vocabulary, grammar, and expressions.

## How to respond based on user intent:

### 1. Word lookup (user types a word like "disorder" or "abide by")
   - Show: word, phonetic (in /slashes/), part of speech, Chinese definition
   - Include common collocations with Chinese translations
   - Provide 1-2 example sentences (EN + ZH)
   - Keep it structured and scannable
   - ⚠️ Phonetic note: Many English words have DIFFERENT pronunciations depending on part of speech (e.g. noun "record" /ˈrekɔːd/ vs verb "record" /rɪˈkɔːd/; noun "present" /ˈpreznt/ vs verb "present" /prɪˈzent/). The database phonetic may only show one form — check your knowledge and list both with their POS labels if applicable.

### 2. "How do I say X in English" / translation requests
   - Give the most natural English equivalent, not literal translation
   - Explain briefly why this expression works
   - Offer 1 example sentence

### 3. Grammar / usage questions
   - Explain clearly and concisely
   - Use examples to illustrate

### 4. General questions about English
   - Answer directly and helpfully

## Style guidelines:
- Be concise but thorough. Use line breaks for readability.
- For word lookups, start with the word itself, then phonetic, then definition.
- Use Chinese for explanations where helpful, but always show English examples.
- Do NOT use markdown formatting like **bold** or lists — use plain text with line breaks.`

/** 把词卡数据追加为 system prompt 的数据段（与迁移前实现一致）。 */
function appendWordCard(system: string, wordCard: WordCard): string {
  let out = system
  out += `\n\n## Word data found in database (use this as the primary source):\n`
  out += `Word: ${wordCard.word}\n`
  out += `Phonetic: ${wordCard.phonetic || 'N/A'}\n`
  out += `Part of speech: ${wordCard.partOfSpeech}\n`
  out += `Definition: ${wordCard.definition}\n`
  if (wordCard.collocations) out += `Collocations: ${wordCard.collocations}\n`
  if (wordCard.example) out += `Example: ${wordCard.example}\n`
  if (wordCard.exampleZh) out += `Example ZH: ${wordCard.exampleZh}\n`
  out += `\nPresent this information clearly. If the example contains " ||| " separators, treat each segment as a separate sentence.\n`
  out += `IMPORTANT: The database phonetic above may only cover one form. If this word has different pronunciations for different parts of speech (e.g. noun vs verb), explicitly list them in your response and note which POS each pronunciation belongs to.`
  return out
}

/** UI 使用 `role: 'ai'`，provider 使用 `assistant`。 */
function toAIMessage(turn: AssistantQaTurn): AIMessage {
  const role: AIMessage['role'] = turn.role === 'ai' ? 'assistant' : (turn.role as AIMessage['role'])
  return { role, content: turn.content }
}

export function buildAssistantQaPrompt(input: AssistantQaPromptInput): AssistantQaPrompt {
  const system = input.wordCard
    ? appendWordCard(BASE_SYSTEM_PROMPT, input.wordCard)
    : BASE_SYSTEM_PROMPT

  return {
    system,
    messages: (input.turns ?? []).map(toAIMessage),
  }
}
