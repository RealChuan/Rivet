import { describe, expect, it } from 'vitest'
import { formatErrorMessage } from './error.js'

describe('error utilities', () => {
  describe('formatErrorMessage', () => {
    it('should return message from Error object', () => {
      const error = new Error('test error')
      expect(formatErrorMessage(error)).toBe('test error')
    })

    it('should return message from Error subclass', () => {
      const error = new TypeError('type error')
      expect(formatErrorMessage(error)).toBe('type error')
    })

    it('should return message from RangeError', () => {
      const error = new RangeError('range error')
      expect(formatErrorMessage(error)).toBe('range error')
    })

    it('should return empty string from Error with empty message', () => {
      const error = new Error('')
      expect(formatErrorMessage(error)).toBe('')
    })

    it('should return string as-is', () => {
      expect(formatErrorMessage('string error')).toBe('string error')
    })

    it('should return empty string for empty string input', () => {
      expect(formatErrorMessage('')).toBe('')
    })

    it('should return JSON string for objects', () => {
      const obj = { code: 'TEST', message: 'test' }
      expect(formatErrorMessage(obj)).toBe(JSON.stringify(obj))
    })

    it('should return JSON string for arrays', () => {
      expect(formatErrorMessage([1, 2, 3])).toBe('[1,2,3]')
    })

    it('should handle null', () => {
      expect(formatErrorMessage(null)).toBe('null')
    })

    it('should handle undefined', () => {
      expect(formatErrorMessage(undefined)).toBe('undefined')
    })

    it('should handle numbers', () => {
      expect(formatErrorMessage(42)).toBe('42')
    })

    it('should handle zero', () => {
      expect(formatErrorMessage(0)).toBe('0')
    })

    it('should handle false', () => {
      expect(formatErrorMessage(false)).toBe('false')
    })

    it('should handle circular references via catch branch', () => {
      const obj: Record<string, unknown> = { name: 'circular' }
      obj.self = obj
      // JSON.stringify throws on circular refs, falls back to String()
      expect(formatErrorMessage(obj)).toBe('[object Object]')
    })

    it('should handle BigInt via catch branch', () => {
      // JSON.stringify throws on BigInt, falls back to String()
      expect(formatErrorMessage(BigInt(42))).toBe('42')
    })

    it('should handle Symbol via undefined result branch', () => {
      // JSON.stringify(Symbol()) returns undefined, falls back to String()
      expect(formatErrorMessage(Symbol('test'))).toBe('Symbol(test)')
    })

    it('should handle Function via undefined result branch', () => {
      // JSON.stringify(function) returns undefined, falls back to String()
      const fn = () => {}
      expect(formatErrorMessage(fn)).toBe(String(fn))
    })

    it('should handle object with toJSON method', () => {
      const obj = {
        toJSON: () => ({ serialized: true }),
      }
      expect(formatErrorMessage(obj)).toBe('{"serialized":true}')
    })
  })
})
