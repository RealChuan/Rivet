import { describe, expect, it } from 'vitest'
import { isWindowChromeMode } from '@shared/types/window-chrome.js'
import { getWindowChromeMode } from './window-chrome.js'

describe('getWindowChromeMode', () => {
  it('uses WCO on Windows 11', () => {
    expect(getWindowChromeMode('win32', '10.0.22631.0')).toBe('wco')
    expect(getWindowChromeMode('win32', '10.0.22000.1')).toBe('wco')
  })

  it('uses the custom titlebar on Windows 10 and Server 2022', () => {
    expect(getWindowChromeMode('win32', '10.0.19045.0')).toBe('custom')
    expect(getWindowChromeMode('win32', '10.0.20348.0')).toBe('custom')
  })

  it('uses mac-hidden on macOS and custom elsewhere', () => {
    expect(getWindowChromeMode('darwin', '24.0.0')).toBe('mac-hidden')
    expect(getWindowChromeMode('linux', '6.8.0')).toBe('custom')
  })

  it('guards runtime values', () => {
    expect(isWindowChromeMode('wco')).toBe(true)
    expect(isWindowChromeMode('custom')).toBe(true)
    expect(isWindowChromeMode('mac-hidden')).toBe(true)
    expect(isWindowChromeMode('windowed')).toBe(false)
    expect(isWindowChromeMode(null)).toBe(false)
  })
})
