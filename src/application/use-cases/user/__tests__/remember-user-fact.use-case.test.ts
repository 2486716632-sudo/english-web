import { describe, it, expect } from 'vitest'
import { ApplicationError } from '@/application/errors'
import type { TraceRecord } from '@/application/ports/trace'
import { runInTrace } from '@/application/observability/trace-helpers'
import { RememberUserFactUseCase } from '@/application/use-cases/user/remember-user-fact.use-case'
import { MEMORY_CONTENT_MAX_CHARS } from '@/domain/memory/memory-rules'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'
import { FakeMemoryRepository } from './fakes'

function harness() {
  const memory = new FakeMemoryRepository()
  const useCase = new RememberUserFactUseCase(memory)
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  return { memory, useCase, recorder }
}

const traceOf = (recorder: InMemoryTraceRecorder): TraceRecord => {
  const record = recorder.getLastTrace()
  if (!record) throw new Error('trace not recorded')
  return record
}

/** 写入 payload **不含** userId（B-01）；归属身份只来自 ExecutionContext。 */
const baseWrite = {
  kind: 'goal' as const,
  key: 'primary_goal',
  content: 'pass IELTS speaking 7.0',
  source: 'explicit_user' as const,
}

describe('RememberUserFactUseCase — 显式、确定性记忆写入', () => {
  it('B-01：写入归属来自 ExecutionContext.userId', async () => {
    const { memory, useCase } = harness()

    const stored = await useCase.execute(baseWrite, { userId: 'user-a' })

    expect(stored).toMatchObject({
      userId: 'user-a',
      kind: 'goal',
      key: 'primary_goal',
      content: 'pass IELTS speaking 7.0',
      source: 'explicit_user',
    })
    expect(memory.saveCalls).toHaveLength(1)
    expect(memory.saveCalls[0]?.userId).toBe('user-a')
  })

  it('B-01：缺失 ExecutionContext.userId → 显式 invalid_input（不写库、不回落默认用户）', async () => {
    const { memory, useCase } = harness()

    await expect(useCase.execute(baseWrite)).rejects.toBeInstanceOf(ApplicationError)
    await expect(useCase.execute(baseWrite)).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(useCase.execute(baseWrite, {})).rejects.toMatchObject({
      code: 'invalid_input',
    })
    await expect(useCase.execute(baseWrite, { userId: 'bad id!' })).rejects.toMatchObject({
      code: 'invalid_input',
    })

    expect(memory.saveCalls).toHaveLength(0)
  })

  it('B-01：payload 试图指定另一个用户 → 被忽略，权威归属仍是 context.userId', async () => {
    const { memory, useCase } = harness()

    const hostilePayload = { ...baseWrite, userId: 'user-b' } as unknown as typeof baseWrite
    const stored = await useCase.execute(hostilePayload, { userId: 'user-a' })

    expect(stored.userId).toBe('user-a')
    expect(memory.saveCalls[0]?.userId).toBe('user-a')
  })

  it('去重：同一含义键的不同写法只产生一条记录（更新而不是新增）', async () => {
    const { memory, useCase } = harness()

    const first = await useCase.execute(
      { ...baseWrite, kind: 'preference', key: 'Example Order', content: 'prefers examples first' },
      { userId: 'user-a' },
    )
    const second = await useCase.execute(
      {
        ...baseWrite,
        kind: 'preference',
        key: 'example-order',
        content: 'prefers examples before theory',
      },
      { userId: 'user-a' },
    )

    expect(first.key).toBe('example_order')
    expect(second.key).toBe(first.key)
    expect(second.id).toBe(first.id)
    expect(second.content).toBe('prefers examples before theory')
    expect(await memory.listMemory({ userId: 'user-a', limit: 20 })).toHaveLength(1)
  })

  it('同一 key 但不同 kind / 不同用户 → 不同记录', async () => {
    const { useCase } = harness()

    const goal = await useCase.execute({ ...baseWrite, kind: 'goal' }, { userId: 'user-a' })
    const milestone = await useCase.execute(
      { ...baseWrite, kind: 'milestone' },
      { userId: 'user-a' },
    )
    const otherUser = await useCase.execute({ ...baseWrite, kind: 'goal' }, { userId: 'user-b' })

    expect(new Set([goal.id, milestone.id, otherUser.id]).size).toBe(3)
  })

  it('B-02：canonical User State 保留语义键不能写成 Memory', async () => {
    const { memory, useCase } = harness()

    for (const key of ['explanation_language', 'Explanation Language', 'englishLevel']) {
      await expect(
        useCase.execute({ ...baseWrite, kind: 'preference', key }, { userId: 'user-a' }),
      ).rejects.toMatchObject({ code: 'invalid_input' })
    }

    expect(memory.saveCalls).toHaveLength(0)
  })

  it('B-02：非 canonical 的 preference 仍然可以写入', async () => {
    const { memory, useCase } = harness()

    const stored = await useCase.execute(
      {
        kind: 'preference',
        key: 'example_order',
        content: 'prefers examples before theory',
        source: 'explicit_user',
      },
      { userId: 'user-a' },
    )

    expect(stored).toMatchObject({ kind: 'preference', key: 'example_order' })
    expect(memory.saveCalls).toHaveLength(1)
  })

  it('拒绝非法输入：闭集外的 kind / source、空内容、超长内容', async () => {
    const { useCase, memory } = harness()

    await expect(
      useCase.execute({ ...baseWrite, kind: 'raw_chat' }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute({ ...baseWrite, source: 'chat_history' }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute({ ...baseWrite, content: '   ' }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute(
        { ...baseWrite, content: 'x'.repeat(MEMORY_CONTENT_MAX_CHARS + 1) },
        { userId: 'user-a' },
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    expect(memory.saveCalls).toHaveLength(0)
  })

  it('仓储失败 → persistence_failed（显式写入失败必须报错）', async () => {
    const { memory, useCase } = harness()
    memory.failSave = new Error('write failed')

    const milestone = {
      kind: 'milestone' as const,
      key: 'first_reading_series',
      content: 'finished 5 articles',
      source: 'deterministic' as const,
    }

    await expect(useCase.execute(milestone, { userId: 'user-a' })).rejects.toBeInstanceOf(
      ApplicationError,
    )
    await expect(useCase.execute(milestone, { userId: 'user-a' })).rejects.toMatchObject({
      code: 'persistence_failed',
    })
  })

  it('Trace 只记录 kind / source / 尺寸 / id，不记录记忆内容', async () => {
    const { useCase, recorder } = harness()
    const content = 'MEMORY-WRITE-CONTENT-MARKER'

    await runInTrace(
      recorder,
      'test.root',
      { category: 'use_case' },
      (trace) =>
        useCase.execute(
          {
            kind: 'weakness',
            key: 'articles',
            content,
            source: 'deterministic',
          },
          { trace, userId: 'user-a' },
        ),
    )

    const record = traceOf(recorder)
    const span = record.spans.find((item) => item.name === 'memory.remember')
    expect(span?.metadata).toMatchObject({
      'memory.kind': 'weakness',
      'memory.source': 'deterministic',
      'memory.keyChars': 'articles'.length,
      'memory.contentChars': content.length,
    })
    expect(span?.metadata['memory.id']).toBeTruthy()
    expect(JSON.stringify(record)).not.toContain(content)
  })
})
