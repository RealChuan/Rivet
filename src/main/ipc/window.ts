import { app, BrowserWindow, ipcMain } from 'electron'
import {
  DEFAULT_CHILD_WINDOW_HEIGHT,
  DEFAULT_CHILD_WINDOW_MIN_WIDTH,
} from '@shared/constants/app.js'
import { DEFAULT_ROUTE, IPC_CHANNELS } from '@shared/constants/index.js'
import { WindowManager } from '../app/window-factory.js'
import { getWindowMeta } from '../utils/window-meta.js'

export function setupWindowIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW.GET_META, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { windowId: 'unknown', route: DEFAULT_ROUTE }
    return getWindowMeta(win) ?? { windowId: 'unknown', route: DEFAULT_ROUTE }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.MINIMIZE, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.MAXIMIZE, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.CLOSE, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.GET_STATE, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return {
      isMaximized: win?.isMaximized() ?? false,
      platform: process.platform,
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.WINDOW.CREATE_CHILD,
    (
      _event,
      options: {
        id: string
        route: string
        width?: number
        height?: number
        title?: string
      }
    ) => {
      WindowManager.create({
        ...options,
        width: options.width ?? DEFAULT_CHILD_WINDOW_MIN_WIDTH,
        height: options.height ?? DEFAULT_CHILD_WINDOW_HEIGHT,
      })
      return options.id
    }
  )

  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE_CHILD, (_event, id: string) => {
    WindowManager.close(id)
    return true
  })
}
