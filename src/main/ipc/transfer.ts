import { ipcMain } from 'electron'
import type { TransferDirection } from '@shared/constants/index.js'
import type { LastDirKey } from '@shared/constants/index.js'
import type { TransferTask } from '@shared/types/transfer.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { transferService } from '../services/transfer/index.js'

export function setupTransferIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TRANSFER.ADD, (_, tasks: TransferTask[]) => {
    return transferService.addTasks(tasks)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.CANCEL, (_, taskId: string) => {
    transferService.cancel(taskId)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.CANCEL_ALL, (_, sessionId?: string) => {
    transferService.cancelAll(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.RETRY, (_, taskId: string) => {
    transferService.retry(taskId)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.RETRY_ALL, (_, sessionId?: string) => {
    transferService.retryAll(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.GET_TASKS, (_, sessionId?: string) => {
    return transferService.getTasks(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.GET_CONCURRENCY, (_, direction: TransferDirection) => {
    return transferService.getConcurrency(direction)
  })

  ipcMain.handle(
    IPC_CHANNELS.TRANSFER.SET_CONCURRENCY,
    (_, max: number, direction: TransferDirection) => {
      transferService.setConcurrency(max, direction)
    },
  )

  ipcMain.handle(IPC_CHANNELS.TRANSFER.CHECK_LOCAL_FILES, (_event, localDir: string) => {
    return transferService.checkLocalFiles(localDir)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.GET_LAST_DIR, (_, key: LastDirKey) => {
    return transferService.getLastDir(key)
  })

  ipcMain.handle(IPC_CHANNELS.TRANSFER.SET_LAST_DIR, (_, key: LastDirKey, dir: string) => {
    transferService.setLastDir(key, dir)
  })
}
