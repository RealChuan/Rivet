import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import keytar from 'keytar'
import { logger } from '../utils/index.js'
import { SERVICE_NAME } from '@shared/constants/index.js'
import {
  getConfigValue,
  setConfigValue,
  getSavedConnections,
  deleteConnection,
  deleteKnownHost,
  defaultUiSettings,
} from '../stores/index.js'

export function setupCommonIpcHandlers(): void {
  ipcMain.handle('store-get', (_, key: string) => {
    return getConfigValue(key)
  })

  ipcMain.handle('store-set', (_, key: string, value: unknown) => {
    setConfigValue(key, value)
  })

  ipcMain.handle('store-delete', (_, key: string) => {
    if (key === 'saved_connections') {
      setConfigValue(key, [])
    } else if (key === 'ui_settings') {
      setConfigValue(key, { ...defaultUiSettings })
    }
  })

  ipcMain.handle('get-saved-connections', async () => {
    const connections = getSavedConnections()

    const connectionsWithPassword = await Promise.all(
      connections.map(async config => {
        try {
          const password = await keytar.getPassword(
            SERVICE_NAME,
            `connection_${config.connectionUuid}`
          )
          return { ...config, password: password ?? undefined }
        } catch {
          return { ...config, password: undefined }
        }
      })
    )

    return connectionsWithPassword
  })

  ipcMain.handle('delete-connection', async (_, connectionUuid: string) => {
    deleteConnection(connectionUuid)
    deleteKnownHost(connectionUuid)
    await keytar.deletePassword(SERVICE_NAME, `connection_${connectionUuid}`)
  })

  ipcMain.handle('get-credential', async (_, connectionUuid: string) => {
    return await keytar.getPassword(SERVICE_NAME, `connection_${connectionUuid}`)
  })

  ipcMain.handle('get-temp-dir', () => {
    return app.getPath('temp')
  })

  ipcMain.handle('get-download-dir', () => {
    return app.getPath('downloads')
  })

  ipcMain.handle('show-save-dialog', async (_, options: Electron.SaveDialogOptions) => {
    const mainWindow =
      BrowserWindow.getAllWindows().find(w => w.isFocused()) ?? BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      return await dialog.showSaveDialog(mainWindow, options)
    }
    return null
  })

  ipcMain.handle('show-open-dialog', async (_, options: Electron.OpenDialogOptions) => {
    const mainWindow =
      BrowserWindow.getAllWindows().find(w => w.isFocused()) ?? BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      return await dialog.showOpenDialog(mainWindow, options)
    }
    return null
  })

  ipcMain.handle('get-last-error', () => {
    return null
  })

  logger.info('Common IPC handlers registered')
}
