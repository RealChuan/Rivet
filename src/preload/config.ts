import { ipcRenderer } from 'electron'
import type { ErrorInfo, Result } from '@shared/types/index.js'
import { IPC_CHANNELS, type StoreKey } from '@shared/constants/index.js'

export const configAPI = {
  get: (key: StoreKey) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG.GET, key) as Promise<Result<unknown, ErrorInfo>>,
  set: (key: StoreKey, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG.SET, key, value) as Promise<Result<void, ErrorInfo>>,
}

export type ConfigAPI = typeof configAPI
