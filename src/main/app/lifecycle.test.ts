/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-misused-promises -- mockImplementation 回调允许返回 Promise */
/* eslint-disable @typescript-eslint/no-unsafe-return -- mock 透传 any 参数 */
import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockWin = {
  on: vi.fn(),
  once: vi.fn(),
  isDestroyed: vi.fn(() => false),
  webContents: { send: vi.fn() },
}

const mockSetMainWindow = vi.fn()
const mockGetMainWindow = vi.fn(() => mockWin)

vi.mock('../utils/index.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), catch: vi.fn() },
}))

vi.mock('../stores/index.js', () => ({
  getUiSettings: vi.fn(() => ({ appearance: 'system' })),
  flushStores: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./window-theme.js', () => ({
  applyWindowTheme: vi.fn(),
  attachSystemThemeListener: vi.fn(),
}))

vi.mock('../services/index.js', () => ({
  sessionManager: { safeUnregisterAll: vi.fn() },
  sessionRegistry: { count: 0 },
}))

vi.mock('./window-factory.js', () => ({
  createAppWindow: vi.fn(() => mockWin),
}))

vi.mock('./main-window.js', () => ({
  setMainWindow: (...args: unknown[]) => mockSetMainWindow(...args),
  getMainWindow: () => mockGetMainWindow(),
}))

vi.mock('../services/transfer/index.js', () => ({
  transferService: { hasActiveTasks: vi.fn(() => false) },
}))

vi.mock('../protocol/protocol-service.js', () => ({
  protocolService: {},
}))

vi.mock('@shared/constants/index.js', () => ({
  TIMEOUTS: { FORCE_EXIT: 5000 },
}))

vi.mock('@shared/utils/index.js', () => ({
  formatErrorMessage: vi.fn((error: unknown) => String(error)),
}))

vi.mock('@shared/contract/events.contract.js', () => ({
  EVENT_CHANNEL: { HAS_ACTIVE_TASKS: 'transfer.hasActiveTasks' },
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
      ;(sessionManager.safeUnregisterAll as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ success: true, value: null }), 20)),
      )

      await Promise.all([disconnectAllSessions(), disconnectAllSessions()])

      expect(sessionManager.safeUnregisterAll).toHaveBeenCalledTimes(1)
    })

    it('should return early if no active sessions', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')

      setSessionCount(sessionRegistry, 0)
      await disconnectAllSessions()

      expect(sessionManager.safeUnregisterAll).not.toHaveBeenCalled()
    })

    it('should handle disconnection failure gracefully', async () => {
      const { disconnectAllSessions } = await import('./lifecycle.js')
      const { sessionManager, sessionRegistry } = await import('../services/index.js')
      const { logger } = await import('../utils/index.js')

      setSessionCount(sessionRegistry, 2)
      ;(sessionManager.safeUnregisterAll as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: new Error('Disconnect failed'),
      })

      await disconnectAllSessions()

      expect(logger.catch).toHaveBeenCalled()
    })
  })

  describe('cleanupAndExit', () => {
    it('should flush stores and disconnect sessions before exit', async () => {
      const { cleanupAndExit } = await import('./lifecycle.js')
      const { flushStores } = await import('../stores/index.js')

      await cleanupAndExit('SIGTERM', true, 0)

      expect(flushStores).toHaveBeenCalled()
      expect(app.quit).toHaveBeenCalled()
    })

    it('should skip config saving when shouldSaveConfig is false', async () => {
      const { cleanupAndExit } = await import('./lifecycle.js')
      const { flushStores } = await import('../stores/index.js')
      const originalExit = process.exit
      const mockExit = vi.fn()
      ;(process as unknown as Record<string, unknown>)['exit'] = mockExit

      try {
        await cleanupAndExit('uncaughtException', false, 1)
      } finally {
        ;(process as unknown as Record<string, unknown>)['exit'] = originalExit
      }

      expect(flushStores).not.toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('setupAppLifecycle', () => {
    it('should register window-all-closed and before-quit handlers', async () => {
      const { setupAppLifecycle } = await import('./lifecycle.js')

      setupAppLifecycle()

      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function))
      expect(app.on).toHaveBeenCalledWith('before-quit', expect.any(Function))
    })
  })

  describe('createMainWindow', () => {
    it('should create the app window and register it', async () => {
      const { createMainWindow } = await import('./lifecycle.js')
      const { createAppWindow } = await import('./window-factory.js')

      createMainWindow()

      expect(createAppWindow).toHaveBeenCalled()
      expect(mockSetMainWindow).toHaveBeenCalledWith(mockWin)
      expect(mockWin.once).toHaveBeenCalledWith('closed', expect.any(Function))
      expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function))
    })
  })
})
