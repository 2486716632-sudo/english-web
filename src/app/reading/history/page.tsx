'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ArticleItem {
  id: number
  title: string
  titleZh: string | null
  imageUrl: string | null
  tags: string
  createdAt: string
  publishedAt: string | null
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

export default function ReadingHistoryPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showZh, setShowZh] = useState<Record<number, boolean>>({})

  const loadArticles = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/reading?filter=history')
      .then((r) => r.json())
      .then((data) => setArticles(data.articles || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadArticles() }, [loadArticles])

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <header className="shrink-0 border-b px-8 md:px-14 py-5" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/reading')}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#F0F0F0', color: '#757575' }}>
            ← Back
          </button>
          <h1 className="text-xl md:text-2xl font-black tracking-widest uppercase" style={{ color: '#1A1A2E' }}>
            History
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
            <p className="text-sm" style={{ color: '#BBBBBB' }}>Failed to load history.</p>
            <button onClick={loadArticles}
              className="mt-4 text-xs font-medium rounded-full px-4 py-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
              Retry
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-sm" style={{ color: '#BBBBBB' }}>No reading history yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {articles.map((a) => {
              const visual = getTagVisual(a.tags)
              return (
                <div
                  key={a.id}
                  className="group cursor-pointer flex items-center gap-5 rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-sm active:scale-[0.99]"
                  onClick={() => router.push(`/reading/${a.id}`)}
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  <div className="relative shrink-0 w-24 h-16 md:w-32 md:h-20 rounded-xl overflow-hidden">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" style={{ background: visual.gradient }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold leading-snug" style={{ color: '#1A1A2E', fontSize: 'clamp(0.85rem, 1.2vw, 1rem)' }}>
                      {showZh[a.id] && a.titleZh ? a.titleZh : a.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: '#BBBBBB' }}>{formatDate(a.publishedAt || a.createdAt)}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/5 text-black/40">
                        Read
                      </span>
                      {a.titleZh && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowZh((prev) => ({ ...prev, [a.id]: !prev[a.id] })) }}
                          className="ml-auto text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                          style={{
                            backgroundColor: showZh[a.id] ? '#1A1A2E' : '#F0EDE8',
                            color: showZh[a.id] ? '#FFFFFF' : '#A67C52',
                          }}
                        >
                          CN
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
