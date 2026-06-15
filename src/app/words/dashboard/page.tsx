'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Playfair_Display } from 'next/font/google'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
})

const DAILY_TARGET_KEY = 'english-assistant-daily-target'

function getStoredTarget(): number {
  if (typeof window === 'undefined') return 15
  const stored = localStorage.getItem(DAILY_TARGET_KEY)
  const num = stored ? parseInt(stored, 10) : 15
  return Math.min(Math.max(num, 1), 100)
}

interface QueueData {
  reviewQueue: number
  newWordsQueue: number
  masteredCount: number
  totalWords: number
}

// Module-level cache — survives remount on back-navigation
let cachedQueues: QueueData | null = null
const DEFAULT_QUEUES: QueueData = { reviewQueue: 0, newWordsQueue: 0, masteredCount: 0, totalWords: 0 }

export default function DailyDashboard() {
  const router = useRouter()
  const [data, setData] = useState<QueueData>(cachedQueues || DEFAULT_QUEUES)
  const [loading, setLoading] = useState(!cachedQueues)
  const [dailyTarget, setDailyTarget] = useState(getStoredTarget)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    let ignore = false
    fetch('/api/words/queues')
      .then((r) => r.json())
      .then((d) => {
        if (ignore) return
        cachedQueues = d
        setData(d)
        setLoading(false)
      })
      .catch(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  const saveDailyTarget = useCallback((val: number) => {
    const clamped = Math.min(Math.max(val, 1), 100)
    setDailyTarget(clamped)
    localStorage.setItem(DAILY_TARGET_KEY, String(clamped))
  }, [])

  const canLearn = data.newWordsQueue > 0
  const canReview = data.reviewQueue > 0

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

      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12">
        <div className="w-full max-w-4xl mx-auto">
          {/* Title section */}
          <div className="text-center mb-12">
            <h1 className={`${displayFont.className} text-4xl font-bold tracking-tight`} style={{ color: '#262626' }}>Daily Study</h1>
            <div className="flex items-center justify-center gap-2 mt-3">
              <p className="text-lg" style={{ color: '#888888' }}>Choose your learning mode</p>
              <button onClick={() => setShowSettings(true)}
                className="inline-flex rounded-full p-1.5 transition-colors hover:opacity-60"
                style={{ color: '#999999' }}
                title="Study Settings"
              >
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Two-column cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Learn card */}
            <div className="rounded-3xl border p-8 md:p-10 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)' }}
            >
              <div className="flex justify-center mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300 hover:scale-110 hover:shadow-lg"
                  style={{ backgroundColor: '#E8EDF4' }}
                >
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#5A7A9A' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: '#2F2F2F' }}>Learn</h2>
              <p className="mt-1.5 text-sm" style={{ color: '#888888' }}>New words to study today</p>
              <div className="mt-6 mb-8">
                  <span className="text-5xl font-extrabold tabular-nums" style={{ color: '#5A7A9A' }}>{data.newWordsQueue}</span>
                  <p className="mt-1 text-sm" style={{ color: '#AAAAAA' }}>words available</p>
              </div>
              <button
                onClick={() => { if (canLearn) router.push(`/words/study?queue=new&dailyTarget=${dailyTarget}`) }}
                disabled={!canLearn}
                className="w-full rounded-full py-3.5 text-base font-semibold transition-all duration-300 hover:shadow-md active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: canLearn ? '#5A7A9A' : '#F0F0F0', color: canLearn ? '#FFFFFF' : '#AAAAAA' }}
              >
                {canLearn ? 'Start Learning' : 'All caught up'}
              </button>
            </div>

            {/* Review card */}
            <div className="rounded-3xl border p-8 md:p-10 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)' }}
            >
              <div className="flex justify-center mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300 hover:scale-110 hover:shadow-lg"
                  style={{ backgroundColor: '#F4EDE8' }}
                >
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#9A7A5A' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l7.404-7.404" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: '#2F2F2F' }}>Review</h2>
              <p className="mt-1.5 text-sm" style={{ color: '#888888' }}>Words due for spaced repetition</p>
              <div className="mt-6 mb-8">
                  <span className="text-5xl font-extrabold tabular-nums" style={{ color: '#9A7A5A' }}>{data.reviewQueue}</span>
                  <p className="mt-1 text-sm" style={{ color: '#AAAAAA' }}>words to review</p>
              </div>
              <button
                onClick={() => { if (canReview) router.push(`/words/study?queue=review&dailyTarget=${dailyTarget}`) }}
                disabled={!canReview}
                className="w-full rounded-full py-3.5 text-base font-semibold transition-all duration-300 hover:shadow-md active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: canReview ? '#9A7A5A' : '#F0F0F0', color: canReview ? '#FFFFFF' : '#AAAAAA' }}
              >
                {canReview ? 'Start Review' : 'All reviewed'}
              </button>
            </div>
          </div>

          {/* Mastered count + link */}
          {cachedQueues && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <p className="text-xs" style={{ color: '#BBBBBB' }}>
                <span className="tabular-nums">{data.masteredCount}</span> mastered · <span className="tabular-nums">{data.totalWords}</span> total words
              </p>
              {data.masteredCount > 0 && (
                <button onClick={() => router.push('/words/mastered')}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:scale-105 active:scale-[0.97]"
                  style={{ backgroundColor: '#2B384A', color: '#FFFFFF' }}
                >
                  Mastered List
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Settings Modal ===== */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border p-7"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 8px 40px -8px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: '#2F2F2F' }}>Study Settings</h2>
              <button onClick={() => setShowSettings(false)}
                className="rounded-full p-1.5 transition-colors hover:opacity-60"
                style={{ color: '#999999' }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-3" style={{ color: '#555555' }}>
                Daily Word Count
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={dailyTarget}
                  onChange={(e) => saveDailyTarget(parseInt(e.target.value, 10) || 1)}
                  className="w-24 rounded-xl border px-4 py-2.5 text-center text-base font-medium tabular-nums outline-none transition-colors focus:border-stone-400"
                  style={{ borderColor: 'rgba(0,0,0,0.1)', color: '#2F2F2F', backgroundColor: '#F8F6F4' }}
                />
                <span className="text-sm" style={{ color: '#888888' }}>words per session</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
