/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Object.create(null) 造最小窗口桩 */
/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMainWindow, sendToMainWindow, setMainWindow } from './main-window.js'

function fakeWindow(destroyed = false): BrowserWindow {
  const win: BrowserWindow = Object.create(null)
  win.isDestroyed = () => destroyed
  Object.defineProperty(win, 'webContents', { value: { send: vi.fn() } })
  return win
}

describe('main-window', () => {
  beforeEach(() => {
    setMainWindow(null)
  })

  it('sends to the live main window', () => {
    const win = fakeWindow()
    setMainWindow(win)

    sendToMainWindow('transfer.progress', [])

    expect(win.webContents.send).toHaveBeenCalledWith('transfer.progress', [])
  })

  it('drops messages when the window is destroyed or cleared', () => {
    const destroyed = fakeWindow(true)
    setMainWindow(destroyed)
    expect(() => sendToMainWindow('transfer.progress', [])).not.toThrow()

    setMainWindow(null)
    expect(() => sendToMainWindow('transfer.progress', [])).not.toThrow()
    expect(destroyed.webContents.send).not.toHaveBeenCalled()
  })

  it('returns undefined after the window is destroyed', () => {
    setMainWindow(fakeWindow(true))
    expect(getMainWindow()).toBeUndefined()
  })
})
