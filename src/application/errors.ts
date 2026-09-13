// @version 1.0
// @last-reviewed 2026-09-13
// @layer Application — 应用级错误模型

/**
 * ApplicationError — 应用层向外（交付层）暴露的统一错误。
 *
 * 设计原则（见 docs/refactor/CONTENT_PIPELINE_DESIGN.md §error-propagation）：
 *  - 保持精简，只为**当前管线真实出现**的失败类别建码，不建大而全的异常体系
 *  - provider/AI 错误继续使用 Phase 3 的归一化 `AIError`（不在此重复定义）
 *  - `message` 保留底层原始文案（与迁移前的操作员可见日志一致），分类信息放在 `code`
 *  - `cause` 携带原始错误，供交付层/后续 Phase 的 Trace 使用
 */

export type ApplicationErrorCode =
  /** 输入配置非法（例如 feeds 为空、条数上限 < 1）。 */
  | 'invalid_input'
  /** 内容源（RSS / HTTP）不可用，整轮运行无法继续。 */
  | 'feed_unavailable'
  /** 运行级持久化失败（例如裁剪）。 */
  | 'persistence_failed'
  /** 未归类的意外失败。 */
  | 'unexpected'

export interface ApplicationErrorOptions {
  cause?: unknown
}

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode
  readonly cause?: unknown

  constructor(code: ApplicationErrorCode, message: string, options: ApplicationErrorOptions = {}) {
    super(message)
    this.name = 'ApplicationError'
    this.code = code
    this.cause = options.cause
  }
}
