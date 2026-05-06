import type { WindowChromeMode } from '@shared/types/window-chrome.js'
import { TITLEBAR_HEIGHT } from '@shared/constants/index.js'

export function titlebarPadding(mode: WindowChromeMode): number | string {
  if (mode === 'custom' || mode === 'mac-hidden') return TITLEBAR_HEIGHT
  return 'env(titlebar-area-height, 36px)'
}
