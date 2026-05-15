import log from 'electron-log'
import path from 'node:path'
import { app } from 'electron'
import { getCallerInfo } from '@shared/utils/index.js'

log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('userData'), 'logs', 'main.log')
}

log.transports.file.level = 'info'
log.transports.console.level = 'info'

const formatMessage = (message: string) => {
  return !app.isPackaged ? `${getCallerInfo(4)} ${message}` : message
}

export const logger = {
  info: (message: string, ...args: unknown[]) => log.info(formatMessage(message), ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(formatMessage(message), ...args),
  error: (message: string, ...args: unknown[]) => log.error(formatMessage(message), ...args),
  debug: (message: string, ...args: unknown[]) => log.debug(formatMessage(message), ...args),
}

export default logger
