/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { ipcMain, BrowserWindow } from 'electron'

vi.mock('../app/window-factory.js', () => ({
  WindowManager: {
    create: vi.fn(),
    close: vi.fn(),
  },
}))

vi.mock('../utils/window-meta.js', () => ({
  getWindowMeta: vi.fn().mockReturnValue({ windowId: 'test-id', route: '/' }),
}))

describe('window IPC handlers', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
    vi.mocked(ipcMain.on).mockClear()
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue({
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMaximized: vi.fn(() => false),
      close: vi.fn(),
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should setup window handlers', async () => {
    const { setupWindowIpcHandlers } = await import('./window.js')
    setupWindowIpcHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW.GET_META, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW.GET_STATE, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.WINDOW.CREATE_CHILD,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.WINDOW.CLOSE_CHILD,
      expect.any(Function)
    )
    expect(ipcMain.on).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW.MINIMIZE, expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW.MAXIMIZE, expect.any(Function))
    expect(ipcMain.on).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW.CLOSE, expect.any(Function))
  })
})
