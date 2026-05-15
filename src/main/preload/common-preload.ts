import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const commonAPI = {
  storeGet: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMON.STORE_GET, key),
  storeSet: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.STORE_SET, key, value),
  storeDelete: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.COMMON.STORE_DELETE, key),
  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.SHOW_OPEN_DIALOG, options),
  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.SHOW_SAVE_DIALOG, options),
  getSavedConnections: () => ipcRenderer.invoke(IPC_CHANNELS.COMMON.GET_SAVED_CONNECTIONS),
  deleteConnection: (connectionUuid: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.DELETE_CONNECTION, connectionUuid),
  getCredential: (connectionUuid: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.GET_CREDENTIAL, connectionUuid),
  getTempDir: () => ipcRenderer.invoke(IPC_CHANNELS.COMMON.GET_TEMP_DIR),
  getDownloadDir: () => ipcRenderer.invoke(IPC_CHANNELS.COMMON.GET_DOWNLOAD_DIR),
  getIsPackaged: () => ipcRenderer.invoke(IPC_CHANNELS.COMMON.GET_IS_PACKAGED),
  saveKnownHost: (record: { connectionUuid: string; fingerprint: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.SAVE_KNOWN_HOST, record),
  deleteKnownHost: (connectionUuid: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.COMMON.DELETE_KNOWN_HOST, connectionUuid),
}

export type CommonAPI = typeof commonAPI
