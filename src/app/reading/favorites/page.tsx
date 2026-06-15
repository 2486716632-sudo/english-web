'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Heart } from 'lucide-react'

// Module-level scroll position — set by card onClick, read on mount
let _favScroll: number | null = null

interface ArticleItem {
  id: number
  title: string
  titleZh: string | null
  imageUrl: string | null
  tags: string
  createdAt: string
  publishedAt: string | null
  favoritedAt: string | null
}

const TAG_VISUALS: Record<string, { gradient: string }> = {
  ai: { gradient: 'linear-gradient(135deg, #D0D8F0, #B8C4EA)' },
  tech: { gradient: 'linear-gradient(135deg, #D0D8F0, #B8C4EA)' },
  science: { gradient: 'linear-gradient(135deg, #C0E0D8, #A8D0C8)' },
  engineering: { gradient: 'linear-gradient(135deg, #E8D5C0, #D4B89A)' },
  environment: { gradient: 'linear-gradient(135deg, #C0E0D8, #A8D0C8)' },
  economics: { gradient: 'linear-gradient(135deg, #E0D8D0, #D0C8C0)' },
  history: { gradient: 'linear-gradient(135deg, #F0E0C8, #E4CEB0)' },
  society: { gradient: 'linear-gradient(135deg, #E0D8D0, #D0C8C0)' },
  health: { gradient: 'linear-gradient(135deg, #C0E0D8, #A8D0C8)' },
  business: { gradient: 'linear-gradient(135deg, #E0D8D0, #D0C8C0)' },
}

function getTagVisual(tags: string) {
  const tagList = tags.split(',').map((t) => t.trim().toLowerCase())
  for (const t of tagList) {
    if (TAG_VISUALS[t]) return TAG_VISUALS[t]
  }
  return { gradient: 'linear-gradient(135deg, #E8E4E0, #D8D4D0)' }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

let favoritesCache: ArticleItem[] | null = null

export default function ReadingFavoritesPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<ArticleItem[]>(favoritesCache || [])
  const [loading, setLoading] = useState(!favoritesCache)
  const [error, setError] = useState(false)
  const [showZh, setShowZh] = useState<Record<number, boolean>>({})
  const [unfavoriting, setUnfavoriting] = useState<Set<number>>(new Set())
  const restoredRef = useRef(false)

  // Read + clear module-level scroll var (fresh entry = no restore)
  const [savedScroll] = useState(() => {
    const v = _favScroll
    _favScroll = null
    return v
  })

  // Restore scroll position from module-level var
  useLayoutEffect(() => {
    if (savedScroll === null || restoredRef.current) return
    const target = savedScroll
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    if (maxScroll >= target) {
      restoredRef.current = true
      window.scrollTo(0, target)
      let attempts = 0
      function retry() {
        if (++attempts > 20) return
        window.scrollTo(0, target)
        requestAnimationFrame(retry)
      }
      requestAnimationFrame(retry)
    }
  })

  const loadArticles = useCallback(() => {
    if (favoritesCache) {
      setArticles(favoritesCache)
      setLoading(false)
      return
    }
    setError(false)
    fetch('/api/reading?filter=favorites')
      .then((r) => r.json())
      .then((data) => {
        const items = data.articles || []
        favoritesCache = items
        setArticles(items)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadArticles() }, [loadArticles])

  const toggleFavorite = async (id: number) => {
    if (unfavoriting.has(id)) return
    // Optimistic update — remove from list instantly
    const index = articles.findIndex((a) => a.id === id)
    const removed = articles[index]
    setArticles((prev) => prev.filter((a) => a.id !== id))
    favoritesCache = favoritesCache?.filter((a) => a.id !== id) || null
    setUnfavoriting((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/reading/${id}/favorite`, { method: 'POST' })
      if (!res.ok && removed) {
        // Revert on failure — insert at original position
        setArticles((prev) => [...prev.slice(0, index), removed, ...prev.slice(index)])
        favoritesCache = favoritesCache ? [...favoritesCache, removed] : [removed]
      }
    } catch {
      if (removed) {
        setArticles((prev) => [...prev.slice(0, index), removed, ...prev.slice(index)])
        favoritesCache = favoritesCache ? [...favoritesCache, removed] : [removed]
      }
    }
    setUnfavoriting((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <header className="shrink-0 border-b px-8 md:px-14 py-5" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <Link href="/reading"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
            style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-xl md:text-2xl font-black tracking-widest uppercase" style={{ color: '#1A1A2E' }}>
            Favorites
          </h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 px-8 md:px-14 py-10">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((c) => (
              <div key={c} className="animate-pulse flex items-center gap-5 rounded-2xl border p-4"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
                <div className="shrink-0 w-24 h-16 md:w-32 md:h-20 rounded-xl" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#F0F0F0' }} />
                  <div className="h-3 w-1/4 rounded" style={{ backgroundColor: '#F0F0F0' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <p className="text-sm" style={{ color: '#BBBBBB' }}>Failed to load favorites.</p>
            <button onClick={loadArticles}
              className="mt-4 text-xs font-medium rounded-full px-4 py-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
              Retry
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-sm" style={{ color: '#BBBBBB' }}>No favorites yet.</p>
            <p className="text-xs mt-2" style={{ color: '#CCCCCC' }}>Tap the heart icon on any article to save it here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {articles.map((a) => {
              const visual = getTagVisual(a.tags)
              return (
                <div key={a.id} className="group flex items-center gap-5 rounded-2xl border p-4 transition-all duration-200 hover:shadow-sm"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
                  <Link href={`/reading/${a.id}`} onClick={() => { _favScroll = window.scrollY }} className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="relative shrink-0 w-24 h-16 md:w-32 md:h-20 rounded-xl overflow-hidden">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" style={{ background: visual.gradient }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold leading-snug" style={{ color: '#1A1A2E', fontSize: 'clamp(0.85rem, 1.2vw, 1rem)' }}>
                        {showZh[a.id] && a.titleZh ? a.titleZh : a.title}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: '#BBBBBB' }}>{formatDate(a.publishedAt || a.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => toggleFavorite(a.id)}
                    disabled={unfavoriting.has(a.id)}
                    className="shrink-0 rounded-full w-9 h-9 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90 disabled:opacity-50"
                    style={{ backgroundColor: '#F8F6F4' }}
                  >
                    <Heart className="w-5 h-5" fill="#E05050" color="#E05050" strokeWidth={2} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
