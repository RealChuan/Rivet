import type { WindowChromeMode } from '@shared/types/window-chrome.js'
import { TITLEBAR_HEIGHT } from '@shared/constants/index.js'

export function titlebarPadding(mode: WindowChromeMode): number | string {
  if (mode === 'custom' || mode === 'mac-hidden') return TITLEBAR_HEIGHT
  // WCO 的 overlay 矩形会吞掉紧贴其边界的绘制，整体下移 1px 分割线才画得出来。
  return `calc(env(titlebar-area-height, ${TITLEBAR_HEIGHT}px) + 1px)`
}
