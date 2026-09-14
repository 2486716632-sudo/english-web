import { describe, it, expect } from 'vitest'
import { ApplicationError } from '@/application/errors'
import type { TraceRecord, TraceScope } from '@/application/ports/trace'
import { runInTrace } from '@/application/observability/trace-helpers'
import { GetUserContextUseCase } from '@/application/use-cases/user/get-user-context.use-case'
import type { StoredMemoryRecord } from '@/domain/memory/types'
import type { UserLearningProfile } from '@/domain/user/types'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'
import { FIXED_NOW, FakeMemoryRepository, FakeUserRepository, storedMemory } from './fakes'

const CONTENT_MARKER = 'MEMORY-CONTENT-MARKER-DO-NOT-TRACE'

function harness(
  seedProfiles: UserLearningProfile[] = [],
  seedMemory: StoredMemoryRecord[] = [],
) {
  const users = new FakeUserRepository(seedProfiles)
  const memory = new FakeMemoryRepository(seedMemory)
  const useCase = new GetUserContextUseCase({ users, memory })
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  return { users, memory, useCase, recorder }
}

function profileSeed(
  userId: string,
  englishLevel: UserLearningProfile['englishLevel'],
  explanationLanguage: UserLearningProfile['explanationLanguage'],
): UserLearningProfile {
  return {
    userId,
    englishLevel,
    explanationLanguage,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  }
}

const traceOf = (recorder: InMemoryTraceRecorder): TraceRecord => {
  const record = recorder.getLastTrace()
  if (!record) throw new Error('trace not recorded')
  return record
}

/** 复现交付层职责：创建 root trace 并把 scope 显式传给用例（root 会被正确终结）。 */
function runWithTrace<T>(
  recorder: InMemoryTraceRecorder,
  run: (trace: TraceScope) => Promise<T>,
): Promise<T> {
  return runInTrace(recorder, 'test.root', { category: 'use_case' }, run)
}

describe('GetUserContextUseCase — 读取 canonical profile + 有界 memory', () => {
  it('读取档案与记忆，并把收敛后的上限交给仓储（有界选择）', async () => {
    const { useCase, memory } = harness(
      [profileSeed('user-a', 'intermediate', 'zh')],
      [storedMemory({ userId: 'user-a', kind: 'goal', key: 'primary_goal', content: CONTENT_MARKER })],
    )

    const result = await useCase.execute({ memoryLimit: 999 }, { userId: 'user-a' })

    expect(result.userId).toBe('user-a')
    expect(result.profile?.englishLevel).toBe('intermediate')
    expect(result.profile?.explanationLanguage).toBe('zh')
    expect(result.memory).toHaveLength(1)
    expect(result.memory[0]).toMatchObject({ kind: 'goal', content: CONTENT_MARKER })
    expect(result.selectionLimit).toBe(20) // MEMORY_SELECTION_MAX_LIMIT
    expect(result.degraded).toBe(false)
    expect(memory.listQueries[0]).toMatchObject({ userId: 'user-a', limit: 20 })
  })

  it('B-01：ExecutionContext.userId 是权威归属；payload 不能选择另一个用户', async () => {
    const { useCase, memory } = harness(
      [],
      [
        storedMemory({ userId: 'user-a', kind: 'goal', key: 'g', content: 'A-marker' }),
        storedMemory({ userId: 'user-b', kind: 'goal', key: 'g', content: 'B-marker' }),
      ],
    )

    // 运行时注入的敌意 payload 试图指向 user-b；权威归属仍来自 context.userId。
    const hostileInput = {
      memoryLimit: 5,
      userId: 'user-b',
    } as unknown as Parameters<GetUserContextUseCase['execute']>[0]

    const result = await useCase.execute(hostileInput, { userId: 'user-a' })

    expect(result.userId).toBe('user-a')
    expect(result.memory.map((item) => item.content)).toEqual(['A-marker'])
    expect(memory.listQueries[0]?.userId).toBe('user-a')
  })

  it('B-01：缺失 ExecutionContext.userId → 显式 invalid_input（不回落默认用户）', async () => {
    const { useCase, users, memory } = harness()

    await expect(useCase.execute({})).rejects.toBeInstanceOf(ApplicationError)
    await expect(useCase.execute({})).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(useCase.execute({}, {})).rejects.toMatchObject({ code: 'invalid_input' })

    expect(users.getCalls).toHaveLength(0)
    expect(memory.listQueries).toHaveLength(0)
  })

  it('B-01：非法 ExecutionContext.userId → invalid_input', async () => {
    const { useCase } = harness()

    await expect(useCase.execute({}, { userId: 'bad id!' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
    await expect(useCase.execute({}, { userId: '' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
  })

  it('用户隔离：用户 A 只能取到自己的记忆', async () => {
    const { useCase } = harness(
      [],
      [
        storedMemory({ userId: 'user-a', kind: 'goal', key: 'primary_goal', content: 'A 的目标' }),
        storedMemory({ userId: 'user-b', kind: 'goal', key: 'primary_goal', content: 'B 的目标' }),
      ],
    )

    const result = await useCase.execute({}, { userId: 'user-a' })

    expect(result.memory.map((item) => item.content)).toEqual(['A 的目标'])
  })

  it('kind 过滤透传合法子集（混合非法项时忽略非法项）', async () => {
    const { useCase, memory } = harness(
      [],
      [
        storedMemory({ userId: 'user-a', kind: 'goal', key: 'g', content: 'g' }),
        storedMemory({ userId: 'user-a', kind: 'weakness', key: 'w', content: 'w' }),
      ],
    )

    const result = await useCase.execute(
      { memoryKinds: ['weakness', 'nope'] },
      { userId: 'user-a' },
    )

    expect(result.memory.map((item) => item.kind)).toEqual(['weakness'])
    expect(memory.listQueries[0]?.kinds).toEqual(['weakness'])
  })

  it('省略 memoryKinds → 有意不按 kind 过滤（listMemory 收到 undefined）', async () => {
    const { useCase, memory } = harness(
      [],
      [storedMemory({ userId: 'user-a', kind: 'goal', key: 'g', content: 'g' })],
    )

    await useCase.execute({}, { userId: 'user-a' })

    expect(memory.listQueries[0]?.kinds).toBeUndefined()
  })

  it('B-03：非法 / 无法收窄的过滤请求 → invalid_input，绝不 select-all', async () => {
    const { useCase, memory } = harness(
      [],
      [storedMemory({ userId: 'user-a', kind: 'goal', key: 'g', content: 'g' })],
    )

    await expect(
      useCase.execute({ memoryKinds: ['nope'] }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute({ memoryKinds: [] }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute({ memoryKinds: 'goal' }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    // 非法收窄请求从未触达仓储 → 不可能变成全量读取。
    expect(memory.listQueries).toHaveLength(0)
  })

  it('没有任何 profile / memory：返回空上下文，且不降级', async () => {
    const { useCase } = harness()

    const result = await useCase.execute({}, { userId: 'user-a' })

    expect(result.profile).toBeNull()
    expect(result.memory).toEqual([])
    expect(result.degraded).toBe(false)
  })
})

describe('GetUserContextUseCase — 读失败优雅降级（任务文档 Part 10）', () => {
  it('档案读取失败：仍然返回记忆，标记 degraded，请求不失败', async () => {
    const { useCase, users, recorder } = harness(
      [],
      [storedMemory({ userId: 'user-a', kind: 'milestone', key: 'm1', content: 'first milestone' })],
    )
    users.failGet = new Error('profile store unavailable')

    const result = await runWithTrace(recorder, (trace) =>
      useCase.execute({}, { trace, userId: 'user-a' }),
    )

    expect(result.profile).toBeNull()
    expect(result.memory).toHaveLength(1)
    expect(result.degraded).toBe(true)

    const record = traceOf(recorder)
    const span = record.spans.find((item) => item.name === 'user.context')
    expect(span?.status).toBe('degraded')
    expect(record.events.map((event) => event.name)).toContain('user.context.degraded')
    expect(record.events[0]?.metadata).toMatchObject({ 'user.context.source': 'profile' })
  })

  it('记忆读取失败：仍然返回档案，标记 degraded，请求不失败', async () => {
    const { useCase, memory } = harness([profileSeed('user-a', 'advanced', 'en')])
    memory.failList = new Error('memory store unavailable')
    const recorder = new InMemoryTraceRecorder({ clock: { now: () => 0 } })

    const result = await runWithTrace(recorder, (trace) =>
      useCase.execute({}, { trace, userId: 'user-a' }),
    )

    expect(result.profile?.englishLevel).toBe('advanced')
    expect(result.memory).toEqual([])
    expect(result.degraded).toBe(true)

    const record = traceOf(recorder)
    expect(record.events[0]?.metadata).toMatchObject({ 'user.context.source': 'memory' })
  })

  it('两个来源都失败：仍然返回空上下文并标记 degraded（不抛错）', async () => {
    const { useCase, users, memory } = harness()
    users.failGet = new Error('profile down')
    memory.failList = new Error('memory down')

    const result = await useCase.execute({}, { userId: 'user-a' })

    expect(result).toMatchObject({ profile: null, memory: [], degraded: true })
  })
})

describe('GetUserContextUseCase — Trace 只记录元数据（不记录内容）', () => {
  it('记录计数 / 布尔值，且 trace 中不出现 memory 内容或用户标识', async () => {
    const { useCase, recorder } = harness(
      [profileSeed('user-a', 'intermediate', 'zh')],
      [
        storedMemory({ userId: 'user-a', kind: 'goal', key: 'g', content: CONTENT_MARKER }),
        storedMemory({ userId: 'user-a', kind: 'weakness', key: 'w', content: 'weakness text' }),
      ],
    )

    await runWithTrace(recorder, (trace) =>
      useCase.execute({}, { trace, userId: 'user-a' }),
    )

    const record = traceOf(recorder)
    const span = record.spans.find((item) => item.name === 'user.context')
    expect(span?.metadata).toMatchObject({
      'userContext.requested': true,
      'userContext.loaded': true,
      'userContext.degraded': false,
      'userContext.profileFields': 2,
      'memory.selectedCount': 2,
      'memory.kindCount': 2,
      'memory.selectionLimit': 5,
    })

    const serialized = JSON.stringify(record)
    expect(serialized).not.toContain(CONTENT_MARKER)
    expect(serialized).not.toContain('weakness text')
    expect(serialized).not.toContain('intermediate')
    expect(selectedMemoryMetadataKeys(record)).not.toContain('memory.content')
  })
})

function selectedMemoryMetadataKeys(record: TraceRecord): string[] {
  return record.spans.flatMap((span) => Object.keys(span.metadata))
}
