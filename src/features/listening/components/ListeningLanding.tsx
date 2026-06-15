'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CategoriesData {
  categories: { id: string; type: string; subcategories: { id: string }[] }[]
}

export default function ListeningLanding() {
  const [sceneCount, setSceneCount] = useState(0)
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [catRes, sceneRes] = await Promise.all([
          fetch('/api/listening/categories'),
          fetch('/api/listening/scenes'),
        ])
        const catData: CategoriesData = await catRes.json()
        const sceneData = await sceneRes.json()

        const sceneSubIds = new Set<string>()
        const knowledgeSubIds = new Set<string>()
        for (const cat of catData.categories || []) {
          for (const sub of cat.subcategories || []) {
            if (cat.type === 'scene') sceneSubIds.add(sub.id)
            else if (cat.type === 'knowledge') knowledgeSubIds.add(sub.id)
          }
        }

        let s = 0, k = 0
        for (const scene of sceneData.scenes || []) {
          if (sceneSubIds.has(scene.subcategoryId)) s++
          else if (knowledgeSubIds.has(scene.subcategoryId)) k++
        }
        setSceneCount(s)
        setKnowledgeCount(k)
      } catch {
        // Graceful degradation
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F6F4]">
      {/* Top bar */}
      <div className="w-full px-6 md:px-12 pt-6 pb-2">
        <Link
          href="/"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-60 active:scale-95 active:rotate-12"
          style={{ backgroundColor: '#EDE8E3', color: '#a8a29e' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
      </div>

      {/* Cards */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold uppercase tracking-[0.15em] text-[#262626]">
            Choose Your Mode
          </h2>
          <p className="text-stone-400 text-sm mt-3">Select a category to start practicing</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Scene Dialogue */}
          <Link
            href="/listening/scenes"
            className="group"
          >
            <div className="aspect-square rounded-3xl bg-white border border-stone-200/60 p-10 flex flex-col items-center justify-center text-center hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl bg-amber-50/40 flex items-center justify-center mb-5">
                <span className="text-4xl">🎭</span>
              </div>
              <h3 className="text-2xl font-bold text-stone-800 mb-1">
                Scene Dialogue
              </h3>
              <p className="text-xs tracking-widest mt-1 mb-4 text-stone-400">
                daily conversation
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50/40 text-stone-500">Everyday</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50/40 text-stone-500">Practical</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-50/40 text-stone-500">Real-world</span>
              </div>
              <div className="text-stone-800 tabular-nums">
                <span className="text-3xl font-bold">
                  {loading ? (
                    <span className="inline-block w-8 h-8 bg-stone-100 rounded animate-pulse align-middle" />
                  ) : (
                    sceneCount
                  )}
                </span>
                <span className="text-xs text-stone-400 ml-1">scenes</span>
              </div>
            </div>
          </Link>

          {/* Knowledge */}
          <Link
            href="/listening/knowledge"
            className="group"
          >
            <div className="aspect-square rounded-3xl bg-white border border-stone-200/60 p-10 flex flex-col items-center justify-center text-center hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl bg-sky-50/40 flex items-center justify-center mb-5">
                <span className="text-4xl">📚</span>
              </div>
              <h3 className="text-2xl font-bold text-stone-800 mb-1">
                Knowledge
              </h3>
              <p className="text-xs tracking-widest mt-1 mb-4 text-stone-400">
                narratives &amp; interviews
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                <span className="text-[10px] px-2 py-1 rounded-full bg-sky-50/40 text-stone-500">Science</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-sky-50/40 text-stone-500">History</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-sky-50/40 text-stone-500">Society</span>
              </div>
              <div className="text-stone-800 tabular-nums">
                <span className="text-3xl font-bold">
                  {loading ? (
                    <span className="inline-block w-8 h-8 bg-stone-100 rounded animate-pulse align-middle" />
                  ) : (
                    knowledgeCount
                  )}
                </span>
                <span className="text-xs text-stone-400 ml-1">topics</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
