import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { getDownloadDir, getTempDir, supportsGlassEffect } from '../utils/index.js'

export function setupSystemIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_TEMP_DIR, () => {
    return getTempDir()
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_DOWNLOAD_DIR, () => {
    return getDownloadDir()
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM.SUPPORTS_GLASS, () => {
    return supportsGlassEffect()
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM.GENERATE_UUID, () => {
    return crypto.randomUUID()
  })
}
