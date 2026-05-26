import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import type { Result, ErrorInfo } from '@shared/types/result.js'

export const utilsAPI = {
  generateUuid: () => crypto.randomUUID(),
  encryptPassword: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UTILS.ENCRYPT_PASSWORD, password) as Promise<
      Result<string, ErrorInfo>
    >,
  decryptPassword: (encrypted: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UTILS.DECRYPT_PASSWORD, encrypted) as Promise<
      Result<string, ErrorInfo>
    >,
}

export type UtilsAPI = typeof utilsAPI
