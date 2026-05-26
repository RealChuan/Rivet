import { app } from 'electron'
import { type Result, ok, err, type ErrorInfo, createErrorInfo } from '@shared/types/result.js'
import { logger } from './index.js'

export function getTempDir(): Result<string, ErrorInfo> {
  try {
    return ok(app.getPath('temp'))
  } catch (error) {
    logger.catch(error, { action: 'get-temp-dir' })
    return err(createErrorInfo('PATH_ERROR', 'Failed to get temp directory', String(error)))
  }
}

export function getDownloadDir(): Result<string, ErrorInfo> {
  try {
    return ok(app.getPath('downloads'))
  } catch (error) {
    logger.catch(error, { action: 'get-download-dir' })
    return err(createErrorInfo('PATH_ERROR', 'Failed to get download directory', String(error)))
  }
}
