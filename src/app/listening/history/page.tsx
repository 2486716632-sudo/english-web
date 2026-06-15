'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface SceneItem {
  id: string
  categoryId: string
  subcategoryId: string
  title: string
  difficulty: string
  duration: number
  playedAt: string | null
  createdAt: string
}

const CATEGORY_ICONS: Record<string, string> = {
  'scene-campus': '🎓',
  'scene-daily': '🏠',
  'scene-travel': '✈️',
  'scene-social': '💬',
  'scene-workplace': '💼',
  'scene-health': '🏥',
  'scene-professional': '⚙️',
  'custom': '✨',
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`
  return `${Math.floor(diff / 2592000)} months ago`
}

// Module-level cache — survives page navigation within same session
let historyCache: SceneItem[] = []

export default function HistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const [scenes, setScenes] = useState<SceneItem[]>(historyCache)
  const [loading, setLoading] = useState(historyCache.length === 0)

  // Auto-cleanup history older than 10 days (once per browser)
  useEffect(() => {
    const lastCleanup = localStorage.getItem('listening-history-cleanup')
    if (lastCleanup && Date.now() - Number(lastCleanup) < 10 * 24 * 60 * 60 * 1000) return
    fetch('/api/history/cleanup?type=listening', { method: 'POST' })
      .then(() => localStorage.setItem('listening-history-cleanup', String(Date.now())))
      .catch(() => {}) // best-effort
  }, [])

  useEffect(() => {
    if (historyCache.length > 0) return // use cached data instantly
    async function load() {
      const res = await fetch('/api/listening/scenes?filter=history')
      const data = await res.json()
      historyCache = data.scenes || []
      setScenes(historyCache)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F6F4]">
      {/* Top bar */}
      <div className="w-full px-6 md:px-12 pt-6 pb-2 flex items-center justify-between">
        <button
          onClick={() => {
            if (from === 'scenes') router.push('/listening/scenes')
            else if (from === 'knowledge') router.push('/listening/knowledge')
            else router.push('/listening')
          }}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
          style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-lg font-bold uppercase tracking-[0.15em]" style={{ color: '#262626' }}>History</h1>
        <div className="w-20" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full border-2 border-stone-200 border-t-stone-800 w-6 h-6" />
          </div>
        ) : scenes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-400 text-lg">No listening history</p>
            <p className="text-stone-300 text-sm mt-2">Scenes you play will appear here</p>
            <Link
              href="/listening"
              className="inline-block mt-6 px-6 py-3 rounded-xl bg-[#262626] text-white text-sm font-medium hover:scale-105 hover:shadow-lg active:scale-[0.97] transition-all duration-300"
            >
              Start Listening
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {scenes.map(scene => (
              <Link
                key={scene.id}
                href={`/listening/${scene.id}`}
                className="flex items-center gap-5 px-6 py-6 rounded-2xl bg-white border border-stone-200/60 hover:scale-[1.01] hover:shadow-md active:scale-[0.99] transition-all duration-200 group"
              >
                {/* Category icon */}
                <span className="text-2xl flex-shrink-0">
                  {CATEGORY_ICONS[scene.categoryId] || '🎧'}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-stone-800 group-hover:text-stone-900 transition-colors truncate">
                    {scene.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-stone-400 font-mono">
                      {formatDuration(scene.duration)}
                    </span>
                  </div>
                </div>

                {/* Played time */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-stone-400">
                    {scene.playedAt ? timeAgo(scene.playedAt) : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
