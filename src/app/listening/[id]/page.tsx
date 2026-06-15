'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

interface LineData {
  id: string
  speaker: string
  english: string
  chinese: string | null
  lineOrder: number
  audioUrl: string | null
}

interface SceneData {
  id: string
  categoryId: string
  subcategoryId: string
  title: string
  description: string | null
  difficulty: string
  duration: number
  speakers: number
  lines: LineData[]
}

/* ---- SeekBar component (extracted outside to prevent re-mount on every render) ---- */
interface SeekBarProps {
  scene: SceneData | null
  elapsed: number
  width?: number
  onSeek: (percent: number) => void
}

function SeekBar({ scene, elapsed, width = 500, onSeek }: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  function getPercent(clientX: number) {
    if (!barRef.current) return 0
    const rect = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function handleMouseDown(e: React.MouseEvent) {
    draggingRef.current = true
    onSeek(getPercent(e.clientX))
    e.preventDefault()
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return
      onSeek(getPercent(e.clientX))
    }
    function handleMouseUp() {
      draggingRef.current = false
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onSeek])

  const pct = scene ? Math.min(elapsed / scene.duration, 1) * 100 : 0

  return (
    <div style={{ width: `${width}px` }}>
      <div
        ref={barRef}
        className="h-1.5 bg-stone-300 rounded-full overflow-hidden cursor-pointer group relative"
        onMouseDown={handleMouseDown}
      >
        <div className="h-full bg-stone-700 rounded-full transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
        {/* Draggable thumb — invisible until hover */}
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-stone-500 text-sm font-mono tabular-nums">
          {scene ? `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}` : '0:00'}
        </span>
        <span className="text-stone-500 text-sm font-mono tabular-nums">
          {scene ? `${Math.floor(scene.duration / 60)}:${(scene.duration % 60).toString().padStart(2, '0')}` : '0:00'}
        </span>
      </div>
    </div>
  )
}

export default function ListeningPlayerPage() {
  const params = useParams()
  const router = useRouter()
  const [scene, setScene] = useState<SceneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showCaptions, setShowCaptions] = useState(false)
  const [showPlayerMode, setShowPlayerMode] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [currentLine, setCurrentLine] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const [sceneList, setSceneList] = useState<{ id: string; subcategoryId: string }[]>([])
  const [currentSceneIndex, setCurrentSceneIndex] = useState(-1)

  // Refs for audio control (avoid React race conditions)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentLineRef = useRef(0)
  const isPlayingRef = useRef(false)
  const speedRef = useRef(1)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const completedRef = useRef(false)
  const returnPathRef = useRef('/listening/scenes')

  // Keep refs in sync
  currentLineRef.current = currentLine
  isPlayingRef.current = isPlaying
  speedRef.current = speed

  // Find current scene index in the scene list
  function findSceneIndex(list: { id: string }[], targetId: string) {
    return list.findIndex(s => s.id === targetId)
  }

  // Determine the return listing page based on scene category
  useEffect(() => {
    if (scene) {
      returnPathRef.current = scene.categoryId?.startsWith('knowledge') ? '/listening/knowledge' : '/listening/scenes'
    }
  }, [scene])

  // Load scene data + scene list for prev/next navigation
  useEffect(() => {
    async function load() {
      // Build the same subcategory filter from the current scene's data
      const [sceneRes, listRes] = await Promise.all([
        fetch(`/api/listening/scenes/${params.id}`),
        fetch('/api/listening/scenes'),
      ])
      if (!sceneRes.ok) { setLoading(false); return }
      const data = await sceneRes.json()
      const listData = await listRes.json()
      const allScenes: { id: string; subcategoryId: string }[] = listData.scenes || []

      setScene(data)
      setSceneList(allScenes)
      setCurrentSceneIndex(findSceneIndex(allScenes, params.id as string))
      setElapsed(0)
      elapsedRef.current = 0
      setLoading(false)
      // Auto-play
      const autoPlayTimer = setTimeout(() => setIsPlaying(true), 100)
      pendingTimersRef.current.add(autoPlayTimer)
    }
    load()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      if (endTimerRef.current !== null) {
        clearTimeout(endTimerRef.current)
        endTimerRef.current = null
      }
      for (const id of pendingTimersRef.current) clearTimeout(id)
      pendingTimersRef.current.clear()
    }
  }, [params.id])

  // Strip parenthesized stage directions like (laughs) for TTS input
  function textForTTS(text: string): string {
    return text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() || text
  }

  const advanceLine = useCallback(() => {
    if (!scene) return
    const nextIdx = currentLineRef.current + 1
    if (nextIdx >= scene.lines.length) {
      // End of scene — let timer tick to the end naturally
      setIsPlaying(false)
      setCurrentLine(nextIdx)
      completedRef.current = true
      if (elapsedRef.current < scene.duration) {
        if (endTimerRef.current !== null) clearInterval(endTimerRef.current)
        endTimerRef.current = setInterval(() => {
          elapsedRef.current += 1
          setElapsed(elapsedRef.current)
          if (elapsedRef.current >= scene.duration && endTimerRef.current !== null) {
            clearInterval(endTimerRef.current)
            endTimerRef.current = null
          }
        }, 1000)
      }
      fetch(`/api/listening/scenes/${scene.id}`, { method: 'POST' })
      return
    }
    setCurrentLine(nextIdx)
    // React will re-render, and the next useEffect will trigger playback
  }, [scene])

  // Play a specific line by index
  const playLineByIndex = useCallback((index: number) => {
    if (!scene || !scene.lines[index]) return
    const line = scene.lines[index]

    if (!line.audioUrl) {
      // No audio - use estimated timing to advance
      const cleanText = textForTTS(line.english)
      const estimatedMs = Math.max(cleanText.length * 100, 2000)
      const tid = setTimeout(() => {
        pendingTimersRef.current.delete(tid)
        if (isPlayingRef.current && currentLineRef.current === index) {
          advanceLine()
        }
      }, estimatedMs / speedRef.current)
      pendingTimersRef.current.add(tid)
      return
    }

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    const audio = audioRef.current

    // Resume from paused position if same audio is already loaded
    if (audio.src && audio.src.endsWith(line.audioUrl) && audio.paused) {
      audio.playbackRate = speedRef.current
      audio.play().catch(() => setIsPlaying(false))
      return
    }

    audio.preload = 'auto'
    audio.src = line.audioUrl
    audio.playbackRate = speedRef.current

    audio.onended = () => {
      if (currentLineRef.current === index && isPlayingRef.current) {
        advanceLine()
      }
    }

    audio.onerror = () => {
      const tid = setTimeout(() => {
        pendingTimersRef.current.delete(tid)
        if (currentLineRef.current === index && isPlayingRef.current) {
          advanceLine()
        }
      }, Math.max(line.english.length * 120, 2500) / speedRef.current)
      pendingTimersRef.current.add(tid)
    }

    audio.play().catch(() => {
      setIsPlaying(false)
    })
  }, [scene, advanceLine])

  // Effect: when currentLine changes and playing, play the new line
  useEffect(() => {
    if (isPlaying && scene && currentLine < scene.lines.length) {
      playLineByIndex(currentLine)
    }
  }, [currentLine, isPlaying, playLineByIndex])

  // Timer: update elapsed time every second while playing
  useEffect(() => {
    if (!isPlaying || !scene) return
    const interval = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      // Fallback: if elapsed reaches duration and scene wasn't completed via advanceLine
      if (elapsedRef.current >= scene.duration && !completedRef.current) {
        completedRef.current = true
        setIsPlaying(false)
        fetch(`/api/listening/scenes/${scene.id}`, { method: 'POST' })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isPlaying, scene])

  function togglePlay() {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
    } else {
      if (!scene) return
      if (currentLine >= scene.lines.length) {
        // Reached the end, restart
        setCurrentLine(0)
        setElapsed(0)
        elapsedRef.current = 0
      }
      setIsPlaying(true)
    }
  }

  function goPrevScene() {
    if (currentSceneIndex <= 0 || !sceneList[currentSceneIndex - 1]) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    router.push(`/listening/${sceneList[currentSceneIndex - 1].id}`)
  }

  function goNextScene() {
    if (currentSceneIndex < 0 || currentSceneIndex >= sceneList.length - 1 || !sceneList[currentSceneIndex + 1]) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    router.push(`/listening/${sceneList[currentSceneIndex + 1].id}`)
  }

  function cycleSpeed() {
    const speeds = [0.75, 1, 1.1, 1.25, 1.5]
    const idx = speeds.indexOf(speed)
    const next = speeds[(idx + 1) % speeds.length]
    setSpeed(next)
    // Update currently playing audio speed
    if (audioRef.current) {
      audioRef.current.playbackRate = next
    }
  }

  const seekTo = useCallback((percent: number) => {
    if (!scene || scene.lines.length === 0) return
    const targetLine = Math.max(0, Math.min(scene.lines.length - 1, Math.floor(percent * scene.lines.length)))
    const estimatedElapsed = Math.floor(targetLine / scene.lines.length * scene.duration)
    if (audioRef.current) audioRef.current.pause()
    setCurrentLine(targetLine)
    elapsedRef.current = estimatedElapsed
    setElapsed(estimatedElapsed)
    // Restart playback from the new position
    setIsPlaying(true)
  }, [scene])

  function toggleCaptions() {
    setShowCaptions(!showCaptions)
    setShowPlayerMode(!showPlayerMode)
  }

  function showSubtitles() {
    setShowPlayerMode(false)
    setShowCaptions(true)
  }


  // Player mode (subtitles hidden)
  if (showPlayerMode) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center select-none overflow-hidden"
        style={{ backgroundColor: '#f0ece4' }}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 z-10" style={{ paddingTop: 44 }}>
          <button onClick={() => { window.location.href = returnPathRef.current }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
            style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div /> {/* spacer */}
        </div>

        {/* Turntable — only the disc area flips to subtitles */}
        <div className="flex-1 flex flex-col items-center justify-center" style={{ marginTop: 0, gap: 0 }}>
          <div className="relative cursor-pointer" style={{ width: 520, height: 520 }} onClick={showSubtitles}>
            {/* Circular wooden body — full round turntable deck */}
            <div className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(160deg, #6b5543, #4a3d30, #3d3227, #4a3d30)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              {/* Top surface grain highlight */}
              <div className="absolute rounded-full" style={{
                inset: 3,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.05) 100%)',
              }} />
            </div>

            {/* Plinth rim ring */}
            <div className="absolute rounded-full"
              style={{
                inset: 28,
                background: 'linear-gradient(145deg, #5c4a3a, #3d3227)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.05)',
              }}
            />

            {/* Platter (metal rotating base) */}
            <div className="absolute rounded-full"
              style={{
                inset: 44,
                background: 'linear-gradient(135deg, #5a5a5a, #3a3a3a, #2a2a2a, #404040)',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              {/* Platter edge ring */}
              <div className="absolute rounded-full" style={{
                inset: 2,
                border: '1px solid rgba(255,255,255,0.04)',
              }} />
              {/* Platter inner brush texture */}
              <div className="absolute rounded-full" style={{
                inset: '20%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)',
              }} />
            </div>

            {/* Vinyl record */}
            <div
              className="absolute rounded-full"
              style={{
                animation: isPlaying ? 'cdSpin 1.5s linear infinite' : 'none',
                inset: 68,
                background: '#1a1a1a',
                boxShadow: '0 0 30px rgba(0,0,0,0.4), inset 0 0 20px rgba(0,0,0,0.2)',
              }}
            >
              {/* Vinyl subtle sheen */}
              <div className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 35%, rgba(255,255,255,0.01) 55%, transparent 75%)',
                }}
              />
              {/* Vinyl grooves - dense */}
              {[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42].map(r => (
                <div key={r} className="absolute rounded-full" style={{
                  inset: `${r}%`,
                  border: '1px solid rgba(255,255,255,0.035)',
                }} />
                ))}
              {/* Rotation marker */}
              {isPlaying && (
                <div className="absolute" style={{
                  top: '4%', left: '50%',
                  width: 5, height: 5,
                  marginLeft: -2.5,
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: '50%',
                }} />
              )}
              {/* Record label - vintage style */}
              <div className="absolute rounded-full flex flex-col items-center justify-center"
                style={{
                  inset: '30%',
                  background: 'linear-gradient(145deg, #d4a574, #c49260, #b8845a)',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15), inset 0 -1px 0 rgba(255,255,255,0.1)',
                }}
              >
                {/* Label ring */}
                <div className="absolute rounded-full border" style={{
                  inset: '12%',
                  borderColor: 'rgba(255,255,255,0.1)',
                }} />
                {/* Label text */}
                <span className="text-white/90 select-none" style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
                  {scene?.title?.[0] || '♪'}
                </span>
                {/* Small decorative dots */}
                <div className="flex gap-1 mt-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="rounded-full bg-white/20" style={{ width: 3, height: 3 }} />
                  ))}
                </div>
              </div>
              {/* Spindle */}
              <div className="absolute rounded-full" style={{
                inset: '47.5%',
                backgroundColor: '#999',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
              }}>
                <div className="absolute rounded-full" style={{
                  inset: '25%',
                  backgroundColor: '#bbb',
                }} />
              </div>
            </div>

            {/* Fixed shimmer highlight */}
            {isPlaying && (
              <div className="absolute rounded-full" style={{
                inset: 68,
                background: 'linear-gradient(115deg, rgba(255,255,255,0.12) 0%, transparent 18%, transparent 48%, rgba(255,255,255,0.06) 62%, transparent 78%)',
                animation: 'shimmerSweep 3s ease-in-out infinite',
                pointerEvents: 'none',
                zIndex: 5,
              }} />
            )}

            {/* Tonearm assembly */}
            <div
              className="absolute"
              style={{
                top: 12,
                right: -28,
                width: 280,
                height: 170,
                transformOrigin: '90% 8%',
                transform: isPlaying ? 'rotate(-16deg)' : 'rotate(12deg)',
                transition: 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 10,
              }}
            >
              {/* Pivot base - cylindrical tower */}
              <div className="absolute" style={{
                top: 6, right: 6,
                width: 46, height: 46,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #b0a898, #887e72, #6b6258)',
                boxShadow: '0 3px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}>
                {/* Pivot center dot */}
                <div className="absolute rounded-full" style={{
                  top: '40%', left: '40%',
                  width: 8, height: 8,
                  background: '#444',
                }} />
              </div>

              {/* Tonearm main tube */}
              <div
                className="absolute"
                style={{
                  top: 24, right: 30,
                  width: 244, height: 5,
                  borderRadius: 3,
                  background: 'linear-gradient(to bottom, #c0b8a8, #a09888, #b8b0a0)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}
              >
                {/* Tube highlight */}
                <div className="absolute" style={{
                  top: 0, left: 0, right: 0, height: 2,
                  borderRadius: 3,
                  background: 'linear-gradient(to right, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
                }} />

                {/* Headshell */}
                <div className="absolute" style={{
                  left: -14, top: -12,
                  width: 30, height: 28,
                  borderRadius: '2px 4px 4px 2px',
                  background: 'linear-gradient(135deg, #8a8278, #6b6358)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transform: 'skewY(-3deg)',
                }}>
                  {/* Headshell top clip */}
                  <div className="absolute" style={{
                    top: 0, left: 4, right: 4, height: 4,
                    background: '#999',
                    borderRadius: '1px',
                  }} />
                  {/* Cartridge body */}
                  <div className="absolute" style={{
                    bottom: 0, left: 3, right: 3, height: 10,
                    background: '#444',
                    borderRadius: '1px',
                  }}>
                    {/* Stylus / needle */}
                    <div
                      className="absolute"
                      style={{
                        bottom: -12, left: 5,
                        width: 2,
                        height: 14,
                        background: 'linear-gradient(to top, #eee, #999)',
                        borderRadius: '0 0 1px 1px',
                        transform: 'rotate(-6deg)',
                        transformOrigin: 'top center',
                        animation: isPlaying ? 'stylusShake 0.4s ease-in-out infinite' : 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Counterweight at back */}
                <div className="absolute" style={{
                  right: -8, top: -8,
                  width: 18, height: 18,
                  background: 'radial-gradient(circle at 40% 40%, #666, #444)',
                  borderRadius: '50%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>
                  {/* Counterweight slit */}
                  <div className="absolute" style={{
                    top: '50%', left: '20%', right: '20%', height: 2,
                    background: 'rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>

              {/* Anti skate weight thread (decorative) */}
              <div className="absolute rounded-full" style={{
                top: 34, right: 38,
                width: 4, height: 4,
                background: '#aaa',
                opacity: 0.3,
              }} />
            </div>

            {/* Plinth bottom bar - power indicator */}
            <div className="absolute" style={{
              bottom: 12, left: '50%',
              marginLeft: -30,
              width: 60, height: 8,
              borderRadius: 4,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), transparent)',
            }}>
              <div className="absolute" style={{
                left: 10, top: 1,
                width: 4, height: 4,
                borderRadius: '50%',
                background: '#d4a574',
                boxShadow: '0 0 6px rgba(212,165,116,0.4)',
              }} />
            </div>
          </div>

          {/* Info + Controls */}
          <div className="flex flex-col items-center" style={{ gap: 10, marginTop: 48 }}>
          {/* Track info */}
          <div className="text-center">
            <h1 className="text-stone-800 font-semibold truncate max-w-[500px]" style={{ fontSize: 26, letterSpacing: 3 }}>
              {scene?.title || 'Listening'}
            </h1>
          </div>

          {/* Progress bar — time-based */}
          <SeekBar scene={scene} elapsed={elapsed} onSeek={seekTo} />

          {/* Controls — speed prev play next CD */}
          <div className="flex items-center justify-center gap-5">
            <button onClick={cycleSpeed}
              className="px-4 py-1.5 rounded-full text-sm font-mono transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
            >
              {speed}x
            </button>
            <button onClick={goPrevScene} className="text-stone-400 hover:text-stone-700 transition-colors p-1">
              <SkipBack size={26} />
            </button>
            <button onClick={togglePlay}
              className="rounded-full bg-stone-800 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
              style={{ width: 72, height: 72 }}
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
            </button>
            <button onClick={goNextScene} className="text-stone-400 hover:text-stone-700 transition-colors p-1">
              <SkipForward size={26} />
            </button>
            <button onClick={toggleCaptions}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
            >
              {showPlayerMode ? 'Subtitles' : 'CD'}
            </button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F4] flex items-center justify-center">
        <div className="animate-spin rounded-full border-2 border-stone-200 border-t-stone-800 w-6 h-6" />
      </div>
    )
  }

  if (!scene) {
    return (
      <div className="min-h-screen bg-[#F8F6F4] flex flex-col items-center justify-center gap-4">
        <p className="text-stone-500">场景未找到</p>
        <Link href="/listening" className="text-sm text-stone-400 underline hover:text-stone-600">返回列表</Link>
      </div>
    )
  }

  const prevLine = currentLine > 0 ? scene.lines[currentLine - 1] : null
  const current = scene.lines[currentLine]
  const isEnded = currentLine >= scene.lines.length

  return (
    <div className="min-h-screen bg-[#F8F6F4] flex flex-col select-none">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#F8F6F4]/90 backdrop-blur-sm border-b border-stone-200/50">
        <div className="w-full px-6 md:px-12 py-4 flex items-center justify-between">
          <button onClick={() => { window.location.href = returnPathRef.current }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
            style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div /> {/* spacer */}
        </div>
      </div>

      {/* Subtitle area — same centered layout as CD player */}
      <div className="flex-1 flex flex-col items-center justify-center select-none overflow-hidden px-6">
        {isEnded ? (
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center" style={{ minHeight: 200, gap: 8 }}>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-stone-300 leading-relaxed tracking-tight">End of Scene</p>
              </div>
            </div>
            <div className="flex flex-col items-center" style={{ gap: 10, marginTop: 60 }}>
              <SeekBar scene={scene} elapsed={elapsed} onSeek={seekTo} width={600} />
              <div className="flex items-center justify-center gap-5">
                <button onClick={cycleSpeed}
                  className="px-4 py-1.5 rounded-full text-sm font-mono transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {speed}x
                </button>
                <button onClick={goPrevScene} className="text-stone-400 hover:text-stone-700 transition-colors p-1">
                  <SkipBack size={26} />
                </button>
                <button onClick={togglePlay}
                  className="rounded-full bg-stone-800 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
                  style={{ width: 72, height: 72 }}
                >
                  <Play size={28} className="ml-0.5" />
                </button>
                <button onClick={toggleCaptions}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {showPlayerMode ? 'Subtitles' : 'CD'}
                </button>
              </div>
            </div>
          </div>
        ) : showCaptions && current ? (
          <div className="flex flex-col items-center" style={{ minHeight: 200, gap: 8 }}>
            {/* Previous line — faded above */}
            {prevLine && (
              <div className="mb-5 text-center transition-all duration-500 ease-out"
                style={{
                  animation: 'prevLineExit 0.5s ease-out both',
                }}
              >
                <p className="text-xl text-stone-500 leading-relaxed italic">{prevLine.english}</p>
              </div>
            )}

            {/* Current line — fades in with slide */}
            <div key={currentLine} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-stone-900 leading-relaxed tracking-tight"
                style={{ animation: 'currentLineEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' }}
              >
                {current.english}
              </p>
              {current.chinese && (
                <p className="text-lg text-stone-500 mt-3 leading-relaxed"
                  style={{ animation: 'currentLineEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both' }}
                >
                  {current.chinese}
                </p>
              )}
            </div>

            {/* Progress bar + Controls — matches CD player layout */}
            <div className="flex flex-col items-center" style={{ gap: 10, marginTop: 60 }}>
              <SeekBar scene={scene} elapsed={elapsed} onSeek={seekTo} width={600} />

              {/* Controls — speed prev play next CD */}
              <div className="flex items-center justify-center gap-5">
                <button onClick={cycleSpeed}
                  className="px-4 py-1.5 rounded-full text-sm font-mono transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {speed}x
                </button>
                <button onClick={goPrevScene} className="text-stone-400 hover:text-stone-700 transition-colors p-1">
                  <SkipBack size={26} />
                </button>
                <button onClick={togglePlay}
                  className="rounded-full bg-stone-800 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
                  style={{ width: 72, height: 72 }}
                >
                  {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
                </button>
                <button onClick={goNextScene} className="text-stone-400 hover:text-stone-700 transition-colors p-1">
                  <SkipForward size={26} />
                </button>
                <button onClick={toggleCaptions}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {showPlayerMode ? 'Subtitles' : 'CD'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-stone-400 text-sm">
            <p>Subtitles已隐藏</p>
            <p className="text-xs mt-1">点击「Subtitles」按钮显示</p>
          </div>
        )}
      </div>
    </div>
  )
}