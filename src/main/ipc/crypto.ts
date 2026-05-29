import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { decryptPassword, encryptPassword } from '../utils/encryption.js'

export function setupCryptoIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CRYPTO.ENCRYPT_PASSWORD, (_, password: string) => {
    return encryptPassword(password)
  })

  ipcMain.handle(IPC_CHANNELS.CRYPTO.DECRYPT_PASSWORD, (_, encrypted: string) => {
    return decryptPassword(encrypted)
  })
}
