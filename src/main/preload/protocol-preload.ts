import { ipcRenderer } from 'electron'
import type {
  FileInfo,
  ConnectionConfigWithoutPassword,
  ProgressEvent,
} from '@shared/types/index.js'

export const protocolAPI = {
  connect: (config: ConnectionConfigWithoutPassword & { password?: string }) =>
    ipcRenderer.invoke('connect', config),
  disconnect: (sessionId: string) => ipcRenderer.invoke('disconnect', sessionId),
  list: (sessionId: string, path: string) => ipcRenderer.invoke('list', sessionId, path),
  mkdir: (sessionId: string, path: string) => ipcRenderer.invoke('mkdir', sessionId, path),
  rename: (sessionId: string, file: FileInfo, newName: string) =>
    ipcRenderer.invoke('rename', sessionId, file, newName),
  delete: (sessionId: string, files: FileInfo[]) => ipcRenderer.invoke('delete', sessionId, files),
  copy: (sessionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke('copy', sessionId, file, targetPath),
  move: (sessionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke('move', sessionId, file, targetPath),
  uploadFile: (sessionId: string, localPath: string, remotePath: string) =>
    ipcRenderer.invoke('upload-file', sessionId, localPath, remotePath),
  downloadFile: (sessionId: string, file: FileInfo, localPath: string) =>
    ipcRenderer.invoke('download-file', sessionId, file, localPath),
  cancelTransfer: (transferId: string) => ipcRenderer.invoke('cancel-transfer', transferId),
  onProgress: (callback: (event: ProgressEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: ProgressEvent) => callback(event)
    ipcRenderer.on('transfer-progress', handler)
    return () => ipcRenderer.removeListener('transfer-progress', handler)
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
    ipcRenderer.on('session-disconnected', handler)
    return () => ipcRenderer.removeListener('session-disconnected', handler)
  },
}

export type ProtocolAPI = typeof protocolAPI
