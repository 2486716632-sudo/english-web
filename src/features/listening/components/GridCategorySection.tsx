'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SceneItem, Category } from './SectionRow'

interface Props {
  categories: Category[]
  scenes: Record<string, SceneItem[]>
}

const BG_COLORS = [
  'bg-amber-50 hover:bg-amber-100',
  'bg-sky-50 hover:bg-sky-100',
  'bg-rose-50 hover:bg-rose-100',
  'bg-emerald-50 hover:bg-emerald-100',
  'bg-violet-50 hover:bg-violet-100',
  'bg-orange-50 hover:bg-orange-100',
  'bg-teal-50 hover:bg-teal-100',
  'bg-pink-50 hover:bg-pink-100',
]

export default function GridCategorySection({ categories, scenes }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div>
      {/* Category pill grid */}
      <div className="flex flex-wrap gap-3 mb-6">
        {categories.map((cat, i) => {
          const sceneCount = cat.subcategories.reduce(
            (sum, sub) => sum + (scenes[sub.id]?.length || 0), 0
          )
          const isOpen = expanded === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setExpanded(isOpen ? null : cat.id)}
              className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border border-stone-200/60 transition-all duration-200 active:scale-[0.97] ${
                BG_COLORS[i % BG_COLORS.length]
              } ${isOpen ? 'ring-2 ring-stone-400 shadow-md' : 'hover:shadow-md'}`}
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="text-sm font-bold text-stone-800">{cat.name}</span>
              <span className="text-xs text-stone-400 font-mono">{sceneCount}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded category content */}
      {expanded && (
        <div className="space-y-8 animate-fadeIn">
          {categories
            .filter(c => c.id === expanded)
            .map(cat => (
              <div key={cat.id}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 tracking-wide">{cat.name}</h2>
                    <p className="text-xs text-stone-400">{cat.nameZh}</p>
                  </div>
                </div>

                {cat.subcategories.map(sub => {
                  const subScenes = scenes[sub.id] || []
                  const newCount = subScenes.filter(s => !s.playedAt).length
                  return (
                    <div key={sub.id} className="mb-6 last:mb-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-stone-700">{sub.name}</h3>
                          <span className="text-[11px] text-stone-400 font-mono">{sub.nameZh}</span>
                        </div>
                        {newCount > 0 && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-medium">
                            {newCount} 未听
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {subScenes.length === 0 ? (
                          <div className="col-span-full flex items-center justify-center h-20 rounded-xl bg-white/50 border border-stone-200/40 border-dashed">
                            <p className="text-xs text-stone-400">暂无场景</p>
                          </div>
                        ) : (
                          subScenes.map(scene => (
                            <Link
                              key={scene.id}
                              href={`/listening/${scene.id}`}
                              className="group rounded-xl bg-white border border-stone-200/60 p-4 hover:shadow-md hover:border-stone-300/60 active:scale-[0.97] transition-all duration-200"
                            >
                              <div className="flex flex-col h-full">
                                <h4 className="text-sm font-semibold text-stone-800 group-hover:text-stone-900 leading-snug mb-3">
                                  {scene.title}
                                </h4>
                                <div className="mt-auto flex items-center gap-2 flex-wrap">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                    scene.difficulty === 'elementary' ? 'bg-emerald-100 text-emerald-700' :
                                    scene.difficulty === 'advanced' ? 'bg-rose-100 text-rose-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {scene.difficulty === 'elementary' ? '初级' :
                                     scene.difficulty === 'advanced' ? '高级' : '中级'}
                                  </span>
                                  <span className="text-[11px] text-stone-400 font-mono">
                                    {fmt(scene.duration)}
                                  </span>
                                  {scene.playedAt ? (
                                    <span className="text-[11px] text-stone-300 ml-auto">已听</span>
                                  ) : (
                                    <span className="text-[11px] text-emerald-500 ml-auto font-medium">NEW</span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
        </div>
      )}

      {/* Empty state when nothing expanded */}
      {!expanded && (
        <div className="text-center py-16">
          <p className="text-stone-400 text-sm">选择一个分类查看场景</p>
        </div>
      )}
    </div>
  )
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
