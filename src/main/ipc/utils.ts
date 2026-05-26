import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { encryptPassword, decryptPassword } from '../utils/encryption.js'

export function setupUtilsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.UTILS.ENCRYPT_PASSWORD, (_, password: string) => {
    return encryptPassword(password)
  })

  ipcMain.handle(IPC_CHANNELS.UTILS.DECRYPT_PASSWORD, (_, encrypted: string) => {
    return decryptPassword(encrypted)
  })
}
