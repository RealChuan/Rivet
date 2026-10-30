import os from 'node:os'
import type { WindowChromeMode } from '@shared/types/window-chrome.js'

const WINDOWS_11_BUILD = 22000

/**
 * WCO 的独有收益（Snap Layouts）只在 Windows 11；Win10/Linux 保留自绘标题栏，
 * 只是不使用 WCO。macOS 的 hidden titlebar + 原生红绿灯不算 WCO。
 */
export function getWindowChromeMode(
  platform: NodeJS.Platform = process.platform,
  release: string = os.release(),
): WindowChromeMode {
  if (platform === 'darwin') return 'mac-hidden'
  if (platform !== 'win32') return 'custom'

  const build = Number(release.split('.')[2] ?? 0)
  return build >= WINDOWS_11_BUILD ? 'wco' : 'custom'
}
