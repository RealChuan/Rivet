/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import log from 'electron-log/renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/utils/index.js', () => ({
  formatMessage: vi.fn((msg: string) => `[formatted] ${msg}`),
  getCallerInfo: vi.fn(() => 'test-caller'),
  catchLog: vi.fn(
    (logFn: (msg: string) => void, error: unknown, context?: Record<string, unknown>) => {
      const message = error instanceof Error ? error.message : String(error)
      const contextStr = context ? ` ${JSON.stringify(context)}` : ''
      logFn(`[formatted] ${message}${contextStr}`)
    },
  ),
}))

describe('renderer logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export logger with all methods', async () => {
    const { default: logger } = await import('./logger.js')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.catch).toBe('function')
  })

  it('should call electron-log info with formatted message', async () => {
    const { default: logger } = await import('./logger.js')
    logger.info('test message')
    expect(log.info).toHaveBeenCalledWith('[formatted] test message')
  })

  it('should call electron-log warn with formatted message', async () => {
    const { default: logger } = await import('./logger.js')
    logger.warn('warning message')
    expect(log.warn).toHaveBeenCalledWith('[formatted] warning message')
  })

  it('should call electron-log error with formatted message', async () => {
    const { default: logger } = await import('./logger.js')
    logger.error('error message')
    expect(log.error).toHaveBeenCalledWith('[formatted] error message')
  })

  it('should call electron-log debug with formatted message', async () => {
    const { default: logger } = await import('./logger.js')
    logger.debug('debug message')
    expect(log.debug).toHaveBeenCalledWith('[formatted] debug message')
  })

  it('should format error in catch method', async () => {
    const { default: logger } = await import('./logger.js')
    const error = new Error('test error')
    logger.catch(error)
    expect(log.error).toHaveBeenCalled()
    const loggedMessage = vi.mocked(log.error).mock.calls[0]?.[0] as string
    expect(loggedMessage).toContain('test error')
  })

  it('should include context in catch method', async () => {
    const { default: logger } = await import('./logger.js')
    logger.catch(new Error('err'), { action: 'test-action' })
    const loggedMessage = vi.mocked(log.error).mock.calls[0]?.[0] as string
    expect(loggedMessage).toContain('test-action')
  })

  it('should handle non-Error objects in catch', async () => {
    const { default: logger } = await import('./logger.js')
    logger.catch('string error')
    expect(log.error).toHaveBeenCalled()
  })
})
