import type { AppError, ErrorCode } from '@shared/domain/error.js'

/**
 * IPC 返回信封的结构类型。
 * 同时兼容 `Result<T>` 与旧的 `ProtocolResponse<T>`：两者都有 `success` 判别字段。
 * `value` 可选是因为部分契约的结果本身是 `z.void()` / `.optional()`。
 */
export type Envelope<T> = { success: true; value?: T } | { success: false; error: AppError }

export class ApiError extends Error {
  readonly appError: AppError

  constructor(appError: AppError) {
    super(appError.message || appError.code)
    this.name = 'ApiError'
    this.appError = appError
  }

  get code(): ErrorCode {
    return this.appError.code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** 把失败信封转成可抛出的 `ApiError`；成功时返回裸值。 */
export function unwrap<T>(envelope: Envelope<T>): T {
  if (!envelope.success) {
    throw new ApiError(envelope.error)
  }
  // 契约保证成功分支的 value 与调用方声明的 T 一致；可选 value 由调用方按 T 收窄。
  return envelope.value as T
}
