import { ipcMain } from 'electron'
import keytar from 'keytar'
import { ProtocolFactory } from '../services/protocol/factory.js'
import { sessionManager, type SessionHandle } from '../services/protocol/session-manager.js'
import { saveConnection, saveKnownHost, deleteKnownHost } from '../stores/index.js'
import { logger } from '../utils/index.js'
import { SERVICE_NAME, ProtocolType, IPC_CHANNELS, SftpStatus } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { toErrorMessage } from '@shared/utils/index.js'
import { type FileProtocol } from '../services/protocol/base.js'

function getSessionAndProtocol(sessionId: string): {
  handle: SessionHandle<unknown>
  protocol: FileProtocol
} {
  const handle =
    sessionManager.get(sessionId, ProtocolType.SFTP) ??
    sessionManager.get(sessionId, ProtocolType.WEBDAV)
  if (!handle) {
    throw new Error(`Connection not found: ${sessionId}`)
  }
  const protocol = ProtocolFactory.getProtocol(handle.protocolType)
  return { handle, protocol }
}

export function setupProtocolIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROTOCOL.CONNECT, async (_, config: ConnectionConfig) => {
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

      if (result.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
        return result
      }

      if (!result.sessionId) {
        throw new Error('Connection failed: no session ID returned')
      }

      saveConnection(config)

      logger.info(`Connection established: ${config.name} (${config.connectionUuid})`)
      return result
    } catch (error) {
      const errMsg = toErrorMessage(error)
      logger.error(`Connection failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROTOCOL.DISCONNECT, async (_, sessionId: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.disconnect(sessionId)
      logger.info(`Disconnected: ${sessionId}`)
    } catch (error) {
      const errMsg = toErrorMessage(error)
      logger.error(`Disconnect failed: ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROTOCOL.LIST, async (_, sessionId: string, remotePath: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      return await protocol.list(sessionId, remotePath)
    } catch (error) {
      const errMsg = toErrorMessage(error)
      logger.error(`List directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROTOCOL.MKDIR, async (_, sessionId: string, remotePath: string) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.mkdir(sessionId, remotePath)
    } catch (error) {
      const errMsg = toErrorMessage(error)
      logger.error(`Create directory failed: ${remotePath} - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.RENAME,
    async (_, sessionId: string, file: FileInfo, newName: string) => {
      try {
        const { protocol } = getSessionAndProtocol(sessionId)
        await protocol.rename(sessionId, file, newName)
      } catch (error) {
        const errMsg = toErrorMessage(error)
        logger.error(`Rename failed: ${file.name} -> ${newName} - ${errMsg}`)
        throw error
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROTOCOL.DELETE, async (_, sessionId: string, file: FileInfo) => {
    try {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.delete(sessionId, file)
    } catch (error) {
      const errMsg = toErrorMessage(error)
      logger.error(`Delete failed - ${errMsg}`)
      throw error
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.COPY,
    async (_, sessionId: string, file: FileInfo, targetPath: string) => {
      try {
        const { protocol } = getSessionAndProtocol(sessionId)
        await protocol.copy(sessionId, file, targetPath)
      } catch (error) {
        const errMsg = toErrorMessage(error)
        logger.error(`Copy failed: ${file.absolutePath} -> ${targetPath} - ${errMsg}`)
        throw error
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MOVE,
    async (_, sessionId: string, file: FileInfo, targetPath: string) => {
      try {
        const { protocol } = getSessionAndProtocol(sessionId)
        await protocol.move(sessionId, file, targetPath)
      } catch (error) {
        const errMsg = toErrorMessage(error)
        logger.error(`Move failed: ${file.absolutePath} -> ${targetPath} - ${errMsg}`)
        throw error
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.SAVE_KNOWN_HOST,
    (_, record: { connectionUuid: string; fingerprint: string }) => {
      const result = saveKnownHost(record)
      if (!result.success) {
        throw new Error(`Failed to save known host: ${result.error}`)
      }
      logger.info(`Host key saved for connection: ${record.connectionUuid}`)
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROTOCOL.DELETE_KNOWN_HOST, (_, connectionUuid: string) => {
    const result = deleteKnownHost(connectionUuid)
    if (!result.success) {
      throw new Error(`Failed to delete known host: ${result.error}`)
    }
    logger.info(`Host key deleted for connection: ${connectionUuid}`)
    return { success: true }
  })
}
