export default function PlayerLoading() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      {/* Top bar skeleton */}
      <div className="sticky top-0 z-30 border-b border-stone-200/50" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="w-full px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="h-4 w-12 rounded" style={{ backgroundColor: '#E8E8E8' }} />
          <div className="flex items-center gap-3">
            <div className="w-16 h-6 rounded-full" style={{ backgroundColor: '#E8E8E8' }} />
            <div className="w-12 h-6 rounded-full" style={{ backgroundColor: '#E8E8E8' }} />
          </div>
        </div>
      </div>

      {/* Player body skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        {/* Turntable circle */}
        <div className="rounded-full animate-pulse" style={{
          width: 'clamp(280px, 40vw, 520px)',
          height: 'clamp(280px, 40vw, 520px)',
          backgroundColor: '#EDE8E3',
        }} />

        {/* Info area */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-64 rounded" style={{ backgroundColor: '#E8E8E8' }} />
          <div className="h-1 w-80 rounded-full" style={{ backgroundColor: '#E8E8E8' }} />
          <div className="h-16 w-16 rounded-full" style={{ backgroundColor: '#E8E8E8' }} />
        </div>
      </div>
    </div>
  )
}
