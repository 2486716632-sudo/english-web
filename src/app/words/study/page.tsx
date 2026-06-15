'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { WordData } from '@/lib/types'
import { formatPhonetic } from '@/lib/utils'

// ─── types ───────────────────────────────────────────

type FrontChoice = 'known' | 'unsure' | 'unknown'
type BackChoice = 'next' | 'mistaken' | 'mastered'

interface WordJourney {
  r1Front?: FrontChoice
  r1Back?: BackChoice
  r2Front?: FrontChoice
  r2Back?: BackChoice
  r3Front?: FrontChoice
  r3Back?: BackChoice
}

// ─── helpers ─────────────────────────────────────────

function highlightWord(example: string, word: string): React.ReactNode[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = example.split(new RegExp(`\\b(${escaped}\\w*)\\b`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase().startsWith(word.toLowerCase())
      ? <strong key={i} className="font-extrabold underline underline-offset-4 decoration-2" style={{ color: '#2F2F2F', textDecorationColor: 'rgba(0,0,0,0.2)' }}>{part}</strong>
      : part,
  )
}

interface DefEntry { pos: string; meaning: string }

function parseDefinitions(rawDef: string, rawPos: string): DefEntry[] {
  const segments = rawDef.split(/[；;]|[\r\n]+/).map((s) => s.trim()).filter(Boolean)
  return segments.map((seg) => {
    const match = seg.match(/^([a-zA-Z/]+)\.?\s*(.*)$/)
    if (match && match[1].length <= 6) {
      return { pos: match[1].toLowerCase(), meaning: match[2] || seg }
    }
    return { pos: rawPos, meaning: seg }
  })
}

/** Determine final SM-2 rating (or 'mastered') from the word's journey across all 3 rounds. */
function calcRating(id: number, j: WordJourney | undefined, mastered: Set<number>): number | 'mastered' {
  if (mastered.has(id)) return 'mastered'
  if (!j) return 3

  // Passed in R2 (known + next on back)
  if (j.r2Front === 'known' && j.r2Back === 'next') {
    // R1 was also smooth → Easy (5), otherwise → Good (3)
    return (j.r1Front === 'known' && j.r1Back === 'next') ? 5 : 3
  }

  // Reached R3
  if (j.r3Back === 'next') return 2   // Hard — learned with extra practice
  if (j.r3Back === 'mistaken') return 1 // Again — still struggling

  return 3
}

// ─── component ───────────────────────────────────────

export default function StudyPage() {
  const router = useRouter()

  // URL‑derived
  const [mode, setMode] = useState<'learn' | 'review'>('learn')
  const [dailyTarget, setDailyTarget] = useState(15)

  // Core study state
  const [words, setWords] = useState<WordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [round, setRound] = useState<1 | 2 | 3>(1)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Multi‑round tracking
  const [journey, setJourney] = useState<Record<number, WordJourney>>({})
  const [mastered, setMastered] = useState<Set<number>>(new Set())
  const submittingRef = useRef(false)

  // Derived: words that failed R2 (eligible for R3)
  const r2Failed = useMemo<number[]>(() => {
    if (round < 2) return []
    const active = words.filter(w => !mastered.has(w.id))
    return active
      .filter(w => {
        const j = journey[w.id]
        return !j || j.r2Front !== 'known' || j.r2Back !== 'next'
      })
      .map(w => w.id)
  }, [round, words, mastered, journey])

  // Phase
  const phase: 'loading' | 'active' | 'round-end' | 'complete' = (() => {
    if (loading) return 'loading'
    if (error || words.length === 0) return 'complete'

    if (round === 1) return idx >= words.length ? 'round-end' : 'active'

    if (round === 2) {
      const q = words.filter(w => !mastered.has(w.id))
      if (idx >= q.length) {
        return r2Failed.length === 0 ? 'complete' : 'round-end'
      }
      return 'active'
    }

    return idx >= r2Failed.length ? 'complete' : 'active'
  })()

  // ── auto-transition round-end ──────────────────────

  const autoTransitRef = useRef(false)

  const startNextRound = useCallback(() => {
    if (round === 1) {
      setRound(2)
      setIdx(0)
      setFlipped(false)
      return
    }
    if (round === 2 && r2Failed.length > 0) {
      setRound(3)
      setIdx(0)
      setFlipped(false)
    }
  }, [round, r2Failed])

  useEffect(() => {
    if (phase !== 'round-end') {
      autoTransitRef.current = false
      return
    }
    if (autoTransitRef.current) return
    autoTransitRef.current = true

    const timer = setTimeout(() => startNextRound(), 2000)
    return () => clearTimeout(timer)
  }, [phase, startNextRound])

  // ── fetch ─────────────────────────────────────────

  const fetchedRef = useRef(false)

  const fetchWords = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams(window.location.search)
      const qs = new URLSearchParams()
      const dt = params.get('dailyTarget')
      const queue = params.get('queue')
      if (dt) qs.set('dailyTarget', dt)
      if (queue) qs.set('queue', queue)
      const qstr = qs.toString()
      const url = qstr ? `/api/words?${qstr}` : '/api/words'
      const res = await fetch(url)
      const data = await res.json()
      setWords(data.words || [])
      if (!data.words || data.words.length === 0) { setLoading(false); return }
      setMode(queue === 'review' ? 'review' : 'learn')
      if (dt) setDailyTarget(parseInt(dt, 10))

      setRound(1)
      setIdx(0)
      setFlipped(false)
      setJourney({})
      setMastered(new Set())
    } catch {
      setError(true)
      setWords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchWords()
  }, [fetchWords])

  // ── convenience ───────────────────────────────────

  const activeQueue = (): WordData[] => {
    if (round === 1) return words
    if (round === 2) return words.filter(w => !mastered.has(w.id))
    return r2Failed.map(id => words.find(w => w.id === id)!).filter(Boolean)
  }

  const currentWord = activeQueue()[idx]

  // ── submit ────────────────────────────────────────

  const submitRating = useCallback(async (id: number, rating: number | 'mastered') => {
    const body = rating === 'mastered'
      ? JSON.stringify({ wordId: id, mastered: true })
      : JSON.stringify({ wordId: id, rating })
    try {
      await fetch('/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    } catch (e) {
      console.error('submit failed', e)
    }
  }, [])

  // ── front ──────────────────────────────────────────

  const handleFront = useCallback((choice: FrontChoice) => {
    if (!currentWord) return
    setJourney(prev => ({
      ...prev,
      [currentWord.id]: { ...prev[currentWord.id], [`r${round}Front`]: choice },
    }))
    setFlipped(true)
  }, [currentWord, round])

  // ── back ───────────────────────────────────────────

  const handleBack = useCallback(async (choice: BackChoice) => {
    if (!currentWord || submittingRef.current) return
    const id = currentWord.id

    setJourney(prev => ({
      ...prev,
      [id]: { ...prev[id], [`r${round}Back`]: choice },
    }))

    if (choice === 'mastered') {
      submittingRef.current = true
      setMastered(prev => new Set([...prev, id]))
      submitRating(id, 'mastered')
      submittingRef.current = false
      advance()
      return
    }

    if (round === 1) {
      advance()
      return
    }

    if (round === 2) {
      const passed = journey[id]?.r2Front === 'known' && choice === 'next'
      if (passed) {
        submittingRef.current = true
        const r = calcRating(id, { ...journey[id], r2Back: 'next' }, mastered)
        submitRating(id, r)
        submittingRef.current = false
      }
      advance()
      return
    }

    if (round === 3) {
      submittingRef.current = true
      const r3J = { ...journey[id], r3Back: choice }
      const r = calcRating(id, r3J, mastered)
      submitRating(id, r)
      submittingRef.current = false
      advance()
      return
    }
  }, [currentWord, round, journey, mastered, submitRating])

  // ── advance ────────────────────────────────────────

  const advance = useCallback(() => {
    setIdx(i => i + 1)
    setFlipped(false)
  }, [])

  // ── stats ──────────────────────────────────────────

  const completeStats = useMemo(() => {
    const mc = mastered.size
    const r2p = words
      .filter(w => !mastered.has(w.id))
      .filter(w => journey[w.id]?.r2Front === 'known' && journey[w.id]?.r2Back === 'next')
      .length
    const r3p = words
      .filter(w => !mastered.has(w.id))
      .filter(w => {
        const j = journey[w.id]
        if (!j) return false
        if (j.r2Front === 'known' && j.r2Back === 'next') return false
        return j.r3Back === 'next'
      })
      .length
    const still = words.length - mc - r2p - r3p
    return { masteredCount: mc, passedR2: r2p, passedR3: r3p, stillLearning: still }
  }, [words, mastered, journey])

  // ── render back card ──────────────────────────────

  const renderBackCard = () => {
    if (!currentWord) return null
    const j = journey[currentWord.id]
    const rFront = j?.[`r${round}Front` as keyof WordJourney] as FrontChoice | undefined
    const showMistaken = rFront === 'known'

    const collocList = currentWord.collocations
      ? currentWord.collocations.split(',').map(s => s.trim())
      : []
    const defEntries = parseDefinitions(currentWord.definition, currentWord.partOfSpeech)
    const exampleParts = currentWord.example ? currentWord.example.split(' ||| ') : []
    const exampleZhParts = currentWord.exampleZh ? currentWord.exampleZh.split(' ||| ') : []

    return (
      <div className="w-full rounded-3xl border px-8 md:px-12 py-8 md:py-10 overflow-y-auto relative"
        style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)', minHeight: 'min(60vh, 560px)' }}
      >
        {/* Mastered — top right */}
        <button onClick={() => !submitting && handleBack('mastered')}
          disabled={submitting}
          className="absolute top-4 right-4 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-[0.96] disabled:opacity-40"
          style={{ backgroundColor: '#2B384A', color: '#FFFFFF' }}
        >
          {submitting ? '…' : 'Mastered'}
        </button>

        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 pt-4" style={{ color: '#2F2F2F' }}>{currentWord.word}</h2>
        {currentWord.phonetic && <p className="mb-7 text-sm md:text-base" style={{ color: '#888888' }}>{formatPhonetic(currentWord.phonetic)}</p>}

        {defEntries.length > 0 && (
          <section className="mb-7">
            <h3 className="mb-3 text-xs md:text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: '#888888' }}>Definition</h3>
            <div className="space-y-2">
              {defEntries.map((d, i) => (
                <p key={i} className="text-base md:text-lg leading-relaxed" style={{ color: '#2F2F2F' }}>
                  <span className="font-semibold" style={{ color: '#555555' }}>{d.pos}</span> {d.meaning}
                </p>
              ))}
            </div>
          </section>
        )}

        {collocList.length > 0 && (
          <section className="mb-7">
            <h3 className="mb-3 text-xs md:text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: '#888888' }}>Collocations</h3>
            <div className="flex flex-wrap gap-3">
              {collocList.map((c, i) => {
                const spaceIdx = c.lastIndexOf(' ')
                const en = spaceIdx > 0 ? c.slice(0, spaceIdx) : c
                const zh = spaceIdx > 0 ? c.slice(spaceIdx + 1) : ''
                return (
                  <span key={i} className="inline-flex items-baseline gap-1.5 px-4 py-2 text-sm"
                    style={{ backgroundColor: '#F0F0F0', color: '#555555', borderRadius: '10px' }}>
                    <span className="font-medium">{en}</span>
                    <span style={{ color: '#888888' }}>{zh}</span>
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {currentWord.example && (
          <section className="mb-7">
            <h3 className="mb-3 text-xs md:text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: '#888888' }}>Example</h3>
            <div className="space-y-4">
              {exampleParts.map((ex, i) => (
                <div key={i}>
                  <p className="text-base md:text-lg leading-relaxed italic" style={{ color: '#2F2F2F' }}>
                    &ldquo;{highlightWord(ex, currentWord.word)}&rdquo;
                  </p>
                  {exampleZhParts[i] &&
                    <p className="mt-1.5 text-base md:text-lg leading-relaxed" style={{ color: '#555555' }}>{exampleZhParts[i]}</p>
                  }
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Back buttons */}
        <div className="flex gap-4 md:gap-5" style={{ maxWidth: showMistaken ? '100%' : '60%', margin: '0 auto' }}>
          <button onClick={() => handleBack('next')} disabled={submitting}
            className="flex-1 py-3.5 md:py-4 text-base md:text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.96] disabled:opacity-40"
            style={{ backgroundColor: '#202020', borderRadius: '14px' }}
          >
            Next
          </button>
          {showMistaken && (
            <button onClick={() => handleBack('mistaken')} disabled={submitting}
              className="flex-1 py-3.5 md:py-4 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96] disabled:opacity-40"
              style={{ backgroundColor: '#FCEAEB', color: '#B91C1C', borderRadius: '14px' }}
            >
              Mistaken
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── render front card ─────────────────────────────

  const renderFrontCard = () => {
    if (!currentWord) return null

    const isTwoBtn = round !== 2
    const buttons = isTwoBtn
      ? ([
          { label: 'Known',   cls: 'bg-[#4F677E] text-white',           choice: 'known' as FrontChoice },
          { label: 'Unknown', cls: 'bg-[#FCEAEB] text-[#B91C1C]',       choice: 'unknown' as FrontChoice },
        ] as const)
      : ([
          { label: 'Known',   cls: 'bg-[#4F677E] text-white',           choice: 'known' as FrontChoice },
          { label: 'Unsure',  cls: 'bg-[#F0F0F0] text-[#888888]',       choice: 'unsure' as FrontChoice },
          { label: 'Unknown', cls: 'bg-[#FCEAEB] text-[#B91C1C]',       choice: 'unknown' as FrontChoice },
        ] as const)

    return (
      <>
        <div className="w-full flex flex-col items-center select-none pt-20 md:pt-24"
          style={{ minHeight: 'min(60vh, 560px)' }}
        >
          {currentWord.partOfSpeech && (
            <span className="mb-6 md:mb-8 rounded-full px-4 py-1.5 text-sm md:text-base font-semibold uppercase tracking-wide"
              style={{ backgroundColor: '#F0F0F0', color: '#AAAAAA' }}>
              {currentWord.partOfSpeech}
            </span>
          )}
          <h2 className="font-extrabold tracking-tight text-center leading-[1.1]"
            style={{ fontSize: 'clamp(3.5rem, 15vw, 7rem)', color: '#262626' }}>
            {currentWord.word}
          </h2>
          {currentWord.phonetic && <p className="mt-6 md:mt-8 text-base md:text-lg" style={{ color: '#757575' }}>{formatPhonetic(currentWord.phonetic)}</p>}
        </div>

        <div className="w-full max-w-2xl mx-auto mt-4">
          <div className={`flex gap-4 md:gap-5 ${isTwoBtn ? 'justify-center' : ''}`}
            style={isTwoBtn ? { maxWidth: '70%', margin: '0 auto' } : {}}
          >
            {buttons.map(b => (
              <button key={b.choice} onClick={() => handleFront(b.choice)}
                className={`flex-1 py-4 md:py-5 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96] rounded-[40px] ${b.cls}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  // Loading
  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

  // Empty / error
  if (!loading && words.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="w-full px-6 md:px-12 pt-6 pb-2">
          <button onClick={() => router.back()}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
            style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <p className="text-sm" style={{ color: '#757575' }}>{ error ? 'Something went wrong.' : 'No words available right now.' }</p>
          {!error && (
            <p className="mt-2 text-xs" style={{ color: '#AAAAAA' }}>Come back later or adjust your daily target.</p>
          )}
        </div>
      </div>
    )
  }

  // ── Round-end transition (auto-transitions after 2s) ──

  if (phase === 'round-end') {
    if (round === 1) {
      return (
        <div onClick={startNextRound}
          className="min-h-screen flex flex-col items-center justify-center px-6 cursor-pointer select-none" style={{ backgroundColor: '#F8F6F4' }}>
          <div className="mx-auto max-w-sm text-center animate-popIn">
            <div className="mb-4 text-5xl">📖</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>Round 1 Complete</h1>
            <p className="mt-3 text-base" style={{ color: '#757575' }}>
              {words.length} word{words.length !== 1 ? 's' : ''} introduced.
              {mastered.size > 0 && ` ${mastered.size} mastered.`}
            </p>
            <p className="mt-1 text-sm font-medium tracking-wide" style={{ color: '#AAAAAA' }}>
              Entering Round 2…
            </p>
          </div>
        </div>
      )
    }

    // round === 2 with failures → R3
    const r2Total = words.filter(w => !mastered.has(w.id)).length
    const r2FailedCount = r2Failed.length
    return (
      <div onClick={startNextRound}
        className="min-h-screen flex flex-col items-center justify-center px-6 cursor-pointer select-none" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="mx-auto max-w-sm text-center animate-popIn">
          <div className="mb-4 text-5xl">🔁</div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>Round 2 Complete</h1>
          <p className="mt-3 text-base" style={{ color: '#757575' }}>
            <span className="font-semibold" style={{ color: '#4F677E' }}>{r2Total - r2FailedCount} passed</span>
            {' · '}
            <span className="font-semibold" style={{ color: '#B91C1C' }}>{r2FailedCount} need review</span>
          </p>
          <p className="mt-1 text-sm font-medium tracking-wide" style={{ color: '#AAAAAA' }}>
            Entering Round 3…
          </p>
        </div>
      </div>
    )
  }

  // ── Study Complete ────────────────────────────────

  if (phase === 'complete') {
    const { masteredCount, passedR2, passedR3, stillLearning } = completeStats
    const allDone = stillLearning === 0

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="mx-auto max-w-sm animate-popIn">
            <div className="mb-5 text-6xl">{allDone ? '🎉' : '💪'}</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>
              {allDone ? 'All Words Mastered!' : 'Study Complete'}
            </h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: '#757575' }}>
              {words.length} word{words.length !== 1 ? 's' : ''} studied today.
            </p>
            <div className="mt-5 space-y-1 text-sm" style={{ color: '#888888' }}>
              {masteredCount > 0 && <p>Mastered: {masteredCount}</p>}
              {passedR2 > 0 && <p>Learned (R2): {passedR2}</p>}
              {passedR3 > 0 && <p>Learned (R3): {passedR3}</p>}
              {stillLearning > 0 && <p style={{ color: '#B91C1C' }}>Need more review: {stillLearning}</p>}
            </div>
            <div className="mt-8 flex justify-center gap-4">
              <button onClick={() => router.push('/words/dashboard')}
                className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-all active:scale-[0.97] hover:opacity-90"
                style={{ backgroundColor: '#262626' }}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Active — word card ────────────────────────────

  // Safety guard: never render a card without a valid word
  if (phase === 'active' && !currentWord) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

  const q = activeQueue()
  const total = q.length
  const pos = Math.min(idx + 1, total)

  const roundLabel = mode === 'learn'
    ? { 1: 'Learn · Round 1', 2: 'Learn · Round 2', 3: 'Learn · Round 3' }[round]
    : { 1: 'Review · Round 1', 2: 'Review · Round 2', 3: 'Review · Round 3' }[round]

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#F8F6F4' }}>
      {/* Top bar */}
      <div className="flex-shrink-0 w-full px-6 md:px-12 pt-6 pb-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex justify-start">
            <button onClick={() => router.back()}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
              style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: '#262626' }}>{roundLabel}</h1>
            <div className="mx-auto mt-1 h-[3px]" style={{ width: '90%', backgroundColor: '#262626' }} />
          </div>

          <div className="flex justify-end items-center gap-2 text-sm">
            <span style={{ color: '#757575' }} className="tabular-nums">{pos} / {total}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 w-full px-6 md:px-12 mt-2">
        <div className="w-full mx-auto" style={{ maxWidth: 'min(48rem, 100%)' }}>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#888888' }}>Progress</span>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#E8E8E8' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${total > 0 ? (pos / total) * 100 : 0}%`, backgroundColor: '#262626' }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: '#888888' }}>{Math.round(total > 0 ? (pos / total) * 100 : 0)}%</span>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 min-h-0">
        <div key={`${round}-${idx}`} className="w-full max-w-2xl mx-auto mb-4">
          {flipped ? renderBackCard() : renderFrontCard()}
        </div>
      </div>
    </div>
  )
}
