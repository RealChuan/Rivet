/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Object.create(null) 造最小窗口桩 */
import { nativeTheme, type BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WindowChromeMode } from '@shared/types/window-chrome.js'
import { TITLEBAR_HEIGHT, TITLEBAR_OVERLAY_COLORS } from '@shared/constants/index.js'
import { applyWindowTheme } from './window-theme.js'

const mockGetMainWindow = vi.fn<() => BrowserWindow>(() => fakeWindow())
const mockGetWindowChromeMode = vi.fn<() => WindowChromeMode>(() => 'custom')
const mockSupportsVibrancy = vi.fn(() => true)
const mockSupportsBackgroundMaterial = vi.fn(() => true)

function setDark(value: boolean): void {
  Object.defineProperty(nativeTheme, 'shouldUseDarkColors', {
    value,
    writable: true,
    configurable: true,
  })
}

vi.mock('./main-window.js', () => ({
  getMainWindow: () => mockGetMainWindow(),
}))

vi.mock('./window-chrome.js', () => ({
  getWindowChromeMode: () => mockGetWindowChromeMode(),
}))

vi.mock('../utils/index.js', () => ({
  supportsVibrancy: () => mockSupportsVibrancy(),
  supportsBackgroundMaterial: () => mockSupportsBackgroundMaterial(),
}))

function fakeWindow(): BrowserWindow {
  const win: BrowserWindow = Object.create(null)
  win.setVibrancy = vi.fn()
  win.setTitleBarOverlay = vi.fn()
  win.setBackgroundMaterial = vi.fn()
  return win
}

describe('applyWindowTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeTheme.themeSource = 'system'
    setDark(false)
    mockGetWindowChromeMode.mockReturnValue('custom')
    mockGetMainWindow.mockReturnValue(fakeWindow())
    mockSupportsVibrancy.mockReturnValue(true)
    mockSupportsBackgroundMaterial.mockReturnValue(true)
  })

  it('sets only nativeTheme.themeSource in custom mode', () => {
    const win = mockGetMainWindow()
    applyWindowTheme('dark')

    expect(nativeTheme.themeSource).toBe('dark')
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled()
    expect(win.setBackgroundMaterial).not.toHaveBeenCalled()
    expect(win.setVibrancy).not.toHaveBeenCalled()
  })

  it('sets the light overlay and mica in wco mode', () => {
    mockGetWindowChromeMode.mockReturnValue('wco')
    const win = mockGetMainWindow()
    applyWindowTheme('light')

    expect(win.setTitleBarOverlay).toHaveBeenCalledWith({
      ...TITLEBAR_OVERLAY_COLORS.light,
      height: TITLEBAR_HEIGHT,
    })
    expect(win.setBackgroundMaterial).toHaveBeenCalledWith('mica')
  })

  it('uses dark overlay when the OS resolves dark', () => {
    mockGetWindowChromeMode.mockReturnValue('wco')
    setDark(true)
    const win = mockGetMainWindow()
    applyWindowTheme('system')

    expect(win.setTitleBarOverlay).toHaveBeenCalledWith({
      ...TITLEBAR_OVERLAY_COLORS.dark,
      height: TITLEBAR_HEIGHT,
    })
  })

  it('degrades mica to none when the background material is unsupported', () => {
    mockGetWindowChromeMode.mockReturnValue('wco')
    mockSupportsBackgroundMaterial.mockReturnValue(false)
    const win = mockGetMainWindow()
    applyWindowTheme('light')

    expect(win.setBackgroundMaterial).toHaveBeenCalledWith('none')
  })

  it('uses vibrancy and no overlay in mac-hidden mode', () => {
    mockGetWindowChromeMode.mockReturnValue('mac-hidden')
    const win = mockGetMainWindow()
    applyWindowTheme('light')

    expect(win.setVibrancy).toHaveBeenCalledWith('under-window')
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled()
    expect(win.setBackgroundMaterial).not.toHaveBeenCalled()
  })

  it('removes vibrancy when macOS does not support it', () => {
    mockGetWindowChromeMode.mockReturnValue('mac-hidden')
    mockSupportsVibrancy.mockReturnValue(false)
    const win = mockGetMainWindow()
    applyWindowTheme('light')

    expect(win.setVibrancy).toHaveBeenCalledWith(null)
  })
})
