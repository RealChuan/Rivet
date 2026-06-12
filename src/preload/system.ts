import { ipcRenderer } from 'electron'
import type { ErrorInfo, Result } from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const systemAPI = {
  getTempDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_TEMP_DIR) as Promise<Result<string, ErrorInfo>>,
  getDownloadDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_DOWNLOAD_DIR) as Promise<Result<string, ErrorInfo>>,
  generateUuid: () => crypto.randomUUID(),
}
