'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, Monitor, FlaskConical, Cog, Globe, TrendingUp, Clock, Users, HeartPulse, Briefcase } from 'lucide-react'

interface ArticleItem {
  id: number
  title: string
  titleZh: string | null
  imageUrl: string | null
  source: string
  sourceEmoji: string
  summary: string
  difficulty: number
  tags: string
  createdAt: string
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

const TAG_LABELS: Record<string, string> = {
  ai: 'AI & Machine Learning',
  tech: 'Technology',
  science: 'Science',
  engineering: 'Engineering',
  environment: 'Environment',
  economics: 'Economics',
  history: 'History',
  society: 'Society',
  health: 'Health & Medicine',
  business: 'Business',
  general: 'General',
}

const TAG_ICONS: Record<string, React.ReactNode> = {
  ai: <Brain className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#7C8DB5', strokeWidth: 1.5 }} />,
  tech: <Monitor className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#7C8DB5', strokeWidth: 1.5 }} />,
  science: <FlaskConical className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#7DB5A0', strokeWidth: 1.5 }} />,
  engineering: <Cog className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#B5987A', strokeWidth: 1.5 }} />,
  environment: <Globe className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#7DB5A0', strokeWidth: 1.5 }} />,
  economics: <TrendingUp className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#B5A890', strokeWidth: 1.5 }} />,
  history: <Clock className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#B5987A', strokeWidth: 1.5 }} />,
  society: <Users className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#B5A890', strokeWidth: 1.5 }} />,
  health: <HeartPulse className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#7DB5A0', strokeWidth: 1.5 }} />,
  business: <Briefcase className="w-6 h-6 md:w-7 md:h-7" style={{ color: '#B5A890', strokeWidth: 1.5 }} />,
}

const TAG_PRIORITY = ['ai', 'tech', 'science', 'engineering', 'economics', 'society', 'environment', 'history', 'health', 'business']

function getTagVisual(tags: string) {
  const tagList = tags.split(',').map((t) => t.trim().toLowerCase())
  for (const t of tagList) {
    if (TAG_VISUALS[t]) return TAG_VISUALS[t]
  }
  return { gradient: 'linear-gradient(135deg, #E8E4E0, #D8D4D0)' }
}

function getPrimaryTag(tags: string): string {
  const tagList = tags.split(',').map((t) => t.trim().toLowerCase())
  for (const t of tagList) {
    if (TAG_VISUALS[t]) return t
  }
  return 'general'
}

function groupByTag(articles: ArticleItem[]) {
  const groups: Record<string, ArticleItem[]> = {}
  for (const a of articles) {
    const tag = getPrimaryTag(a.tags)
    if (!groups[tag]) groups[tag] = []
    groups[tag].push(a)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ai = TAG_PRIORITY.indexOf(a)
      const bi = TAG_PRIORITY.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    .map(([tag, items]) => ({ tag, items }))
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function SectionRow({ articles, showZh, onToggleZh, onCardClick }: {
  articles: ArticleItem[]
  showZh: Record<number, boolean>
  onToggleZh: (id: number) => void
  onCardClick: (id: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory scrollbar-none"
        style={{ paddingLeft: '2px' }}
      >
        {articles.map((a) => {
          const visual = getTagVisual(a.tags)
          return (
            <div
              key={a.id}
              className="group cursor-pointer shrink-0 snap-start"
              style={{ width: 'clamp(320px, 60vw, 440px)' }}
              onClick={() => onCardClick(a.id)}
            >
              {/* Thumbnail — 16:9, all 4 corners rounded, no white card */}
              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-sm transition-shadow duration-300 group-hover:shadow-md">
                {a.imageUrl ? (
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full" style={{ background: visual.gradient }} />
                )}
              </div>

              {/* Text below — no background, sits on page bg like YouTube */}
              <div className="pt-2.5">
                <div className="flex items-start gap-2">
                  <h2 className="leading-snug font-bold flex-1 min-w-0" style={{ color: '#1A1A2E', fontSize: 'clamp(0.85rem, 1.2vw, 1rem)' }}>
                    {showZh[a.id] && a.titleZh ? a.titleZh : a.title}
                  </h2>
                  {a.titleZh && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleZh(a.id) }}
                      className="shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-1 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        backgroundColor: showZh[a.id] ? '#1A1A2E' : '#F0EDE8',
                        color: showZh[a.id] ? '#FFFFFF' : '#A67C52',
                      }}
                    >
                      CN
                    </button>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: '#BBBBBB' }}>
                  {daysAgo(a.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      {/* Right-edge fade hint */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-12"
        style={{ background: 'linear-gradient(90deg, transparent, #F8F6F4)' }} />
    </div>
  )
}

export default function ReadingPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showZh, setShowZh] = useState<Record<number, boolean>>({})

  const loadArticles = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/reading')
      .then((r) => r.json())
      .then((data) => setArticles(data.articles || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadArticles() }, [loadArticles])

  const sections = groupByTag(articles)

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      {/* Header */}
      <header className="shrink-0 border-b px-8 md:px-14 py-5" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/')}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#F0F0F0', color: '#757575' }}>
            ← Back
          </button>
          <h1 className="text-xl md:text-2xl font-black tracking-widest uppercase" style={{ color: '#1A1A2E' }}>
            Reading
          </h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Content — sections */}
      <main className="flex-1 px-8 md:px-14 py-10">
        {loading ? (
          <div className="space-y-10">
            {[1, 2].map((s) => (
              <div key={s} className="space-y-4">
                <div className="h-6 w-48 rounded" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="flex gap-4">
                  {[1, 2, 3].map((c) => (
                    <div key={c} className="animate-pulse shrink-0" style={{ width: 'clamp(320px, 60vw, 440px)' }}>
                      <div className="aspect-[16/9] w-full rounded-2xl" style={{ backgroundColor: '#F0F0F0' }} />
                      <div className="mt-3 h-4 w-3/4 rounded" style={{ backgroundColor: '#F0F0F0' }} />
                      <div className="mt-2 h-4 w-1/2 rounded" style={{ backgroundColor: '#F0F0F0' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-24 flex flex-col items-center text-center">
            <p className="text-sm" style={{ color: '#BBBBBB' }}>Failed to load articles. Check your connection.</p>
            <button onClick={loadArticles}
              className="mt-4 text-xs font-medium rounded-full px-4 py-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
              Retry
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-sm" style={{ color: '#BBBBBB' }}>No articles yet. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map(({ tag, items }) => {
              const visual = TAG_VISUALS[tag] || { gradient: 'linear-gradient(135deg, #E8E4E0, #D8D4D0)' }
              return (
                <section key={tag}>
                  {/* Section header */}
                  <div className="flex items-center gap-4 mb-5">
                    {TAG_ICONS[tag] || null}
                    <h2 className="text-lg md:text-xl font-bold tracking-[0.15em] uppercase" style={{ color: '#1A1A2E' }}>
                      {TAG_LABELS[tag] || tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </h2>
                    <span className="text-xs font-medium" style={{ color: '#BBBBBB' }}>
                      {items.length} article{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Horizontal scroll row */}
                  <SectionRow
                    articles={items}
                    showZh={showZh}
                    onToggleZh={(id) => setShowZh((prev) => ({ ...prev, [id]: !prev[id] }))}
                    onCardClick={(id) => router.push(`/reading/${id}`)}
                  />
                </section>
              )
            })}
          </div>
        )}
      </main>

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
