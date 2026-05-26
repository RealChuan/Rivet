import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import type { Result, ErrorInfo } from '@shared/types/index.js'

export const systemAPI = {
  getTempDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_TEMP_DIR) as Promise<Result<string, ErrorInfo>>,
  getDownloadDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_DOWNLOAD_DIR) as Promise<Result<string, ErrorInfo>>,
}

export type SystemAPI = typeof systemAPI
