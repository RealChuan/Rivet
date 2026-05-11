import { ipcMain, type BrowserWindow } from 'electron'
import keytar from 'keytar'
import { ProtocolFactory } from '../services/protocol/factory.js'
import { sessionManager } from '../services/protocol/session-manager.js'
import { logger } from '../utils/index.js'
import { SERVICE_NAME, MAIN_WINDOW_ID } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { transferControllers } from '../stores/index.js'
import { WindowManager } from '../app/window-factory.js'

function getMainWindow(): BrowserWindow | null {
  return WindowManager.get(MAIN_WINDOW_ID) ?? null
}

export function setupProtocolIpcHandlers(): void {
  ipcMain.handle('connect', async (_, config: ConnectionConfig) => {
    try {
      if (config.password) {
        await keytar.setPassword(
          SERVICE_NAME,
          `connection_${config.connectionUuid}`,
          config.password
        )
      }

      const protocol = ProtocolFactory.getProtocol(config.protocol)
      const sessionId = await protocol.connect(config)

      const { saveConnection } = await import('../stores/index.js')
      saveConnection(config)

      logger.info(`Connection established: ${config.name} (${config.connectionUuid})`)
      return sessionId
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Connection failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('disconnect', async (_, sessionId: string) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        logger.warn(`Session not found for disconnect: ${sessionId}`)
        return
      }

      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      await protocol.disconnect(sessionId)
      logger.info(`Disconnected: ${sessionId}`)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Disconnect failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('list', async (_, sessionId: string, remotePath: string) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      return await protocol.list(sessionId, remotePath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`List directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('mkdir', async (_, sessionId: string, remotePath: string) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      await protocol.mkdir(sessionId, remotePath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Create directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('rename', async (_, sessionId: string, file: FileInfo, newName: string) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      await protocol.rename(sessionId, file, newName)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Rename failed: ${file.name} -> ${newName} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('delete', async (_, sessionId: string, files: FileInfo[]) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      await protocol.delete(sessionId, files)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Delete failed - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('copy', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      await protocol.copy(sessionId, file, targetPath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Copy failed: ${file.absolutePath} -> ${targetPath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('move', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const handle =
        sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
      if (!handle) {
        throw new Error(`Connection not found: ${sessionId}`)
      }
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      await protocol.move(sessionId, file, targetPath)
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
        const handle =
          sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
        if (!handle) {
          throw new Error(`Connection not found: ${sessionId}`)
        }

        const protocol = ProtocolFactory.getProtocol(handle.protocolType)
        const config = handle.config

        await protocol.uploadFile(
          sessionId,
          localPath,
          remotePath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                connectionUuid: config.connectionUuid,
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
        const handle =
          sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
        if (!handle) {
          throw new Error(`Connection not found: ${sessionId}`)
        }

        const protocol = ProtocolFactory.getProtocol(handle.protocolType)
        const config = handle.config

        await protocol.downloadFile(
          sessionId,
          file,
          localPath,
          (percent: number) => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send('transfer-progress', {
                transferId,
                connectionUuid: config.connectionUuid,
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
