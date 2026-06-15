export default function KnowledgeLoading() {
  return (
    <div className="w-full h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#F8F6F4' }}>
      {/* Top bar skeleton */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 md:px-12 pt-6 pb-4">
        <div className="flex items-center gap-5">
          <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: '#EDE8E3' }} />
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded" style={{ backgroundColor: '#EDE8E3' }} />
            <div>
              <div className="h-5 w-28 rounded" style={{ backgroundColor: '#EDE8E3' }} />
              <div className="mt-1 h-3 w-20 rounded" style={{ backgroundColor: '#F0F0F0' }} />
            </div>
          </div>
        </div>
        <div className="h-10 w-24 rounded-full animate-pulse" style={{ backgroundColor: '#F0F0F0' }} />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex-shrink-0 flex items-center gap-2 px-8 md:px-12 pb-5">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse h-10 w-28 rounded-full" style={{ backgroundColor: '#F0F0F0' }} />
        ))}
      </div>

      {/* Content skeleton */}
      <main className="flex-1 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="px-8 md:px-12 py-8">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(c => (
              <div key={c} className="animate-pulse rounded-xl px-4 py-5" style={{ backgroundColor: '#F0F0F0' }}>
                <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#e5e5e5' }} />
                <div className="mt-3 h-3 w-1/2 rounded" style={{ backgroundColor: '#e5e5e5' }} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
