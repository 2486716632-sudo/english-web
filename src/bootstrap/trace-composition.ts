// @layer Composition Root — Trace 装配
//
// 唯一决定"用哪个 Trace adapter"的地方。Application 只看见 `TracePort`。
// 与 `index.ts`（assistant 交付面）/`reading-composition.ts`（CLI 交付面）同层。

import type { ClockPort } from '@/application/ports/clock'
import type { TracePort } from '@/application/ports/trace'
import { ConsoleTraceRecorder } from '@/infrastructure/telemetry/console-trace-recorder'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'

/**
 * Trace 输出模式：
 *  - `console`（默认，开发/生产）：结构化 JSON 行写入 stdout，操作员/日志采集可见
 *  - `memory`：只在进程内存中保留，供测试与自动化断言
 *
 * 选择顺序：显式参数 → `TRACE_MODE` 环境变量 → `NODE_ENV === 'test'` 时为 memory，否则 console。
 */
export type TraceRecorderMode = 'console' | 'memory'

export interface CreateTraceRecorderOptions {
  mode?: TraceRecorderMode
  /** console 模式的输出 sink（默认 `console.log`）；便于测试捕获输出。 */
  write?: (line: string) => void
  clock?: ClockPort
  createId?: () => string
}

export function resolveTraceMode(mode?: TraceRecorderMode): TraceRecorderMode {
  if (mode) return mode
  const fromEnv = process.env.TRACE_MODE
  if (fromEnv === 'console' || fromEnv === 'memory') return fromEnv
  return process.env.NODE_ENV === 'test' ? 'memory' : 'console'
}

/** 按模式装配一个 Trace recorder。 */
export function createTraceRecorder(options: CreateTraceRecorderOptions = {}): TracePort {
  const mode = resolveTraceMode(options.mode)
  if (mode === 'memory') {
    return new InMemoryTraceRecorder({ clock: options.clock, createId: options.createId })
  }
  return new ConsoleTraceRecorder({
    write: options.write,
    clock: options.clock,
    createId: options.createId,
  })
}

let processTraceRecorder: TracePort | undefined

/** 进程内惰性单例（Route 使用），避免每个请求重建 recorder。 */
export function getTraceRecorder(): TracePort {
  if (!processTraceRecorder) {
    processTraceRecorder = createTraceRecorder()
  }
  return processTraceRecorder
}
