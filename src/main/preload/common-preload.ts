import { ipcRenderer } from 'electron'

export const commonAPI = {
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store-delete', key),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  getSavedConnections: () => ipcRenderer.invoke('get-saved-connections'),
  deleteConnection: (connectionId: string) => ipcRenderer.invoke('delete-connection', connectionId),
  getCredential: (connectionId: string) => ipcRenderer.invoke('get-credential', connectionId),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  getDownloadDir: () => ipcRenderer.invoke('get-download-dir'),
  getLastError: () => ipcRenderer.invoke('get-last-error'),
}

export type CommonAPI = typeof commonAPI
