import { ipcMain, app, BrowserWindow } from 'electron'
import keytar from 'keytar'
import logger from '../logger.js'

const SERVICE_NAME = 'RivetCredentials'

export function setupCommonIpcHandlers(): void {
  ipcMain.handle('store-get', async (_, key: string) => {
    const { getConfigValue } = await import('../store.js')
    return getConfigValue(key)
  })

  ipcMain.handle('store-set', async (_, key: string, value: unknown) => {
    const { setConfigValue } = await import('../store.js')
    setConfigValue(key, value)
  })

  ipcMain.handle('store-delete', async (_, key: string) => {
    const { setConfigValue, defaultUiSettings } = await import('../store.js')
    if (key === 'saved_connections') {
      setConfigValue(key, [])
    } else if (key === 'ui_settings') {
      setConfigValue(key, { ...defaultUiSettings })
    }
  })

  ipcMain.handle('get-saved-connections', async () => {
    const { getSavedConnections } = await import('../store.js')
    const connections = getSavedConnections()

    // 从 keytar 读取密码
    const connectionsWithPassword = await Promise.all(
      connections.map(async config => {
        try {
          const password = await keytar.getPassword(
            SERVICE_NAME,
            `connection_${config.connectionId}`
          )
          return { ...config, password: password || undefined }
        } catch {
          return { ...config, password: undefined }
        }
      })
    )

    return connectionsWithPassword
  })

  ipcMain.handle('delete-connection', async (_, connectionId: string) => {
    const { deleteConnection } = await import('../store.js')
    deleteConnection(connectionId)
    await keytar.deletePassword(SERVICE_NAME, `connection_${connectionId}`)
  })

  ipcMain.handle('get-credential', async (_, connectionId: string) => {
    return await keytar.getPassword(SERVICE_NAME, `connection_${connectionId}`)
  })

  ipcMain.handle('get-temp-dir', async () => {
    return app.getPath('temp')
  })

  ipcMain.handle('get-download-dir', async () => {
    return app.getPath('downloads')
  })

  ipcMain.handle('show-save-dialog', async (_, options: any) => {
    const { dialog } = await import('electron')
    const mainWindow =
      BrowserWindow.getAllWindows().find(w => w.isFocused()) || BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      return await dialog.showSaveDialog(mainWindow, options)
    }
    return null
  })

  ipcMain.handle('show-open-dialog', async (_, options: any) => {
    const { dialog } = await import('electron')
    const mainWindow =
      BrowserWindow.getAllWindows().find(w => w.isFocused()) || BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      return await dialog.showOpenDialog(mainWindow, options)
    }
    return null
  })

  ipcMain.handle('get-last-error', async () => {
    return null
  })

  logger.info('Common IPC handlers registered')
}
