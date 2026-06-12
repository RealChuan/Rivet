import { app } from 'electron'
import log from 'electron-log/main'
import path from 'node:path'
import { catchLog as sharedCatchLog, formatMessage, getCallerInfo } from '@shared/utils/index.js'

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

export const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  catch: (error: unknown, context?: Record<string, unknown>) =>
    sharedCatchLog((msg, ...args) => log.error(msg, ...args), error, context),
}
