/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import log from 'electron-log/main'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock shared utils that logger depends on
vi.mock('@shared/utils/index.js', () => ({
  formatMessage: vi.fn((msg: string) => `[formatted] ${msg}`),
  getCallerInfo: vi.fn(() => 'test-caller'),
  catchLog: vi.fn(
    (logFn: (msg: string) => void, error: unknown, context?: Record<string, unknown>) => {
      const message = error instanceof Error ? error.message : String(error)
      const contextStr = context ? ` ${JSON.stringify(context)}` : ''
      logFn(`[formatted] ${message}${contextStr}`)
    }
  ),
}))

describe('main logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export logger with all methods', async () => {
    const { logger } = await import('./logger.js')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.catch).toBe('function')
  })

  it('should delegate info to electron-log', async () => {
    const { logger } = await import('./logger.js')
    logger.info('test info message')
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('test info message'))
  })

  it('should delegate warn to electron-log', async () => {
    const { logger } = await import('./logger.js')
    logger.warn('test warn message')
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('test warn message'))
  })

  it('should delegate error to electron-log', async () => {
    const { logger } = await import('./logger.js')
    logger.error('test error message')
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('test error message'))
  })

  it('should delegate debug to electron-log', async () => {
    const { logger } = await import('./logger.js')
    logger.debug('test debug message')
    expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('test debug message'))
  })

  it('should delegate catch to electron-log error', async () => {
    const { logger } = await import('./logger.js')
    logger.catch(new Error('test error'), { action: 'test' })
    expect(log.error).toHaveBeenCalled()
    const loggedMessage = vi.mocked(log.error).mock.calls[0]?.[0] as string
    expect(loggedMessage).toContain('test error')
  })

  it('should include context in catch output', async () => {
    const { logger } = await import('./logger.js')
    logger.catch(new Error('connection failed'), { action: 'connect', sessionId: 'sess-1' })
    expect(log.error).toHaveBeenCalled()
    const loggedMessage = vi.mocked(log.error).mock.calls[0]?.[0] as string
    expect(loggedMessage).toContain('connection failed')
    expect(loggedMessage).toContain('connect')
  })

  it('should handle non-Error objects in catch', async () => {
    const { logger } = await import('./logger.js')
    logger.catch('string error', { action: 'test' })
    expect(log.error).toHaveBeenCalled()
    const loggedMessage = vi.mocked(log.error).mock.calls[0]?.[0] as string
    expect(loggedMessage).toContain('string error')
  })
})
