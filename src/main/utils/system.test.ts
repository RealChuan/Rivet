import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('system utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('getTempDir', () => {
    it('should return temp directory path', async () => {
      vi.doMock('electron', () => ({
        app: {
          getPath: vi.fn().mockReturnValue('/tmp/test'),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { getTempDir } = await import('./system.js')
      const result = getTempDir()

      expect(result.success).toBe(true)
      expect(result.value).toBe('/tmp/test')
    })

    it('should return error when getPath throws', async () => {
      vi.doMock('electron', () => ({
        app: {
          getPath: vi.fn().mockImplementation(() => {
            throw new Error('Failed to get path')
          }),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { getTempDir } = await import('./system.js')
      const result = getTempDir()

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('PATH_ERROR')
    })
  })

  describe('getDownloadDir', () => {
    it('should return download directory path', async () => {
      vi.doMock('electron', () => ({
        app: {
          getPath: vi.fn().mockReturnValue('/home/user/downloads'),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { getDownloadDir } = await import('./system.js')
      const result = getDownloadDir()

      expect(result.success).toBe(true)
      expect(result.value).toBe('/home/user/downloads')
    })

    it('should return error when getPath throws', async () => {
      vi.doMock('electron', () => ({
        app: {
          getPath: vi.fn().mockImplementation(() => {
            throw new Error('Failed to get path')
          }),
        },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))

      const { getDownloadDir } = await import('./system.js')
      const result = getDownloadDir()

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('PATH_ERROR')
    })
  })
})
