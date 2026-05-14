import { ipcMain, type BrowserWindow } from 'electron'
import keytar from 'keytar'
import { ProtocolFactory } from '../services/protocol/factory.js'
import { sessionManager, type SessionHandle } from '../services/protocol/session-manager.js'
import { saveKnownHost, deleteKnownHost, transferControllers } from '../stores/index.js'
import { logger } from '../utils/index.js'
import { SERVICE_NAME, MAIN_WINDOW_ID } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { WindowManager } from '../app/window-factory.js'
import { type FileProtocol } from '../services/protocol/base.js'

function getMainWindow(): BrowserWindow | null {
  return WindowManager.get(MAIN_WINDOW_ID) ?? null
}

function getSessionAndProtocol(sessionId: string): {
  handle: SessionHandle<unknown>
  protocol: FileProtocol
} {
  const handle = sessionManager.get(sessionId, 'sftp') ?? sessionManager.get(sessionId, 'webdav')
  if (!handle) {
    throw new Error(`Connection not found: ${sessionId}`)
  }
  const protocol = ProtocolFactory.getProtocol(handle.protocolType)
  return { handle, protocol }
}

export function setupProtocolIpcHandlers(): void {
  ipcMain.handle('connect', async (_, config: ConnectionConfig) => {
    try {
      const password =
        config.password ??
        (await keytar.getPassword(SERVICE_NAME, `connection_${config.connectionUuid}`))

      if (!password) {
        throw new Error('Password is required for connection')
      }

      const fullConfig: ConnectionConfig = {
        ...config,
        password,
      }

      if (config.savePassword && password) {
        await keytar.setPassword(SERVICE_NAME, `connection_${config.connectionUuid}`, password)
      } else {
        await keytar.deletePassword(SERVICE_NAME, `connection_${config.connectionUuid}`)
      }

      const protocol = ProtocolFactory.getProtocol(config.protocol)
      const result = await protocol.connect(fullConfig)

      const { saveConnection } = await import('../stores/index.js')
      saveConnection(config)

      logger.info(`Connection established: ${config.name} (${config.connectionUuid})`)
      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Connection failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('disconnect', async (_, sessionId: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
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
      const { protocol } = getSessionAndProtocol(sessionId)
      return await protocol.list(sessionId, remotePath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`List directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('mkdir', async (_, sessionId: string, remotePath: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.mkdir(sessionId, remotePath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Create directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('rename', async (_, sessionId: string, file: FileInfo, newName: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.rename(sessionId, file, newName)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Rename failed: ${file.name} -> ${newName} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('delete', async (_, sessionId: string, files: FileInfo[]) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.delete(sessionId, files)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Delete failed - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('copy', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.copy(sessionId, file, targetPath)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`Copy failed: ${file.absolutePath} -> ${targetPath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle('move', async (_, sessionId: string, file: FileInfo, targetPath: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
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
        const { handle, protocol } = getSessionAndProtocol(sessionId)
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
        const { handle, protocol } = getSessionAndProtocol(sessionId)
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

  ipcMain.handle(
    'save-known-host',
    (_, record: { connectionUuid: string; fingerprint: string }) => {
      const result = saveKnownHost(record)
      if (!result.success) {
        throw new Error(`Failed to save known host: ${result.error}`)
      }
      logger.info(`Host key saved for connection: ${record.connectionUuid}`)
      return { success: true }
    }
  )

  ipcMain.handle('delete-known-host', (_, connectionUuid: string) => {
    const result = deleteKnownHost(connectionUuid)
    if (!result.success) {
      throw new Error(`Failed to delete known host: ${result.error}`)
    }
    logger.info(`Host key deleted for connection: ${connectionUuid}`)
    return { success: true }
  })
}
