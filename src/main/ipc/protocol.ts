import { ipcMain } from 'electron'
import { protocolService } from '../services/protocol/protocol-service.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'

export function setupProtocolIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROTOCOL.CONNECT, async (_, config: ConnectionConfig) => {
    return await protocolService.connect(config)
  })

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.DISCONNECT,
    async (_, sessionId: string, requestId?: string) => {
      return await protocolService.disconnect(sessionId, requestId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.LIST,
    async (_, sessionId: string, remotePath: string, requestId?: string) => {
      return await protocolService.list(sessionId, remotePath, requestId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MKDIR,
    async (_, sessionId: string, remotePath: string, requestId?: string) => {
      return await protocolService.mkdir(sessionId, remotePath, requestId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.RENAME,
    async (_, sessionId: string, file: FileInfo, newName: string, requestId?: string) => {
      return await protocolService.rename(sessionId, file, newName, requestId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.DELETE,
    async (_, sessionId: string, file: FileInfo, requestId?: string) => {
      return await protocolService.delete(sessionId, file, requestId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.COPY,
    async (_, sessionId: string, file: FileInfo, targetPath: string, requestId?: string) => {
      return await protocolService.copy(sessionId, file, targetPath, requestId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROTOCOL.MOVE,
    async (_, sessionId: string, file: FileInfo, targetPath: string, requestId?: string) => {
      return await protocolService.move(sessionId, file, targetPath, requestId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROTOCOL.CANCEL, (_, requestId: string) => {
    protocolService.cancel(requestId)
  })
}
