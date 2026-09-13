// @version 1.0
// @last-reviewed 2026-09-13
// @layer Infrastructure — 结构化 JSON 行 trace 输出（开发 / 操作员可见）

import type { SpanRecord, TraceEventRecord, TraceRecord } from '@/application/ports/trace'
import {
  BaseTraceRecorder,
  type TraceLifecycleViolation,
  type TraceRecorderOptions,
} from '@/infrastructure/telemetry/base-trace-recorder'

/**
 * 结构化 console Trace recorder。
 *
 * 输出格式（Phase 5 任务文档 Part 16）：**每条记录一行 JSON**，机器可读：
 *
 * ```json
 * {"record":"span","traceId":"…","spanId":"…","parentSpanId":"…","name":"reading.process_article",
 *  "category":"workflow_step","status":"ok","startedAt":1757…,"endedAt":1757…,"durationMs":243,
 *  "metadata":{"articleIndex":1},"error":null}
 * ```
 *
 * `record` 取值为 `span` / `event` / `trace` / `trace.lifecycle_violation`：
 *  - `span`  —— 每个 span 到达终态时输出
 *  - `event` —— 每个 trace 事件输出（Log 级记录，归属于某个 span）
 *  - `trace` —— trace 结束时的汇总行（状态、耗时、span / event 计数）
 *  - `trace.lifecycle_violation` —— trace 在仍有存活子 span 时被终结（埋点缺陷，见 TRACE_DESIGN §8）：
 *    单独一种 record 类型，避免它在日志里被误认为"正常完成"
 *
 * 输出目的地通过 `write` 注入（默认 `console.log`），因此该 adapter 是唯一接触 console 的地方；
 * 未来换成远端 adapter 只需替换本类。所有内容在写入前已经过 `sanitize.ts` 清洗。
 *
 * 生命周期 / 失败语义（外部审核 v2 的 B-03 / B-04）：
 *  - **不保留**任何已完成的 TraceState：base recorder 在交付终态快照后即释放 ACTIVE state；
 *    本类只做序列化与写出，不持有 trace 结构
 *  - `write` 抛异常**不会**影响业务：base recorder 的 fail-open 边界会吞掉输出失败并计数
 */
export interface ConsoleTraceRecorderOptions extends TraceRecorderOptions {
  /** 输出 sink；默认 `console.log`（每行一个 JSON 对象）。 */
  write?: (line: string) => void
}

export class ConsoleTraceRecorder extends BaseTraceRecorder {
  private readonly write: (line: string) => void

  constructor(options: ConsoleTraceRecorderOptions = {}) {
    super(options)
    this.write = options.write ?? ((line: string) => console.log(line))
  }

  protected onSpanEnded(span: SpanRecord): void {
    this.write(JSON.stringify({ record: 'span', ...span }))
  }

  protected onEventRecorded(event: TraceEventRecord): void {
    this.write(JSON.stringify({ record: 'event', ...event }))
  }

  protected onTraceEnded(trace: TraceRecord, violation: TraceLifecycleViolation | null): void {
    if (violation) {
      this.write(
        JSON.stringify({
          record: 'trace.lifecycle_violation',
          traceId: trace.traceId,
          name: trace.name,
          category: trace.category,
          status: trace.status,
          startedAt: trace.startedAt,
          endedAt: trace.endedAt,
          durationMs: trace.durationMs,
          metadata: trace.metadata,
          error: trace.error,
          spanCount: trace.spans.length,
          eventCount: trace.events.length,
          violation,
        }),
      )
      return
    }

    this.write(
      JSON.stringify({
        record: 'trace',
        traceId: trace.traceId,
        name: trace.name,
        category: trace.category,
        status: trace.status,
        startedAt: trace.startedAt,
        endedAt: trace.endedAt,
        durationMs: trace.durationMs,
        metadata: trace.metadata,
        error: trace.error,
        spanCount: trace.spans.length,
        eventCount: trace.events.length,
      }),
    )
  }
}
