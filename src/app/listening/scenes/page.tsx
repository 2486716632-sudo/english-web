'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import type { SceneItem, Category } from '@/features/listening/components/SectionRow'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
})

const DIFFICULTY_LABELS: Record<string, string> = {
  elementary: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const CATEGORY_EN: Record<string, string> = {
  'scene-campus': 'Campus Life',
  'scene-daily': 'Daily Life',
  'scene-travel': 'Travel',
  'scene-social': 'Social',
  'scene-workplace': 'Workplace',
  'scene-health': 'Health & Medical',
  'scene-professional': 'Professional',
}

const SUBCATEGORY_EN: Record<string, string> = {
  'campus-lecture': 'Lecture Rants',
  'campus-groupwork': 'Group Work',
  'campus-courses': 'Courses & Majors',
  'campus-dorm': 'Dorm Life',
  'campus-activity': 'Campus Activities',
  'daily-food': 'Food & Dining',
  'daily-transit': 'Transportation',
  'daily-shopping': 'Shopping',
  'daily-living': 'Living',
  'daily-emergency': 'Emergencies',
  'travel-prep': 'Trip Planning',
  'travel-airport': 'Airport & Customs',
  'travel-lodging': 'Lodging',
  'travel-local': 'Local Experiences',
  'travel-accident': 'Travel Mishaps',
  'social-invite': 'Invitations',
  'social-chat': 'Casual Chat',
  'social-emotion': 'Emotions',
  'social-vent': 'Venting',
  'social-holiday': 'Holidays',
  'workplace-jobhunt': 'Job Hunting',
  'workplace-daily': 'Daily Work',
  'workplace-meeting': 'Meetings',
  'workplace-problem': 'Workplace Challenges',
  'health-doctor': 'Doctor Visits',
  'health-pharmacy': 'Pharmacy',
  'health-hospital': 'Hospital',
  'health-fitness': 'Fitness',
  'professional-mechanical': 'Mechanical Engineering',
  'professional-automotive': 'Automotive',
  'professional-cs': 'Computer & AI',
  'professional-trade': 'Foreign Trade',
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SceneCard({ scene, index, showCn, categoryId }: { scene: SceneItem; index: number; showCn: boolean; categoryId: string }) {
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
            categoryId,
          }))
        }
      }}
      className="group rounded-xl px-4 py-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'transparent',
        animation: `cardFadeIn 0.4s ease-out ${index * 0.04}s both`,
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F5F2EF' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
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

export default function ScenesPage() {
  const [savedState, setSavedState] = useState<{ scrollY: number; categoryId: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [scenes, setScenes] = useState<Record<string, SceneItem[]>>({})
  const [activeCategory, setActiveCategory] = useState('')
  const [showChineseMap, setShowChineseMap] = useState<Record<string, boolean>>({})
  const mainRef = useRef<HTMLElement>(null)
  const restoredRef = useRef(false)

  // Read saved scroll state from sessionStorage after mount (never during SSR)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lsn-restore')
      if (raw) {
        sessionStorage.removeItem('lsn-restore')
        const parsed = JSON.parse(raw) as { scrollY: number; categoryId: string }
        setSavedState(parsed)
        setActiveCategory(parsed.categoryId)
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

        const cats = (catData.categories || []).filter((c: Category) => c.type === 'scene')
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

  // Set default category when categories first load (no saved state)
  useEffect(() => {
    if (categories.length > 0 && !activeCategory && !savedState) {
      setActiveCategory(categories[0].id)
    }
  }, [categories, activeCategory, savedState])

  function switchCategory(id: string) {
    setActiveCategory(id)
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeCat = categories.find(c => c.id === activeCategory)
  const subcategories = activeCat?.subcategories || []
  const totalScenes = activeCat
    ? activeCat.subcategories.reduce((sum, sub) => sum + (scenes[sub.id]?.length || 0), 0)
    : 0
  const catName = activeCategory ? (CATEGORY_EN[activeCategory] || activeCat?.nameZh || '') : ''

  return (
    <div className="w-full h-screen flex overflow-hidden" style={{ backgroundColor: '#F8F6F4' }}>
      {/* ===== Left Sidebar ===== */}
      <aside className="w-72 h-full flex flex-col flex-shrink-0">
        {/* Back + title */}
        <div className="flex items-center gap-3 px-6 pt-7 pb-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <Link
            href="/listening"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
            style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
            Scenes
          </h1>
        </div>

        {/* Category nav + Generate */}
        <div className="flex-1 flex flex-col overflow-y-auto px-3 py-5">
          <nav className="flex flex-col gap-0.5">
          {categories.map((cat, idx) => {
            const isActive = activeCategory === cat.id
            const navCatName = CATEGORY_EN[cat.id] || cat.nameZh
            return (
              <button
                key={cat.id}
                onClick={() => switchCategory(cat.id)}
                className="relative group flex items-center gap-3 w-full rounded-lg px-4 py-3 text-left transition-all duration-300 hover:bg-white hover:translate-x-1 hover:scale-[1.02] active:scale-[0.96]"
                style={{
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  animation: `navSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.04}s both`,
                }}
              >
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-500"
                  style={{
                    height: isActive ? '24px' : '0px',
                    backgroundColor: '#262626',
                    opacity: isActive ? 1 : 0,
                  }}
                />
                <span
                  className="text-lg transition-all duration-500 group-hover:scale-125 group-hover:-rotate-6"
                  style={{ transform: isActive ? 'scale(1.2)' : 'scale(1)' }}
                >{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm leading-tight transition-all duration-300"
                    style={{
                      color: isActive ? '#262626' : '#78716c',
                      fontWeight: isActive ? 700 : 400,
                      letterSpacing: isActive ? '0.02em' : '0em',
                    }}
                  >
                    {navCatName}
                  </div>
                </div>
              </button>
            )
          })}
          </nav>

        </div>
      </aside>

      {/* ===== Right Main Content ===== */}
      <main ref={mainRef} data-scrollable className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="p-10">
          {/* Wrapper keyed to activeCategory for unified entrance animation */}
          <div key={activeCategory} style={{ animation: 'fadeSlideIn 0.35s ease-out both' }}>
          {/* Header bar */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{activeCat?.icon}</span>
                <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#262626' }}>
                  {catName}
                </h2>
              </div>
              <p className="text-sm mt-1" style={{ color: '#a8a29e' }}>
                {totalScenes} scenes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/listening/history?from=scenes"
                className="rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
              >
                History
              </Link>
            </div>
          </div>

          {/* Sections */}
          {loading ? (
            <div className="space-y-10">
              {[1, 2, 3].map(s => (
                <div key={s}>
                  <div className="h-5 w-40 rounded mb-4" style={{ backgroundColor: '#e5e5e5' }} />
                  <div className="grid grid-cols-3 gap-6">
                    {[1, 2, 3].map(c => (
                      <div key={c} className="animate-pulse rounded-xl px-4 py-5" style={{ backgroundColor: '#F0F0F0' }}>
                        <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#e5e5e5' }} />
                        <div className="mt-3 h-3 w-1/2 rounded" style={{ backgroundColor: '#e5e5e5' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : subcategories.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm" style={{ color: '#d6d3d1' }}>No subcategories.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {subcategories.map(sub => {
                const itemScenes = scenes[sub.id] || []
                const subShowCn = showChineseMap[sub.id] || false
                const subDisplayName = subShowCn ? sub.nameZh : (SUBCATEGORY_EN[sub.id] || sub.nameZh)
                return (
                  <section key={sub.id} style={{ animation: `sectionReveal 0.4s ease-out both` }}>
                    <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid #c0b8b0' }}>
                      <h3 className={`${displayFont.className} text-xl font-semibold tracking-normal transition-all duration-200 hover:tracking-wider`} style={{ color: '#C9A04E' }}>
                        {subDisplayName}
                      </h3>
                      <button
                        onClick={() => setShowChineseMap(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{
                          backgroundColor: subShowCn ? '#262626' : '#EDE8E3',
                          color: subShowCn ? '#FFFFFF' : '#78716c',
                        }}
                      >
                        {subShowCn ? 'EN' : 'CN'}
                      </button>
                    </div>
                    {itemScenes.length === 0 ? (
                      <p className="text-sm py-8 text-center" style={{ color: '#d6d3d1' }}>No scenarios yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {itemScenes.map((scene, i) => (
                          <SceneCard key={scene.id} scene={scene} index={i} showCn={subShowCn} categoryId={activeCategory} />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sectionReveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes navSlideIn {
          from { opacity: 0; transform: translateX(-24px) scale(0.92); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
