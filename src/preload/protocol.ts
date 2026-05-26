import { ipcRenderer } from 'electron'
import { listenerManager } from './listener-manager.js'
import type {
  FileInfo,
  ConnectionConfig,
  OperationResult,
  ProtocolResponse,
} from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const protocolAPI = {
  connect: (config: ConnectionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.CONNECT, config) as Promise<
      ProtocolResponse<OperationResult>
    >,
  disconnect: (sessionId: string, requestId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.DISCONNECT, sessionId, requestId) as Promise<
      ProtocolResponse<void>
    >,
  list: (sessionId: string, path: string, requestId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.LIST, sessionId, path, requestId) as Promise<
      ProtocolResponse<FileInfo[]>
    >,
  mkdir: (sessionId: string, path: string, requestId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.MKDIR, sessionId, path, requestId) as Promise<
      ProtocolResponse<void>
    >,
  rename: (sessionId: string, file: FileInfo, newName: string, requestId?: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.PROTOCOL.RENAME,
      sessionId,
      file,
      newName,
      requestId
    ) as Promise<ProtocolResponse<void>>,
  delete: (sessionId: string, file: FileInfo, requestId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.DELETE, sessionId, file, requestId) as Promise<
      ProtocolResponse<void>
    >,
  copy: (sessionId: string, file: FileInfo, targetPath: string, requestId?: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.PROTOCOL.COPY,
      sessionId,
      file,
      targetPath,
      requestId
    ) as Promise<ProtocolResponse<void>>,
  move: (sessionId: string, file: FileInfo, targetPath: string, requestId?: string) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.PROTOCOL.MOVE,
      sessionId,
      file,
      targetPath,
      requestId
    ) as Promise<ProtocolResponse<void>>,
  cancel: (requestId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.CANCEL, requestId),
  onSessionDisconnected: (
    callback: (event: {
      sessionId: string
      connectionId: string
      protocol: string
      name: string
    }) => void
  ): (() => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      event: { sessionId: string; connectionId: string; protocol: string; name: string }
    ) => callback(event)
    return listenerManager.on(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, handler)
  },
}

export type ProtocolAPI = typeof protocolAPI
