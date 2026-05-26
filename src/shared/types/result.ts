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
 * 获取成功结果的值，如果是错误结果则抛出异常
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value
  }
  throw result.error instanceof Error ? result.error : new Error(String(result.error))
}

/**
 * 获取成功结果的值，如果是错误结果则返回默认值
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue
}

/**
 * 获取成功结果的值，如果是错误结果则调用函数获取默认值
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  return isOk(result) ? result.value : fn(result.error)
}

/**
 * 对成功结果应用映射函数
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value))
  }
  return result
}

/**
 * 对错误结果应用映射函数
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error))
  }
  return result
}

/**
 * 链式调用，对成功结果应用返回 Result 的函数
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value)
  }
  return result
}

/**
 * 异步版本的 andThen
 */
export async function andThenAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (isOk(result)) {
    return fn(result.value)
  }
  return result
}

/**
 * 执行可能抛出异常的函数，返回 Result
 */
export function tryCatch<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return ok(fn())
  } catch (error) {
    return err(error as E)
  }
}

/**
 * 异步版本的 tryCatch
 */
export async function tryCatchAsync<T, E = Error>(fn: () => Promise<T>): Promise<Result<T, E>> {
  try {
    const value = await fn()
    return ok(value)
  } catch (error) {
    return err(error as E)
  }
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
