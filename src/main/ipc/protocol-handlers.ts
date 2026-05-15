import { ipcMain } from 'electron'
import keytar from 'keytar'
import { ProtocolFactory } from '../services/protocol/factory.js'
import { sessionManager, type SessionHandle } from '../services/protocol/session-manager.js'
import { saveConnection } from '../stores/index.js'
import { logger } from '../utils/index.js'
import { SERVICE_NAME, IPC_CHANNELS, SftpStatus } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { toErrorMessage } from '@shared/utils/index.js'
import { type FileProtocol } from '../services/protocol/base.js'

function getSessionAndProtocol(sessionId: string): {
  handle: SessionHandle<unknown>
  protocol: FileProtocol
} {
  const handle = sessionManager.get(sessionId)
  if (!handle) {
    throw new Error(`Connection not found: ${sessionId}`)
  }
  const protocol = ProtocolFactory.getProtocol(handle.protocolType)
  return { handle, protocol }
}

function createProtocolHandler<T extends unknown[]>(
  operation: string,
  handler: (...args: T) => Promise<unknown>
): (...args: T) => Promise<unknown> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      const errMsg = toErrorMessage(error)
      logger.error(`${operation} failed: ${errMsg}`)
      throw error
    }
  }
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

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.DISCONNECT,
    createProtocolHandler('Disconnect', async (_, sessionId: string) => {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.disconnect(sessionId)
      logger.info(`Disconnected: ${sessionId}`)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.LIST,
    createProtocolHandler('List directory', async (_, sessionId: string, remotePath: string) => {
      const { protocol } = getSessionAndProtocol(sessionId)
      return await protocol.list(sessionId, remotePath)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MKDIR,
    createProtocolHandler('Create directory', async (_, sessionId: string, remotePath: string) => {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.mkdir(sessionId, remotePath)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.RENAME,
    createProtocolHandler(
      'Rename',
      async (_, sessionId: string, file: FileInfo, newName: string) => {
        const { protocol } = getSessionAndProtocol(sessionId)
        await protocol.rename(sessionId, file, newName)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.DELETE,
    createProtocolHandler('Delete', async (_, sessionId: string, file: FileInfo) => {
      const { protocol } = getSessionAndProtocol(sessionId)
      await protocol.delete(sessionId, file)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.COPY,
    createProtocolHandler(
      'Copy',
      async (_, sessionId: string, file: FileInfo, targetPath: string) => {
        const { protocol } = getSessionAndProtocol(sessionId)
        await protocol.copy(sessionId, file, targetPath)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MOVE,
    createProtocolHandler(
      'Move',
      async (_, sessionId: string, file: FileInfo, targetPath: string) => {
        const { protocol } = getSessionAndProtocol(sessionId)
        await protocol.move(sessionId, file, targetPath)
      }
    )
  )
}
