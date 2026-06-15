export default function HistoryLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F6F4' }}>
      <div className="w-full px-6 md:px-12 pt-6 pb-2 flex items-center justify-between">
        <div className="rounded-full px-3.5 py-1.5 w-16 h-8" style={{ backgroundColor: '#F0F0F0' }} />
        <h1 className="text-lg font-bold uppercase tracking-[0.15em]" style={{ color: '#262626' }}>History</h1>
        <div className="w-20" />
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-5 px-6 py-6 rounded-2xl bg-white border border-stone-200/60">
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#F0F0F0' }} />
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded" style={{ backgroundColor: '#F0F0F0' }} />
                <div className="mt-2 h-3 w-1/4 rounded" style={{ backgroundColor: '#F0F0F0' }} />
              </div>
              <div className="h-4 w-16 rounded" style={{ backgroundColor: '#F0F0F0' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
