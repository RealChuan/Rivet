import log from 'electron-log/renderer'
import { catchLog as sharedCatchLog, formatMessage, getCallerInfo } from '@shared/utils/index.js'

const isPackaged = import.meta.env.PROD // 生产构建为 true

const createLogFn = (level: 'info' | 'warn' | 'error' | 'debug') => {
  return (msg: string, ...args: unknown[]) => {
    log[level](formatMessage(msg, !isPackaged, getCallerInfo(3)), ...args)
  }
}

const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  catch: (error: unknown, context?: Record<string, unknown>) =>
    sharedCatchLog((msg, ...args) => log.error(msg, ...args), error, context),
}

export default logger
