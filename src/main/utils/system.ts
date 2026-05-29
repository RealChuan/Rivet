import { app } from 'electron'
import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { logger } from './index.js'

export function getTempDir(): Result<string, ErrorInfo> {
  try {
    return ok(app.getPath('temp'))
  } catch (error) {
    logger.catch(error, { action: 'get-temp-dir' })
    return err(
      createErrorInfo(ERROR_CODE.PATH_ERROR, 'Failed to get temp directory', String(error))
    )
  }
}

export function getDownloadDir(): Result<string, ErrorInfo> {
  try {
    return ok(app.getPath('downloads'))
  } catch (error) {
    logger.catch(error, { action: 'get-download-dir' })
    return err(
      createErrorInfo(ERROR_CODE.PATH_ERROR, 'Failed to get download directory', String(error))
    )
  }
}
