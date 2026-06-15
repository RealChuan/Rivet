import { app } from 'electron'
import os from 'node:os'
import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { logger } from './index.js'

/**
 * 判断当前平台是否支持原生毛玻璃效果
 * - macOS 26+ (Liquid Glass)
 * - Windows 11+ (Mica/Acrylic, build >= 22000)
 * - 其他平台均不支持
 */
export function supportsGlassEffect(): boolean {
  const platform = process.platform
  if (platform === 'darwin') {
    const version = process.getSystemVersion()
    return parseInt(version) >= 26
  }
  if (platform === 'win32') {
    const parts = os.release().split('.')
    const build = parseInt(parts[2] ?? '0')
    return build >= 22000
  }
  return false
}

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
