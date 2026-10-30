import type { AppError } from './error.js'

/** 成功结果。`error` 固定为 null，便于直接读取而无需先窄化。 */
export interface Ok<T> {
  success: true
  value: T
  error: null
}

/** 失败结果。`value` 固定为 null，理由同上。 */
export interface Err<E> {
  success: false
  value: null
  error: E
}

/**
 * 统一的结果信封。
 * 判别字段是 `success`（保持与既有调用方一致），默认错误类型为 `AppError`。
 */
export type Result<T, E = AppError> = Ok<T> | Err<E>

export function ok<T>(value: T): Ok<T> {
  return { success: true, value, error: null }
}

export function err<E>(error: E): Err<E> {
  return { success: false, value: null, error }
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success === true
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.success === false
}
