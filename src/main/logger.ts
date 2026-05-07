import log from 'electron-log'
import path from 'path'
import { app } from 'electron'
import { getCallerInfo } from '../shared/utils'

log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('userData'), 'logs', 'main.log')
}

log.transports.file.level = 'info'
log.transports.console.level = 'info'

export const logger = {
  info: (message: string, ...args: unknown[]) => log.info(`${getCallerInfo()} ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(`${getCallerInfo()} ${message}`, ...args),
  error: (message: string, ...args: unknown[]) =>
    log.error(`${getCallerInfo()} ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) =>
    log.debug(`${getCallerInfo()} ${message}`, ...args),
}

export default logger
