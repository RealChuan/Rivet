import { ipcRenderer } from 'electron'
import type { LastDirKey, TransferDirection } from '@shared/constants/index.js'
import type {
  DeduplicateResult,
  LocalFileInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { listenerManager } from './listener-manager.js'

export const transferAPI = {
  add: (tasks: TransferTask[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.ADD, tasks) as Promise<DeduplicateResult>,

  cancel: (taskId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.CANCEL, taskId) as Promise<void>,

  cancelAll: (sessionId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.CANCEL_ALL, sessionId) as Promise<void>,

  retry: (taskId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.RETRY, taskId) as Promise<void>,

  retryAll: (sessionId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.RETRY_ALL, sessionId) as Promise<void>,

  getTasks: (sessionId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.GET_TASKS, sessionId) as Promise<TransferTask[]>,

  getConcurrency: (direction: TransferDirection) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.GET_CONCURRENCY, direction) as Promise<number>,

  setConcurrency: (max: number, direction: TransferDirection) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.SET_CONCURRENCY, max, direction) as Promise<void>,

  checkLocalFiles: (localDir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.CHECK_LOCAL_FILES, localDir) as Promise<
      LocalFileInfo[]
    >,

  getLastDir: (key: LastDirKey) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.GET_LAST_DIR, key) as Promise<string | null>,
  setLastDir: (key: LastDirKey, dir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TRANSFER.SET_LAST_DIR, key, dir) as Promise<void>,

  onTasksEnqueued: (callback: (tasks: TransferTask[]) => void) =>
    listenerManager.on(IPC_CHANNELS.TRANSFER.TASKS_ENQUEUED, (_, tasks: TransferTask[]) =>
      callback(tasks)
    ),

  onProgress: (callback: (data: TransferProgressData) => void) =>
    listenerManager.on(IPC_CHANNELS.TRANSFER.PROGRESS, (_, data: TransferProgressData) =>
      callback(data)
    ),

  onTaskCompleted: (
    callback: (data: { taskId: string; transferredSize?: number; fileSize?: number }) => void
  ) =>
    listenerManager.on(
      IPC_CHANNELS.TRANSFER.TASK_COMPLETED,
      (_, data: { taskId: string; transferredSize?: number; fileSize?: number }) => callback(data)
    ),

  onTaskFailed: (callback: (data: { taskId: string; errorMessage: string }) => void) =>
    listenerManager.on(
      IPC_CHANNELS.TRANSFER.TASK_FAILED,
      (_, data: { taskId: string; errorMessage: string }) => callback(data)
    ),

  onTaskRemoved: (callback: (data: { taskId: string }) => void) =>
    listenerManager.on(IPC_CHANNELS.TRANSFER.TASK_REMOVED, (_, data: { taskId: string }) =>
      callback(data)
    ),

  onHasActiveTasks: (callback: () => void) =>
    listenerManager.on(IPC_CHANNELS.TRANSFER.HAS_ACTIVE_TASKS, () => callback()),
}
