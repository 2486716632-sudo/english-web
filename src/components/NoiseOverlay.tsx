'use client'

import { useEffect, useState } from 'react'

export default function NoiseOverlay() {
  // Only render on client to avoid hydration mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 select-none"
      style={{ mixBlendMode: 'multiply' }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="grainFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 0.035 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grainFilter)" opacity="1" />
      </svg>
    </div>
  )
}
