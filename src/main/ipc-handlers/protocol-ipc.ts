import { ipcMain, BrowserWindow } from 'electron'
import keytar from 'keytar'
import { v4 as uuidv4 } from 'uuid'
import { ProtocolFactory } from '../protocols/ProtocolFactory.js'
import logger from '../utils/logger.js'
import { ConnectionConfig, FileInfo } from '../../shared/types.js'
import { activeConnections, transferControllers } from './index.js'

const SERVICE_NAME = 'RivetCredentials'

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

export function setupProtocolIpcHandlers(): void {
  ipcMain.handle(
    'connect',
    async (_, config: Omit<ConnectionConfig, 'connectionId'> & { connectionId?: string }) => {
      try {
        const connectionId = config.connectionId || uuidv4()
        const fullConfig: ConnectionConfig = {
          ...config,
          connectionId,
        } as ConnectionConfig

        if (fullConfig.password) {
          await keytar.setPassword(SERVICE_NAME, `connection_${connectionId}`, fullConfig.password)
        }

        const protocolImpl = ProtocolFactory.getProtocol(fullConfig.protocol)
        const internalSessionId = await protocolImpl.connect(fullConfig)

        activeConnections.set(connectionId, {
          sessionId: internalSessionId,
          config: fullConfig,
        })

        const { saveConnection } = await import('../utils/store.js')
        saveConnection(fullConfig)

        logger.info(`Connection established: ${fullConfig.name} (${connectionId})`)
        return connectionId
      } catch (error) {
        logger.error(`Connection failed: ${error}`)
        throw error
      }
    }
  )

  ipcMain.handle('disconnect', async (_, connectionId: string) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (handle) {
        const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
        await protocolImpl.disconnect(handle.sessionId)
        activeConnections.delete(connectionId)
        logger.info(`Disconnected: ${connectionId}`)
      }
    } catch (error) {
      logger.error(`Disconnect failed: ${error}`)
      throw error
    }
  })

  ipcMain.handle('list', async (_, connectionId: string, remotePath: string) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (!handle) {
        throw new Error(`Connection not found: ${connectionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      return await protocolImpl.list(handle.sessionId, remotePath)
    } catch (error) {
      logger.error(`List directory failed: ${remotePath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('mkdir', async (_, connectionId: string, remotePath: string) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (!handle) {
        throw new Error(`Connection not found: ${connectionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.mkdir(handle.sessionId, remotePath)
    } catch (error) {
      logger.error(`Create directory failed: ${remotePath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('rename', async (_, connectionId: string, file: FileInfo, newName: string) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (!handle) {
        throw new Error(`Connection not found: ${connectionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.rename(handle.sessionId, file, newName)
    } catch (error) {
      logger.error(`Rename failed: ${file.name} -> ${newName} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('delete', async (_, connectionId: string, files: FileInfo[]) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (!handle) {
        throw new Error(`Connection not found: ${connectionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.delete(handle.sessionId, files)
    } catch (error) {
      logger.error(`Delete failed - ${error}`)
      throw error
    }
  })

  ipcMain.handle('copy', async (_, connectionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (!handle) {
        throw new Error(`Connection not found: ${connectionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.copy(handle.sessionId, file, targetPath)
    } catch (error) {
      logger.error(`Copy failed: ${file.absolutePath} -> ${targetPath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle('move', async (_, connectionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle = activeConnections.get(connectionId)
      if (!handle) {
        throw new Error(`Connection not found: ${connectionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.move(handle.sessionId, file, targetPath)
    } catch (error) {
      logger.error(`Move failed: ${file.absolutePath} -> ${targetPath} - ${error}`)
      throw error
    }
  })

  ipcMain.handle(
    'upload-file',
    async (_, connectionId: string, localPath: string, remotePath: string) => {
      const transferId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const abortController = new AbortController()
      transferControllers.set(transferId, abortController)

      try {
        const handle = activeConnections.get(connectionId)
        if (!handle) {
          throw new Error(`Connection not found: ${connectionId}`)
        }

        const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
        await protocolImpl.uploadFile(
          handle.sessionId,
          localPath,
          remotePath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                connectionId,
                operation: 'upload',
                path: remotePath,
                percent,
              } as any)
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
    async (_, connectionId: string, file: FileInfo, localPath: string) => {
      const transferId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const abortController = new AbortController()
      transferControllers.set(transferId, abortController)

      try {
        const handle = activeConnections.get(connectionId)
        if (!handle) {
          throw new Error(`Connection not found: ${connectionId}`)
        }

        const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
        await protocolImpl.downloadFile(
          handle.sessionId,
          file,
          localPath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                connectionId,
                operation: 'download',
                path: file.absolutePath,
                percent,
              } as any)
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
}
