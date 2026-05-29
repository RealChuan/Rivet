import { describe, expect, it, vi } from 'vitest'
import {
  andThen,
  andThenAsync,
  createErrorInfo,
  err,
  type ErrorInfo,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  type Result,
  tryCatch,
  tryCatchAsync,
  unwrap,
  unwrapOr,
  unwrapOrElse,
} from './result.js'

describe('Result Type', () => {
  describe('ok()', () => {
    it('should create a success result with the given value', () => {
      const result = ok(42)
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
      expect(result.error).toBeNull()
    })

    it('should handle null and undefined values', () => {
      const nullResult = ok(null)
      expect(nullResult.value).toBeNull()
      expect(nullResult.success).toBe(true)

      const undefinedResult = ok(undefined)
      expect(undefinedResult.value).toBeUndefined()
      expect(undefinedResult.success).toBe(true)
    })

    it('should handle objects and arrays', () => {
      const objResult = ok({ name: 'test', value: 123 })
      expect(objResult.value).toEqual({ name: 'test', value: 123 })

      const arrResult = ok([1, 2, 3])
      expect(arrResult.value).toEqual([1, 2, 3])
    })
  })

  describe('err()', () => {
    it('should create an error result with the given error', () => {
      const error = new Error('test error')
      const result = err(error)
      expect(result.success).toBe(false)
      expect(result.value).toBeNull()
      expect(result.error).toBe(error)
    })

    it('should handle string errors', () => {
      const result = err('string error')
      expect(result.error).toBe('string error')
    })

    it('should handle ErrorInfo objects', () => {
      const errorInfo: ErrorInfo = { code: 'TEST_ERROR', message: 'test message' }
      const result = err(errorInfo)
      expect(result.error).toEqual(errorInfo)
    })
  })

  describe('isOk()', () => {
    it('should return true for success results', () => {
      const result = ok(42)
      expect(isOk(result)).toBe(true)
    })

    it('should return false for error results', () => {
      const result = err(new Error('fail'))
      expect(isOk(result)).toBe(false)
    })

    it('should act as a type guard for Ok<T>', () => {
      const result: Result<number, Error> = ok(42)
      if (isOk(result)) {
        expect(result.value).toBeTypeOf('number')
      }
    })
  })

  describe('isErr()', () => {
    it('should return true for error results', () => {
      const result = err(new Error('fail'))
      expect(isErr(result)).toBe(true)
    })

    it('should return false for success results', () => {
      const result = ok(42)
      expect(isErr(result)).toBe(false)
    })

    it('should act as a type guard for Err<E>', () => {
      const result: Result<number, Error> = err(new Error('fail'))
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error)
      }
    })
  })

  describe('unwrap()', () => {
    it('should return the value for success results', () => {
      const result = ok(42)
      expect(unwrap(result)).toBe(42)
    })

    it('should throw the error for error results', () => {
      const error = new Error('test error')
      const result = err(error)
      expect(() => unwrap(result)).toThrow(error)
    })

    it('should wrap non-Error errors in an Error', () => {
      const result = err('string error')
      expect(() => unwrap(result)).toThrow('string error')
    })
  })

  describe('unwrapOr()', () => {
    it('should return the value for success results', () => {
      const result = ok(42)
      expect(unwrapOr(result, 0)).toBe(42)
    })

    it('should return the default value for error results', () => {
      const result = err(new Error('fail'))
      expect(unwrapOr(result, 0)).toBe(0)
    })

    it('should handle null defaults', () => {
      const result = err(new Error('fail'))
      expect(unwrapOr(result, null)).toBeNull()
    })
  })

  describe('unwrapOrElse()', () => {
    it('should return the value for success results', () => {
      const result = ok(42)
      expect(unwrapOrElse(result, () => 0)).toBe(42)
    })

    it('should call the function for error results', () => {
      const result = err('error code')
      const defaultValueFn = vi.fn(() => 0)
      expect(unwrapOrElse(result, defaultValueFn)).toBe(0)
      expect(defaultValueFn).toHaveBeenCalledWith('error code')
    })

    it('should pass the error to the function', () => {
      const errorInfo: ErrorInfo = { code: 'TEST', message: 'test' }
      const result = err(errorInfo)
      const fn = vi.fn((e: ErrorInfo) => e.code)
      expect(unwrapOrElse(result, fn)).toBe('TEST')
      expect(fn).toHaveBeenCalledWith(errorInfo)
    })
  })

  describe('map()', () => {
    it('should transform the value for success results', () => {
      const result = ok(2)
      const mapped = map(result, x => x * 2)
      expect(isOk(mapped)).toBe(true)
      expect(unwrap(mapped)).toBe(4)
    })

    it('should pass through error results', () => {
      const error = new Error('fail')
      const result = err(error)
      const mapped = map(result, (x: number) => x * 2)
      expect(isErr(mapped)).toBe(true)
      expect(mapped.error).toBe(error)
    })

    it('should handle type transformations', () => {
      const result = ok(42)
      const mapped = map(result, (x: number) => x.toString())
      expect(unwrap(mapped)).toBe('42')
    })
  })

  describe('mapErr()', () => {
    it('should transform the error for error results', () => {
      const result = err('original error')
      const mapped = mapErr(result, (e: string) => `transformed: ${e}`)
      expect(isErr(mapped)).toBe(true)
      expect(mapped.error).toBe('transformed: original error')
    })

    it('should pass through success results', () => {
      const result = ok(42)
      const mapped = mapErr(result, (e: unknown) => `transformed: ${String(e)}`)
      expect(isOk(mapped)).toBe(true)
      expect(mapped.value).toBe(42)
    })
  })

  describe('andThen()', () => {
    it('should chain operations for success results', () => {
      const result = ok(2)
      const chained = andThen(result, (x: number) => ok(x * 3))
      expect(isOk(chained)).toBe(true)
      expect(unwrap(chained)).toBe(6)
    })

    it('should allow chaining to return errors', () => {
      const result = ok(2)
      const chained = andThen(result, () => err('error'))
      expect(isErr(chained)).toBe(true)
    })

    it('should pass through error results', () => {
      const error = new Error('fail')
      const result = err(error)
      const chained = andThen(result, (x: number) => ok(x * 3))
      expect(isErr(chained)).toBe(true)
      expect(chained.error).toBe(error)
    })
  })

  describe('andThenAsync()', () => {
    it('should chain async operations for success results', async () => {
      const result = ok(2)
      const chained = await andThenAsync(result, (x: number) => Promise.resolve(ok(x * 3)))
      expect(isOk(chained)).toBe(true)
      expect(unwrap(chained)).toBe(6)
    })

    it('should handle async error returns', async () => {
      const result = ok(2)
      const chained = await andThenAsync(result, () => Promise.resolve(err('async error')))
      expect(isErr(chained)).toBe(true)
      expect(chained.error).toBe('async error')
    })

    it('should pass through error results', async () => {
      const error = new Error('fail')
      const result = err(error)
      const chained = await andThenAsync(result, (x: number) => Promise.resolve(ok(x * 3)))
      expect(isErr(chained)).toBe(true)
      expect(chained.error).toBe(error)
    })
  })

  describe('tryCatch()', () => {
    it('should return success for non-throwing functions', () => {
      const result = tryCatch<{ test: boolean }>(
        () => JSON.parse('{"test": true}') as { test: boolean }
      )
      expect(isOk(result)).toBe(true)
      expect(unwrap(result)).toEqual({ test: true })
    })

    it('should return error for throwing functions', () => {
      const result = tryCatch<unknown>(() => JSON.parse('invalid'))
      expect(isErr(result)).toBe(true)
    })

    it('should return success for functions returning null/undefined', () => {
      const nullResult = tryCatch(() => null)
      expect(isOk(nullResult)).toBe(true)
      expect(nullResult.value).toBeNull()

      const undefinedResult = tryCatch(() => undefined)
      expect(isOk(undefinedResult)).toBe(true)
      expect(undefinedResult.value).toBeUndefined()
    })
  })

  describe('tryCatchAsync()', () => {
    it('should return success for non-throwing async functions', async () => {
      const result = await tryCatchAsync(() => Promise.resolve({ data: 'test' }))
      expect(isOk(result)).toBe(true)
      expect(unwrap(result)).toEqual({ data: 'test' })
    })

    it('should return error for throwing async functions', async () => {
      const result = await tryCatchAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw new Error('async error')
      })
      expect(isErr(result)).toBe(true)
    })

    it('should handle rejected promises', async () => {
      const result = await tryCatchAsync(() => Promise.reject(new Error('rejected')))
      expect(isErr(result)).toBe(true)
    })
  })

  describe('createErrorInfo()', () => {
    it('should create an ErrorInfo object with required fields', () => {
      const errorInfo = createErrorInfo('TEST_CODE', 'test message')
      expect(errorInfo.code).toBe('TEST_CODE')
      expect(errorInfo.message).toBe('test message')
      expect(errorInfo.detail).toBeUndefined()
      expect(errorInfo.stack).toBeUndefined()
    })

    it('should include optional detail field', () => {
      const errorInfo = createErrorInfo('TEST_CODE', 'test message', 'detailed info')
      expect(errorInfo.detail).toBe('detailed info')
    })

    it('should create ErrorInfo that works with err()', () => {
      const errorInfo = createErrorInfo('FS_NOT_FOUND', 'File not found', '/path/to/file')
      const result = err(errorInfo)
      expect(isErr(result)).toBe(true)
      expect(result.error.code).toBe('FS_NOT_FOUND')
      expect(result.error.message).toBe('File not found')
    })
  })

  describe('ErrorInfo interface', () => {
    it('should have correct structure', () => {
      const errorInfo: ErrorInfo = {
        code: 'CONN_TIMEOUT',
        message: 'Connection timed out',
        detail: 'Timeout after 30s',
        stack: 'Error: timeout\n    at connect()',
      }
      expect(errorInfo.code).toBeTypeOf('string')
      expect(errorInfo.message).toBeTypeOf('string')
      expect(errorInfo.detail).toBeTypeOf('string')
      expect(errorInfo.stack).toBeTypeOf('string')
    })
  })

  // Note: Type inference tests are handled by TypeScript's type checker.
  // Runtime behavior tests are covered above.

  it('should work with union error types', () => {
    type MyResult = Result<string, Error | string>
    const success: MyResult = ok('success')
    const error1: MyResult = err(new Error('fail'))
    const error2: MyResult = err('string error')
    expect(isOk(success)).toBe(true)
    expect(isErr(error1)).toBe(true)
    expect(isErr(error2)).toBe(true)
  })

  it('should handle nested Result types', () => {
    const nested: Result<Result<number, Error>, Error> = ok(ok(42))
    expect(isOk(nested)).toBe(true)
    expect(isOk(unwrap(nested))).toBe(true)
    expect(unwrap(unwrap(nested))).toBe(42)
  })

  it('should compose map and andThen', () => {
    const result = ok(5)
    const composed = andThen(
      map(result, x => x * 2),
      x => ok(x + 1)
    )
    expect(isOk(composed)).toBe(true)
    expect(unwrap(composed)).toBe(11)
  })

  it('should handle deeply nested error propagation', () => {
    const error = new Error('deep error')
    const nested: Result<Result<number, Error>, Error> = ok(err(error))
    expect(isOk(nested)).toBe(true)
    expect(isErr(unwrap(nested))).toBe(true)
    expect(unwrap(nested).error).toBe(error)
  })

  it('should handle undefined in ok()', () => {
    const result = ok<undefined>(undefined)
    expect(isOk(result)).toBe(true)
    expect(result.value).toBeUndefined()
  })

  it('should handle ErrorInfo with all fields', () => {
    const errorInfo = createErrorInfo('CODE', 'message', 'detail', 'stack')
    expect(errorInfo.code).toBe('CODE')
    expect(errorInfo.message).toBe('message')
    expect(errorInfo.detail).toBe('detail')
    expect(errorInfo.stack).toBe('stack')
  })
})
