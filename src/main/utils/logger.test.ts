/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import log from 'electron-log/main'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock shared utils that logger depends on（保留 CALLER_DEPTH 等常量真实值）
vi.mock('@shared/utils/index.js', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    formatMessage: vi.fn((msg: string) => `[formatted] ${msg}`),
    getCallerInfo: vi.fn(() => 'test-caller'),
    catchLog: vi.fn(
      (logFn: (msg: string) => void, error: unknown, context?: Record<string, unknown>) => {
        const message = error instanceof Error ? error.message : String(error)
        const contextStr = context ? ` ${JSON.stringify(context)}` : ''
        logFn(`[formatted] ${message}${contextStr}`)
      },
    ),
  }
})

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

describe('log file rotation', () => {
  it('文件名包含应用名、主机名、进程 ID 与日期', async () => {
    const { buildLogFileName } = await import('./logger.js')

    const name = buildLogFileName(new Date(2026, 9, 30))

    expect(name).toMatch(new RegExp(`^Rivet_.+_${process.pid}_2026-10-30\\.log$`))
  })

  it('只清理自己命名模式内的过期文件', async () => {
    const { buildLogFileName, cleanupExpiredLogs } = await import('./logger.js')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rivet-log-'))
    const prefix = buildLogFileName(new Date(2026, 9, 30)).replace(/_2026-10-30\.log$/, '')
    const oldPrefix = prefix.replace(/_\d+$/, '_12345')

    const shouldDelete = [`${oldPrefix}_2026-09-01.log`, `${oldPrefix}_2026-09-01_09-00-00-000.log`]
    const shouldKeep = [
      `${oldPrefix}_2026-10-29.log`,
      `other_2026-09-01.log`,
      `RivetX_${os.hostname()}_1_2026-09-01.log`,
    ]

    try {
      for (const name of [...shouldDelete, ...shouldKeep]) {
        fs.writeFileSync(path.join(dir, name), 'log')
      }

      cleanupExpiredLogs({ dir, now: new Date(2026, 9, 30), retentionDays: 14 })

      for (const name of shouldDelete) {
        expect(fs.existsSync(path.join(dir, name))).toBe(false)
      }
      for (const name of shouldKeep) {
        expect(fs.existsSync(path.join(dir, name))).toBe(true)
      }
    } finally {
      fs.rmSync(dir, { force: true, recursive: true })
    }
  })
})
