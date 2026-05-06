import { isWindowChromeMode, type WindowChromeMode } from '@shared/types/window-chrome.js'

/** preload 同步注入的窗口 chrome 模式；测试环境没有 preload 时回退自绘标题栏。 */
export function getWindowChrome(): WindowChromeMode {
  const value = window.electronAPI?.env?.windowChrome
  return isWindowChromeMode(value) ? value : 'custom'
}
