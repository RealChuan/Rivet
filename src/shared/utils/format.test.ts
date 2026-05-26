import { describe, it, expect } from 'vitest'
import { formatFileSize, formatDate } from './format.js'

describe('format utilities', () => {
  describe('formatFileSize', () => {
    it('should return - for negative numbers', () => {
      expect(formatFileSize(-1)).toBe('-')
    })

    it('should return - for zero', () => {
      expect(formatFileSize(0)).toBe('-')
    })

    it('should return - for NaN', () => {
      expect(formatFileSize(NaN)).toBe('-')
    })

    it('should return - for Infinity', () => {
      expect(formatFileSize(Infinity)).toBe('-')
    })

    it('should format bytes', () => {
      expect(formatFileSize(512)).toBe('512 B')
    })

    it('should format KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
    })

    it('should format MB', () => {
      expect(formatFileSize(1048576)).toBe('1 MB')
    })

    it('should format GB', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })
  })

  describe('formatFileSize with locale', () => {
    it('formats bytes with en-US locale', () => {
      expect(formatFileSize(1024, 'en-US')).toBe('1 KB')
    })

    it('formats bytes with zh-CN locale', () => {
      expect(formatFileSize(1024, 'zh-CN')).toBe('1 KB')
    })

    it('returns - for invalid input', () => {
      expect(formatFileSize(NaN)).toBe('-')
      expect(formatFileSize(0)).toBe('-')
    })
  })

  describe('formatDate', () => {
    it('should return - for 0', () => {
      expect(formatDate(0)).toBe('-')
    })

    it('should return - for undefined', () => {
      expect(formatDate(undefined as unknown as number)).toBe('-')
    })

    it('should format timestamp', () => {
      const timestamp = new Date('2024-01-15T10:30:00').getTime()
      const result = formatDate(timestamp)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })

  describe('formatDate with locale', () => {
    it('formats timestamp with locale', () => {
      const ts = new Date('2025-01-15T10:30:00Z').getTime()
      const result = formatDate(ts, 'en-US')
      expect(result).toBeTruthy()
      expect(result).not.toBe('-')
    })

    it('returns - for zero timestamp', () => {
      expect(formatDate(0)).toBe('-')
    })
  })
})
