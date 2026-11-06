/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { app, shell } from 'electron'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLogCache, getLogCacheSize, getLogDir, openLogDir } from './log-files.js'
import { buildLogFileName } from './logger.js'

let root = ''
let logsRoot = ''

/** 活动日志名：`<app>_<host>_<pid>_<today>.log`，前缀用于拼归档名。 */
function activeName(): string {
  return buildLogFileName()
}

function logPrefix(): string {
  return activeName().replace(/_\d{4}-\d{2}-\d{2}\.log$/, '')
}

function writeLog(name: string, bytes: number): void {
  writeFileSync(path.join(logsRoot, name), Buffer.alloc(bytes))
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'rivet-log-cache-'))
  logsRoot = path.join(root, 'logs')
  mkdirSync(logsRoot, { recursive: true })
  vi.mocked(app.getPath).mockImplementation((name: string) => (name === 'userData' ? root : '/tmp'))
  // 全局 setup 里的 resetAllMocks 会清掉 mock 的默认实现，这里补回来。
  vi.mocked(shell.openPath).mockResolvedValue('')
})

afterEach(() => {
  vi.clearAllMocks()
  rmSync(root, { recursive: true, force: true })
})

describe('log cache', () => {
  it('getLogDir 指向 userData/logs', () => {
    const result = getLogDir()

    expect(result.success).toBe(true)
    expect(result.success ? result.value : '').toBe(logsRoot)
  })

  it('只统计自家命名的旧日志与归档，排除活动日志', () => {
    writeLog(activeName(), 100)
    writeLog(`${logPrefix()}_2026-01-01.log`, 300)
    writeLog(`${logPrefix()}_2026-01-01_09-35-04-123.log`, 200)
    writeLog('unrelated.txt', 999)
    writeLog('OtherApp_host_1_2026-01-01.log', 999)

    const result = getLogCacheSize()

    expect(result.success && result.value).toBe(500)
  })

  it('清除返回释放量与统计一致，活动日志保留', () => {
    writeLog(activeName(), 100)
    writeLog(`${logPrefix()}_2026-01-01.log`, 300)
    writeLog(`${logPrefix()}_2026-01-01_09-35-04-123.log`, 200)

    const cleared = clearLogCache()

    expect(cleared.success && cleared.value).toBe(500)
    expect(existsSync(path.join(logsRoot, activeName()))).toBe(true)
    const remaining = getLogCacheSize()
    expect(remaining.success && remaining.value).toBe(0)
  })

  it('日志目录不存在时按空缓存处理', () => {
    rmSync(logsRoot, { recursive: true, force: true })

    expect(getLogCacheSize()).toEqual({ success: true, value: 0, error: null })
    expect(clearLogCache()).toEqual({ success: true, value: 0, error: null })
  })
})

describe('openLogDir', () => {
  it('活动日志存在时在文件管理器中定位它', async () => {
    writeLog(activeName(), 10)

    await expect(openLogDir()).resolves.toEqual({ success: true, value: undefined, error: null })
    expect(shell.showItemInFolder).toHaveBeenCalledWith(path.join(logsRoot, activeName()))
  })

  it('还没写过日志时直接打开目录', async () => {
    await expect(openLogDir()).resolves.toEqual({ success: true, value: undefined, error: null })
    expect(shell.openPath).toHaveBeenCalledWith(logsRoot)
  })
})
