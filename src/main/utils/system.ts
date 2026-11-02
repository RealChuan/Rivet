import { app } from 'electron'
import os from 'node:os'

import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { logger } from './index.js'

/**
 * macOS 传统 vibrancy 的下限：`under-window` 材质自 10.14 起存在，
 * 这里取 Electron 45 支持的最低 macOS 版本（Ventura）作为部署下限。
 */
const MACOS_MIN_VIBRANCY_VERSION = 13
/**
 * 背景材质走 DWMWA_SYSTEMBACKDROP_TYPE，自 Windows 11 22H2（22621）才有，21H2 上会被 DWM 静默忽略。
 */
const WINDOWS_BACKDROP_BUILD = 22621

/**
 * 判断当前系统是否支持 macOS 原生毛玻璃（NSVisualEffectView vibrancy）。
 * macOS 13+ 呈现的是传统模糊材质，macOS 26+ 由系统升级为 Liquid Glass 外观。
 */
export function supportsVibrancy(): boolean {
  if (process.platform !== 'darwin') return false
  return parseInt(process.getSystemVersion()) >= MACOS_MIN_VIBRANCY_VERSION
}

/**
 * 判断当前系统是否支持 Windows 原生背景材质（Mica，build >= 22621）。
 */
export function supportsBackgroundMaterial(): boolean {
  if (process.platform !== 'win32') return false
  const parts = os.release().split('.')
  const build = parseInt(parts[2] ?? '0')
  return build >= WINDOWS_BACKDROP_BUILD
}

/** 是否有窗口级材质，渲染层据此决定主界面底色是否需要不透明 */
export function supportsGlassEffect(): boolean {
  return supportsVibrancy() || supportsBackgroundMaterial()
}

function getPathSafe(target: 'temp' | 'downloads', action: string): Result<string, ErrorInfo> {
  try {
    return ok(app.getPath(target))
  } catch (error) {
    logger.catch(error, { action })
    return err(
      createErrorInfo(ERROR_CODE.PATH_ERROR, `Failed to get ${target} directory`, String(error)),
    )
  }
}

export const getTempDir = () => getPathSafe('temp', 'getTempDir')
export const getDownloadDir = () => getPathSafe('downloads', 'getDownloadDir')
