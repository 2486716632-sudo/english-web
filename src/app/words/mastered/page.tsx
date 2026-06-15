'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatPhonetic } from '@/lib/utils'

interface DefEntry { pos: string; meaning: string }

function parseDefinitions(rawDef: string, rawPos: string): DefEntry[] {
  const segments = rawDef.split(/[；;]|[\r\n]+/).map((s) => s.trim()).filter(Boolean)
  return segments.map((seg) => {
    const match = seg.match(/^([a-zA-Z/]+)\.?\s*(.*)$/)
    if (match && match[1].length <= 6) {
      return { pos: match[1].toLowerCase(), meaning: match[2] || seg }
    }
    return { pos: rawPos, meaning: seg }
  })
}

interface MasteredWord {
  id: number
  word: string
  phonetic: string | null
  partOfSpeech: string
  definition: string
}

export default function MasteredListPage() {
  const [words, setWords] = useState<MasteredWord[]>([])
  const [loading, setLoading] = useState(true)
  const [returningId, setReturningId] = useState<number | null>(null)
  const router = useRouter()

  const fetchMastered = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/words/mastered')
      const data = await res.json()
      setWords(data.words || [])
    } catch {
      setWords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMastered()
  }, [fetchMastered])

  const returnWord = useCallback(async (wordId: number) => {
    setReturningId(wordId)
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId, unmastered: true }),
      })
      setWords((prev) => prev.filter((w) => w.id !== wordId))
    } catch (err) {
      console.error(err)
    } finally {
      setReturningId(null)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F6F4' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-800" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F6F4' }}>
      <div className="w-full px-6 md:px-12 pt-6 pb-2">
        <button onClick={() => router.back()}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
          style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-6 md:px-12 pb-12">
        <div className="w-full max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-center" style={{ color: '#262626' }}>Mastered Words</h1>
          <p className="text-sm text-center mb-8" style={{ color: '#757575' }}>
            {words.length} word{words.length !== 1 ? 's' : ''} permanently mastered
          </p>

          {words.length === 0 ? (
            <p className="text-sm text-center py-16" style={{ color: '#AAAAAA' }}>No mastered words yet.</p>
          ) : (
            <div className="space-y-3">
              {words.map((w) => (
                <div key={w.id}
                  className="rounded-2xl border px-7 py-5"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="font-bold text-lg" style={{ color: '#2F2F2F' }}>{w.word}</span>
                        {w.phonetic && (
                          <span className="text-sm" style={{ color: '#999999' }}>{formatPhonetic(w.phonetic)}</span>
                        )}
                      </div>
                      {w.definition && (
                        <div className="mt-1.5 space-y-0.5 text-sm leading-relaxed" style={{ color: '#555555' }}>
                          {parseDefinitions(w.definition, w.partOfSpeech).map((d, i) => (
                            <p key={i}>
                              {d.pos && <span className="font-medium" style={{ color: '#666666' }}>{d.pos}</span>}
                              {d.pos && ' '}{d.meaning}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => returnWord(w.id)}
                      disabled={returningId === w.id}
                      className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:scale-105 active:scale-[0.95] disabled:opacity-40"
                      style={{ backgroundColor: '#FCEAEB', color: '#B91C1C' }}
                    >
                      {returningId === w.id ? '…' : 'Return'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
