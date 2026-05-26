import { describe, it, expect } from 'vitest'
import { formatErrorMessage } from './error.js'

describe('error utilities', () => {
  describe('formatErrorMessage', () => {
    it('should return message from Error object', () => {
      const error = new Error('test error')
      expect(formatErrorMessage(error)).toBe('test error')
    })

    it('should return string as-is', () => {
      expect(formatErrorMessage('string error')).toBe('string error')
    })

    it('should return JSON string for objects', () => {
      const obj = { code: 'TEST', message: 'test' }
      expect(formatErrorMessage(obj)).toBe(JSON.stringify(obj))
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
  })
})
