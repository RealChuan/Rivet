import log from 'electron-log'
import path from 'path'
import { app } from 'electron'

log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('userData'), 'logs', 'main.log')
}

log.transports.file.level = 'info'
log.transports.console.level = 'debug'

export const logger = {
  info: (message: string, ...args: unknown[]) => log.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => log.error(message, ...args),
  debug: (message: string, ...args: unknown[]) => log.debug(message, ...args),
}

export default logger
