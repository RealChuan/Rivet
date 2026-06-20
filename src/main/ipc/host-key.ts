import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { removeHostKeyRecord, saveHostKeyRecord } from '../stores/known-hosts.js'

export function setupHostKeyIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.HOST_KEY.SAVE,
    (_, record: { connectionId: string; hash: string }) => {
      return saveHostKeyRecord(record)
    },
  )

  ipcMain.handle(IPC_CHANNELS.HOST_KEY.DELETE, (_, connectionId: string) => {
    return removeHostKeyRecord(connectionId)
  })
}
