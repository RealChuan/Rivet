import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('system utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('supportsGlassEffect', () => {
    it('should return true for macOS 26+', async () => {
      vi.doMock('electron', () => ({
        app: { getPath: vi.fn() },
      }))
      vi.doMock('node:os', () => ({
        default: { release: vi.fn() },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      Object.defineProperty(process, 'getSystemVersion', {
        value: () => '26.0.0',
        configurable: true,
      })

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(true)
    })

    it('should return false for macOS 15', async () => {
      vi.doMock('electron', () => ({
        app: { getPath: vi.fn() },
      }))
      vi.doMock('node:os', () => ({
        default: { release: vi.fn() },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      Object.defineProperty(process, 'getSystemVersion', {
        value: () => '15.0.0',
        configurable: true,
      })

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(false)
    })

    it('should return true for Windows 11 (build 22000)', async () => {
      vi.doMock('electron', () => ({
        app: { getPath: vi.fn() },
      }))
      vi.doMock('node:os', () => ({
        default: { release: () => '10.0.22000' },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(true)
    })

    it('should return false for Windows 10 (build 19045)', async () => {
      vi.doMock('electron', () => ({
        app: { getPath: vi.fn() },
      }))
      vi.doMock('node:os', () => ({
        default: { release: () => '10.0.19045' },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(false)
    })

    it('should return false for Linux', async () => {
      vi.doMock('electron', () => ({
        app: { getPath: vi.fn() },
      }))
      vi.doMock('node:os', () => ({
        default: { release: vi.fn() },
      }))
      vi.doMock('./logger.js', () => ({
        logger: { catch: vi.fn() },
      }))
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(false)
    })
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
