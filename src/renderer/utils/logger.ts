import { getCallerInfo } from '../../shared/utils'

const logger = {
  info: (message: string, ...args: unknown[]) =>
    console.info(`[INFO] ${getCallerInfo()} ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) =>
    console.warn(`[WARN] ${getCallerInfo()} ${message}`, ...args),
  error: (message: string, ...args: unknown[]) =>
    console.error(`[ERROR] ${getCallerInfo()} ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) =>
    console.debug(`[DEBUG] ${getCallerInfo()} ${message}`, ...args),
}

export default logger
