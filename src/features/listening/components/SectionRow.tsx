'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

export interface SceneItem {
  id: string
  categoryId: string
  subcategoryId: string
  title: string
  titleZh?: string | null
  difficulty: string
  duration: number
  speakers: number
  playedAt: string | null
  createdAt: string
}

export interface SubCategory {
  id: string
  name: string
  nameZh: string
  description: string
  dialogueType: string
  targetPoolSize: number
  maxPoolSize: number
}

export interface Category {
  id: string
  name: string
  nameZh: string
  icon: string
  isCore: boolean
  type: string
  subcategories: SubCategory[]
}

const DIFFICULTY_STYLES: Record<string, { label: string; bg: string; dot: string }> = {
  elementary: { label: '初级', bg: 'rgba(52,211,153,0.15)', dot: '#34d399' },
  intermediate: { label: '中级', bg: 'rgba(251,191,36,0.15)', dot: '#fbbf24' },
  advanced: { label: '高级', bg: 'rgba(251,113,133,0.15)', dot: '#fb7185' },
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SceneCard({ scene }: { scene: SceneItem }) {
  const diff = DIFFICULTY_STYLES[scene.difficulty] || DIFFICULTY_STYLES.intermediate

  return (
    <Link
      href={`/listening/${scene.id}`}
      className="flex-shrink-0 w-44 rounded-xl bg-white p-4 group"
      style={{
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        transition: 'all 0.25s cubic-bezier(0.21, 0.89, 0.32, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0,0,0,0.12), 0 4px 8px -4px rgba(0,0,0,0.06)'
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
      }}
    >
      <h4 className="text-[13px] font-semibold leading-snug mb-3" style={{ color: '#1a1a1a' }}>
        {scene.title}
      </h4>
      <div className="mt-auto flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: diff.bg, color: diff.dot }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: diff.dot }} />
          {diff.label}
        </span>
        <span className="text-[11px] font-mono" style={{ color: '#999' }}>
          {formatDuration(scene.duration)}
        </span>
        {scene.playedAt ? (
          <span className="text-[10px] ml-auto" style={{ color: '#bbb' }}>已听</span>
        ) : (
          <span className="text-[10px] font-semibold ml-auto" style={{ color: '#34d399' }}>NEW</span>
        )}
      </div>
    </Link>
  )
}

function SubCategoryBlock({ sub, scenes }: { sub: SubCategory; scenes: Record<string, SceneItem[]> }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const dbScenes = scenes[sub.id] || []
  const newCount = dbScenes.filter(s => !s.playedAt).length

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [checkScroll, dbScenes])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{
      border: '1px solid rgba(0,0,0,0.05)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold" style={{ color: '#2a2a2a' }}>{sub.name}</h3>
          <span className="text-[11px] font-mono" style={{ color: '#aaa' }}>{sub.nameZh}</span>
          <span className="hidden sm:inline text-[11px]" style={{ color: '#ccc' }}>·</span>
          <span className="hidden sm:inline text-[11px]" style={{ color: '#bbb' }}>{dbScenes.length} 个场景</span>
        </div>
        {newCount > 0 && (
          <span
            className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: 'rgba(52,211,153,0.12)',
              color: '#10b981',
            }}
          >
            {newCount} 未听
          </span>
        )}
      </div>

      {/* Scene cards with arrows */}
      <div className="px-5 pb-4 relative group/row">
        {canScrollLeft && (
          <button onClick={() => scroll('left')}
            className="absolute left-1 z-10 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center
              opacity-0 group-hover/row:opacity-100 transition-all duration-300"
            style={{ border: 'none', background: 'none' }}>
            <div className="rounded-full w-8 h-8 flex items-center justify-center shadow-md bg-white"
              style={{ color: '#888' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </div>
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {dbScenes.length === 0 ? (
            <div className="flex-shrink-0 w-full rounded-lg flex items-center justify-center h-16"
              style={{
                border: '1px dashed rgba(0,0,0,0.08)',
                backgroundColor: 'rgba(255,255,255,0.5)',
              }}>
              <span className="text-xs" style={{ color: '#bbb' }}>暂无场景</span>
            </div>
          ) : (
            dbScenes.map(scene => (
              <SceneCard key={scene.id} scene={scene} />
            ))
          )}
        </div>
        {canScrollRight && (
          <button onClick={() => scroll('right')}
            className="absolute right-1 z-10 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center
              opacity-0 group-hover/row:opacity-100 transition-all duration-300"
            style={{ border: 'none', background: 'none' }}>
            <div className="rounded-full w-8 h-8 flex items-center justify-center shadow-md bg-white"
              style={{ color: '#888' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export default function SectionRow({ category, scenes }: { category: Category; scenes: Record<string, SceneItem[]> }) {
  const totalScenes = category.subcategories.reduce((sum, sub) => sum + (scenes[sub.id]?.length || 0), 0)

  return (
    <section className="listening-section">
      {/* Category header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
        >
          {category.icon}
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: '#1c1c1c' }}>
            {category.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono" style={{ color: '#aaa' }}>{category.nameZh}</span>
            <span className="text-[10px]" style={{ color: '#ccc' }}>·</span>
            <span className="text-[11px]" style={{ color: '#bbb' }}>{totalScenes} 个场景</span>
          </div>
        </div>
      </div>

      {/* Subcategory blocks */}
      <div className="space-y-3">
        {category.subcategories.map((sub) => (
          <SubCategoryBlock key={sub.id} sub={sub} scenes={scenes} />
        ))}
      </div>
    </section>
  )
}
