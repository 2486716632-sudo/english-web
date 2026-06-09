'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface VocabItem {
  id: number
  word: string
  type: string
  partOfSpeech: string | null
  phonetic: string | null
  definition: string
  contextSentence: string
  example: string | null
  exampleZh: string | null
  addedToReview: boolean
}

interface ArticleData {
  id: number
  title: string
  source: string
  sourceEmoji: string
  imageUrl: string | null
  content: string
  summary: string
  summaryEn: string | null
  difficulty: number
  tags: string
  createdAt: string
  vocabItems: VocabItem[]
}

const TAG_VISUALS: Record<string, { gradient: string }> = {
  ai: { gradient: 'linear-gradient(135deg, #D0D8F0, #B8C4EA)' },
  tech: { gradient: 'linear-gradient(135deg, #D0D8F0, #B8C4EA)' },
  science: { gradient: 'linear-gradient(135deg, #C0E0D8, #A8D0C8)' },
  engineering: { gradient: 'linear-gradient(135deg, #E8D5C0, #D4B89A)' },
  environment: { gradient: 'linear-gradient(135deg, #C0E0D8, #A8D0C8)' },
  economics: { gradient: 'linear-gradient(135deg, #E0D8D0, #D0C8C0)' },
  history: { gradient: 'linear-gradient(135deg, #F0E0C8, #E4CEB0)' },
  society: { gradient: 'linear-gradient(135deg, #E0D8D0, #D0C8C0)' },
  health: { gradient: 'linear-gradient(135deg, #C0E0D8, #A8D0C8)' },
  business: { gradient: 'linear-gradient(135deg, #E0D8D0, #D0C8C0)' },
}

function getTagVisual(tags: string) {
  const tagList = tags.split(',').map((t) => t.trim().toLowerCase())
  for (const t of tagList) {
    if (TAG_VISUALS[t]) return TAG_VISUALS[t]
  }
  return { gradient: 'linear-gradient(135deg, #E8E4E0, #D8D4D0)' }
}

const TYPE_LABELS: Record<string, string> = {
  word: 'Word',
  phrase: 'Phrase',
  expression: 'Expression',
}

const TYPE_COLORS: Record<string, string> = {
  word: '#4A90D9',
  phrase: '#7B68AE',
  expression: '#C97B3A',
}

const POS_ABBR: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  interjection: 'interj.',
  article: 'art.',
  auxiliary: 'aux.',
  determiner: 'det.',
  numeral: 'num.',
  particle: 'part.',
}

function highlightText(text: string, vocabWords: string[]): (string | { word: string; index: number })[] {
  if (!vocabWords.length) return [text]
  const pattern = new RegExp(`\\b(${vocabWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const parts: (string | { word: string; index: number })[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(pattern.source, 'gi')
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const matchedWord = match[0].toLowerCase()
    const vocabIndex = vocabWords.findIndex((w) => w.toLowerCase() === matchedWord)
    parts.push({ word: match[0], index: vocabIndex >= 0 ? vocabIndex : 0 })
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export default function ReadingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set())

  const loadArticle = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/reading/${id}`)
      .then((r) => r.json())
      .then((data) => setArticle(data.article || null))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { loadArticle() }, [loadArticle])

  // Auto-mark as read once article loads
  useEffect(() => {
    if (article) {
      fetch(`/api/reading/${id}/read`, { method: 'POST' }).catch(() => {})
    }
  }, [article, id])

  const addVocab = async (vocabId: number) => {
    if (addingIds.has(vocabId)) return
    setAddingIds((prev) => new Set(prev).add(vocabId))
    try {
      const res = await fetch(`/api/reading/${id}/vocab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabId }),
      })
      if (!res.ok) return
      setArticle((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          vocabItems: prev.vocabItems.map((v) =>
            v.id === vocabId ? { ...v, addedToReview: true } : v
          ),
        }
      })
    } catch {}
    setAddingIds((prev) => { const n = new Set(prev); n.delete(vocabId); return n })
  }

  function sortByAppearance(items: VocabItem[], content: string): VocabItem[] {
    const positions = new Map<string, number>()
    for (const item of items) {
      const idx = content.toLowerCase().indexOf(item.word.toLowerCase())
      if (!positions.has(item.word.toLowerCase())) {
        positions.set(item.word.toLowerCase(), idx === -1 ? 9999 : idx)
      }
    }
    return [...items].sort((a, b) => {
      const pa = positions.get(a.word.toLowerCase()) ?? 9999
      const pb = positions.get(b.word.toLowerCase()) ?? 9999
      return pa - pb
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <p className="text-sm" style={{ color: '#BBBBBB' }}>Failed to load article.</p>
        <button onClick={loadArticle}
          className="mt-4 text-xs font-medium rounded-full px-4 py-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
          Retry
        </button>
        <button onClick={() => router.push('/reading')} className="mt-3 text-xs font-medium underline" style={{ color: '#888888' }}>
          ← Back to Reading
        </button>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <p className="text-sm" style={{ color: '#BBBBBB' }}>Article not found.</p>
        <button onClick={() => router.push('/reading')} className="mt-4 text-xs font-medium underline" style={{ color: '#888888' }}>
          ← Back to Reading
        </button>
      </div>
    )
  }

  const paragraphs = article.content.split('\n').filter(Boolean)
  const sortedVocab = sortByAppearance(article.vocabItems, article.content)
  const vocabWords = sortedVocab.map((v) => v.word)

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      {/* Hero image — full bleed to top */}
      {(() => {
        const visual = getTagVisual(article.tags)
        return (
          <div className="relative w-full h-[200px] lg:h-[320px] overflow-hidden shrink-0">
            {article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div className="h-full w-full" style={{ background: visual.gradient }} />
            )}
            {/* Back button — overlay top-left on hero */}
            <button onClick={() => router.push('/reading')}
              className="absolute top-4 left-4 md:top-6 md:left-6 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 z-20"
              style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#FFFFFF' }}>
              ← Back
            </button>
            {/* Gradient fade to background color */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #F8F6F4 0%, transparent 100%)' }} />
          </div>
        )
      })()}

      {/* Article left + sidebar right — centered container, wider content area */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-6xl mx-auto px-6 md:px-10 -mt-16 lg:-mt-24 gap-10 relative z-10">
        {/* Article content — left side, flex fills remaining space */}
        <div className="flex-1 min-w-0">
          <article>
            {/* Date only */}
            <div className="mb-2">
              <span className="text-xs" style={{ color: '#BBBBBB' }}>
                {new Date(article.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-4" style={{ color: '#1A1A2E' }}>
              {article.title}
            </h1>

            {/* Summary — English primary, toggle to Chinese */}
            {(article.summaryEn || article.summary) && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#888888' }}>
                    Summary
                  </span>
                  {article.summaryEn && article.summary && (
                    <button
                      onClick={() => setShowSummary((v) => !v)}
                      className="text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: showSummary ? '#1A1A2E' : '#E8DDD0',
                        color: showSummary ? '#FFFFFF' : '#8B6B42',
                      }}
                    >
                      CN
                    </button>
                  )}
                </div>
                <div className="rounded-xl p-4 text-base leading-relaxed"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(0,0,0,0.06)',
                    color: '#666666',
                    boxShadow: '0 2px 12px -4px rgba(0,0,0,0.04)',
                  }}>
                  {showSummary && article.summary ? article.summary : article.summaryEn || article.summary}
                </div>
              </div>
            )}

            {/* Article body with highlighted vocab */}
            <div className="space-y-5 leading-relaxed" style={{ color: '#444444', lineHeight: '1.9', fontSize: 'clamp(17px, 1.5vw, 19px)' }}>
              {paragraphs.map((para, i) => {
                const parts = highlightText(para, vocabWords)
                return (
                  <p key={i}>
                    {parts.map((part, j) => {
                      if (typeof part === 'string') return <span key={j}>{part}</span>
                      const vocabItem = sortedVocab[part.index] || null
                      const tc = vocabItem ? TYPE_COLORS[vocabItem.type] || '#D4A853' : '#D4A853'
                      return (
                        <span
                          key={j}
                          className="cursor-help transition-colors"
                          style={{
                            color: tc,
                            fontWeight: 600,
                            borderBottom: `2px solid ${tc}40`,
                            paddingBottom: '1px',
                          }}
                          title={vocabItem ? `${vocabItem.word} — ${vocabItem.definition}` : ''}
                        >
                          {part.word}
                          <sup className="text-[10px] leading-none ml-[1px]" style={{ color: tc }}>{part.index + 1}</sup>
                        </span>
                      )
                    })}
                  </p>
                )
              })}
            </div>
          </article>
        </div>

        {/* Vocab sidebar — right side */}
        <aside className="w-full lg:w-80 2xl:w-96 shrink-0">
          <div className="rounded-2xl border p-4 sticky top-6"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: 'rgba(0,0,0,0.06)',
              boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
            }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888888' }}>
                Vocab ({sortedVocab.length})
              </h3>
            </div>

            <div className="space-y-4">
              {sortedVocab.map((v, idx) => (
                <div key={v.id} className="rounded-xl p-4 transition-all hover:scale-[1.01]"
                  style={{ backgroundColor: '#F8F6F4' }}>
                  {/* Word + type tag */}
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold leading-none rounded-full w-[18px] h-[18px] inline-flex items-center justify-center"
                          style={{ backgroundColor: `${TYPE_COLORS[v.type] || '#888888'}18`, color: TYPE_COLORS[v.type] || '#888888' }}>
                          {idx + 1}
                        </span>
                        <span className="text-base font-semibold" style={{ color: '#1A1A2E' }}>{v.word}</span>
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium rounded px-2 py-0.5"
                      style={{ backgroundColor: `${TYPE_COLORS[v.type] || '#888888'}18`, color: TYPE_COLORS[v.type] || '#888888' }}>
                      {TYPE_LABELS[v.type] || v.type}
                    </span>
                  </div>

                  {/* Phonetic — separate line below word */}
                  {v.phonetic && v.type !== 'expression' && (
                    <div className="mb-1.5">
                      <span className="text-sm" style={{ color: '#999999' }}>/{v.phonetic.replace(/^\/|\/$/g, '')}/</span>
                    </div>
                  )}

                  {/* Part of speech abbreviation + definition */}
                  <div className="mb-1.5">
                    {v.partOfSpeech && (
                      <span className="text-xs font-medium mr-1" style={{ color: '#BBBBBB' }}>{POS_ABBR[v.partOfSpeech.toLowerCase()] || v.partOfSpeech}</span>
                    )}
                    <span className="text-sm" style={{ color: '#666666' }}>{v.definition}</span>
                  </div>

                  {/* Context sentence */}
                  <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: '#666666' }}>
                    &ldquo;{v.contextSentence}&rdquo;
                  </p>

                  {/* Extra example for expressions */}
                  {v.example && v.type === 'expression' && (
                    <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: '#666666' }}>
                      e.g. {v.example}
                    </p>
                  )}

                  {/* Add button */}
                  <div className="mt-3 flex justify-end">
                    {v.addedToReview ? (
                      <span className="text-xs font-medium" style={{ color: '#7FB069' }}>✓ Added</span>
                    ) : (
                      <button onClick={() => addVocab(v.id)}
                        disabled={addingIds.has(v.id)}
                        className="text-xs font-medium rounded-full px-3 py-1.5 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                        style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
                        {addingIds.has(v.id) ? 'Adding...' : '+ Review'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .animate-in { animation: fadeUp 0.3s ease-out both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
