export interface SM2Result {
  interval: number
  easiness: number
  repetitions: number
  nextReviewAt: Date
}

/**
 * Standard SM-2 algorithm for spaced repetition.
 * Supports ratings 1-5 where:
 *   1-2 = incorrect (reset), 3 = good, 4 = easy, 5 = mastered
 *
 * @param rating - User rating: 1-5
 * @param prev - Previous review state (defaults to initial values)
 */
export function sm2(
  rating: number,
  prev: { interval: number; easiness: number; repetitions: number } = {
    interval: 0,
    easiness: 2.5,
    repetitions: 0,
  },
): SM2Result {
  let { interval, easiness, repetitions } = prev

  // Update easiness factor (SM-2 formula for any rating 1-5)
  easiness =
    easiness + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  if (easiness < 1.3) easiness = 1.3

  if (rating >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easiness)
    }
    repetitions += 1
  } else {
    // Incorrect response — reset, review again immediately
    repetitions = 0
    interval = 0
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + interval)
  nextReviewAt.setHours(0, 0, 0, 0)

  return { interval, easiness, repetitions, nextReviewAt }
}
