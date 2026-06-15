export default function ScenesLoading() {
  return (
    <div className="w-full h-screen flex overflow-hidden" style={{ backgroundColor: '#F8F6F4' }}>
      {/* Sidebar skeleton */}
      <aside className="w-72 h-full flex flex-col flex-shrink-0">
        <div className="flex items-center gap-3 px-6 pt-7 pb-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: '#EDE8E3' }} />
          <div className="h-4 w-16 rounded" style={{ backgroundColor: '#F0F0F0' }} />
        </div>
        <div className="flex-1 px-3 py-5 space-y-1">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-3 w-full rounded-lg px-4 py-3">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: '#F0F0F0' }} />
              <div className="h-4 w-24 rounded" style={{ backgroundColor: '#F0F0F0' }} />
            </div>
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 h-full overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="p-10">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded animate-pulse" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="h-8 w-40 rounded animate-pulse" style={{ backgroundColor: '#F0F0F0' }} />
              </div>
              <div className="mt-1 h-4 w-24 rounded animate-pulse" style={{ backgroundColor: '#F0F0F0' }} />
            </div>
            <div className="h-8 w-20 rounded-full animate-pulse" style={{ backgroundColor: '#F0F0F0' }} />
          </div>

          <div className="space-y-10">
            {[1, 2, 3].map(s => (
              <div key={s}>
                <div className="h-5 w-40 rounded mb-4" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="grid grid-cols-3 gap-2">
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
        </div>
      </main>
    </div>
  )
}
