// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Output Port (时间源抽象；最小实现，不做时间框架)

/**
 * ClockPort — 最小的可注入时间源。
 *
 * 存在理由（Phase 5 任务文档 Part 14）：trace 的计时断言必须确定性 ——
 * 生产使用真实时间，测试注入假时钟，从而避免依赖真实时间的 flaky 测试。
 *
 * 刻意只提供 `now()`（epoch ms）。不提供时区、日历、定时器等能力。
 */
export interface ClockPort {
  /** 当前时间（Unix epoch 毫秒）。 */
  now(): number
}
