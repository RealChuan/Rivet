import { contextBridge, ipcRenderer } from 'electron'
import type { FileInfo, ConnectionConfig } from '../shared/types.js'

interface ElectronAPI {
  connect: (config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    basePath?: string
  }) => Promise<string>
  disconnect: (sessionId: string) => Promise<void>
  list: (sessionId: string, path: string) => Promise<FileInfo[]>
  mkdir: (sessionId: string, path: string) => Promise<void>
  rename: (sessionId: string, file: FileInfo, newName: string) => Promise<void>
  delete: (sessionId: string, files: FileInfo[]) => Promise<void>
  copy: (sessionId: string, file: FileInfo, targetPath: string) => Promise<void>
  move: (sessionId: string, file: FileInfo, targetPath: string) => Promise<void>
  uploadFile: (
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ) => Promise<void>
  downloadFile: (
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ) => Promise<void>
  cancelTransfer: (transferId: string) => Promise<void>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  showOpenDialog: (options: any) => Promise<any>
  showSaveDialog: (options: any) => Promise<any>
  getSavedConnections: () => Promise<ConnectionConfig[]>
  deleteConnection: (id: string) => Promise<void>
  getCredential: (credentialId: string) => Promise<string | null>
  getTempDir: () => Promise<string>
  getDownloadDir: () => Promise<string>
  onProgress: (callback: (event: any) => void) => () => void
  getLastError: () => Promise<string | null>
}

const electronAPI: ElectronAPI = {
  connect: config => ipcRenderer.invoke('connect', config),
  disconnect: sessionId => ipcRenderer.invoke('disconnect', sessionId),
  list: (sessionId, path) => ipcRenderer.invoke('list', sessionId, path),
  mkdir: (sessionId, path) => ipcRenderer.invoke('mkdir', sessionId, path),
  rename: (sessionId, file, newName) => ipcRenderer.invoke('rename', sessionId, file, newName),
  delete: (sessionId, files) => ipcRenderer.invoke('delete', sessionId, files),
  copy: (sessionId, file, targetPath) => {
    return ipcRenderer.invoke('copy', sessionId, file, targetPath)
  },
  move: (sessionId, file, targetPath) => {
    return ipcRenderer.invoke('move', sessionId, file, targetPath)
  },
  uploadFile: (sessionId, localPath, remotePath, onProgress) =>
    ipcRenderer.invoke('upload-file', sessionId, localPath, remotePath, onProgress),
  downloadFile: (sessionId, file, localPath, onProgress) => {
    return ipcRenderer.invoke('download-file', sessionId, file, localPath, onProgress)
  },
  cancelTransfer: transferId => ipcRenderer.invoke('cancel-transfer', transferId),
  storeGet: key => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: key => ipcRenderer.invoke('store-delete', key),
  showOpenDialog: options => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: options => ipcRenderer.invoke('show-save-dialog', options),
  getSavedConnections: () => ipcRenderer.invoke('get-saved-connections'),
  deleteConnection: id => ipcRenderer.invoke('delete-connection', id),
  getCredential: credentialId => ipcRenderer.invoke('get-credential', credentialId),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  getDownloadDir: () => ipcRenderer.invoke('get-download-dir'),
  onProgress: callback => {
    const handler = (_: Electron.IpcRendererEvent, event: any) => callback(event)
    ipcRenderer.on('transfer-progress', handler)
    return () => {
      ipcRenderer.removeListener('transfer-progress', handler)
    }
  },
  getLastError: () => ipcRenderer.invoke('get-last-error'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
