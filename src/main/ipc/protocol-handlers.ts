import { ipcMain } from 'electron'
import keytar from 'keytar'
import { ProtocolService } from '../services/index.js'
import { saveConnection } from '../stores/index.js'
import { logger } from '../utils/index.js'
import { SERVICE_NAME, IPC_CHANNELS, SftpStatus } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { toErrorMessage } from '@shared/utils/index.js'

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

      const result = await ProtocolService.connect(fullConfig)

      if (result.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
        return result
      }

      saveConnection(config)

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
      await ProtocolService.disconnect(sessionId)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.LIST,
    createProtocolHandler('List directory', async (_, sessionId: string, remotePath: string) => {
      return await ProtocolService.list(sessionId, remotePath)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MKDIR,
    createProtocolHandler('Create directory', async (_, sessionId: string, remotePath: string) => {
      await ProtocolService.mkdir(sessionId, remotePath)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.RENAME,
    createProtocolHandler(
      'Rename',
      async (_, sessionId: string, file: FileInfo, newName: string) => {
        await ProtocolService.rename(sessionId, file, newName)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.DELETE,
    createProtocolHandler('Delete', async (_, sessionId: string, file: FileInfo) => {
      await ProtocolService.delete(sessionId, file)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.COPY,
    createProtocolHandler(
      'Copy',
      async (_, sessionId: string, file: FileInfo, targetPath: string) => {
        await ProtocolService.copy(sessionId, file, targetPath)
      }
    )
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MOVE,
    createProtocolHandler(
      'Move',
      async (_, sessionId: string, file: FileInfo, targetPath: string) => {
        await ProtocolService.move(sessionId, file, targetPath)
      }
    )
  )
}
