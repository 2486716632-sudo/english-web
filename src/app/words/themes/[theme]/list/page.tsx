'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import type { WordData } from '@/lib/types'
import { formatPhonetic } from '@/lib/types'

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
  const [words, setWords] = useState<WordData[]>([])
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/words?theme=${theme}`)
        const data = await res.json()
        setWords(data.words || [])
        setProgress(loadProgress(theme))
      } catch {
        setWords([])
      } finally {
        setLoading(false)
      }
    })()
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
  const displayLabel = THEME_LABELS[theme] || theme

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
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all hover:opacity-70 active:scale-[0.97]"
          style={{ backgroundColor: '#F0F0F0', color: '#757575' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      <div className="flex-1 px-6 md:px-12 pb-12">
        <div className="w-full max-w-4xl mx-auto">
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
              <div className="space-y-2">
                {notYet.map((w) => (
                  <div key={w.id}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#2F2F2F' }}>{w.word}</p>
                      <p className="text-xs truncate" style={{ color: '#888888' }}>{formatPhonetic(w.phonetic) || ''} {w.definition}</p>
                    </div>
                    <button onClick={() => setWordStatus(w.id, 'got_it')}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
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
              <div className="space-y-2">
                {gotIt.map((w) => (
                  <div key={w.id}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#2F2F2F' }}>{w.word}</p>
                      <p className="text-xs truncate" style={{ color: '#888888' }}>{formatPhonetic(w.phonetic) || ''} {w.definition}</p>
                    </div>
                    <button onClick={() => setWordStatus(w.id, 'not_yet')}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
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
