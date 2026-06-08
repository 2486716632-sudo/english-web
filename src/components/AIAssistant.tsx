'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface AssistantMessage {
  role: 'user' | 'ai'
  content: string
}

interface WordData {
  word: string
  phonetic: string | null
  partOfSpeech: string
  definition: string
  collocations: string | null
  example: string | null
  exampleZh: string | null
}

const PANEL_W = 420
const PANEL_H = 580
const POS_KEY = 'ai-assistant-pos'

function loadPosition(): { right: number; bottom: number } {
  if (typeof window === 'undefined') return { right: 24, bottom: 88 }
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.right === 'number' && typeof parsed.bottom === 'number') {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return { right: 24, bottom: 88 }
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [wordData, setWordData] = useState<WordData | null>(null)
  const [position, setPosition] = useState<{ right: number; bottom: number }>(loadPosition)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origRight: number; origBottom: number }>({ startX: 0, startY: 0, origRight: 0, origBottom: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Persist position
  useEffect(() => {
    localStorage.setItem(POS_KEY, JSON.stringify(position))
  }, [position])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200)
  }, [isOpen])

  // Refocus input after AI responds
  useEffect(() => {
    if (!loading && isOpen) inputRef.current?.focus()
  }, [loading, isOpen])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function clampPosition(pos: { right: number; bottom: number }) {
    const maxRight = window.innerWidth - Math.min(PANEL_W, window.innerWidth - 32) - 16
    const maxBottom = window.innerHeight - Math.min(PANEL_H, window.innerHeight - 80) - 16
    return {
      right: Math.max(16, Math.min(pos.right, maxRight)),
      bottom: Math.max(16, Math.min(pos.bottom, maxBottom)),
    }
  }

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origRight: position.right, origBottom: position.bottom }
  }, [position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    // Moving right → right offset decreases; moving down → bottom offset decreases
    const clamped = clampPosition({ right: dragRef.current.origRight - dx, bottom: dragRef.current.origBottom - dy })
    setPosition(clamped)
  }, [dragging])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: AssistantMessage = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setLoading(true)
    setWordData(null)

    try {
      const allMessages = [...messages, userMsg]
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, query: text.trim() }),
      })
      const data = await res.json()
      if (data.wordData) setWordData(data.wordData)
      setMessages((prev) => [...prev, { role: 'ai', content: data.reply || 'Sorry, I got no response.' }])
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', content: 'Sorry, connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    if (inputText.trim() && !loading) sendMessage(inputText)
  }, [sendMessage, inputText, loading])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }, [handleSubmit])

  const openPanel = useCallback(() => {
    setIsOpen(true)
    setMessages([])
    setWordData(null)
  }, [])

  const closePanel = useCallback(() => {
    setIsOpen(false)
    setMessages([])
    setWordData(null)
  }, [])

  return (
    <>
      {/* Floating Ball */}
      <button
        onClick={openPanel}
        className="fixed z-40 group flex items-center justify-center cursor-pointer"
        style={{
          bottom: '24px',
          right: '24px',
        }}
        aria-label="Ask AI"
      >
        {/* Hover label */}
        <span
          className="absolute right-full mr-3 hidden group-hover:flex items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-opacity"
          style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
        >
          Ask me anything
        </span>
        <div
          className="flex items-center justify-center rounded-full shadow-xl transition-all hover:scale-110 active:scale-95"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: '#262626',
          }}
        >
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
          onClick={closePanel}
        >
          <div
            ref={panelRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => e.stopPropagation()}
            className="absolute flex flex-col overflow-hidden"
            style={{
              width: `min(${PANEL_W}px, calc(100vw - 32px))`,
              height: `min(${PANEL_H}px, calc(100vh - 80px))`,
              right: position.right,
              bottom: position.bottom,
              cursor: dragging ? 'grabbing' : 'default',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid rgba(0,0,0,0.05)',
              boxShadow: '0 8px 40px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.02)',
            }}
          >
            {/* Header / Drag Handle */}
            <div
              onMouseDown={handleMouseDown}
              className="flex items-center justify-between px-5 py-3.5 shrink-0 select-none"
              style={{
                backgroundColor: '#F8F6F4',
                cursor: dragging ? 'grabbing' : 'grab',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: '#262626' }}>
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold tracking-tight" style={{ color: '#2F2F2F' }}>AI Assistant</span>
              </div>
              <button onClick={closePanel} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:opacity-60" style={{ color: '#999999' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="mb-4 rounded-full p-3.5" style={{ backgroundColor: '#F0F0F0' }}>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#888888' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#555555' }}>Ask me anything about English</p>
                  <p className="text-xs mt-1.5" style={{ color: '#AAAAAA' }}>Words, grammar, translation, usage...</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div
                        className="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed text-white"
                        style={{
                          backgroundColor: '#2F2F2F',
                          borderRadius: '18px 18px 4px 18px',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div
                        className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold select-none"
                        style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                      >
                        A
                      </div>
                      <div
                        className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                        style={{
                          backgroundColor: '#F3F1EF',
                          color: '#2F2F2F',
                          borderRadius: '18px 18px 18px 4px',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Word Data Card */}
              {wordData && (
                <div
                  className="rounded-xl border p-4"
                  style={{
                    backgroundColor: '#F8F6F4',
                    borderColor: 'rgba(0,0,0,0.05)',
                  }}
                >
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-base font-bold" style={{ color: '#2F2F2F' }}>{wordData.word}</span>
                    {wordData.phonetic && <span className="text-xs" style={{ color: '#888888' }}>/{wordData.phonetic.replace(/^\/|\/$/g, '')}/</span>}
                    <span className="text-xs" style={{ color: '#AAAAAA' }}>{wordData.partOfSpeech}</span>
                  </div>
                  <p className="text-sm mb-2.5 leading-relaxed" style={{ color: '#555555' }}>{wordData.definition}</p>
                  {wordData.collocations && (
                    <div className="flex flex-wrap gap-1.5">
                      {wordData.collocations.split(',').map((c, i) => {
                        const sp = c.lastIndexOf(' ')
                        const en = sp > 0 ? c.slice(0, sp) : c
                        const zh = sp > 0 ? c.slice(sp + 1) : ''
                        return (
                          <span key={i} className="inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: '#FFFFFF', color: '#555555', border: '1px solid rgba(0,0,0,0.04)' }}>
                            <span className="font-medium">{en}</span>
                            {zh && <span style={{ color: '#AAAAAA' }}>{zh}</span>}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold select-none"
                    style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                  >
                    A
                  </div>
                  <div
                    className="px-5 py-3"
                    style={{
                      backgroundColor: '#F3F1EF',
                      borderRadius: '18px 18px 18px 4px',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: '#AAAAAA', animationDelay: '0s' }} />
                      <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: '#AAAAAA', animationDelay: '0.15s' }} />
                      <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: '#AAAAAA', animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors placeholder:select-none"
                  style={{
                    borderColor: 'rgba(0,0,0,0.07)',
                    backgroundColor: '#F8F6F4',
                    color: '#2F2F2F',
                  }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  className="shrink-0 rounded-xl p-2.5 transition-all active:scale-90 cursor-pointer"
                  style={{
                    backgroundColor: inputText.trim() && !loading ? '#262626' : '#E8E8E8',
                    color: '#FFFFFF',
                  }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
