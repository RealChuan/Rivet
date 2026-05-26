import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import type { Result, ErrorInfo } from '@shared/types/result.js'

export const hostKeyAPI = {
  save: (record: { connectionId: string; hash: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.HOST_KEY.SAVE, record) as Promise<Result<void, ErrorInfo>>,
  delete: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.HOST_KEY.DELETE, connectionId) as Promise<
      Result<void, ErrorInfo>
    >,
}

export type HostKeyAPI = typeof hostKeyAPI
