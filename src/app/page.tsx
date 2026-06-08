import Link from 'next/link'
import { Playfair_Display } from 'next/font/google'

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
        {/* Book body — left page (static) */}
        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        {/* Book body — right page (static framework) */}
        <path className="book-page" d="M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        {/* Flip page — lifts from the spine on hover */}
        <path className="flip-page" d="M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        {/* Center spine line (static) */}
        <path d="M12 6.042v14.25" strokeLinecap="round" strokeWidth={2} opacity={0.4} />
      </svg>
    ),
  },
  {
    title: 'AI Coach',
    description: 'Immersive voice-based speaking companion.',
    href: '/coach',
    enabled: true,
    icon: (
      <svg className="h-8 w-8 icon-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ overflow: 'visible' }}>
        {/* Mic body */}
        <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" />
        {/* Sound wave bars */}
        <rect className="wave-bar" x="3.5" y="10" width="1.5" height="6" rx="0.75" fill="currentColor" opacity="0" stroke="none" />
        <rect className="wave-bar" x="6" y="8" width="1.5" height="10" rx="0.75" fill="currentColor" opacity="0" stroke="none" />
        <rect className="wave-bar" x="16.5" y="8" width="1.5" height="10" rx="0.75" fill="currentColor" opacity="0" stroke="none" />
        <rect className="wave-bar" x="19" y="10" width="1.5" height="6" rx="0.75" fill="currentColor" opacity="0" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'YouTube',
    description: 'Curated English videos & active listening practice.',
    href: '#',
    enabled: false,
    icon: (
      <svg className="h-8 w-8 icon-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ overflow: 'visible' }}>
        {/* Pulse rings */}
        <circle className="play-ring" cx="12" cy="12" r="8" strokeWidth={1} opacity={0} />
        <circle className="play-ring" cx="12" cy="12" r="8" strokeWidth={1} opacity={0} />
        {/* Play triangle */}
        <path className="play-triangle" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Reading',
    description: 'Curated English articles & news with vocab extraction.',
    href: '/reading',
    enabled: true,
    icon: (
      <svg className="h-8 w-8 icon-container" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ overflow: 'visible' }}>
        {/* Book body — left page (static) */}
        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        {/* Book body — right page (static framework) */}
        <path className="book-page" d="M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        {/* Flip page — lifts from the spine on hover */}
        <path className="flip-page" d="M12 6.042a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292" strokeLinecap="round" strokeLinejoin="round" />
        {/* Center spine line (static) */}
        <path d="M12 6.042v14.25" strokeLinecap="round" strokeWidth={2} opacity={0.4} />
        {/* Reading glasses on top */}
        <circle cx="9" cy="8.5" r="2.2" fill="none" strokeWidth={1.2} opacity={0.6} />
        <circle cx="15" cy="8.5" r="2.2" fill="none" strokeWidth={1.2} opacity={0.6} />
        <path d="M11.2 8.5h1.6" strokeWidth={1.2} opacity={0.4} />
      </svg>
    ),
  },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16" style={{
      backgroundColor: '#F8F6F4',
      backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(200,180,160,0.13), transparent)',
    }}>
      {/* Decorative warm amber glow - top right */}
      <div className="pointer-events-none fixed -right-32 -top-32 select-none" style={{ width: 'clamp(300px, 50vw, 500px)', height: 'clamp(300px, 50vw, 500px)' }}>
        <div className="h-full w-full rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 65%)' }} />
      </div>
      {/* Decorative warm amber glow - bottom left */}
      <div className="pointer-events-none fixed -bottom-24 -left-24 select-none" style={{ width: 'clamp(200px, 35vw, 350px)', height: 'clamp(200px, 35vw, 350px)' }}>
        <div className="h-full w-full rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 65%)' }} />
      </div>

      <div className="relative mx-auto max-w-5xl text-center">

        {/* Gold label */}
        <span className="inline-block text-[10px] font-semibold tracking-[0.3em] uppercase mb-8" style={{ color: '#C49B3F' }}>
          Personal English Learning
        </span>

        {/* Cinematic title */}
        <h1 className={`${displayFont.className} leading-[1.3]`} style={{
          fontSize: 'clamp(1.8rem, 6.5vw, 4rem)',
          fontWeight: 500,
          color: '#1A1A2E',
          textShadow: '0 2px 12px rgba(0,0,0,0.06), 0 8px 30px rgba(0,0,0,0.03)',
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

        <p className={`${displayFont.className} mt-6 text-sm md:text-base leading-relaxed`} style={{
          color: '#A67C52',
          fontStyle: 'italic',
          fontWeight: 400,
        }}>
          Master English through science-backed methods and modern tools.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {features.map((f) =>
            f.enabled ? (
              <Link
                key={f.title}
                href={f.href}
                className="group relative rounded-3xl border p-8 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: 'rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 20px -4px rgba(0,0,0,0.06)',
                }}
              >
                {/* Gold accent line on hover */}
                <div className="absolute left-8 right-8 top-0 h-[2px] rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ backgroundColor: '#D4A853' }} />

                <div className="mb-4" style={{ color: '#555555' }}>
                  {f.icon}
                </div>
                <h2 className="text-lg font-semibold" style={{ color: '#2F2F2F' }}>{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#888888' }}>{f.description}</p>
              </Link>
            ) : (
              <div
                key={f.title}
                className="relative rounded-3xl border p-8 text-left opacity-60"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.04)', boxShadow: '0 1px 8px -2px rgba(0,0,0,0.04)' }}
              >
                <div style={{ color: '#BBBBBB' }}>{f.icon}</div>
                <h2 className="mt-4 text-lg font-semibold" style={{ color: '#BBBBBB' }}>{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#BBBBBB' }}>{f.description}</p>
                <span className="mt-4 inline-flex rounded-full px-3 py-0.5 text-xs font-medium" style={{ backgroundColor: '#F0F0F0', color: '#AAAAAA' }}>
                  Coming Soon
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
