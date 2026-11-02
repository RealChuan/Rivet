import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function mockSystemModules(release: () => string = () => ''): void {
  vi.doMock('electron', () => ({
    app: { getPath: vi.fn() },
  }))
  vi.doMock('node:os', () => ({
    default: { release: vi.fn(release) },
  }))
  vi.doMock('./logger.js', () => ({
    logger: { catch: vi.fn() },
  }))
}

function setSystem(platform: NodeJS.Platform, systemVersion: string): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  Object.defineProperty(process, 'getSystemVersion', {
    value: () => systemVersion,
    configurable: true,
  })
}

describe('system utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('supportsVibrancy', () => {
    it('should return true for macOS 13 (Electron minimum)', async () => {
      mockSystemModules()
      setSystem('darwin', '13.6.1')

      const { supportsVibrancy } = await import('./system.js')
      expect(supportsVibrancy()).toBe(true)
    })

    it('should return false for macOS 12', async () => {
      mockSystemModules()
      setSystem('darwin', '12.7.6')

      const { supportsVibrancy } = await import('./system.js')
      expect(supportsVibrancy()).toBe(false)
    })

    it('should return false off macOS', async () => {
      mockSystemModules(() => '10.0.22621')
      setSystem('win32', '10.0.22621')

      const { supportsVibrancy } = await import('./system.js')
      expect(supportsVibrancy()).toBe(false)
    })
  })

  describe('supportsBackgroundMaterial', () => {
    it('should return true for Windows 11 22H2 (build 22621)', async () => {
      mockSystemModules(() => '10.0.22621')
      setSystem('win32', '10.0.22621')

      const { supportsBackgroundMaterial } = await import('./system.js')
      expect(supportsBackgroundMaterial()).toBe(true)
    })

    it('should return false for Windows 11 21H2 (build 22000)', async () => {
      mockSystemModules(() => '10.0.22000')
      setSystem('win32', '10.0.22000')

      const { supportsBackgroundMaterial } = await import('./system.js')
      expect(supportsBackgroundMaterial()).toBe(false)
    })

    it('should return false for Windows 10 (build 19045)', async () => {
      mockSystemModules(() => '10.0.19045')
      setSystem('win32', '10.0.19045')

      const { supportsBackgroundMaterial } = await import('./system.js')
      expect(supportsBackgroundMaterial()).toBe(false)
    })

    it('should return false off Windows', async () => {
      mockSystemModules()
      setSystem('darwin', '26.0.0')

      const { supportsBackgroundMaterial } = await import('./system.js')
      expect(supportsBackgroundMaterial()).toBe(false)
    })
  })

  describe('supportsGlassEffect', () => {
    it('should return true on macOS 13', async () => {
      mockSystemModules()
      setSystem('darwin', '13.6.1')

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(true)
    })

    it('should return false on macOS 12', async () => {
      mockSystemModules()
      setSystem('darwin', '12.7.6')

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(false)
    })

    it('should return true for Windows 11 22H2 (build 22621)', async () => {
      mockSystemModules(() => '10.0.22621')
      setSystem('win32', '10.0.22621')

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(true)
    })

    it('should return false for Windows 10 (build 19045)', async () => {
      mockSystemModules(() => '10.0.19045')
      setSystem('win32', '10.0.19045')

      const { supportsGlassEffect } = await import('./system.js')
      expect(supportsGlassEffect()).toBe(false)
    })

    it('should return false for Linux', async () => {
      mockSystemModules()
      setSystem('linux', '')

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
