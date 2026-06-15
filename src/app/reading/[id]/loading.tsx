import Link from 'next/link'

export default function ArticleLoading() {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <div className="relative w-full h-[200px] lg:h-[320px] overflow-hidden shrink-0"
        style={{ backgroundColor: '#F0F0F0' }}>
        <Link href="/reading"
          className="absolute top-4 left-4 md:top-6 md:left-6 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm transition-all hover:opacity-60 active:scale-95 active:rotate-12"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#FFFFFF' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #F8F6F4 0%, transparent 100%)' }} />
      </div>
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-6xl mx-auto px-6 md:px-10 -mt-16 lg:-mt-24 gap-10 relative z-10">
        <div className="flex-1 min-w-0 animate-pulse">
          <div className="h-4 w-32 rounded mb-4" style={{ backgroundColor: '#F0F0F0' }} />
          <div className="h-8 w-3/4 rounded mb-6" style={{ backgroundColor: '#F0F0F0' }} />
          <div className="h-24 rounded-xl mb-6" style={{ backgroundColor: '#F0F0F0' }} />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-5 w-full rounded" style={{ backgroundColor: '#F0F0F0' }} />
            ))}
          </div>
        </div>
        <aside className="w-full lg:w-80 2xl:w-96 shrink-0">
          <div className="rounded-2xl border p-4 animate-pulse"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="h-4 w-24 rounded mb-4" style={{ backgroundColor: '#F0F0F0' }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl p-4 mb-3" style={{ backgroundColor: '#F8F6F4' }}>
                <div className="h-5 w-20 rounded mb-2" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="h-4 w-full rounded mb-1" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#F0F0F0' }} />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
