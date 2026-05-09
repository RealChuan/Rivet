import { ipcMain, BrowserWindow } from 'electron'
import keytar from 'keytar'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import { ProtocolFactory } from './protocols/ProtocolFactory.js'
import logger from './logger.js'
import { ConnectionConfig, FileInfo, ProgressEvent } from '../shared/types.js'

const SERVICE_NAME = 'RivetCredentials'
const activeConnections: Map<
  string,
  { sessionId: string; protocol: 'sftp' | 'webdav'; basePath?: string }
> = new Map()
const transferControllers: Map<string, AbortController> = new Map()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

export function setupIpcHandlers(): void {
  ipcMain.handle(
    'connect',
    async (
      _,
      config: Omit<ConnectionConfig, 'id' | 'credentialId'> & {
        password?: string
        privateKey?: string
      }
    ) => {
      try {
        const credentialId = uuidv4()

        if (config.password) {
          await keytar.setPassword(SERVICE_NAME, `connection_${credentialId}`, config.password)
        } else if (config.privateKey) {
          await keytar.setPassword(SERVICE_NAME, `connection_${credentialId}`, config.privateKey)
        }

        const protocolImpl = ProtocolFactory.getProtocol(config.protocol)
        const sessionId = await protocolImpl.connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          privateKey: config.privateKey,
          basePath: config.basePath,
        })

        const connectionConfig: ConnectionConfig = {
          id: credentialId,
          name: config.name || `${config.protocol}://${config.host}`,
          protocol: config.protocol,
          host: config.host,
          port: config.port,
          username: config.username,
          credentialId,
          basePath: config.basePath,
        }

        activeConnections.set(credentialId, {
          sessionId,
          protocol: config.protocol,
          basePath: config.basePath,
        })

        // 保存连接到 store
        const { saveConnection } = await import('./store.js')
        saveConnection(connectionConfig)

        logger.info(`Connection established: ${connectionConfig.name} (${credentialId})`)
        return credentialId
      } catch (error) {
        logger.error(`Connection failed: ${error}`)
        throw error
      }
    }
  )

  ipcMain.handle('disconnect', async (_, sessionId: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (handle) {
        const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
        await protocolImpl.disconnect(handle.sessionId)
        activeConnections.delete(sessionId)
        logger.info(`Disconnected: ${sessionId}`)
      }
    } catch (error) {
      logger.error(`Disconnect failed: ${error}`)
      throw error
    }
  })

  ipcMain.handle('list', async (_, sessionId: string, remotePath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
      return await protocolImpl.list(handle.sessionId, remotePath)
    } catch (error) {
      logger.error(`List directory failed: ${remotePath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('mkdir', async (_, sessionId: string, remotePath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
      await protocolImpl.mkdir(handle.sessionId, remotePath)
    } catch (error) {
      logger.error(`Create directory failed: ${remotePath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('rename', async (_, sessionId: string, file: FileInfo, newName: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
      await protocolImpl.rename(handle.sessionId, file, newName)
    } catch (error) {
      logger.error(`Rename failed: ${file.name} -> ${newName} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('delete', async (_, sessionId: string, files: FileInfo[]) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
      await protocolImpl.delete(handle.sessionId, files)
    } catch (error) {
      logger.error(`Delete failed - ${error}`)
      throw error
    }
  })

  ipcMain.handle('copy', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
      await protocolImpl.copy(handle.sessionId, file, targetPath)
    } catch (error) {
      logger.error(`Copy failed: ${file.absolutePath} -> ${targetPath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('move', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
      await protocolImpl.move(handle.sessionId, file, targetPath)
    } catch (error) {
      logger.error(`Move failed: ${file.absolutePath} -> ${targetPath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle(
    'upload-file',
    async (_, sessionId: string, localPath: string, remotePath: string) => {
      const transferId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const abortController = new AbortController()
      transferControllers.set(transferId, abortController)

      try {
        const handle = activeConnections.get(sessionId)
        if (!handle) {
          throw new Error(`Connection not found: ${sessionId}`)
        }

        const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
        await protocolImpl.uploadFile(
          handle.sessionId,
          localPath,
          remotePath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                sessionId,
                operation: 'upload',
                path: remotePath,
                percent,
              } as ProgressEvent)
            }
          },
          abortController.signal
        )

        transferControllers.delete(transferId)
        return { transferId, success: true }
      } catch (error) {
        transferControllers.delete(transferId)
        logger.error(`Upload failed: ${localPath} -> ${remotePath} - ${error}`)
        throw error
      }
    }
  )

  ipcMain.handle(
    'download-file',
    async (_, sessionId: string, file: FileInfo, localPath: string) => {
      const transferId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const abortController = new AbortController()
      transferControllers.set(transferId, abortController)

      try {
        const handle = activeConnections.get(sessionId)
        if (!handle) {
          throw new Error(`Connection not found: ${sessionId}`)
        }

        const protocolImpl = ProtocolFactory.getProtocol(handle.protocol)
        await protocolImpl.downloadFile(
          handle.sessionId,
          file,
          localPath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                sessionId,
                operation: 'download',
                path: file.absolutePath,
                percent,
              } as ProgressEvent)
            }
          },
          abortController.signal
        )

        transferControllers.delete(transferId)
        return { transferId, success: true }
      } catch (error) {
        transferControllers.delete(transferId)
        logger.error(`Download failed: ${file.absolutePath} -> ${localPath} - ${error}`)
        throw error
      }
    }
  )

  ipcMain.handle('cancel-transfer', async (_, transferId: string) => {
    const controller = transferControllers.get(transferId)
    if (controller) {
      controller.abort()
      transferControllers.delete(transferId)
      logger.info(`Transfer cancelled: ${transferId}`)
    }
  })

  ipcMain.handle('store-get', async (_, key: string) => {
    const { getConfigValue } = await import('./store.js')
    return getConfigValue(key)
  })

  ipcMain.handle('store-set', async (_, key: string, value: unknown) => {
    const { setConfigValue } = await import('./store.js')
    setConfigValue(key, value)
  })

  ipcMain.handle('store-delete', async (_, key: string) => {
    const { setConfigValue, defaultUiSettings } = await import('./store.js')
    if (key === 'saved_connections') {
      setConfigValue(key, [])
    } else if (key === 'ui_settings') {
      setConfigValue(key, { ...defaultUiSettings })
    }
  })

  ipcMain.handle('get-saved-connections', async () => {
    const { getSavedConnections } = await import('./store.js')
    return getSavedConnections()
  })

  ipcMain.handle('delete-connection', async (_, id: string) => {
    const { deleteConnection } = await import('./store.js')
    deleteConnection(id)
    await keytar.deletePassword(SERVICE_NAME, `connection_${id}`)
  })

  ipcMain.handle('get-credential', async (_, credentialId: string) => {
    return await keytar.getPassword(SERVICE_NAME, `connection_${credentialId}`)
  })

  ipcMain.handle('get-temp-dir', async () => {
    return app.getPath('temp')
  })

  ipcMain.handle('get-download-dir', async () => {
    return app.getPath('downloads')
  })

  ipcMain.handle('show-save-dialog', async (_, options: any) => {
    const { dialog } = await import('electron')
    const mainWindow = getMainWindow()
    if (mainWindow) {
      return await dialog.showSaveDialog(mainWindow, options)
    }
    return null
  })

  ipcMain.handle('show-open-dialog', async (_, options: any) => {
    const { dialog } = await import('electron')
    const mainWindow = getMainWindow()
    if (mainWindow) {
      return await dialog.showOpenDialog(mainWindow, options)
    }
    return null
  })

  logger.info('IPC handlers registered')
}

export { activeConnections, transferControllers }
