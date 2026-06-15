'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import type { SceneItem, Category } from '@/features/listening/components/SectionRow'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
})

const SUBCATEGORY_EN: Record<string, string> = {
  'knowledge-tech': 'Technology',
  'knowledge-nature': 'Nature & Environment',
  'knowledge-business': 'Business & Economy',
  'knowledge-society': 'Society & Culture',
  'knowledge-history': 'History',
  'knowledge-health': 'Health & Wellness',
  'knowledge-sports': 'Sports Science',
  'knowledge-psychology': 'Psychology & Cognition',
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ArticleCard({ scene, index, showCn, subId }: { scene: SceneItem; index: number; showCn: boolean; subId: string }) {
  const isNew = !scene.playedAt
  const displayTitle = showCn && scene.titleZh ? scene.titleZh : scene.title

  return (
    <Link
      href={`/listening/${scene.id}`}
      onClick={() => {
        const main = document.querySelector('main[data-scrollable]')
        if (main) {
          sessionStorage.setItem('lsn-restore', JSON.stringify({
            scrollY: main.scrollTop,
            subId,
          }))
        }
      }}
      className="group rounded-xl px-4 py-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: '#FFFFFF',
        animation: `cardFadeIn 0.4s ease-out ${index * 0.04}s both`,
        border: '1px solid rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F5F2EF'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start gap-2 mb-2">
        <h3 className="text-base font-semibold leading-snug flex-1 transition-colors duration-200 group-hover:text-[#262626]" style={{ color: '#57534e' }}>
          {displayTitle}
        </h3>
        {isNew && (
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: '#262626' }} />
        )}
      </div>
      <p className="text-sm" style={{ color: '#a8a29e' }}>
        <span className="font-mono text-[11px]">{formatDuration(scene.duration)}</span>
      </p>
    </Link>
  )
}

export default function KnowledgePage() {
  const [savedState, setSavedState] = useState<{ scrollY: number; subId?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [scenes, setScenes] = useState<Record<string, SceneItem[]>>({})
  const [activeSub, setActiveSub] = useState('')
  const [showCnMap, setShowCnMap] = useState<Record<string, boolean>>({})
  const tabsRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const restoredRef = useRef(false)

  // Read saved scroll state from sessionStorage after mount (never during SSR)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lsn-restore')
      if (raw) {
        sessionStorage.removeItem('lsn-restore')
        const parsed = JSON.parse(raw) as { scrollY: number; subId?: string }
        setSavedState(parsed)
        if (parsed.subId) setActiveSub(parsed.subId)
      }
    } catch {}
  }, [])

  // Restore scroll position — runs after every render, waits until content is tall enough
  useLayoutEffect(() => {
    if (!savedState || restoredRef.current || !mainRef.current) return
    const el = mainRef.current
    const target = savedState.scrollY
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll >= target) {
      restoredRef.current = true
      el.scrollTop = target
    }
  })

  // Load data on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [catRes, sceneRes] = await Promise.all([
          fetch('/api/listening/categories'),
          fetch('/api/listening/scenes'),
        ])
        const catData = await catRes.json()
        const sceneData = await sceneRes.json()

        const cats = (catData.categories || []).filter((c: Category) => c.type === 'knowledge')
        if (cancelled) return
        setCategories(cats)

        const grouped: Record<string, SceneItem[]> = {}
        for (const s of sceneData.scenes || []) {
          if (!grouped[s.subcategoryId]) grouped[s.subcategoryId] = []
          grouped[s.subcategoryId].push(s)
        }
        if (cancelled) return
        setScenes(grouped)
      } catch {
        if (cancelled) return
        setCategories([])
        setScenes({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeCat = categories[0]
  const subcategories = activeCat?.subcategories || []
  const activeSubData = subcategories.find(s => s.id === activeSub)

  // Set default subcategory when data loads (no saved state)
  useEffect(() => {
    if (!activeSub && subcategories.length > 0 && !loading && !savedState) {
      setActiveSub(subcategories[0].id)
    }
  }, [activeSub, subcategories, loading, savedState])
  const activeScenes = activeSub ? (scenes[activeSub] || []) : []

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#F8F6F4' }}>
      {/* ===== Top bar ===== */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 md:px-12 pt-6 pb-4">
        <div className="flex items-center gap-5">
          <Link
            href="/listening"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
            style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeCat?.icon}</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: '#262626' }}>Knowledge</h1>
              <p className="text-xs mt-0.5" style={{ color: '#a8a29e' }}>Knowledge listening</p>
            </div>
          </div>
        </div>
        <Link
          href="/listening/history?from=knowledge"
          className="rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
        >
          History
        </Link>
      </div>

      {/* ===== Subcategory tabs ===== */}
      {!loading && subcategories.length > 0 && (
        <div
          ref={tabsRef}
          className="flex-shrink-0 flex items-center gap-1.5 overflow-x-auto px-8 md:px-12 pb-5 scrollbar-none"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', borderBottom: '2px solid #c0b8b0' }}
        >
          {subcategories.map((sub, idx) => {
            const isActive = activeSub === sub.id
            const enName = SUBCATEGORY_EN[sub.id] || sub.nameZh
            const sceneCount = scenes[sub.id]?.length || 0
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSub(sub.id)}
                className="flex-shrink-0 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: isActive ? '#C9A04E' : '#F3F1EF',
                  color: isActive ? '#FFFFFF' : '#57534e',
                  boxShadow: isActive ? '0 2px 12px rgba(201,160,78,0.25)' : 'none',
                  animation: `tabSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.03}s both`,
                }}
              >
                <span>{enName}</span>
                {sceneCount > 0 && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-full font-mono"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#EDE8E3',
                      color: isActive ? 'rgba(255,255,255,0.85)' : '#78716c',
                    }}
                  >
                    {sceneCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ===== Main content ===== */}
      <main ref={mainRef} data-scrollable className="flex-1 overflow-y-auto flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="px-8 md:px-12 py-8 flex-1 flex flex-col">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(c => (
                <div key={c} className="animate-pulse rounded-xl px-4 py-5" style={{ backgroundColor: '#F0F0F0' }}>
                  <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#e5e5e5' }} />
                  <div className="mt-3 h-3 w-1/2 rounded" style={{ backgroundColor: '#e5e5e5' }} />
                </div>
              ))}
            </div>
          ) : !activeCat || subcategories.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-sm" style={{ color: '#d6d3d1' }}>No content yet.</p>
            </div>
          ) : !activeSubData ? null : (
            <div key={activeSub} className="flex-1 flex flex-col" style={{ animation: 'fadeSlideIn 0.3s ease-out both' }}>
              <div className="flex items-center gap-3 mb-6 pb-3">
                <h2 className={`${displayFont.className} text-2xl font-semibold tracking-normal transition-all duration-200 hover:tracking-wider`} style={{ color: '#C9A04E' }}>
                  {showCnMap[activeSub] ? activeSubData.nameZh : (SUBCATEGORY_EN[activeSub] || activeSubData.nameZh)}
                </h2>
                <button
                  onClick={() => setShowCnMap(prev => ({ ...prev, [activeSub]: !prev[activeSub] }))}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: showCnMap[activeSub] ? '#262626' : '#EDE8E3',
                    color: showCnMap[activeSub] ? '#FFFFFF' : '#78716c',
                  }}
                >
                  {showCnMap[activeSub] ? 'EN' : 'CN'}
                </button>
              </div>
              {activeScenes.length === 0 ? (
                <div className="flex items-center justify-center flex-1">
                  <p className="text-sm" style={{ color: '#d6d3d1' }}>No articles yet.</p>
                </div>
              ) : (
                <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="grid grid-cols-2 gap-3">
                    {activeScenes.map((scene, i) => (
                      <ArticleCard key={scene.id} scene={scene} index={i} showCn={showCnMap[activeSub]} subId={activeSub} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tabSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
