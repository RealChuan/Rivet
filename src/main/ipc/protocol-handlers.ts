import { ipcMain, BrowserWindow } from 'electron'
import keytar from 'keytar'
import { ProtocolFactory } from '../services/protocol/factory.js'
import { logger } from '../utils/index.js'
import { SERVICE_NAME } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { activeConnections, transferControllers } from '../stores/index.js'

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? (windows[0] ?? null) : null
}

export function setupProtocolIpcHandlers(): void {
  ipcMain.handle('connect', async (_, config: ConnectionConfig) => {
    try {
      const fullConfig = config

      if (fullConfig.password) {
        await keytar.setPassword(
          SERVICE_NAME,
          `connection_${fullConfig.connectionUuid}`,
          fullConfig.password
        )
      }

      const protocolImpl = ProtocolFactory.getProtocol(fullConfig.protocol)
      const sessionId = await protocolImpl.connect(fullConfig)

      activeConnections.set(sessionId, {
        sessionId,
        config: fullConfig,
      })

      const { saveConnection } = await import('../stores/index.js')
      saveConnection(fullConfig)

      logger.info(`Connection established: ${fullConfig.name} (${fullConfig.connectionUuid})`)
      return sessionId
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Connection failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('disconnect', async (_, sessionId: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (handle) {
        const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
        await protocolImpl.disconnect(sessionId)
        activeConnections.delete(sessionId)
        logger.info(`Disconnected: ${sessionId}`)
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Disconnect failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('list', async (_, sessionId: string, remotePath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      return await protocolImpl.list(sessionId, remotePath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`List directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('mkdir', async (_, sessionId: string, remotePath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.mkdir(sessionId, remotePath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Create directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('rename', async (_, sessionId: string, file: FileInfo, newName: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.rename(sessionId, file, newName)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Rename failed: ${file.name} -> ${newName} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('delete', async (_, sessionId: string, files: FileInfo[]) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.delete(sessionId, files)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Delete failed - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('copy', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.copy(sessionId, file, targetPath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Copy failed: ${file.absolutePath} -> ${targetPath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('move', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle = activeConnections.get(sessionId)
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
      await protocolImpl.move(sessionId, file, targetPath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Move failed: ${file.absolutePath} -> ${targetPath} - ${errMsg}`)
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

        const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
        await protocolImpl.uploadFile(
          sessionId,
          localPath,
          remotePath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                connectionUuid: handle.config.connectionUuid,
                operation: 'upload' as const,
                path: remotePath,
                percent,
              })
            }
          },
          abortController.signal
        )

        transferControllers.delete(transferId)
        return { transferId, success: true }
      } catch (error) {
        transferControllers.delete(transferId)
        const errMsg = error instanceof Error ? error.message : String(error)
        logger.error(`Upload failed: ${localPath} -> ${remotePath} - ${errMsg}`)
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

        const protocolImpl = ProtocolFactory.getProtocol(handle.config.protocol)
        await protocolImpl.downloadFile(
          sessionId,
          file,
          localPath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                connectionUuid: handle.config.connectionUuid,
                operation: 'download',
                path: file.absolutePath,
                percent,
              })
            }
          },
          abortController.signal
        )

        transferControllers.delete(transferId)
        return { transferId, success: true }
      } catch (error) {
        transferControllers.delete(transferId)
        const errMsg = error instanceof Error ? error.message : String(error)
        logger.error(`Download failed: ${file.absolutePath} -> ${localPath} - ${errMsg}`)
        throw error
      }
    }
  )

  ipcMain.handle('cancel-transfer', (_, transferId: string) => {
    const controller = transferControllers.get(transferId)
    if (controller) {
      controller.abort()
      transferControllers.delete(transferId)
      logger.info(`Transfer cancelled: ${transferId}`)
    }
  })
}
