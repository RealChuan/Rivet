import { ipcRenderer } from 'electron'
import type {
  FileInfo,
  ConnectionConfigWithoutPassword,
  ProgressEvent,
} from '@shared/types/index.js'
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
  delete: (sessionId: string, files: FileInfo[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.DELETE, sessionId, files),
  copy: (sessionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.COPY, sessionId, file, targetPath),
  move: (sessionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.MOVE, sessionId, file, targetPath),
  uploadFile: (sessionId: string, localPath: string, remotePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.UPLOAD_FILE, sessionId, localPath, remotePath),
  downloadFile: (sessionId: string, file: FileInfo, localPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.DOWNLOAD_FILE, sessionId, file, localPath),
  cancelTransfer: (transferId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROTOCOL.CANCEL_TRANSFER, transferId),
  onProgress: (callback: (event: ProgressEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: ProgressEvent) => callback(event)
    ipcRenderer.on(IPC_CHANNELS.EVENTS.TRANSFER_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENTS.TRANSFER_PROGRESS, handler)
  },
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
    ipcRenderer.on(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, handler)
  },
}

export type ProtocolAPI = typeof protocolAPI
