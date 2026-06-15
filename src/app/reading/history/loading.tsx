export default function HistoryLoading() {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <header className="shrink-0 border-b px-8 md:px-14 py-5" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <div className="rounded-full px-4 py-1.5 w-16 h-8" style={{ backgroundColor: '#F0F0F0' }} />
          <h1 className="text-xl md:text-2xl font-black tracking-widest uppercase" style={{ color: '#1A1A2E' }}>
            History
          </h1>
          <div className="w-20" />
        </div>
      </header>
      <main className="flex-1 px-8 md:px-14 py-10">
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
      </main>
    </div>
  )
}
