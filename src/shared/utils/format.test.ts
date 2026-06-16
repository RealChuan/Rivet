import { describe, expect, it } from 'vitest'
import { formatDate, formatFileSize } from './format.js'

describe('format utilities', () => {
  describe('formatFileSize', () => {
    it('should return - for negative numbers', () => {
      expect(formatFileSize(-1)).toBe('-')
    })

    it("should return '0 B' for zero", () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('should return 0 B for negative zero', () => {
      expect(formatFileSize(-0)).toBe('0 B')
    })

    it('should return - for NaN', () => {
      expect(formatFileSize(NaN)).toBe('-')
    })

    it('should return - for Infinity', () => {
      expect(formatFileSize(Infinity)).toBe('-')
    })

    it('should return - for -Infinity', () => {
      expect(formatFileSize(-Infinity)).toBe('-')
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

    it('should format TB', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB')
    })

    it('should format PB', () => {
      expect(formatFileSize(1125899906842624)).toBe('1 PB')
    })

    it('should format EB', () => {
      expect(formatFileSize(1152921504606847000)).toBe('1 EB')
    })

    it('should format fractional KB with decimals', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('should format fractional MB with decimals', () => {
      expect(formatFileSize(1572864)).toBe('1.5 MB')
    })

    it('should round to 2 decimal places', () => {
      // 1234 bytes = 1.205078125 KB, rounded to 1.21 KB
      expect(formatFileSize(1234)).toBe('1.21 KB')
    })

    it('should format values near unit boundary', () => {
      // 1023 bytes stays as bytes
      expect(formatFileSize(1023)).toBe('1,023 B')
    })

    it('should format very large values beyond EB range', () => {
      // Beyond EB, clamped to EB unit
      const result = formatFileSize(1e20)
      expect(result).toContain('EB')
    })
  })

  describe('formatFileSize with locale', () => {
    it('formats fractional KB with de-DE locale using comma as decimal separator', () => {
      // 1536 bytes = 1.5 KB, de-DE uses comma for decimals
      const result = formatFileSize(1536, 'de-DE')
      expect(result).toBe('1,5 KB')
    })

    it('formats large byte count with en-US locale using comma separator', () => {
      // 1023 bytes = "1,023 B" in en-US
      expect(formatFileSize(1023, 'en-US')).toBe('1,023 B')
    })
  })

  describe('formatDate', () => {
    it('should return - for 0', () => {
      expect(formatDate(0)).toBe('-')
    })

    it('should return - for undefined', () => {
      expect(formatDate(undefined as unknown as number)).toBe('-')
    })

    it('should return - for NaN', () => {
      expect(formatDate(NaN)).toBe('-')
    })

    it('should format a known timestamp with en-US locale', () => {
      const timestamp = new Date('2024-01-15T10:30:00').getTime()
      const result = formatDate(timestamp, 'en-US')
      // Should contain year, month, day and time components
      expect(result).toContain('2024')
      expect(result).toContain('Jan')
      expect(result).toContain('15')
      expect(result).toContain('10:30')
    })

    it('should format a known timestamp with zh-CN locale', () => {
      const timestamp = new Date('2024-06-15T14:00:00').getTime()
      const result = formatDate(timestamp, 'zh-CN')
      expect(result).toContain('2024')
      expect(result).toContain('6')
      expect(result).toContain('15')
      expect(result).toContain('14:00')
    })

    it('should format negative timestamp (pre-epoch date)', () => {
      // Negative timestamps represent dates before 1970
      const result = formatDate(-86400000, 'en-US')
      // Should produce a valid date string, not '-'
      expect(result).not.toBe('-')
      expect(result).toBeTruthy()
    })
  })
})
