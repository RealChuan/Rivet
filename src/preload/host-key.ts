import { ipcRenderer } from 'electron'
import type { ErrorInfo, Result } from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const hostKeyAPI = {
  save: (record: { connectionId: string; hash: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.HOST_KEY.SAVE, record) as Promise<Result<void, ErrorInfo>>,
  delete: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.HOST_KEY.DELETE, connectionId) as Promise<
      Result<void, ErrorInfo>
    >,
}
