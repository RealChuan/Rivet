import { contextBridge, ipcRenderer } from 'electron'

interface ElectronAPI {
  connect: (config: any) => Promise<string>
  disconnect: (sessionId: string) => Promise<void>
  listDirectory: (sessionId: string, path: string) => Promise<any[]>
  createDirectory: (sessionId: string, path: string) => Promise<void>
  rename: (sessionId: string, oldPath: string, newPath: string) => Promise<void>
  delete: (sessionId: string, path: string) => Promise<void>
  uploadFile: (
    sessionId: string,
    localPath: string,
    remotePath: string,
    signal?: AbortSignal
  ) => Promise<{ transferId: string; success: boolean }>
  downloadFile: (
    sessionId: string,
    remotePath: string,
    localPath: string,
    signal?: AbortSignal
  ) => Promise<{ transferId: string; success: boolean }>
  cancelTransfer: (transferId: string) => Promise<void>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  onProgress: (callback: (event: any) => void) => () => void
  getLastError: () => Promise<string | null>
}

const electronAPI: ElectronAPI = {
  connect: config => ipcRenderer.invoke('connect', config),
  disconnect: sessionId => ipcRenderer.invoke('disconnect', sessionId),
  listDirectory: (sessionId, path) => ipcRenderer.invoke('listDirectory', sessionId, path),
  createDirectory: (sessionId, path) => ipcRenderer.invoke('createDirectory', sessionId, path),
  rename: (sessionId, oldPath, newPath) =>
    ipcRenderer.invoke('rename', sessionId, oldPath, newPath),
  delete: (sessionId, path) => ipcRenderer.invoke('delete', sessionId, path),
  uploadFile: (sessionId, localPath, remotePath) =>
    ipcRenderer.invoke('uploadFile', sessionId, localPath, remotePath),
  downloadFile: (sessionId, remotePath, localPath) =>
    ipcRenderer.invoke('downloadFile', sessionId, remotePath, localPath),
  cancelTransfer: transferId => ipcRenderer.invoke('cancelTransfer', transferId),
  storeGet: key => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: key => ipcRenderer.invoke('store-delete', key),
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
