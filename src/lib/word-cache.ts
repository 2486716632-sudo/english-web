import type { WordData } from './types'

// Module-level caches — survive remount on back-navigation
export const listWordCache: Record<string, WordData[]> = {}
export const studyWordCache: Record<string, WordData[]> = {}

export function clearWordCaches(theme: string) {
  delete listWordCache[theme]
  delete studyWordCache[theme]
}
