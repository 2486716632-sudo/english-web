'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { WordData } from '@/lib/types'
import { formatPhonetic } from '@/lib/types'

function highlightWord(example: string, word: string): React.ReactNode[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = example.split(new RegExp(`\\b(${escaped}\\w*)\\b`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase().startsWith(word.toLowerCase())
      ? <strong key={i} className="font-extrabold underline underline-offset-4 decoration-2" style={{ color: '#2F2F2F', textDecorationColor: 'rgba(0,0,0,0.2)' }}>{part}</strong>
      : part,
  )
}

interface DefEntry {
  pos: string
  meaning: string
}

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

export default function WordsPage() {
  const [words, setWords] = useState<WordData[]>([])
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const router = useRouter()

  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const dailyTarget = params.get('dailyTarget')
      const url = dailyTarget ? `/api/words?dailyTarget=${dailyTarget}` : '/api/words'
      const res = await fetch(url)
      const data = await res.json()
      setWords(data.words || [])
    } catch {
      setWords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWords() }, [fetchWords])

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const newStack = [...prev]
      const prevIdx = newStack.pop()!
      setIndex(prevIdx)
      setFlipped(false)
      return newStack
    })
  }, [])

  const flipCard = useCallback(() => {
    if (!flipped) setFlipped(true)
  }, [flipped])

  const submitAndFlip = useCallback(async (rating: number) => {
    const current = words[index]
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: current.id, rating }),
      })
      setFlipped(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }, [words, index, submitting])

  const submitMastered = useCallback(async () => {
    const current = words[index]
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: current.id, mastered: true }),
      })
      setFlipped(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }, [words, index, submitting])

  // Back-side override buttons — submit and advance
  const submitAndAdvance = useCallback(async (rating: number) => {
    const current = words[index]
    if (!current || submitting) return
    setHistory((prev) => [...prev, index])
    setSubmitting(true)
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: current.id, rating }),
      })
      setIndex((i) => i + 1)
      setFlipped(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }, [words, index, submitting])

  const masterAndAdvance = useCallback(async () => {
    const current = words[index]
    if (!current || submitting) return
    setHistory((prev) => [...prev, index])
    setSubmitting(true)
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: current.id, mastered: true }),
      })
      setIndex((i) => i + 1)
      setFlipped(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }, [words, index, submitting])

  const advance = useCallback(() => {
    if (submitting) return
    setHistory((prev) => [...prev, index])
    setIndex((i) => i + 1)
    setFlipped(false)
  }, [index, submitting])

  const nextRound = useCallback(() => {
    setIndex(0)
    setHistory([])
    setFlipped(false)
    fetchWords()
  }, [fetchWords])

  const current = words[index]
  const isComplete = !loading && words.length > 0 && index >= words.length
  const hasCollocations = current?.collocations && current.collocations.length > 0
  const collocList = hasCollocations ? current.collocations!.split(',').map((s) => s.trim()) : []
  const defEntries = current ? parseDefinitions(current.definition, current.partOfSpeech) : []
  const exampleParts = current?.example ? current.example.split(' ||| ') : []
  const exampleZhParts = current?.exampleZh ? current.exampleZh.split(' ||| ') : []

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="w-full px-6 md:px-12 pt-6 pb-2">
          <button onClick={() => router.push('/words')}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all hover:opacity-70 active:scale-[0.97]"
            style={{ backgroundColor: '#F0F0F0', color: '#757575' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-4 text-center">
          <div className="mx-auto max-w-sm">
            <div className="mb-5 text-6xl select-none">🎉</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>Study Complete!</h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: '#757575' }}>
              You studied {words.length} word{words.length > 1 ? 's' : ''} today.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button onClick={nextRound}
                className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-all active:scale-[0.97] hover:opacity-90"
                style={{ backgroundColor: '#262626' }}>
                Next Round
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: '#F8F6F4' }}>
        <p className="text-sm" style={{ color: '#757575' }}>No words available right now.</p>
      </div>
    )
  }

  const cardEl = flipped ? (
    <div className="w-full rounded-3xl border px-8 md:px-12 py-8 md:py-10 overflow-y-auto"
      style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)', minHeight: 'min(60vh, 560px)' }}
    >
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2" style={{ color: '#2F2F2F' }}>{current.word}</h2>
      {current.phonetic && <p className="mb-7 text-sm md:text-base" style={{ color: '#888888' }}>{formatPhonetic(current.phonetic)}</p>}

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

      {current.example && (
        <section>
          <h3 className="mb-3 text-xs md:text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: '#888888' }}>Example</h3>
          <div className="space-y-4">
            {exampleParts.map((ex, i) => (
              <div key={i}>
                <p className="text-base md:text-lg leading-relaxed italic" style={{ color: '#2F2F2F' }}>
                  &ldquo;{highlightWord(ex, current.word)}&rdquo;
                </p>
                {exampleZhParts[i]
                  ? <p className="mt-1.5 text-base md:text-lg leading-relaxed" style={{ color: '#555555' }}>{exampleZhParts[i]}</p>
                  : null
                }
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  ) : (
    <div className="w-full flex flex-col items-center justify-center select-none cursor-pointer"
      onClick={flipCard}
      style={{ minHeight: 'min(60vh, 560px)' }}
    >
      {current.partOfSpeech && (
        <span className="mb-6 md:mb-8 rounded-full px-4 py-1.5 text-sm md:text-base font-semibold uppercase tracking-wide"
          style={{ backgroundColor: '#F0F0F0', color: '#AAAAAA' }}>
          {current.partOfSpeech}
        </span>
      )}
      <h2 className="font-extrabold tracking-tight text-center leading-[1.1]"
        style={{ fontSize: 'clamp(3.5rem, 15vw, 7rem)', color: '#262626' }}>
        {current.word}
      </h2>
      {current.phonetic && <p className="mt-6 md:mt-8 text-base md:text-lg" style={{ color: '#757575' }}>{formatPhonetic(current.phonetic)}</p>}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <div className="w-full px-6 md:px-12 pt-6 pb-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex justify-start">
            <button onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all hover:opacity-70 active:scale-[0.97]"
              style={{ backgroundColor: '#F0F0F0', color: '#757575' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: '#262626' }}>Daily Study</h1>
            <div className="mx-auto mt-1 h-[3px]" style={{ width: '90%', backgroundColor: '#262626' }} />
          </div>

          <div className="flex justify-end items-center gap-2 text-sm">
            <span className="rounded-full px-3 py-1 font-medium" style={{ backgroundColor: '#F0F0F0', color: '#757575' }}>
              New {words.length}
            </span>
            <span style={{ color: '#757575' }} className="tabular-nums">{index + 1} / {words.length}</span>
            <button onClick={() => router.push('/words/mastered')}
              className="rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.97]"
              style={{ backgroundColor: '#333333', color: '#FFFFFF' }}
            >
              Mastered List
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12">
        <div className="w-full max-w-2xl mx-auto mb-6">
          <div className="flex items-center gap-4">
            {history.length > 0 && (
              <button onClick={goBack}
                className="rounded-full p-1 transition-all hover:opacity-60 active:scale-[0.92]"
                style={{ color: '#888888' }}
                title="Previous word"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#888888' }}>Progress</span>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#E8E8E8' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((index + 1) / words.length) * 100}%`, backgroundColor: '#262626' }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: '#888888' }}>{Math.round(((index + 1) / words.length) * 100)}%</span>
          </div>
        </div>

        <div key={index} className="w-full max-w-2xl mx-auto mb-8">
          {cardEl}
        </div>

        {!flipped && (
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-center text-sm mb-5" style={{ color: '#757575' }}>Do you remember this word?</p>
            <div className="flex gap-4 md:gap-5">
              <button onClick={() => submitAndFlip(1)}
                className="flex-1 py-4 md:py-5 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96]"
                style={{ backgroundColor: '#FCEAEB', color: '#FC6F7B', borderRadius: '40px' }}>
                Forgot
              </button>
              <button onClick={() => submitAndFlip(3)}
                className="flex-1 py-4 md:py-5 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96]"
                style={{ backgroundColor: '#E1EDFA', color: '#64B0FA', borderRadius: '40px' }}>
                Good
              </button>
              <button onClick={() => submitAndFlip(5)}
                className="flex-1 py-4 md:py-5 text-base md:text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.96]"
                style={{ backgroundColor: '#4F677E', borderRadius: '40px' }}>
                Easy
              </button>
              <button onClick={submitMastered} disabled={submitting}
                className="flex-1 py-4 md:py-5 text-base md:text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.96] disabled:opacity-40"
                style={{ backgroundColor: '#2B384A', borderRadius: '40px' }}>
                {submitting ? '…' : 'Mastered'}
              </button>
            </div>
          </div>
        )}

        {flipped && (
          <div className="w-full max-w-2xl mx-auto flex gap-4 md:gap-5">
            <button onClick={() => submitAndAdvance(1)} disabled={submitting}
              className="flex-1 py-3.5 md:py-4 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96] disabled:opacity-40"
              style={{ backgroundColor: '#FFDEDE', color: '#FF4D4D', borderRadius: '14px' }}>
              Misremembered
            </button>
            <button onClick={masterAndAdvance} disabled={submitting}
              className="flex-1 py-3.5 md:py-4 text-base md:text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.96] disabled:opacity-40"
              style={{ backgroundColor: '#5A6B7E', borderRadius: '14px' }}>
              Mastered
            </button>
            <button onClick={advance} disabled={submitting}
              className="flex-1 py-3.5 md:py-4 text-base md:text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.96] disabled:opacity-40 inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: '#202020', borderRadius: '14px' }}>
              Next
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: '#FFFFFF' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
