'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import type { WordData } from '@/lib/types'
import { formatPhonetic } from '@/lib/types'

const BATCH_SIZE = 15

interface ProgressMap {
  [wordId: number]: 'got_it' | 'not_yet'
}

function loadProgress(theme: string): ProgressMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(`wordpack_${theme}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveProgress(theme: string, map: ProgressMap) {
  localStorage.setItem(`wordpack_${theme}`, JSON.stringify(map))
}

function highlightWord(example: string, word: string): React.ReactNode[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = example.split(new RegExp(`\\b(${escaped}\\w*)\\b`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase().startsWith(word.toLowerCase())
      ? <strong key={i} className="font-extrabold underline underline-offset-4 decoration-2" style={{ color: '#2F2F2F', textDecorationColor: 'rgba(0,0,0,0.2)' }}>{part}</strong>
      : part,
  )
}

const THEME_LABELS: Record<string, string> = {
  kitchen: 'Kitchen',
  car: 'Car',
  clothing: 'Clothing',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  body: 'Body & Health',
  office: 'Office',
  technology: 'Technology',
  school: 'School',
  sports: 'Sports & Fitness',
  shopping: 'Shopping',
  transportation: 'Transportation',
  entertainment: 'Entertainment',
  weather: 'Weather',
  home: 'Home',
  people: 'People & Family',
  'mechanical-engineering': 'Mechanical Engineering',
  'computer-ai': 'Computer & AI',
  automotive: 'Automotive',
  'foreign-trade': 'Foreign Trade',
}

export default function ThemeStudyPage() {
  const params = useParams()
  const theme = params.theme as string
  const router = useRouter()

  const [allWords, setAllWords] = useState<WordData[]>([])
  const [batch, setBatch] = useState<WordData[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [gotItCount, setGotItCount] = useState(0)
  const progressRef = useRef<ProgressMap>({})

  // Load all theme words + progress
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/words?theme=${theme}`)
        const data = await res.json()
        const words: WordData[] = data.words || []
        setAllWords(words)

        const prog = loadProgress(theme)
        progressRef.current = prog

        // Pick up to BATCH_SIZE words that are not yet "got_it"
        const notYet = words.filter((w) => prog[w.id] !== 'got_it')
        const shuffled = notYet.sort(() => Math.random() - 0.5)
        const batchWords = shuffled.slice(0, BATCH_SIZE)
        setBatch(batchWords)

        // Preload images for the batch
        batchWords.forEach((w) => {
          if (w.imageUrl) {
            const img = new Image()
            img.src = w.imageUrl
          }
        })
      } catch {
        setAllWords([])
      } finally {
        setLoading(false)
      }
    })()
  }, [theme])

  const flipCard = useCallback(() => {
    if (!flipped) setFlipped(true)
  }, [flipped])

  const markGotIt = useCallback(() => {
    const current = batch[index]
    if (!current) return
    const prog = { ...progressRef.current, [current.id]: 'got_it' as const }
    progressRef.current = prog
    saveProgress(theme, prog)
    setGotItCount((c) => c + 1)
    setIndex((i) => i + 1)
    setFlipped(false)
  }, [batch, index, theme])

  const markNotYet = useCallback(() => {
    setIndex((i) => i + 1)
    setFlipped(false)
  }, [])

  const nextRound = useCallback(() => {
    const notYet = allWords.filter((w) => progressRef.current[w.id] !== 'got_it')
    if (notYet.length === 0) return
    const shuffled = notYet.sort(() => Math.random() - 0.5)
    setBatch(shuffled.slice(0, BATCH_SIZE))
    setIndex(0)
    setFlipped(false)
    setGotItCount(0)
  }, [allWords])

  const current = batch[index]
  const isComplete = !loading && batch.length > 0 && index >= batch.length
  const displayLabel = THEME_LABELS[theme] || theme
  const hasCollocations = current?.collocations && current.collocations.length > 0
  const collocList = hasCollocations ? current.collocations!.split(',').map((s) => s.trim()) : []

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

  if (batch.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="w-full px-6 md:px-12 pt-6 pb-2">
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
        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-4 text-center">
          <div className="mx-auto max-w-sm">
            <div className="mb-5 text-6xl select-none">🎉</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>All Done!</h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: '#757575' }}>
              You've mastered all {allWords.length} {displayLabel} words.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isComplete) {
    const remaining = allWords.filter((w) => progressRef.current[w.id] !== 'got_it').length
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="w-full px-6 md:px-12 pt-6 pb-2">
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
        <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-4 text-center">
          <div className="mx-auto max-w-sm">
            <div className="mb-5 text-6xl select-none">🎉</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>Session Complete!</h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: '#757575' }}>
              You got <strong style={{ color: '#262626' }}>{gotItCount}</strong> new words this round.
            </p>
            {remaining > 0 && (
              <p className="mt-1 text-sm" style={{ color: '#888888' }}>
                {remaining} words still learning.
              </p>
            )}
            <div className="mt-8 flex justify-center gap-4">
              {remaining > 0 && (
              <button onClick={nextRound}
                className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-all active:scale-[0.97] hover:opacity-90"
                style={{ backgroundColor: '#262626' }}>
                Next Round
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    )
  }

  if (allWords.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: '#F8F6F4' }}>
        <p className="text-sm" style={{ color: '#757575' }}>No words found for this pack.</p>
      </div>
    )
  }

  const cardEl = flipped ? (
    <div className="w-full rounded-3xl border px-8 md:px-12 py-8 md:py-10 overflow-y-auto"
      style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)', minHeight: 'min(60vh, 560px)' }}
    >
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2" style={{ color: '#2F2F2F' }}>{current.word}</h2>
      {current.phonetic && <p className="mb-7 text-sm md:text-base" style={{ color: '#888888' }}>{formatPhonetic(current.phonetic)}</p>}

      {current.definition && (
        <section className="mb-7">
          <h3 className="mb-3 text-xs md:text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: '#888888' }}>Definition</h3>
          <p className="text-base md:text-lg leading-relaxed" style={{ color: '#2F2F2F' }}>{current.definition}</p>
        </section>
      )}

      {current.imageUrl && (
        <section className="mb-7">
          <div className="w-full overflow-hidden rounded-2xl" style={{ maxHeight: '240px' }}>
            <img src={current.imageUrl} alt={current.word} className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
            <div>
              <p className="text-base md:text-lg leading-relaxed italic" style={{ color: '#2F2F2F' }}>
                &ldquo;{highlightWord(current.example, current.word)}&rdquo;
              </p>
              {current.exampleZh && (
                <p className="mt-1.5 text-base md:text-lg leading-relaxed" style={{ color: '#555555' }}>{current.exampleZh}</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  ) : (
    <div className="w-full flex flex-col items-center justify-center select-none cursor-pointer"
      onClick={flipCard}
      style={{ minHeight: 'min(60vh, 560px)' }}
    >
      {current.imageUrl && (
        <div className="mb-6 w-full max-w-xs overflow-hidden rounded-2xl" style={{ maxHeight: '200px' }}>
          <img src={current.imageUrl} alt={current.word} className="w-full h-full object-cover" />
        </div>
      )}
      {current.partOfSpeech && (
        <span className="mb-6 md:mb-8 rounded-full px-4 py-1.5 text-sm md:text-base font-semibold uppercase tracking-wide"
          style={{ backgroundColor: '#F0F0F0', color: '#AAAAAA' }}>
          {current.partOfSpeech}
        </span>
      )}
      <h2 className="font-extrabold tracking-tight text-center leading-[1.1] whitespace-nowrap"
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
            <h1 className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: '#262626' }}>{displayLabel}</h1>
            <div className="mx-auto mt-1 h-[3px]" style={{ width: '90%', backgroundColor: '#262626' }} />
          </div>

          <div className="flex justify-end">
            <span style={{ color: '#757575' }} className="tabular-nums">{index + 1} / {batch.length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12">
        <div className="w-full max-w-2xl mx-auto mb-6">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#888888' }}>Progress</span>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#E8E8E8' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((index + 1) / batch.length) * 100}%`, backgroundColor: '#262626' }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: '#888888' }}>{Math.round(((index + 1) / batch.length) * 100)}%</span>
          </div>
        </div>

        <div key={index} className="w-full max-w-2xl mx-auto mb-8">
          {cardEl}
        </div>

        {!flipped && (
          <div className="w-full max-w-2xl mx-auto">
            <p className="text-center text-sm mb-5" style={{ color: '#757575' }}>Do you remember this word?</p>
            <button onClick={flipCard}
              className="w-full py-4 md:py-5 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96]"
              style={{ backgroundColor: '#E8E8E8', color: '#555555', borderRadius: '40px' }}>
              Show Answer
            </button>
          </div>
        )}

        {flipped && (
          <div className="w-full max-w-2xl mx-auto flex gap-4 md:gap-5">
            <button onClick={markNotYet}
              className="flex-1 py-4 md:py-5 text-base md:text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-[0.96]"
              style={{ backgroundColor: '#FCEAEB', color: '#FC6F7B', borderRadius: '14px' }}>
              Not Yet
            </button>
            <button onClick={markGotIt}
              className="flex-1 py-4 md:py-5 text-base md:text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.96]"
              style={{ backgroundColor: '#4F677E', borderRadius: '14px' }}>
              Got It
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
