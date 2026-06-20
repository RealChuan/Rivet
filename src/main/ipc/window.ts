import { app, ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { WindowManager } from '../app/window-factory.js'

export function setupWindowIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW.GET_META, (event) => {
    return WindowManager.getMeta(event.sender)
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.MINIMIZE, (event) => {
    WindowManager.minimize(event.sender)
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.MAXIMIZE, (event) => {
    WindowManager.maximize(event.sender)
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.CLOSE, (event) => {
    WindowManager.closeBySender(event.sender)
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.GET_STATE, (event) => {
    return WindowManager.getState(event.sender)
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
      },
    ) => {
      WindowManager.create(options)
      return options.id
    },
  )

  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE_CHILD, (_event, id: string) => {
    WindowManager.close(id)
    return true
  })
}
