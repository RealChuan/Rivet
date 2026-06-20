/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-misused-promises -- mockImplementation 回调允许返回 Promise */
import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/index.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    catch: vi.fn(),
  },
}))

vi.mock('../stores/index.js', () => ({
  saveConfig: vi.fn(),
  stopAutoSave: vi.fn(),
}))

vi.mock('../services/index.js', () => ({
  sessionManager: {
    safeUnregisterAll: vi.fn(),
  },
  sessionRegistry: {
    count: 0,
  },
}))

vi.mock('./window-factory.js', () => ({
  WindowManager: {
    create: vi.fn(),
  },
}))

vi.mock('../services/transfer/index.js', () => ({
  transferService: {
    setMainWindow: vi.fn(),
    hasActiveTasks: vi.fn(() => false),
  },
}))

vi.mock('@shared/constants/index.js', () => ({
  APP_NAME: 'Rivet',
  MAIN_WINDOW_ID: 'main',
  DEFAULT_MAIN_WINDOW_WIDTH: 1100,
  DEFAULT_MAIN_WINDOW_HEIGHT: 700,
  MIN_MAIN_WINDOW_WIDTH: 800,
  MIN_MAIN_WINDOW_HEIGHT: 600,
  DEFAULT_ROUTE: '/',
  TRANSFER_CONFIG: {
    PROGRESS_THROTTLE_MS: 500,
    ROTATION_INTERVAL_MS: 3000,
    DEFAULT_MAX_CONCURRENCY: 5,
    MIN_CONCURRENCY: 1,
    MAX_CONCURRENCY: 10,
    MAX_INLINE_OPERATIONS: 3,
  },
}))

vi.mock('@shared/constants/timeouts.js', () => ({
  TIMEOUTS: {
    FORCE_EXIT: 5000,
  },
}))

vi.mock('@shared/utils/index.js', () => ({
  formatErrorMessage: vi.fn((error: unknown) => String(error)),
}))

function setSessionCount(registry: { count: number }, value: number): void {
  Object.defineProperty(registry, 'count', { value, writable: true, configurable: true })
}

describe('lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('disconnectAllSessions', () => {
    it('should prevent concurrent disconnections', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')

      setSessionCount(sessionRegistry, 3)
      const mockResult = { success: true, value: null }
      ;(sessionManager.safeUnregisterAll as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResult), 100)),
      )

      const promise1 = disconnectAllSessions()
      const promise2 = disconnectAllSessions()

      await Promise.all([promise1, promise2])

      expect(sessionManager.safeUnregisterAll).toHaveBeenCalledTimes(1)
    })

    it('should return early if no active sessions', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')

      setSessionCount(sessionRegistry, 0)
      await disconnectAllSessions()

      expect(sessionManager.safeUnregisterAll).not.toHaveBeenCalled()
    })

    it('should disconnect all sessions when sessions exist', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')

      setSessionCount(sessionRegistry, 3)
      const mockResult = { success: true, value: null }
      ;(sessionManager.safeUnregisterAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult)

      await disconnectAllSessions()

      expect(sessionManager.safeUnregisterAll).toHaveBeenCalled()
    })

    it('should handle disconnection failure gracefully', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')
      const { logger } = await import('../utils/index.js')

      setSessionCount(sessionRegistry, 2)
      const mockResult = { success: false, error: new Error('Disconnect failed') }
      ;(sessionManager.safeUnregisterAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult)

      await disconnectAllSessions()

      expect(logger.catch).toHaveBeenCalled()
    })

    it('should handle unexpected errors during disconnection', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')
      const { logger } = await import('../utils/index.js')

      setSessionCount(sessionRegistry, 1)
      ;(sessionManager.safeUnregisterAll as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Unexpected error'),
      )

      await disconnectAllSessions()

      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('cleanupAndExit', () => {
    it('should stop auto save and disconnect sessions before exit', async () => {
      const { cleanupAndExit } = await import('./lifecycle.js')
      const { stopAutoSave, saveConfig } = await import('../stores/index.js')

      await cleanupAndExit('SIGTERM', true, 0)

      expect(stopAutoSave).toHaveBeenCalled()
      expect(saveConfig).toHaveBeenCalled()
      expect(app.quit).toHaveBeenCalled()
    })

    it('should call process.exit with non-zero code for errors', async () => {
      const { cleanupAndExit } = await import('./lifecycle.js')
      const originalExit = process.exit
      const mockExit = vi.fn()
      ;(process as unknown as Record<string, unknown>)['exit'] = mockExit

      try {
        await cleanupAndExit('uncaughtException', false, 1)
        expect(mockExit).toHaveBeenCalledWith(1)
      } finally {
        ;(process as unknown as Record<string, unknown>)['exit'] = originalExit
      }

      expect(app.quit).not.toHaveBeenCalled()
    })

    it('should skip config saving when shouldSaveConfig is false', async () => {
      const { cleanupAndExit } = await import('./lifecycle.js')
      const { saveConfig } = await import('../stores/index.js')
      const originalExit = process.exit
      const mockExit = vi.fn()
      ;(process as unknown as Record<string, unknown>)['exit'] = mockExit

      try {
        await cleanupAndExit('uncaughtException', false, 1)
      } finally {
        ;(process as unknown as Record<string, unknown>)['exit'] = originalExit
      }

      expect(saveConfig).not.toHaveBeenCalled()
    })
  })

  describe('setupAppLifecycle', () => {
    it('should register window-all-closed handler', async () => {
      const { setupAppLifecycle } = await import('./lifecycle.js')

      setupAppLifecycle()

      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function))
    })

    it('should register before-quit handler', async () => {
      const { setupAppLifecycle } = await import('./lifecycle.js')

      setupAppLifecycle()

      expect(app.on).toHaveBeenCalledWith('before-quit', expect.any(Function))
    })

    it('should register signal handlers for SIGTERM and SIGINT', async () => {
      const { setupAppLifecycle } = await import('./lifecycle.js')

      const onSpy = vi.spyOn(process, 'on')

      setupAppLifecycle()

      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))

      onSpy.mockRestore()
    })

    it('should register uncaughtException handler', async () => {
      const { setupAppLifecycle } = await import('./lifecycle.js')

      const onSpy = vi.spyOn(process, 'on')

      setupAppLifecycle()

      expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function))

      onSpy.mockRestore()
    })
  })

  describe('createMainWindow', () => {
    it('should create main window with correct options', async () => {
      const { createMainWindow } = await import('./lifecycle.js')
      const { WindowManager } = await import('./window-factory.js')

      const mockWin = { on: vi.fn(), isDestroyed: vi.fn(() => false) }
      ;(WindowManager.create as ReturnType<typeof vi.fn>).mockReturnValue(mockWin)

      createMainWindow()

      expect(WindowManager.create).toHaveBeenCalledWith({
        id: 'main',
        route: '/',
        width: 1100,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        title: 'Rivet',
      })
    })

    it('should register activate handler for macOS', async () => {
      const { createMainWindow } = await import('./lifecycle.js')
      const { WindowManager } = await import('./window-factory.js')

      const mockWin = { on: vi.fn(), isDestroyed: vi.fn(() => false) }
      ;(WindowManager.create as ReturnType<typeof vi.fn>).mockReturnValue(mockWin)

      createMainWindow()

      expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function))
    })
  })
})
