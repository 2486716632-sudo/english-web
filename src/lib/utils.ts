export function formatPhonetic(phonetic: string | null): string | null {
  if (!phonetic) return null
  const t = phonetic.trim()
  if (t.startsWith('/') && t.endsWith('/')) return t
  return `/${t}/`
}
