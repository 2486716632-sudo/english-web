// @layer Domain — User 领域类型（无外部依赖、无 Prisma / Next.js / Trace）

/**
 * 逻辑用户标识。
 *
 * 刻意是不透明字符串：Domain 不关心它从哪来（过渡期常量 / 未来的 session / JWT）。
 * 见 `docs/refactor/MEMORY_DESIGN.md` 的身份策略章节。
 */
export type UserId = string

/** 英语水平闭集。闭集让"确定性写入"可校验，也让 prompt 能安全按档位措辞。 */
export const ENGLISH_LEVELS = [
  'beginner',
  'elementary',
  'intermediate',
  'upper_intermediate',
  'advanced',
] as const

export type EnglishLevel = (typeof ENGLISH_LEVELS)[number]

/** 解释语言偏好闭集（应用的既有解释语言是中文；英文/双语作为显式偏好）。 */
export const EXPLANATION_LANGUAGES = ['zh', 'en', 'bilingual'] as const

export type ExplanationLanguage = (typeof EXPLANATION_LANGUAGES)[number]

/**
 * **canonical 用户学习档案**（user state）。
 *
 * 语义：这些是"当前为真"的事实，可被覆盖；与历史性的 Memory（`UserMemory`）刻意分离。
 */
export interface UserLearningProfile {
  userId: UserId
  englishLevel: EnglishLevel | null
  explanationLanguage: ExplanationLanguage | null
  createdAt: Date
  updatedAt: Date
}

/**
 * **已校验**的档案局部更新。
 *
 * 语义：只有显式出现的键会被写入；`null` 表示显式清空该字段；
 * 缺省的键表示"不改变"。未校验的原始输入由 `profile-rules.ts` 处理。
 */
export interface LearningProfilePatch {
  englishLevel?: EnglishLevel | null
  explanationLanguage?: ExplanationLanguage | null
}
