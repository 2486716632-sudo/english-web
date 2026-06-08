'use client'

import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'

const DAILY_TARGET_KEY = 'english-assistant-daily-target'

function getStoredTarget(): number {
  if (typeof window === 'undefined') return 15
  const stored = localStorage.getItem(DAILY_TARGET_KEY)
  const num = stored ? parseInt(stored, 10) : 15
  return Math.min(Math.max(num, 1), 100)
}

export default function VocabularyPage() {
  const router = useRouter()

  const [showSettings, setShowSettings] = useState(false)
  const [dailyTarget, setDailyTarget] = useState(getStoredTarget)

  // Save daily target
  const saveDailyTarget = useCallback((val: number) => {
    const clamped = Math.min(Math.max(val, 1), 100)
    setDailyTarget(clamped)
    localStorage.setItem(DAILY_TARGET_KEY, String(clamped))
  }, [])

  // Start study with user's daily target
  const startStudy = useCallback(() => {
    router.push(`/words/study?dailyTarget=${dailyTarget}`)
  }, [router, dailyTarget])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <div className="w-full px-6 md:px-12 pt-6 pb-2">
        <button onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all hover:opacity-70 active:scale-[0.97]"
          style={{ backgroundColor: '#F0F0F0', color: '#757575' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 -mt-4">
        <div className="w-full max-w-4xl mx-auto text-center mb-14">
          <span className="inline-flex items-center justify-center rounded-[1.25rem] mb-7 h-24 w-24 animate-book-icon hover:scale-105 hover:shadow-[0_8px_24px_-4px_rgba(59,46,36,0.25)] duration-300 cursor-default" style={{ backgroundColor: '#3B2E24' }}>
            <svg className="h-[52px] w-[52px]" viewBox="0 0 24 24" fill="none" style={{ overflow: 'visible' }}>
              {/* Book shadow/offset for depth */}
              <rect x="3" y="3" width="18" height="18" rx="1.8" fill="#D4A853" opacity="0.15" />
              {/* Book cover */}
              <rect x="2.5" y="2.5" width="18" height="18" rx="1.8" fill="#F5F0EB" stroke="#E0D5C0" strokeWidth="0.8" />
              {/* Spine */}
              <rect x="2.5" y="2.5" width="3" height="18" rx="1" fill="#EDE3D0" stroke="#E0D5C0" strokeWidth="0.8" />
              {/* Page edge detail */}
              <rect x="5.2" y="3.8" width="15.3" height="16.4" rx="0.8" fill="#FAF8F4" stroke="#E8E0D0" strokeWidth="0.4" />
              {/* Subtle page lines */}
              <line x1="7" y1="8" x2="18" y2="8" stroke="#D4C8B0" strokeWidth="0.5" strokeLinecap="round" opacity="0.5" />
              <line x1="7" y1="10.5" x2="15" y2="10.5" stroke="#D4C8B0" strokeWidth="0.5" strokeLinecap="round" opacity="0.5" />
              <line x1="7" y1="13" x2="17" y2="13" stroke="#D4C8B0" strokeWidth="0.5" strokeLinecap="round" opacity="0.5" />
              {/* Gold foil accent */}
              <line x1="7" y1="15.5" x2="14" y2="15.5" stroke="#C49B3F" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
            </svg>
          </span>
          <h1 className="text-5xl font-bold tracking-tight animate-vocab-title" style={{ color: '#262626' }}>Vocabulary</h1>
          <p className="mt-3.5 text-lg animate-vocab-subtitle" style={{ color: '#888888' }}>Choose a mode to start learning</p>
        </div>

        <div className="w-full max-w-4xl mx-auto space-y-5">
          {/* Daily Study card */}
          <button onClick={startStudy}
            className="w-full flex items-center gap-6 rounded-3xl border px-8 py-8 text-left transition-all active:scale-[0.98] animate-card-1 vocab-card"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl vocab-card-icon" style={{ backgroundColor: '#E8EDF4' }}>
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#5A7A9A' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold" style={{ color: '#2F2F2F' }}>Daily Study</h2>
                <span onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
                  className="inline-flex cursor-pointer rounded-full transition-colors hover:opacity-60"
                  style={{ color: '#999999' }}
                  title="Study Settings"
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              </div>
              <p className="mt-1 text-base" style={{ color: '#888888' }}>SM-2 spaced repetition for IELTS vocabulary</p>
            </div>
            <svg className="h-5 w-5 shrink-0 vocab-card-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#BBBBBB' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Word Packs card */}
          <button onClick={() => router.push('/words/themes')}
            className="w-full flex items-center gap-6 rounded-3xl border px-8 py-8 text-left transition-all active:scale-[0.98] animate-card-2 vocab-card"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl vocab-card-icon" style={{ backgroundColor: '#F4EDE8' }}>
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#9A7A5A' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold" style={{ color: '#2F2F2F' }}>Word Packs</h2>
              <p className="mt-1 text-base" style={{ color: '#888888' }}>Scene-based thematic vocabulary (Kitchen, Car, Office…)</p>
            </div>
            <svg className="h-5 w-5 shrink-0 vocab-card-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#BBBBBB' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== Settings Modal ===== */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border p-7 max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 8px 40px -8px rgba(0,0,0,0.15)' }}
          >
            {/* Header */}
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

            {/* Daily word count */}
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
