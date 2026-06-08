'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ThemePack {
  theme: string
  count: number
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

const THEME_ICONS: Record<string, string> = {
  kitchen: '🍳',
  car: '🚗',
  clothing: '👕',
  restaurant: '🍽️',
  hotel: '🏨',
  body: '💪',
  office: '💼',
  technology: '💻',
  school: '📚',
  sports: '⚽',
  shopping: '🛍️',
  transportation: '🚌',
  entertainment: '🎬',
  weather: '🌤️',
  home: '🏠',
  people: '👨‍👩‍👧‍👧',
  'mechanical-engineering': '⚙️',
  'computer-ai': '🤖',
  automotive: '🏎️',
  'foreign-trade': '🌐',
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<ThemePack[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/words/themes')
        const data = await res.json()
        setThemes(data.themes || [])
      } catch {
        setThemes([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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

      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12">
        <div className="w-full max-w-2xl mx-auto text-center mb-10 animate-header">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>Word Packs</h1>
          <p className="mt-2 text-sm" style={{ color: '#757575' }}>Choose a theme to study</p>
        </div>

        <div className="w-full max-w-2xl mx-auto space-y-3 stagger-wrapper">
          {themes.map((t) => (
            <div
              key={t.theme}
              className="w-full flex items-center gap-5 rounded-3xl border px-6 md:px-8 py-5 transition-all theme-card animate-item"
              style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.04)' }}
            >
              <button onClick={() => router.push(`/words/themes/${t.theme}`)} className="flex items-center gap-5 flex-1 text-left">
                <span className="text-3xl theme-emoji">{THEME_ICONS[t.theme] || '📚'}</span>
                <div className="flex-1">
                  <h2 className="text-lg font-bold theme-title" style={{ color: '#2F2F2F' }}>{THEME_LABELS[t.theme] || t.theme}</h2>
                  <p className="text-sm theme-subtitle" style={{ color: '#888888' }}>{t.count} words</p>
                </div>
              </button>
              <button onClick={() => router.push(`/words/themes/${t.theme}/list`)}
                className="text-xs font-medium whitespace-nowrap rounded-full px-3.5 py-1.5 transition-all active:scale-[0.97] theme-wordlist-link"
                style={{ color: '#FFFFFF' }}>
                Word List
              </button>
            </div>
          ))}
          {themes.length === 0 && (
            <p className="text-center text-sm" style={{ color: '#757575' }}>No word packs available yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
