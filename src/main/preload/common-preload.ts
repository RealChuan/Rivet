import { ipcRenderer } from 'electron'

export const commonAPI = {
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store-delete', key),
  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('show-save-dialog', options),
  getSavedConnections: () => ipcRenderer.invoke('get-saved-connections'),
  deleteConnection: (connectionUuid: string) =>
    ipcRenderer.invoke('delete-connection', connectionUuid),
  getCredential: (connectionUuid: string) => ipcRenderer.invoke('get-credential', connectionUuid),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  getDownloadDir: () => ipcRenderer.invoke('get-download-dir'),
  getLastError: () => ipcRenderer.invoke('get-last-error'),
  saveKnownHost: (record: { connectionUuid: string; fingerprint: string }) =>
    ipcRenderer.invoke('save-known-host', record),
  deleteKnownHost: (connectionUuid: string) =>
    ipcRenderer.invoke('delete-known-host', connectionUuid),
}

export type CommonAPI = typeof commonAPI
