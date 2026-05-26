import { describe, it, expect } from 'vitest'
import { registerWindowMeta, unregisterWindowMeta, getWindowMeta } from './window-meta.js'

describe('window-meta utilities', () => {
  it('should register window metadata', () => {
    const mockWindow = {} as unknown as Electron.BrowserWindow
    registerWindowMeta(mockWindow, 'win-1', '/home')

    const meta = getWindowMeta(mockWindow)
    expect(meta).toEqual({ windowId: 'win-1', route: '/home' })
  })

  it('should return undefined for unregistered window', () => {
    const mockWindow = {} as unknown as Electron.BrowserWindow
    const meta = getWindowMeta(mockWindow)
    expect(meta).toBeUndefined()
  })

  it('should unregister window metadata', () => {
    const mockWindow = {} as unknown as Electron.BrowserWindow
    registerWindowMeta(mockWindow, 'win-1', '/home')
    unregisterWindowMeta(mockWindow)

    const meta = getWindowMeta(mockWindow)
    expect(meta).toBeUndefined()
  })

  it('should handle multiple windows independently', () => {
    const mockWindow1 = {} as unknown as Electron.BrowserWindow
    const mockWindow2 = {} as unknown as Electron.BrowserWindow

    registerWindowMeta(mockWindow1, 'win-1', '/home')
    registerWindowMeta(mockWindow2, 'win-2', '/settings')

    expect(getWindowMeta(mockWindow1)).toEqual({ windowId: 'win-1', route: '/home' })
    expect(getWindowMeta(mockWindow2)).toEqual({ windowId: 'win-2', route: '/settings' })

    unregisterWindowMeta(mockWindow1)
    expect(getWindowMeta(mockWindow1)).toBeUndefined()
    expect(getWindowMeta(mockWindow2)).toEqual({ windowId: 'win-2', route: '/settings' })
  })
})
