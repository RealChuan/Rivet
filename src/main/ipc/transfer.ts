import { ipcMain } from 'electron'
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

  ipcMain.handle(IPC_CHANNELS.TRANSFER.SET_CONCURRENCY, (_, max: number) => {
    transferService.setConcurrency(max)
  })
}
