import { describe, it, expect } from 'vitest'
import { GetUserContextUseCase } from '@/application/use-cases/user/get-user-context.use-case'
import { RememberUserFactUseCase } from '@/application/use-cases/user/remember-user-fact.use-case'
import { UpdateLearningProfileUseCase } from '@/application/use-cases/user/update-learning-profile.use-case'
import { buildAssistantLearnerContext } from '@/application/prompts/assistant/personal-context.prompt'
import { FakeMemoryRepository, FakeUserRepository } from './fakes'

/**
 * B-02 端到端：canonical User State 与 Memory 的语义所有权不能重叠。
 *
 * 组合两条**获批写入路径**证明：`explanationLanguage` 的唯一权威是 `UserProfile`，
 * Memory 写入无法制造"profile 说 en、memory 说 zh"的矛盾上下文。
 */
describe('B-02 — canonical User State vs Memory 所有权', () => {
  it('explanationLanguage 只由 UserProfile 拥有；Memory 无法写入冲突值', async () => {
    const users = new FakeUserRepository()
    const memory = new FakeMemoryRepository()
    const updateProfile = new UpdateLearningProfileUseCase(users)
    const remember = new RememberUserFactUseCase(memory)
    const getUserContext = new GetUserContextUseCase({ users, memory })

    // 获批路径 1：canonical profile 更新
    await updateProfile.execute(
      { patch: { explanationLanguage: 'en' } },
      { userId: 'user-a' },
    )

    // 获批路径 2：Memory 写入使用 reserved canonical 语义键 → 拒绝
    await expect(
      remember.execute(
        {
          kind: 'preference',
          key: 'explanation_language',
          content: 'prefers Chinese explanations',
          source: 'explicit_user',
        },
        { userId: 'user-a' },
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })

    const context = await getUserContext.execute({}, { userId: 'user-a' })
    expect(context.profile?.explanationLanguage).toBe('en')
    expect(context.memory).toHaveLength(0)

    const block = buildAssistantLearnerContext({
      profile: context.profile,
      memory: context.memory.map((item) => ({ kind: item.kind, content: item.content })),
    })
    expect(block?.text).toContain('- profile.explanation_language: en')
    expect(block?.text).not.toMatch(/- memory\.[^:]*explanation/i)
  })
})
