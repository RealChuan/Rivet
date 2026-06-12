/**
 * Result 类型模板
 * 用于统一封装函数的返回结果，替代传统的 try-catch 模式
 *
 * 使用示例：
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return err('Cannot divide by zero')
 *   }
 *   return ok(a / b)
 * }
 *
 * const result = divide(10, 2)
 * if (isOk(result)) {
 *   logger.log('Result:', result.value)
 * } else {
 *   logger.error('Error:', result.error)
 * }
 * ```
 */

/**
 * 成功结果类型
 */
export interface Ok<T> {
  success: true
  value: T
  error: null
}

/**
 * 错误结果类型
 */
export interface Err<E> {
  success: false
  value: null
  error: E
}

/**
 * Result 联合类型
 * T: 成功时返回的值类型
 * E: 失败时返回的错误类型
 */
export type Result<T, E = Error> = Ok<T> | Err<E>

/**
 * 创建成功结果
 */
export function ok<T>(value: T): Ok<T> {
  return { success: true, value, error: null }
}

/**
 * 创建错误结果
 */
export function err<E>(error: E): Err<E> {
  return { success: false, value: null, error }
}

/**
 * 判断是否为成功结果
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success === true
}

/**
 * 判断是否为错误结果
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.success === false
}

/**
 * 错误信息类型
 * 用于提供结构化的错误信息
 */
export interface ErrorInfo {
  code: string
  message: string
  detail?: string
  stack?: string
}

/**
 * 创建结构化错误信息
 */
export function createErrorInfo(
  code: string,
  message: string,
  detail?: string,
  stack?: string
): ErrorInfo {
  return {
    code,
    message,
    ...(detail !== undefined ? { detail } : {}),
    ...(stack !== undefined ? { stack } : {}),
  }
}
