'use client'

import Link from 'next/link'
import type { SceneItem, Category } from './SectionRow'

interface Props {
  categories: Category[]
  scenes: Record<string, SceneItem[]>
}

const CATEGORY_ICONS: Record<string, string> = {
  'knowledge-sports': '🏃',
  'knowledge-psychology': '🧠',
  'knowledge-science': '🔬',
  'knowledge-history': '📜',
  'knowledge-society': '🌍',
  'knowledge-business': '💼',
}

function getIcon(catId: string): string {
  return CATEGORY_ICONS[catId] || '📖'
}

export default function ListSection({ categories, scenes }: Props) {
  // Collect all scenes grouped by their subcategory
  const allRows: { scene: SceneItem; cat: Category; subName: string; subNameZh: string; icon: string }[] = []

  for (const cat of categories) {
    const icon = getIcon(cat.id)
    for (const sub of cat.subcategories) {
      const subScenes = scenes[sub.id] || []
      for (const scene of subScenes) {
        allRows.push({ scene, cat, subName: sub.name, subNameZh: sub.nameZh, icon })
      }
    }
  }

  // Sort: unplayed first, then by createdAt desc
  allRows.sort((a, b) => {
    if (a.scene.playedAt && !b.scene.playedAt) return 1
    if (!a.scene.playedAt && b.scene.playedAt) return -1
    return new Date(b.scene.createdAt).getTime() - new Date(a.scene.createdAt).getTime()
  })

  if (allRows.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-400 text-lg">No content yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {allRows.map(({ scene, cat, subName, subNameZh, icon }) => (
        <Link
          key={scene.id}
          href={`/listening/${scene.id}`}
          className="flex items-center gap-4 rounded-2xl bg-white border border-stone-200/60 p-5 hover:shadow-md hover:border-stone-300/60 active:scale-[0.99] transition-all duration-200 group"
        >
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center flex-shrink-0 text-2xl">
            {icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-stone-800 group-hover:text-stone-900 transition-colors truncate">
              {scene.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-stone-400 truncate">{subName}</span>
              <span className="text-[10px] text-stone-300">·</span>
              <span className="text-[11px] text-stone-400 font-mono">
                {fmt(scene.duration)}
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
              scene.difficulty === 'elementary' ? 'bg-emerald-100 text-emerald-700' :
              scene.difficulty === 'advanced' ? 'bg-rose-100 text-rose-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {scene.difficulty === 'elementary' ? '初级' :
               scene.difficulty === 'advanced' ? '高级' : '中级'}
            </span>
            {scene.playedAt ? (
              <span className="text-[11px] text-stone-300">已听</span>
            ) : (
              <span className="text-[11px] text-emerald-500 font-medium">NEW</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
