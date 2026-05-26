import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { getTempDir, getDownloadDir } from '../utils/index.js'

export function setupSystemIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_TEMP_DIR, () => {
    return getTempDir()
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_DOWNLOAD_DIR, () => {
    return getDownloadDir()
  })
}
