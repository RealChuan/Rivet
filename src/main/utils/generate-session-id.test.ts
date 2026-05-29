import { describe, expect, it } from 'vitest'
import { generateSessionId } from './generate-session-id.js'

describe('generateSessionId', () => {
  it('should generate session id with protocol prefix', () => {
    const result = generateSessionId('sftp')
    expect(result.startsWith('sftp_')).toBe(true)
  })

  it('should include timestamp in session id', () => {
    const result = generateSessionId('webdav')
    expect(result).toMatch(/^webdav_\d+_/)
    const timestampStr = result.split('_')[1]
    expect(timestampStr).toBeDefined()
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : NaN
    expect(Number.isNaN(timestamp)).toBe(false)
    expect(timestamp).toBeLessThanOrEqual(Date.now())
  })

  it('should include random suffix', () => {
    const result = generateSessionId('sftp')
    const parts = result.split('_')
    expect(parts.length).toBeGreaterThanOrEqual(3)
    const suffix = parts.slice(2).join('_')
    expect(suffix.length).toBeGreaterThan(0)
  })

  it('should generate unique session ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId('sftp'))
    }
    expect(ids.size).toBe(100)
  })

  it('should handle different protocols', () => {
    const ftpResult = generateSessionId('ftp')
    const httpResult = generateSessionId('http')
    expect(ftpResult.startsWith('ftp_')).toBe(true)
    expect(httpResult.startsWith('http_')).toBe(true)
  })
})
