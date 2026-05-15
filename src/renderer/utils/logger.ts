import { getCallerInfo } from '@shared/utils/index.js'

let isPackaged: boolean | undefined

const getIsPackaged = (): boolean => {
  if (isPackaged === undefined) {
    void window.electronAPI.common.getIsPackaged().then(value => {
      isPackaged = value
    })
    return false
  }
  return isPackaged
}

const logger = {
  info: (message: string, ...args: unknown[]): void => {
    const callerInfo = getIsPackaged() ? '' : `${getCallerInfo()} `
    /* eslint-disable-next-line no-console */
    console.info(`[INFO] ${callerInfo}${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]): void => {
    const callerInfo = getIsPackaged() ? '' : `${getCallerInfo()} `
    console.warn(`[WARN] ${callerInfo}${message}`, ...args)
  },
  error: (message: string, ...args: unknown[]): void => {
    const callerInfo = getIsPackaged() ? '' : `${getCallerInfo()} `
    console.error(`[ERROR] ${callerInfo}${message}`, ...args)
  },
  debug: (message: string, ...args: unknown[]): void => {
    const callerInfo = getIsPackaged() ? '' : `${getCallerInfo()} `
    /* eslint-disable-next-line no-console */
    console.debug(`[DEBUG] ${callerInfo}${message}`, ...args)
  },
}

export default logger
