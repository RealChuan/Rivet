import { ipcRenderer } from 'electron'
import { listenerManager } from './listener-manager.js'
import type { FileInfo, ConnectionConfigWithoutPassword } from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const protocolAPI = {
  connect: (config: ConnectionConfigWithoutPassword & { password?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.CONNECT, config),
  disconnect: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.DISCONNECT, sessionId),
  list: (sessionId: string, path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.LIST, sessionId, path),
  mkdir: (sessionId: string, path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.MKDIR, sessionId, path),
  rename: (sessionId: string, file: FileInfo, newName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.RENAME, sessionId, file, newName),
  delete: (sessionId: string, file: FileInfo) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.DELETE, sessionId, file),
  copy: (sessionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.COPY, sessionId, file, targetPath),
  move: (sessionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.MOVE, sessionId, file, targetPath),
  onSessionDisconnected: (
    callback: (event: {
      sessionId: string
      connectionUuid: string
      protocol: string
      name: string
    }) => void
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      event: { sessionId: string; connectionUuid: string; protocol: string; name: string }
    ) => callback(event)
    return listenerManager.on(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, handler)
  },
}

export type ProtocolAPI = typeof protocolAPI
