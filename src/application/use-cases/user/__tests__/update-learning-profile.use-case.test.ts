import { describe, it, expect } from 'vitest'
import { ApplicationError } from '@/application/errors'
import type { TraceRecord } from '@/application/ports/trace'
import { runInTrace } from '@/application/observability/trace-helpers'
import { UpdateLearningProfileUseCase } from '@/application/use-cases/user/update-learning-profile.use-case'
import { InMemoryTraceRecorder } from '@/infrastructure/telemetry/in-memory-trace-recorder'
import { FakeUserRepository } from './fakes'

function harness() {
  const users = new FakeUserRepository()
  const useCase = new UpdateLearningProfileUseCase(users)
  let sequence = 0
  const recorder = new InMemoryTraceRecorder({
    clock: { now: () => 0 },
    createId: () => `id-${(sequence += 1)}`,
  })
  return { users, useCase, recorder }
}

const traceOf = (recorder: InMemoryTraceRecorder): TraceRecord => {
  const record = recorder.getLastTrace()
  if (!record) throw new Error('trace not recorded')
  return record
}

describe('UpdateLearningProfileUseCase — canonical user state 写入', () => {
  it('B-01：写入归属来自 ExecutionContext.userId', async () => {
    const { users, useCase } = harness()

    const updated = await useCase.execute(
      { patch: { englishLevel: 'intermediate' } },
      { userId: 'user-a' },
    )

    expect(updated.userId).toBe('user-a')
    expect(users.updateCalls[0]?.userId).toBe('user-a')
  })

  it('B-01：缺失 ExecutionContext.userId → 显式 invalid_input（不回落默认用户）', async () => {
    const { users, useCase } = harness()

    await expect(useCase.execute({ patch: { englishLevel: 'advanced' } })).rejects.toBeInstanceOf(
      ApplicationError,
    )
    await expect(
      useCase.execute({ patch: { englishLevel: 'advanced' } }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute({ patch: { englishLevel: 'advanced' } }, { userId: 'bad id' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    expect(users.updateCalls).toHaveLength(0)
  })

  it('B-01：payload 试图指定另一个用户 → 被忽略，权威归属仍是 context.userId', async () => {
    const { users, useCase } = harness()

    const hostileInput = {
      userId: 'user-b',
      patch: { englishLevel: 'advanced' },
    } as unknown as Parameters<UpdateLearningProfileUseCase['execute']>[0]

    const updated = await useCase.execute(hostileInput, { userId: 'user-a' })

    expect(updated.userId).toBe('user-a')
    expect(users.updateCalls[0]?.userId).toBe('user-a')
    expect(users.profiles.has('user-b')).toBe(false)
  })

  it('只写入显式提供的字段（未提供的字段保持原值）', async () => {
    const { users, useCase } = harness()
    await useCase.execute({ patch: { englishLevel: 'intermediate' } }, { userId: 'user-a' })

    const updated = await useCase.execute(
      { patch: { explanationLanguage: 'bilingual' } },
      { userId: 'user-a' },
    )

    expect(updated).toMatchObject({
      userId: 'user-a',
      englishLevel: 'intermediate',
      explanationLanguage: 'bilingual',
    })
    expect(users.updateCalls[1]?.patch).toEqual({ explanationLanguage: 'bilingual' })
  })

  it('空字符串 / null 显式清空字段', async () => {
    const { useCase } = harness()
    await useCase.execute({ patch: { englishLevel: 'advanced' } }, { userId: 'user-a' })

    const cleared = await useCase.execute({ patch: { englishLevel: null } }, { userId: 'user-a' })

    expect(cleared.englishLevel).toBeNull()
  })

  it('非法输入 → invalid_input（Domain 校验失败不落库）', async () => {
    const { users, useCase } = harness()

    await expect(
      useCase.execute({ patch: { englishLevel: 'godlike' } }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(
      useCase.execute({ patch: { preferredTopics: 'tech' } }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    await expect(useCase.execute({ patch: {} }, { userId: 'user-a' })).rejects.toMatchObject({
      code: 'invalid_input',
    })

    expect(users.updateCalls).toHaveLength(0)
  })

  it('仓储失败 → persistence_failed（显式写入失败必须报错，不静默丢弃）', async () => {
    const { users, useCase } = harness()
    users.failUpdate = new Error('db down')

    await expect(
      useCase.execute({ patch: { englishLevel: 'advanced' } }, { userId: 'user-a' }),
    ).rejects.toMatchObject({ code: 'persistence_failed', message: 'db down' })
    await expect(
      useCase.execute({ patch: { englishLevel: 'advanced' } }, { userId: 'user-a' }),
    ).rejects.toBeInstanceOf(ApplicationError)
  })

  it('Trace 只记录字段数量，不记录字段值', async () => {
    const { useCase, recorder } = harness()

    await runInTrace(
      recorder,
      'test.root',
      { category: 'use_case' },
      (trace) =>
        useCase.execute(
          { patch: { englishLevel: 'upper_intermediate' } },
          { trace, userId: 'user-a' },
        ),
    )

    const record = traceOf(recorder)
    const span = record.spans.find((item) => item.name === 'user.profile.update')
    expect(span?.metadata).toMatchObject({
      'user.profile.updatedFields': 1,
      'user.profile.fields': 1,
    })
    expect(JSON.stringify(record)).not.toContain('upper_intermediate')
  })
})
