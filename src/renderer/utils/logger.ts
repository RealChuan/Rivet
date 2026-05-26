import log from 'electron-log/renderer'
import { formatMessage, getCallerInfo } from '@shared/utils/index.js'

const isPackaged = import.meta.env.PROD // 生产构建为 true

const createLogFn = (level: 'info' | 'warn' | 'error' | 'debug') => {
  return (msg: string, ...args: unknown[]) => {
    log[level](formatMessage(msg, !isPackaged, getCallerInfo(3)), ...args)
  }
}

function catchLog(error: unknown, context?: Record<string, unknown>) {
  const callerInfo = getCallerInfo(4)
  const errorObj = error instanceof Error ? error : new Error(String(error))
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : ''
  const logMessage = `[${callerInfo}] ${errorObj.message}${contextStr}\nStack: ${errorObj.stack ?? ''}`
  log.error(logMessage)
}

const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  catch: catchLog,
}

export default logger
