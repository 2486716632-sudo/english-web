export default function ReadingLoading() {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <header className="shrink-0 border-b px-8 md:px-14 py-5" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between">
          <div className="rounded-full px-4 py-1.5 w-16 h-8" style={{ backgroundColor: '#F0F0F0' }} />
          <h1 className="text-xl md:text-2xl font-black tracking-widest uppercase" style={{ color: '#1A1A2E' }}>
            Reading
          </h1>
          <div className="rounded-full px-4 py-1.5 w-20 h-8" style={{ backgroundColor: '#262626' }} />
        </div>
      </header>
      <main className="flex-1 px-8 md:px-14 py-10">
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
      </main>
    </div>
  )
}
