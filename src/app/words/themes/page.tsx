'use client'

import { useEffect, useState, useCallback, useRef, useLayoutEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearWordCaches } from '@/lib/word-cache'

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

const EMOJI_POOL = ['📦', '🎯', '⭐', '🔥', '💡', '🎨', '🚀', '🌈', '🎪', '🏆', '🧩', '🎲', '💎', '🔮', '🎭', '📌', '🎀', '🗺️', '⚡', '🎸']
const CUSTOM_META_KEY = 'english-assistant-custom-theme-meta'

// Persistent cache for generated theme labels + emojis (backed by localStorage)
const customLabels: Record<string, string> = {}
const customEmojis: Record<string, string> = {}

// Hydrate from localStorage at module load
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(CUSTOM_META_KEY)
    if (raw) {
      const meta = JSON.parse(raw) as Record<string, { label: string; emoji: string }>
      for (const [key, val] of Object.entries(meta)) {
        if (val.label) customLabels[key] = val.label
        if (val.emoji) customEmojis[key] = val.emoji
      }
    }
  } catch { /* ignore corrupt data */ }
}

function persistCustomMeta(theme: string, label: string, emoji: string) {
  customLabels[theme] = label
  customEmojis[theme] = emoji
  try {
    const raw = localStorage.getItem(CUSTOM_META_KEY)
    const meta = raw ? JSON.parse(raw) as Record<string, { label: string; emoji: string }> : {}
    meta[theme] = { label, emoji }
    localStorage.setItem(CUSTOM_META_KEY, JSON.stringify(meta))
  } catch { /* ignore */ }
}

function removeCustomMeta(theme: string) {
  delete customLabels[theme]
  delete customEmojis[theme]
  try {
    const raw = localStorage.getItem(CUSTOM_META_KEY)
    if (!raw) return
    const meta = JSON.parse(raw) as Record<string, { label: string; emoji: string }>
    delete meta[theme]
    localStorage.setItem(CUSTOM_META_KEY, JSON.stringify(meta))
  } catch { /* ignore */ }
}

function themeLabel(theme: string): string {
  if (THEME_LABELS[theme]) return THEME_LABELS[theme]
  if (customLabels[theme]) return customLabels[theme]
  return theme.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function themeEmoji(theme: string): string {
  if (THEME_ICONS[theme]) return THEME_ICONS[theme]
  if (customEmojis[theme]) return customEmojis[theme]
  let hash = 0
  for (let i = 0; i < theme.length; i++) { hash = ((hash << 5) - hash) + theme.charCodeAt(i); hash |= 0 }
  return EMOJI_POOL[Math.abs(hash) % EMOJI_POOL.length]
}

function isBuiltIn(theme: string): boolean {
  return theme in THEME_LABELS
}

// Module-level scroll state — set by card onClick, read + cleared on mount
let _themesSaved: number | null = null

// Module-level cache
let cachedThemes: ThemePack[] | null = null

export default function ThemesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    }>
      <ThemesPageInner />
    </Suspense>
  )
}

function ThemesPageInner() {
  const searchParams = useSearchParams()
  const [themes, setThemes] = useState<ThemePack[]>(cachedThemes ?? [])
  const [loading, setLoading] = useState(!cachedThemes)
  const activeTab: 'default' | 'custom' = searchParams.get('tab') === 'custom' ? 'custom' : 'default'
  const [showCreate, setShowCreate] = useState(false)
  const [createTheme, setCreateTheme] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [existsInfo, setExistsInfo] = useState<{ theme: string; count: number; label?: string; emoji?: string } | null>(null)
  const [deleteMode, setDeleteMode] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newThemeName, setNewThemeName] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()
  const [savedScrollY] = useState(() => {
    const v = _themesSaved
    _themesSaved = null
    return v
  })
  const restoredRef = useRef(false)

  // Restore scroll position — runs after every render, waits until content is tall enough
  useLayoutEffect(() => {
    if (savedScrollY === null || restoredRef.current) return
    const el = document.querySelector('main[data-scrollable]')
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll >= savedScrollY) {
      restoredRef.current = true
      el.scrollTop = savedScrollY
    }
  })

  function saveScroll() {
    const main = document.querySelector('main[data-scrollable]')
    if (main) {
      _themesSaved = main.scrollTop
    }
  }

  const defaultThemes = themes.filter(t => isBuiltIn(t.theme))
  const customThemes = themes.filter(t => !isBuiltIn(t.theme))

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const res = await fetch('/api/words/themes')
        const data = await res.json()
        if (ignore) return
        cachedThemes = data.themes || []
        setThemes(data.themes || [])
      } catch {
        if (!ignore) setThemes([])
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  const handleGenerate = useCallback(async (force = false) => {
    if (!createTheme.trim()) return
    setGenerating(true)
    setGenError('')
    setExistsInfo(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/words/themes/generate', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: createTheme.trim(), force }),
      })
      const data = await res.json()
      if (data.exists) {
        setExistsInfo(data)
        setShowCreate(true)
        setGenerating(false)
        abortRef.current = null
        return
      }
      if (data.error) {
        setGenError(data.error)
        setShowCreate(true)
        setGenerating(false)
        abortRef.current = null
        return
      }
      // Success — store label + emoji, stay on page with glow
      if (data.label || data.emoji) persistCustomMeta(data.theme, data.label || '', data.emoji || '')
      setShowCreate(false)
      setCreateTheme('')
      setGenerating(false)
      abortRef.current = null
      try {
        const res = await fetch('/api/words/themes')
        const d = await res.json()
        cachedThemes = d.themes || []
        setThemes(d.themes || [])
      } catch {}
      setNewThemeName(data.theme)
      setTimeout(() => setNewThemeName(null), 6000)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') { abortRef.current = null; return }
      setGenError('Network error. Please try again.')
      setShowCreate(true)
      setGenerating(false)
      abortRef.current = null
    }
  }, [createTheme])

  const cancelGenerate = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setGenerating(false)
    setGenError('')
  }, [])

  const handleDelete = useCallback((theme: string) => {
    setConfirmDelete(null)
    // Optimistic: remove from UI instantly, fire API in background
    clearWordCaches(theme)
    removeCustomMeta(theme)
    cachedThemes = cachedThemes?.filter(t => t.theme !== theme) ?? null
    setThemes(prev => prev.filter(t => t.theme !== theme))
    if (customThemes.length <= 1) setDeleteMode(false)
    fetch(`/api/words/themes/${theme}`, { method: 'DELETE' }).catch(() => {})
  }, [customThemes.length])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      {/* ===== Top bar ===== */}
      <div className="flex-shrink-0 flex items-center justify-center relative px-6 md:px-12 pt-6 pb-2">
        <button onClick={() => router.push('/words')}
          className="absolute left-6 md:left-12 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
          style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#262626' }}>Word Packs</h1>
      </div>

      {/* ===== Tabs ===== */}
      <div className="flex-shrink-0 flex items-center justify-center gap-1.5 px-6 md:px-12 pb-5"
        style={{ borderBottom: '2px solid #c0b8b0' }}
      >
        <button onClick={() => router.push('/words/themes')}
          className="flex-shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: activeTab === 'default' ? '#262626' : '#F3F1EF',
            color: activeTab === 'default' ? '#FFFFFF' : '#57534e',
            boxShadow: activeTab === 'default' ? '0 2px 12px rgba(38,38,38,0.25)' : 'none',
          }}
        >
          <span>Default Packs</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full font-mono"
            style={{
              backgroundColor: activeTab === 'default' ? 'rgba(255,255,255,0.25)' : '#EDE8E3',
              color: activeTab === 'default' ? 'rgba(255,255,255,0.85)' : '#78716c',
            }}
          >
            {defaultThemes.length}
          </span>
        </button>
        <button onClick={() => router.push('/words/themes?tab=custom')}
          className="flex-shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: activeTab === 'custom' ? '#262626' : '#F3F1EF',
            color: activeTab === 'custom' ? '#FFFFFF' : '#57534e',
            boxShadow: activeTab === 'custom' ? '0 2px 12px rgba(38,38,38,0.25)' : 'none',
          }}
        >
          <span>Custom Packs</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full font-mono"
            style={{
              backgroundColor: activeTab === 'custom' ? 'rgba(255,255,255,0.25)' : '#EDE8E3',
              color: activeTab === 'custom' ? 'rgba(255,255,255,0.85)' : '#78716c',
            }}
          >
            {customThemes.length}
          </span>
        </button>
      </div>

      {/* ===== Content ===== */}
      <main data-scrollable className="flex-1 overflow-y-auto px-6 md:px-12 py-8">
        <div className="w-full max-w-6xl mx-auto">
          {activeTab === 'default' ? (
            defaultThemes.length === 0 ? (
              <p className="text-center text-sm" style={{ color: '#757575' }}>No default packs available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ animation: 'fadeSlideIn 0.3s ease-out both' }}>
                {defaultThemes.map((t) => (
                  <div key={t.theme}
                    onClick={() => { saveScroll(); router.push(`/words/themes/${t.theme}`) }}
                    className="w-full flex flex-col items-center gap-3 rounded-3xl border px-6 pt-7 pb-5 transition-all theme-card cursor-pointer"
                    style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex flex-col items-center gap-3 w-full text-center pointer-events-none">
                      <span className="text-6xl">{themeEmoji(t.theme)}</span>
                      <div>
                        <h2 className="text-lg font-bold theme-title" style={{ color: '#2F2F2F' }}>{themeLabel(t.theme)}</h2>
                        <p className="text-sm theme-subtitle" style={{ color: '#888888' }}>{t.count} words</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); saveScroll(); router.push(`/words/themes/${t.theme}/list`) }}
                      className="text-xs font-medium rounded-full px-4 py-2 transition-all duration-200 hover:scale-105 active:scale-[0.97] theme-wordlist-link"
                      style={{ color: '#a8a29e' }}>
                      Word List
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ animation: 'fadeSlideIn 0.3s ease-out both' }}>
              {/* Inline create input + delete toggle */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`flex-1 rounded-3xl border px-6 py-5 transition-all duration-300 hover:scale-[1.01] hover:shadow-md group ${createTheme.trim() ? 'border-animate' : ''}`}
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 2px 16px -6px rgba(0,0,0,0.05)' }}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 group-hover:stroke-[#999]" viewBox="0 0 24 24" fill="none" stroke="#c8c0b8" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <input
                      type="text"
                      value={createTheme}
                      onChange={(e) => setCreateTheme(e.target.value)}
                      placeholder="Create a word pack..."
                      disabled={generating}
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: '#2F2F2F' }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && createTheme.trim() && !generating) handleGenerate() }}
                    />
                  </div>
                </div>
                {/* Delete mode toggle — outside input card */}
                {customThemes.length > 0 && (
                  <button onClick={() => { setDeleteMode(!deleteMode); setConfirmDelete(null) }}
                    className="rounded-xl p-2.5 transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
                    style={{ color: deleteMode ? '#DC2626' : '#262626' }}
                    title={deleteMode ? 'Exit delete mode' : 'Delete packs'}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>

              {customThemes.length === 0 ? (
                <p className="text-center text-sm" style={{ color: '#757575' }}>No custom packs yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customThemes.map((t) => (
                    <div key={t.theme}
                      onClick={() => { saveScroll(); router.push(`/words/themes/${t.theme}`) }}
                      className="w-full flex flex-col items-center gap-3 rounded-3xl border px-6 pt-7 pb-5 transition-all theme-card relative cursor-pointer"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: newThemeName === t.theme ? '#FFD700' : 'rgba(0,0,0,0.06)',
                        boxShadow: newThemeName === t.theme ? '0 0 50px 14px rgba(201,160,78,0.55)' : '0 2px 12px -4px rgba(0,0,0,0.04)',
                        animation: newThemeName === t.theme ? 'newCardGlow 2s ease-in-out 3' : undefined,
                      }}
                    >
                      {newThemeName === t.theme && (
                        <div className="absolute -top-3 -right-3 z-10 rounded-full px-3 py-1 text-xs font-bold tracking-wider"
                          style={{
                            backgroundColor: '#C9A04E',
                            color: '#FFFFFF',
                            boxShadow: '0 0 16px 4px rgba(201,160,78,0.5)',
                            animation: 'newCardGlowPulse 2s ease-in-out 3',
                          }}
                        >
                          NEW
                        </div>
                      )}
                      {deleteMode && (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(t.theme) }}
                          className="absolute top-3 right-3 rounded-full w-7 h-7 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                          style={{ backgroundColor: '#FCEAEB', color: '#DC2626' }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <div className="flex flex-col items-center gap-3 w-full text-center pointer-events-none">
                        <span className="text-6xl">{themeEmoji(t.theme)}</span>
                        <div>
                          <h2 className="text-lg font-bold theme-title" style={{ color: '#2F2F2F' }}>{themeLabel(t.theme)}</h2>
                          <p className="text-sm theme-subtitle" style={{ color: '#888888' }}>{t.count} words</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); saveScroll(); router.push(`/words/themes/${t.theme}/list`) }}
                        className="text-xs font-medium rounded-full px-4 py-2 transition-all duration-200 hover:scale-105 active:scale-[0.97] theme-wordlist-link"
                        style={{ color: '#a8a29e' }}>
                        Word List
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ===== Delete confirmation ===== */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border p-7 text-center"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 8px 40px -8px rgba(0,0,0,0.15)' }}
          >
            <div className="mb-4 text-4xl">🗑️</div>
            <h2 className="text-lg font-bold mb-2" style={{ color: '#2F2F2F' }}>Delete Pack?</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#757575' }}>
              Are you sure you want to delete <strong>{themeLabel(confirmDelete)}</strong> and all its words?
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ backgroundColor: '#F0F0F0', color: '#555555' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-[0.97]"
                style={{ backgroundColor: '#DC2626' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Create Modal ===== */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { if (!generating) setShowCreate(false) }}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border p-7"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)', boxShadow: '0 8px 40px -8px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: '#2F2F2F' }}>
                {existsInfo ? 'Already Exists' : 'Create Word Pack'}
              </h2>
              {!generating && (
                <button onClick={() => { setShowCreate(false); setExistsInfo(null); setGenError('') }}
                  className="rounded-full p-1.5 transition-colors hover:opacity-60"
                  style={{ color: '#999999' }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {existsInfo ? (
              <div className="text-center">
                <p className="text-sm leading-relaxed" style={{ color: '#555555' }}>
                  Theme <strong>{existsInfo.label || existsInfo.theme}</strong> already has <strong>{existsInfo.count}</strong> words.
                </p>
                <p className="mt-1 text-xs" style={{ color: '#AAAAAA' }}>
                  You can create additional words for this pack (existing words won't be removed).
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={() => { setShowCreate(false); setExistsInfo(null) }}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.97]"
                    style={{ backgroundColor: '#F0F0F0', color: '#555555' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleGenerate(true)}
                    disabled={generating}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-[0.97] disabled:opacity-40"
                    style={{ backgroundColor: '#262626' }}>
                    {generating ? 'Generating…' : 'Create Anyway'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={createTheme}
                  onChange={(e) => setCreateTheme(e.target.value)}
                  placeholder="e.g. fitness, gardening, cooking..."
                  disabled={generating}
                  className="w-full rounded-xl border px-4 py-3 text-base outline-none transition-colors focus:border-stone-400"
                  style={{ borderColor: 'rgba(0,0,0,0.1)', color: '#2F2F2F', backgroundColor: '#F8F6F4' }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && createTheme.trim() && !generating) handleGenerate() }}
                />

                {genError && (
                  <p className="mt-2 text-xs" style={{ color: '#DC2626' }}>{genError}</p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setShowCreate(false)}
                    disabled={generating}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-40"
                    style={{ backgroundColor: '#F0F0F0', color: '#555555' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleGenerate()}
                    disabled={!createTheme.trim() || generating}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 active:scale-[0.97] disabled:opacity-40"
                    style={{ backgroundColor: generateBtnBg(createTheme.trim(), generating), color: canGenerate(createTheme.trim(), generating) ? '#FFFFFF' : '#AAAAAA' }}
                  >
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Generating…
                      </span>
                    ) : 'Generate'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(0,0,0,0.08); }
          50% { border-color: rgba(0,0,0,0.22); }
        }
        @keyframes newCardGlow {
          0%, 100% { box-shadow: 0 2px 12px -4px rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.06); transform: scale(1); }
          25% { box-shadow: 0 0 30px 8px rgba(201,160,78,0.4), 0 2px 12px -4px rgba(0,0,0,0.04); border-color: #C9A04E; transform: scale(1.03); }
          50% { box-shadow: 0 0 50px 14px rgba(201,160,78,0.55), 0 2px 12px -4px rgba(0,0,0,0.04); border-color: #FFD700; transform: scale(1.02); }
          75% { box-shadow: 0 0 30px 8px rgba(201,160,78,0.4), 0 2px 12px -4px rgba(0,0,0,0.04); border-color: #C9A04E; transform: scale(1.03); }
        }
        @keyframes newCardGlowPulse {
          0%, 100% { opacity: 0; }
          15%, 85% { opacity: 1; }
        }
        .border-animate {
          animation: borderPulse 2s ease-in-out infinite;
        }
        @keyframes genSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes genDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Loading overlay — top level, full screen */}
      {generating && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <div className="relative rounded-3xl px-12 py-12 flex flex-col items-center gap-5 overflow-hidden"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0 8px 40px -8px rgba(0,0,0,0.15)',
            }}
          >
            {/* Animated gradient background */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              background: 'linear-gradient(135deg, #C9A04E, #5A7A9A, #9A7A5A, #C9A04E)',
              backgroundSize: '400% 400%',
              animation: 'gradientShift 3s ease infinite',
            }} />
            <button onClick={cancelGenerate}
              className="absolute top-5 right-5 rounded-full p-1 transition-opacity hover:opacity-60 z-10"
              style={{ color: '#999999' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Double ring spinner */}
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: '#F0F0F0' }} />
              <div className="absolute inset-0 rounded-full border-2 border-t-transparent" style={{
                borderColor: '#C9A04E',
                borderTopColor: 'transparent',
                animation: 'genSpin 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
              }} />
              <div className="absolute inset-2 rounded-full border-2 border-t-transparent" style={{
                borderColor: '#5A7A9A',
                borderTopColor: 'transparent',
                animation: 'genSpin 1.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite reverse',
              }} />
            </div>
            <div className="text-center z-10">
              <p className="text-sm font-semibold" style={{ color: '#2F2F2F' }}>Generating Word Pack</p>
              <p className="text-xs mt-2" style={{ color: '#888888' }}>
                Crafting vocabulary words with examples...
              </p>
              <p className="text-xs mt-3" style={{ color: '#AAAAAA' }}>About 30 ~ 60 seconds</p>
              <div className="mt-4 flex justify-center gap-1.5">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{
                    backgroundColor: '#C9A04E',
                    animation: `genDot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function canGenerate(theme: string, generating: boolean): boolean {
  return theme.trim().length > 0 && !generating
}
function generateBtnBg(theme: string, generating: boolean): string {
  return canGenerate(theme, generating) ? '#262626' : '#F0F0F0'
}
