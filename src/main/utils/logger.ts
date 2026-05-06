import { app } from 'electron'
import log from 'electron-log/main'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  catchLog as sharedCatchLog,
  CALLER_DEPTH,
  formatMessage,
  getCallerInfo,
} from '@shared/utils/index.js'

/** 单个日志文件上限；超过后按时间戳归档，避免无限增长。 */
const LOG_MAX_SIZE_BYTES = 10 * 1024 * 1024
/** 日志保留天数；只清理本应用命名模式内的文件。 */
const LOG_RETENTION_DAYS = 14

/** 文件名只保留跨平台安全字符，主机名/应用名里的空格与特殊符号不会破坏命名模式。 */
function sanitizeFilePart(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return sanitized.length > 0 ? sanitized : 'unknown'
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

/** 按天滚动的日期片段（本地时区）。 */
export function logDateStamp(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function logTimeStamp(date: Date): string {
  return [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3),
  ].join('-')
}

function logPrefix(): string {
  return `${sanitizeFilePart(app.getName())}_${sanitizeFilePart(os.hostname())}_${process.pid}`
}

function logsDir(): string {
  return path.join(app.getPath('userData'), 'logs')
}

/** `<app>_<host>_<pid>_<YYYY-MM-DD>.log` */
export function buildLogFileName(date: Date = new Date()): string {
  return `${logPrefix()}_${logDateStamp(date)}.log`
}

function buildArchiveFileName(filePath: string, date: Date = new Date()): string {
  const parsed = path.parse(filePath)
  const base = `${parsed.name}_${logTimeStamp(date)}`
  let candidate = path.join(parsed.dir, `${base}${parsed.ext}`)
  let counter = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${base}-${counter}${parsed.ext}`)
    counter += 1
  }
  return candidate
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 匹配本应用自己写出的文件名：
 * - 当前文件：`Rivet_<host>_<pid>_2026-10-30.log`
 * - 归档文件：`Rivet_<host>_<pid>_2026-10-30_09-35-04-123.log`（同日多次滚动带 `-N` 后缀）
 * pid 用通配，保证能清掉历史进程留下的日志；其他应用/无关文件永不匹配。
 */
function logFilePattern(): RegExp {
  const prefix = escapeRegExp(
    `${sanitizeFilePart(app.getName())}_${sanitizeFilePart(os.hostname())}_`,
  )
  return new RegExp(
    `^${prefix}\\d+_(\\d{4}-\\d{2}-\\d{2})(?:_\\d{2}-\\d{2}-\\d{2}-\\d{3}(?:-\\d+)?)?\\.log$`,
  )
}

export interface CleanupLogsOptions {
  dir?: string
  now?: Date
  retentionDays?: number
}

/** 删除超过保留期的自家日志；任何失败都静默跳过，不影响启动。 */
export function cleanupExpiredLogs(options: CleanupLogsOptions = {}): void {
  const dir = options.dir ?? logsDir()
  const now = options.now ?? new Date()
  const retentionDays = options.retentionDays ?? LOG_RETENTION_DAYS

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const cutoffTime = cutoff.getTime()
  const pattern = logFilePattern()

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const match = pattern.exec(entry.name)
    if (!match) continue

    const datePart = match[1]
    if (!datePart) continue
    const [year, month, day] = datePart.split('-').map(Number)
    if (year === undefined || month === undefined || day === undefined) continue

    const fileDate = new Date(year, month - 1, day)
    if (fileDate.getTime() >= cutoffTime) continue

    try {
      fs.rmSync(path.join(dir, entry.name), { force: true })
    } catch {
      // 过期清理是尽力而为：文件被占用时留到下次启动再删。
    }
  }
}

log.initialize() // ← 关键：自动注入 preload
log.transports.file.maxSize = LOG_MAX_SIZE_BYTES
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}'
// 对象参数压成单行，避免一条日志被 util.inspect 折成十几行。
log.transports.file.inspectOptions = { breakLength: Infinity, depth: 5 }

let activeLogPath: string | null = null
log.transports.file.resolvePathFn = () => {
  const filePath = path.join(logsDir(), buildLogFileName())
  // 首次写入与跨天换文件时各清理一次；长期不重启的进程也能按期删除旧日志。
  if (filePath !== activeLogPath) {
    activeLogPath = filePath
    cleanupExpiredLogs()
  }
  return filePath
}
log.transports.file.archiveLogFn = (file) => {
  try {
    fs.renameSync(file.path, buildArchiveFileName(file.path))
  } catch {
    // 改名失败（Windows 上文件被占用）时清空当前文件，保证不会无限增长。
    file.clear()
  }
  // 同一天按大小滚动也会生成新文件；顺手清一次过期日志。
  cleanupExpiredLogs()
}
log.transports.file.level = 'info'
log.transports.console.level = 'info'

const createLogFn = (level: 'info' | 'warn' | 'error' | 'debug') => {
  return (msg: string, ...args: unknown[]) => {
    log[level](
      formatMessage(msg, !app.isPackaged, getCallerInfo(CALLER_DEPTH.DIRECT_MAIN)),
      ...args,
    )
  }
}

export const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  catch: (error: unknown, context?: Record<string, unknown>) =>
    sharedCatchLog((msg, ...args) => log.error(msg, ...args), error, context),
}
