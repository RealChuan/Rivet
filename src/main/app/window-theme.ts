import { nativeTheme } from 'electron'
import { TITLEBAR_HEIGHT, TITLEBAR_OVERLAY_COLORS, type Theme } from '@shared/constants/index.js'
import { supportsGlassEffect } from '../utils/index.js'
import { getMainWindow } from './main-window.js'
import { getWindowChromeMode } from './window-chrome.js'

let systemThemeListenerAttached = false

export function applyWindowTheme(theme: Theme): void {
  nativeTheme.themeSource = theme

  const win = getMainWindow()
  if (!win) return

  const mode = getWindowChromeMode()
  if (mode === 'custom') return

  if (mode === 'mac-hidden') {
    win.setVibrancy(supportsGlassEffect() ? 'under-window' : null)
    return
  }

  const colors = nativeTheme.shouldUseDarkColors
    ? TITLEBAR_OVERLAY_COLORS.dark
    : TITLEBAR_OVERLAY_COLORS.light
  win.setTitleBarOverlay({ ...colors, height: TITLEBAR_HEIGHT })
  win.setBackgroundMaterial(supportsGlassEffect() ? 'acrylic' : 'none')
}

export function attachSystemThemeListener(): void {
  if (systemThemeListenerAttached) return
  systemThemeListenerAttached = true
  nativeTheme.on('updated', () => {
    if (nativeTheme.themeSource === 'system') {
      applyWindowTheme('system')
    }
  })
}
