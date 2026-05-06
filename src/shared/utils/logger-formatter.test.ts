import { afterEach, describe, expect, it, vi } from 'vitest'
import { CALLER_DEPTH, catchLog, formatMessage, getCallerInfo } from './logger-formatter.js'

describe('logger-formatter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getCallerInfo', () => {
    /**
     * Mock the global `Error` so `new Error().stack` returns a controlled
     * string. The `targetLine` is placed at index `skipFrames` so that
     * `getCallerInfo(skipFrames)` reads it as the caller frame.
     */
    function mockErrorStack(targetLine: string, skipFrames: number): void {
      const stack: string[] = ['Error']
      for (let i = 1; i < skipFrames; i++) {
        stack.push(`    at filler${i} (filler.js:1:1)`)
      }
      stack.push(targetLine)
      const MockError = class extends Error {
        constructor() {
          super()
          this.stack = stack.join('\n')
        }
      }
      vi.stubGlobal('Error', MockError)
    }

    it('should parse function name and file location from stack line with parentheses', () => {
      mockErrorStack('    at myFunc (/path/to/file.js:10:5)', 1)
      expect(getCallerInfo(1)).toBe('[file.js:10 myFunc]')
    })

    it('should return anonymous for stack line without function name (no parentheses)', () => {
      // Second-regex form: "at /path/file.js:10:5" — there is no function-name
      // capture group. Before the fix, funcName was incorrectly set to the
      // file path ("/path/to/file.js") instead of "anonymous".
      mockErrorStack('    at /path/to/file.js:10:5', 1)
      expect(getCallerInfo(1)).toBe('[file.js:10 anonymous]')
    })

    it('should handle Windows-style paths in stack line with function name', () => {
      mockErrorStack('    at myFunc (C:\\demo\\Rivet\\src\\file.ts:42:7)', 1)
      expect(getCallerInfo(1)).toBe('[file.ts:42 myFunc]')
    })

    it('should handle Windows-style paths in stack line without function name', () => {
      mockErrorStack('    at C:\\demo\\Rivet\\src\\file.ts:42:7', 1)
      expect(getCallerInfo(1)).toBe('[file.ts:42 anonymous]')
    })

    it('should return [unknown] when stack is shorter than skipFrames', () => {
      const MockError = class extends Error {
        constructor() {
          super()
          this.stack = 'Error\n    at only (one.js:1:1)'
        }
      }
      vi.stubGlobal('Error', MockError)
      expect(getCallerInfo(5)).toBe('[unknown]')
    })

    it('should return [unknown] when stack line does not match either regex', () => {
      mockErrorStack('    not a stack line', 1)
      expect(getCallerInfo(1)).toBe('[unknown]')
    })

    it('should return [unknown] when stack is undefined', () => {
      const MockError = class extends Error {
        constructor() {
          super()
          delete this.stack
        }
      }
      vi.stubGlobal('Error', MockError)
      expect(getCallerInfo(1)).toBe('[unknown]')
    })
  })

  describe('formatMessage', () => {
    it('should prepend caller info in dev mode', () => {
      expect(formatMessage('hello', true, '[file.js:1 fn]')).toBe('[file.js:1 fn] hello')
    })

    it('should return only message in production mode', () => {
      expect(formatMessage('hello', false, '[file.js:1 fn]')).toBe('hello')
    })
  })

  describe('catchLog', () => {
    it('should log error message with context and stack', () => {
      const logged: string[] = []
      catchLog((msg) => logged.push(msg), new Error('boom'), { code: 'X' })
      expect(logged[0]).toContain('boom')
      expect(logged[0]).toContain('"code":"X"')
      expect(logged[0]).toContain('Stack:')
    })

    it('should wrap non-Error input into an Error', () => {
      const logged: string[] = []
      catchLog((msg) => logged.push(msg), 'string failure')
      expect(logged[0]).toContain('string failure')
    })

    it('should log without context when context is omitted', () => {
      const logged: string[] = []
      catchLog((msg) => logged.push(msg), new Error('no ctx'))
      expect(logged[0]).toContain('no ctx')
      expect(logged[0]).not.toContain('Context:')
    })
  })

  describe('CALLER_DEPTH integration', () => {
    /**
     * Simulates the exact call structure of createLogFn in both main and
     * renderer logger modules: a closure calls getCallerInfo synchronously.
     * The caller of the closure should be reported.
     */
    function createTestLogFn(depth: number) {
      return function logFn() {
        return getCallerInfo(depth)
      }
    }

    it('DIRECT_RENDERER points to the function that calls logger', () => {
      const logFn = createTestLogFn(CALLER_DEPTH.DIRECT_RENDERER)
      function callerForRenderer() {
        return logFn()
      }
      const callerInfo = callerForRenderer()
      expect(callerInfo).toContain('logger-formatter.test.ts')
      expect(callerInfo).toContain('callerForRenderer')
    })

    it('DIRECT_MAIN points to the function that calls logger', () => {
      const logFn = createTestLogFn(CALLER_DEPTH.DIRECT_MAIN)
      function callerForMain() {
        return logFn()
      }
      const callerInfo = callerForMain()
      expect(callerInfo).toContain('logger-formatter.test.ts')
      expect(callerInfo).toContain('callerForMain')
    })
  })
})
