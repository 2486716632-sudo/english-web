'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import type { WordData } from '@/lib/types'
import { formatPhonetic } from '@/lib/utils'
import { listWordCache } from '@/lib/word-cache'

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

export default function WordListPage() {
  const params = useParams()
  const theme = params.theme as string
  return <WordListInner key={theme} theme={theme} />
}

function WordListInner({ theme }: { theme: string }) {
  const [words, setWords] = useState<WordData[]>(listWordCache[theme] ?? [])
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        if (listWordCache[theme]) {
          setProgress(loadProgress(theme))
          setLoading(false)
          return
        }
        const res = await fetch(`/api/words?theme=${theme}`)
        const data = await res.json()
        if (ignore) return
        listWordCache[theme] = data.words || []
        setWords(data.words || [])
        setProgress(loadProgress(theme))
      } catch {
        if (!ignore) setWords([])
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [theme])

  const setWordStatus = useCallback((wordId: number, status: 'got_it' | 'not_yet') => {
    setProgress((prev) => {
      const next = { ...prev, [wordId]: status }
      saveProgress(theme, next)
      return next
    })
  }, [theme])

  const notYet = words.filter((w) => progress[w.id] !== 'got_it')
  const gotIt = words.filter((w) => progress[w.id] === 'got_it')
  const displayLabel = THEME_LABELS[theme] || theme.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

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

      <div className="flex-1 px-6 md:px-16 lg:px-24 pb-12">
        <div className="w-full max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-center" style={{ color: '#262626' }}>{displayLabel} - Word List</h1>
          <p className="text-sm text-center mb-8" style={{ color: '#757575' }}>
            <span style={{ color: '#FC6F7B' }}>{notYet.length} learning</span>
            <span className="mx-2">·</span>
            <span style={{ color: '#64B0FA' }}>{gotIt.length} mastered</span>
            <span className="mx-2">·</span>
            {words.length} total
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Not Yet column */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#FC6F7B' }}>Learning ({notYet.length})</h2>
              <div className="space-y-3">
                {notYet.map((w) => (
                  <div key={w.id}
                    className="flex items-center gap-4 rounded-2xl border px-6 py-4"
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate" style={{ color: '#2F2F2F' }}>{w.word}</p>
                      <p className="text-sm truncate mt-0.5" style={{ color: '#888888' }}>{formatPhonetic(w.phonetic) || ''} {w.definition}</p>
                    </div>
                    <button onClick={() => setWordStatus(w.id, 'got_it')}
                      className="shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95 hover:shadow-md"
                      style={{ backgroundColor: '#E1EDFA', color: '#64B0FA' }}>
                      ✔
                    </button>
                  </div>
                ))}
                {notYet.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: '#AAAAAA' }}>All words mastered!</p>
                )}
              </div>
            </div>

            {/* Got It column */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#64B0FA' }}>Mastered ({gotIt.length})</h2>
              <div className="space-y-3">
                {gotIt.map((w) => (
                  <div key={w.id}
                    className="flex items-center gap-4 rounded-2xl border px-6 py-4"
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate" style={{ color: '#2F2F2F' }}>{w.word}</p>
                      <p className="text-sm truncate mt-0.5" style={{ color: '#888888' }}>{formatPhonetic(w.phonetic) || ''} {w.definition}</p>
                    </div>
                    <button onClick={() => setWordStatus(w.id, 'not_yet')}
                      className="shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95 hover:shadow-md"
                      style={{ backgroundColor: '#FCEAEB', color: '#FC6F7B' }}>
                      ✗
                    </button>
                  </div>
                ))}
                {gotIt.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: '#AAAAAA' }}>No words mastered yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
