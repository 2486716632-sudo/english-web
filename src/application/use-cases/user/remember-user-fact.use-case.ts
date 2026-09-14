// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — Use Case（显式、确定性写入 durable memory）

import { ApplicationError } from '@/application/errors'
import type { MemoryRepositoryPort } from '@/application/ports/memory-repository'
import { resolveTraceScope, type ExecutionContext } from '@/application/observability/execution-context'
import { runInSpan } from '@/application/observability/trace-helpers'
import { validateNewMemoryInput } from '@/domain/memory/memory-rules'
import type { RawMemoryWriteInput, StoredMemoryRecord } from '@/domain/memory/types'
import { requireOwnershipUserId } from '@/application/use-cases/user/ownership'

/**
 * RememberUserFactUseCase — 写入一条 durable memory（**有意识、显式**的写入路径）。
 *
 * 硬性规则（任务文档 Part 6 / Part 7）：
 *  - 这是**唯一**被允许的 memory 写入入口；Route **不得**直接写记忆
 *  - **不存在**"每条用户消息 → 自动成为 memory"的路径
 *  - 来源必须是闭集之一：`explicit_user`（用户显式表达）或 `deterministic`（确定性派生）
 *  - 内容有界（≤ 500 字符）、key 归一化（去重）
 *  - 同一 `(userId, kind, key)` 再次写入 = **更新**（不产生重复记录）
 *
 * 失败语义：显式写入失败必须报错（不降级）。
 */

export type RememberUserFactInput = RawMemoryWriteInput

export class RememberUserFactUseCase {
  constructor(private readonly memory: MemoryRepositoryPort) {}

  async execute(
    input: RememberUserFactInput,
    context: ExecutionContext = {},
  ): Promise<StoredMemoryRecord> {
    // B-01：归属身份由 Application 从 ExecutionContext 注入 Domain 校验；
    // payload 结构里**没有** userId，因此无法指向另一个用户。
    const ownerUserId = requireOwnershipUserId(context)

    const validated = validateNewMemoryInput(input, ownerUserId)
    if (!validated.ok) throw new ApplicationError('invalid_input', validated.reason)

    const record = validated.value
    const trace = resolveTraceScope(context)

    return runInSpan(
      trace,
      'memory.remember',
      {
        category: 'persistence',
        metadata: {
          'memory.kind': record.kind,
          'memory.source': record.source,
          'memory.keyChars': record.key.length,
          'memory.contentChars': record.content.length,
        },
      },
      async (span) => {
        let stored: StoredMemoryRecord
        try {
          stored = await this.memory.saveMemory(record)
        } catch (error) {
          throw new ApplicationError(
            'persistence_failed',
            error instanceof Error ? error.message : String(error),
            { cause: error },
          )
        }

        // 只记录标识符与尺寸，**不**记录记忆内容。
        span.addMetadata({ 'memory.id': stored.id })
        return stored
      },
    )
  }
}
