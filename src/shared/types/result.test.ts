import { describe, expect, it } from 'vitest'
import { createErrorInfo, err, type ErrorInfo, isErr, isOk, ok, type Result } from './result.js'

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
    expect(isOk(nested.value)).toBe(true)
    expect(nested.value.value).toBe(42)
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
