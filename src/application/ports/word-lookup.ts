// @version 1.0
// @last-reviewed 2026-09-12
// @layer Application — Output Port (interface only, no implementation)

/**
 * WordLookupPort — 「按单词取词卡」的最小读模型端口。
 *
 * Phase 3 只为参考迁移（`POST /api/assistant`）引入这一个最小 port，
 * 用来把 Route 中的 Prisma 细节移出 Layer 1。
 * 完整的 Repository 体系属于 Phase 4+（见 docs/refactor/TARGET_ARCHITECTURE.md §17.4 TBD-1）。
 */

export interface WordCard {
  word: string
  phonetic: string | null
  partOfSpeech: string | null
  definition: string
  collocations: string | null
  example: string | null
  exampleZh: string | null
}

export interface WordLookupPort {
  /**
   * 大小写不敏感地按英文单词精确查找词卡。
   *
   * 契约：**不得抛异常**。查找失败或数据源不可用时返回 `null`，
   * 由调用方决定降级行为（参考迁移中即「不注入词卡，继续回复」）。
   */
  findByWord(word: string): Promise<WordCard | null>
}
