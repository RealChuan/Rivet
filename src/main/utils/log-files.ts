import { shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { buildLogFileName, logFilePattern, logsDir } from './logger.js'

/**
 * 活动日志：electron-log 正持有句柄，Windows 上删不掉。
 * 缓存大小与清除共用同一口径，保证「显示的大小 = 清除能释放的量」。
 */
function activeLogPath(now: Date = new Date()): string {
  return path.join(logsDir(), buildLogFileName(now))
}

/** 旧日志 + 按大小归档出的日志，排除当前活动日志。 */
function listCacheFiles(now: Date = new Date()): string[] {
  const dir = logsDir()
  const active = activeLogPath(now)

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // 目录还没建（从未写过日志）等价于空缓存。
    return []
  }

  const pattern = logFilePattern()
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .filter((filePath) => filePath !== active)
}

function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

function pathFailure(message: string, error: unknown): ErrorInfo {
  return createErrorInfo(ERROR_CODE.PATH_ERROR, message, String(error))
}

export function getLogDir(): Result<string, ErrorInfo> {
  try {
    return ok(logsDir())
  } catch (error) {
    return err(pathFailure('Failed to resolve logs directory', error))
  }
}

export function getLogCacheSize(): Result<number, ErrorInfo> {
  try {
    const bytes = listCacheFiles().reduce((total, filePath) => total + fileSize(filePath), 0)
    return ok(bytes)
  } catch (error) {
    return err(pathFailure('Failed to measure log cache', error))
  }
}

/** 返回释放的字节数；单个文件被占用时跳过，与 cleanupExpiredLogs 同一策略。 */
export function clearLogCache(): Result<number, ErrorInfo> {
  try {
    let freed = 0
    for (const filePath of listCacheFiles()) {
      const size = fileSize(filePath)
      try {
        fs.rmSync(filePath, { force: true })
        freed += size
      } catch {
        // 占用中的旧日志留给下次清理。
      }
    }
    return ok(freed)
  } catch (error) {
    return err(pathFailure('Failed to clear log cache', error))
  }
}

/** 在文件管理器中定位当前活动日志；尚未写过日志时直接打开日志目录。 */
export async function openLogDir(): Promise<Result<void, ErrorInfo>> {
  try {
    const dir = logsDir()
    const active = activeLogPath()
    if (fs.existsSync(active)) {
      shell.showItemInFolder(active)
      return ok(undefined)
    }
    // openPath 成功时 resolve 空串，失败时返回错误文案（不抛错）。
    const message = await shell.openPath(dir)
    return message === ''
      ? ok(undefined)
      : err(pathFailure('Failed to open logs directory', message))
  } catch (error) {
    return err(pathFailure('Failed to open logs directory', error))
  }
}
