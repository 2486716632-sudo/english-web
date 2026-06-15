export interface ReviewState {
  interval: number
  easiness: number
  repetitions: number
  nextReviewAt: string
  isMastered: boolean
}

export interface WordData {
  id: number
  word: string
  phonetic: string | null
  partOfSpeech: string
  definition: string
  collocations: string | null
  example: string | null
  exampleZh: string | null
  imageUrl: string | null
  theme: string | null
  difficulty: string
  review: ReviewState | null
}

export interface QueuesResponse {
  reviewQueue: number
  newWordsQueue: number
  masteredCount: number
  totalWords: number
}

export interface AITrainResponse {
  dialogue: string
  aiTips: string
}
