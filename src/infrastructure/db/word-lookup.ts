// @layer Infrastructure — WordLookupPort implementation (Prisma)

import type { PrismaClient } from '@/generated/prisma/client'
import type { WordCard, WordLookupPort } from '@/application/ports/word-lookup'

/**
 * `WordLookupPort` 的 Prisma 实现。
 *
 * 行为与迁移前 `src/app/api/assistant/route.ts` 中的内联查询一致：
 * 按小写单词精确匹配，查不到或数据源不可用时返回 `null`（调用方降级）。
 *
 * 依赖通过构造函数注入，便于替换实现与测试；Composition Root 负责传入 Prisma 客户端。
 * Prisma 单例的搬迁（`src/lib/prisma.ts` → `src/infrastructure/db/`）属于后续 Phase（见 TARGET_ARCHITECTURE §15）。
 */
export class PrismaWordLookup implements WordLookupPort {
  constructor(private readonly client: PrismaClient) {}

  async findByWord(word: string): Promise<WordCard | null> {
    try {
      const found = await this.client.word.findFirst({
        where: { word: word.toLowerCase() },
      })
      if (!found) return null

      return {
        word: found.word,
        phonetic: found.phonetic,
        partOfSpeech: found.partOfSpeech,
        definition: found.definition,
        collocations: found.collocations,
        example: found.example,
        exampleZh: found.exampleZh,
      }
    } catch {
      // 数据源不可用时不阻断 AI 回复（与迁移前行为一致）。
      return null
    }
  }
}
