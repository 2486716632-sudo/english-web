// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — ClockPort 的生产实现

import type { ClockPort } from '@/application/ports/clock'

/** 生产时间源：真实墙钟（epoch ms）。测试注入假时钟以获得确定性计时断言。 */
export const systemClock: ClockPort = {
  now: () => Date.now(),
}
