'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatPhonetic } from '@/lib/types'

function firstChineseMeaning(definition: string): string {
  const seg = definition.split(/[；;]/).map((s) => s.trim()).filter(Boolean)[0]
  if (!seg) return ''
  const match = seg.match(/^[a-zA-Z/]+\.?\s*(.*)$/)
  return match && match[1] ? match[1] : seg
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

  useEffect(() => { fetchMastered() }, [fetchMastered])

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
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all hover:opacity-70 active:scale-[0.97]"
          style={{ backgroundColor: '#F0F0F0', color: '#757575' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      <div className="flex-1 px-6 md:px-12 pb-12">
        <div className="w-full max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-center" style={{ color: '#262626' }}>Mastered Words</h1>
          <p className="text-sm text-center mb-8" style={{ color: '#757575' }}>
            {words.length} word{words.length !== 1 ? 's' : ''} permanently mastered
          </p>

          {words.length === 0 ? (
            <p className="text-sm text-center py-16" style={{ color: '#AAAAAA' }}>No mastered words yet.</p>
          ) : (
            <div className="space-y-2">
              {words.map((w) => (
                <div key={w.id}
                  className="flex items-center justify-between rounded-2xl border px-5 py-4"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-sm" style={{ color: '#2F2F2F' }}>{w.word}</span>
                    {w.phonetic && (
                      <span className="text-xs shrink-0" style={{ color: '#999999' }}>{formatPhonetic(w.phonetic)}</span>
                    )}
                    {w.definition && (
                      <span className="text-xs shrink-0" style={{ color: '#AAAAAA' }}>· {firstChineseMeaning(w.definition)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => returnWord(w.id)}
                    disabled={returningId === w.id}
                    className="shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all active:scale-[0.95] disabled:opacity-40"
                    style={{ backgroundColor: '#F0F0F0', color: '#777777' }}
                  >
                    {returningId === w.id ? '…' : 'Return'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
