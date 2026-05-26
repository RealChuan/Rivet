import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import type { Result, ErrorInfo } from '@shared/types/result.js'
import type { StoreKey } from '@shared/constants/config.js'

export const configAPI = {
  get: (key: StoreKey) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG.GET, key) as Promise<Result<unknown, ErrorInfo>>,
  set: (key: StoreKey, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG.SET, key, value) as Promise<Result<void, ErrorInfo>>,
}

export type ConfigAPI = typeof configAPI
