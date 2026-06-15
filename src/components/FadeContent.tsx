'use client'

import { useEffect, useRef, useState } from 'react'

interface FadeContentProps {
  children: React.ReactNode
  className?: string
  duration?: number
  delay?: number
  threshold?: number
  initialOpacity?: number
  y?: number
}

export default function FadeContent({
  children,
  className = '',
  duration = 700,
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  y = 20,
}: FadeContentProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay, threshold])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : initialOpacity,
        transform: visible ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
