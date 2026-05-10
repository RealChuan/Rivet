import { ipcRenderer } from 'electron'
import type { FileInfo, ConnectionConfig, ProgressEvent } from '../../shared/types.js'

export const protocolAPI = {
  connect: (config: Omit<ConnectionConfig, 'connectionId'>) =>
    ipcRenderer.invoke('connect', config),
  disconnect: (connectionId: string) => ipcRenderer.invoke('disconnect', connectionId),
  list: (connectionId: string, path: string) => ipcRenderer.invoke('list', connectionId, path),
  mkdir: (connectionId: string, path: string) => ipcRenderer.invoke('mkdir', connectionId, path),
  rename: (connectionId: string, file: FileInfo, newName: string) =>
    ipcRenderer.invoke('rename', connectionId, file, newName),
  delete: (connectionId: string, files: FileInfo[]) =>
    ipcRenderer.invoke('delete', connectionId, files),
  copy: (connectionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke('copy', connectionId, file, targetPath),
  move: (connectionId: string, file: FileInfo, targetPath: string) =>
    ipcRenderer.invoke('move', connectionId, file, targetPath),
  uploadFile: (connectionId: string, localPath: string, remotePath: string) =>
    ipcRenderer.invoke('upload-file', connectionId, localPath, remotePath),
  downloadFile: (connectionId: string, file: FileInfo, localPath: string) =>
    ipcRenderer.invoke('download-file', connectionId, file, localPath),
  cancelTransfer: (transferId: string) => ipcRenderer.invoke('cancel-transfer', transferId),
  onProgress: (callback: (event: ProgressEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: ProgressEvent) => callback(event)
    ipcRenderer.on('transfer-progress', handler)
    return () => ipcRenderer.removeListener('transfer-progress', handler)
  },
}

export type ProtocolAPI = typeof protocolAPI
