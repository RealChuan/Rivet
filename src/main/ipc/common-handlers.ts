import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import keytar from 'keytar'
import { logger } from '../utils/index.js'
import { SERVICE_NAME, IPC_CHANNELS } from '@shared/constants/index.js'
import {
  getConfigValue,
  setConfigValue,
  getSavedConnections,
  deleteConnection,
  deleteKnownHost,
  saveKnownHost,
  defaultUiSettings,
} from '../stores/index.js'

export function setupCommonIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.COMMON.STORE_GET, (_, key: string) => {
    return getConfigValue(key)
  })

  ipcMain.handle(IPC_CHANNELS.COMMON.STORE_SET, (_, key: string, value: unknown) => {
    setConfigValue(key, value)
  })

  ipcMain.handle(IPC_CHANNELS.COMMON.STORE_DELETE, (_, key: string) => {
    if (key === 'saved_connections') {
      setConfigValue(key, [])
    } else if (key === 'ui_settings') {
      setConfigValue(key, { ...defaultUiSettings })
    }
  })

  ipcMain.handle(IPC_CHANNELS.COMMON.GET_SAVED_CONNECTIONS, async () => {
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

  ipcMain.handle(IPC_CHANNELS.COMMON.DELETE_CONNECTION, async (_, connectionUuid: string) => {
    deleteConnection(connectionUuid)
    deleteKnownHost(connectionUuid)
    await keytar.deletePassword(SERVICE_NAME, `connection_${connectionUuid}`)
  })

  ipcMain.handle(IPC_CHANNELS.COMMON.GET_CREDENTIAL, async (_, connectionUuid: string) => {
    return await keytar.getPassword(SERVICE_NAME, `connection_${connectionUuid}`)
  })

  ipcMain.handle(IPC_CHANNELS.COMMON.GET_TEMP_DIR, () => {
    return app.getPath('temp')
  })

  ipcMain.handle(IPC_CHANNELS.COMMON.GET_DOWNLOAD_DIR, () => {
    return app.getPath('downloads')
  })

  ipcMain.handle(
    IPC_CHANNELS.COMMON.SHOW_SAVE_DIALOG,
    async (_, options: Electron.SaveDialogOptions) => {
      const mainWindow =
        BrowserWindow.getAllWindows().find(w => w.isFocused()) ?? BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        return await dialog.showSaveDialog(mainWindow, options)
      }
      return null
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.COMMON.SHOW_OPEN_DIALOG,
    async (_, options: Electron.OpenDialogOptions) => {
      const mainWindow =
        BrowserWindow.getAllWindows().find(w => w.isFocused()) ?? BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        return await dialog.showOpenDialog(mainWindow, options)
      }
      return null
    }
  )

  ipcMain.handle(IPC_CHANNELS.COMMON.GET_IS_PACKAGED, () => {
    return app.isPackaged
  })

  ipcMain.handle(
    IPC_CHANNELS.COMMON.SAVE_KNOWN_HOST,
    (_, record: { connectionUuid: string; fingerprint: string }) => {
      const result = saveKnownHost(record)
      if (!result.success) {
        throw new Error(`Failed to save known host: ${result.error}`)
      }
      logger.info(`Host key saved for connection: ${record.connectionUuid}`)
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.COMMON.DELETE_KNOWN_HOST, (_, connectionUuid: string) => {
    const result = deleteKnownHost(connectionUuid)
    if (!result.success) {
      throw new Error(`Failed to delete known host: ${result.error}`)
    }
    logger.info(`Host key deleted for connection: ${connectionUuid}`)
    return { success: true }
  })

  logger.info('Common IPC handlers registered')
}
