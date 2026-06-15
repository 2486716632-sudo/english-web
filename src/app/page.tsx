import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'
import FadeContent from '@/components/FadeContent'
import SpotlightCard from '@/components/SpotlightCard'
import FloatingLines from '@/components/FloatingLines'
import SplitText from '@/components/SplitText'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
})

const features = [
  {
    title: 'Vocabulary',
    description: 'SM-2 spaced repetition & thematic scene-based word packs.',
    href: '/words',
    enabled: true,
    icon: (
      <svg className="h-8 w-8 icon-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ overflow: 'visible' }}>
        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        <path className="book-page" d="M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        <path className="flip-page" d="M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 6.042v14.25" strokeLinecap="round" strokeWidth={2} opacity={0.4} />
      </svg>
    ),
  },
  {
    title: 'Podcast',
    description: 'AI-generated casual dialogues & immersive listening practice.',
    href: '/listening',
    enabled: true,
    icon: (
      <span className="relative inline-block">
        <svg className="h-8 w-8 headphone-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10a7 7 0 0 1 14 0" />
          <rect x="2.5" y="10" width="4.5" height="7.5" rx="2" />
          <rect x="3.5" y="11.5" width="2.5" height="4.5" rx="1.25" strokeWidth={1} opacity="0.3" />
          <rect x="17" y="10" width="4.5" height="7.5" rx="2" />
          <rect x="18" y="11.5" width="2.5" height="4.5" rx="1.25" strokeWidth={1} opacity="0.3" />
        </svg>
        <span className="note-icon note-icon-1 absolute -left-2 top-1/3 text-sm pointer-events-none select-none font-semibold" style={{ color: '#C49B3F' }}>♪</span>
        <span className="note-icon note-icon-2 absolute left-1/3 -top-0.5 text-sm pointer-events-none select-none font-semibold" style={{ color: '#D4A853' }}>♫</span>
        <span className="note-icon note-icon-3 absolute -right-2 top-1/3 text-sm pointer-events-none select-none font-semibold" style={{ color: '#C49B3F' }}>♩</span>
      </span>
    ),
  },
  {
    title: 'AI Coach',
    description: 'Immersive voice-based speaking companion.',
    href: '/coach',
    enabled: true,
    icon: (
      <svg className="h-8 w-8 icon-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ overflow: 'visible' }}>
        <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" />
        <rect className="wave-bar" x="3.5" y="10" width="1.5" height="6" rx="0.75" fill="#D4A853" opacity="0" stroke="none" />
        <rect className="wave-bar" x="6" y="8" width="1.5" height="10" rx="0.75" fill="#D4A853" opacity="0" stroke="none" />
        <rect className="wave-bar" x="16.5" y="8" width="1.5" height="10" rx="0.75" fill="#D4A853" opacity="0" stroke="none" />
        <rect className="wave-bar" x="19" y="10" width="1.5" height="6" rx="0.75" fill="#D4A853" opacity="0" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'Reading',
    description: 'Curated English articles & news with vocab extraction.',
    href: '/reading',
    enabled: true,
    icon: (
      <span className="relative inline-block">
        <svg className="h-8 w-8 icon-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
          <defs>
            <clipPath id="lensClip">
              <circle cx="16" cy="7.5" r="3.6" />
            </clipPath>
          </defs>
          <path d="M4 3.5h9l3.5 3.5v12.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" strokeWidth={1.6} />
          <path d="M13 3.5v3.5h3.5" opacity="0.4" />
          <rect x="7" y="8" width="5" height="1" rx="0.5" stroke="none" fill="currentColor" opacity="0.7" />
          <rect x="7" y="10.5" width="8" height="0.7" rx="0.35" stroke="none" fill="currentColor" opacity="0.25" />
          <rect x="7" y="12.5" width="7" height="0.7" rx="0.35" stroke="none" fill="currentColor" opacity="0.25" />
          <rect x="7" y="14.5" width="6.5" height="0.7" rx="0.35" stroke="none" fill="currentColor" opacity="0.25" />
          <rect x="7" y="16.5" width="4" height="0.7" rx="0.35" stroke="none" fill="currentColor" opacity="0.25" />
          <g className="reading-glass">
            <path d="M19.5 11.5l3 3" strokeWidth="1.8" stroke="currentColor" />
            <circle cx="16" cy="7.5" r="3.6" strokeWidth="1.6" stroke="currentColor" />
            <g clipPath="url(#lensClip)" className="lens-mag" opacity="0">
              <rect x="13" y="6.6" width="6" height="1.4" rx="0.7" stroke="none" fill="currentColor" opacity="0.9" />
              <rect x="13" y="9" width="5.5" height="1" rx="0.5" stroke="none" fill="currentColor" opacity="0.5" />
              <rect x="13" y="10.8" width="4.5" height="1" rx="0.5" stroke="none" fill="currentColor" opacity="0.5" />
            </g>
            <circle cx="16" cy="7.5" r="2" stroke="currentColor" strokeWidth="1" opacity="0.15" />
          </g>
        </svg>
      </span>
    ),
  },
]

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: '#000000' }}>
      {/* FloatingLines background — full screen */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#000000' }}>
        <FloatingLines
          linesGradient={['#C4A86A', '#B8923A', '#A07828']}
          animationSpeed={0.8}
          interactive={false}
          parallax={true}
          parallaxStrength={0.15}
          bendRadius={6}
          bendStrength={-0.5}
          mouseDamping={0.05}
        />
      </div>

      {/* Decorative gold glow - top right */}
      <div className="pointer-events-none fixed -right-48 -top-48 z-[1] select-none" style={{ width: 'clamp(400px, 60vw, 650px)', height: 'clamp(400px, 60vw, 650px)' }}>
        <div className="h-full w-full rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="relative mx-auto max-w-6xl text-center">

          {/* Gold label */}
          <SplitText
            text="Personal English Learning"
            tag="span"
            className={`${displayFont.className} inline-block text-xs font-semibold tracking-[0.3em] uppercase mb-10`}
            style={{ color: '#D4A853', fontStyle: 'italic' }}
            textAlign="center"
            splitType="words"
            delay={120}
            duration={0.7}
            from={{ opacity: 0, y: 16 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.01}
            rootMargin="0px"
          />

          {/* Title */}
          <h1 className={`${displayFont.className} leading-[1.3] shiny-title`} style={{
            fontSize: 'clamp(1.8rem, 6.5vw, 4rem)',
            fontWeight: 500,
            letterSpacing: '0.15em',
          }}>
            ENGLISH{' '}ASSISTANT
          </h1>

          {/* Gold divider */}
          <div className="mx-auto mt-8 flex items-center justify-center gap-2">
            <div className="h-px w-8" style={{ backgroundColor: '#D4A853' }} />
            <div className="h-[3px] w-6 rounded-full" style={{ backgroundColor: '#D4A853' }} />
            <div className="h-px w-8" style={{ backgroundColor: '#D4A853' }} />
          </div>


          <FadeContent className="mt-14" delay={300} duration={800} y={30}>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) =>
              f.enabled ? (
                <SpotlightCard key={f.title} spotlightColor="rgba(212, 168, 83, 0.15)">
                <Link
                  href={f.href}
                  className="group relative block rounded-3xl border p-6 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] card-glow card-blur"
                  style={{
                    backgroundColor: 'rgba(18, 18, 30, 0.35)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="mb-4" style={{ color: '#FFFFFF' }}>
                    {f.icon}
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: '#EDE8E0' }}>{f.title}</h2>
                  <p className="mt-2 text-base leading-relaxed" style={{ color: '#94909C' }}>{f.description}</p>
                </Link>
                </SpotlightCard>
              ) : (
                <div
                  key={f.title}
                  className="relative rounded-3xl border p-8 text-left opacity-60"
                  style={{ backgroundColor: 'rgba(18,18,30,0.5)', borderColor: 'rgba(255,255,255,0.04)', boxShadow: '0 1px 8px -2px rgba(0,0,0,0.2)' }}
                >
                  <div style={{ color: '#555555' }}>{f.icon}</div>
                  <h2 className="mt-4 text-xl font-bold" style={{ color: '#666666' }}>{f.title}</h2>
                  <p className="mt-2 text-base leading-relaxed" style={{ color: '#555555' }}>{f.description}</p>
                  <span className="mt-4 inline-flex rounded-full px-3 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#777777' }}>
                    Coming Soon
                  </span>
                </div>
              ),
            )}
          </div>
          </FadeContent>
        </div>
      </div>
    </div>
  )
}
