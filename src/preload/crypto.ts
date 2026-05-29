import { ipcRenderer } from 'electron'
import type { ErrorInfo, Result } from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const cryptoAPI = {
  encryptPassword: (password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CRYPTO.ENCRYPT_PASSWORD, password) as Promise<
      Result<string, ErrorInfo>
    >,
  decryptPassword: (encrypted: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CRYPTO.DECRYPT_PASSWORD, encrypted) as Promise<
      Result<string, ErrorInfo>
    >,
}

export type CryptoAPI = typeof cryptoAPI
