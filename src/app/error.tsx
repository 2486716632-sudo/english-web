'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
      <p className="text-sm font-medium" style={{ color: '#888888' }}>Something went wrong</p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
      >
        Try again
      </button>
    </div>
  )
}
