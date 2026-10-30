import type { ErrorCode } from '@shared/domain/error.js'

/** Provider 层唯一允许抛出的错误类型；`toAppError` 会保留其中的 `code`。 */
export class ProviderError extends Error {
  readonly code: ErrorCode
  readonly detail: Record<string, unknown> | undefined

  constructor(code: ErrorCode, message?: string, detail?: Record<string, unknown>) {
    super(message ?? code)
    this.name = 'ProviderError'
    this.code = code
    this.detail = detail
  }
}
