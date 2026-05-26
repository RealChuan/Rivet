import log from 'electron-log/main'
import path from 'node:path'
import { app } from 'electron'
import { formatMessage, getCallerInfo } from '@shared/utils/index.js'

// 主进程特有的配置
log.initialize() // ← 关键：自动注入 preload
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log')
log.transports.file.level = 'info'
log.transports.console.level = 'info'

const createLogFn = (level: 'info' | 'warn' | 'error' | 'debug') => {
  return (msg: string, ...args: unknown[]) => {
    log[level](formatMessage(msg, !app.isPackaged, getCallerInfo(4)), ...args)
  }
}

function catchLog(error: unknown, context?: Record<string, unknown>) {
  const callerInfo = getCallerInfo(4)
  const errorObj = error instanceof Error ? error : new Error(String(error))
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : ''
  const logMessage = `[${callerInfo}] ${errorObj.message}${contextStr}\nStack: ${errorObj.stack ?? ''}`
  log.error(logMessage)
}

export const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  catch: catchLog,
}

export default logger
