import type { LastDirKey, TransferDirection } from '@shared/constants/index.js'
import type { LocalFileInfo, TransferTask } from '@shared/types/index.js'
import { unwrap } from './result.js'

export const transferApi = {
  add: async (
    tasks: TransferTask[],
  ): Promise<{ added: TransferTask[]; duplicates: TransferTask[] }> =>
    unwrap(await window.electronAPI.transfer.add(tasks)),

  cancel: async (taskId: string): Promise<void> => {
    unwrap(await window.electronAPI.transfer.cancel(taskId))
  },

  cancelAll: async (sessionId?: string): Promise<void> => {
    unwrap(await window.electronAPI.transfer.cancelAll(sessionId))
  },

  retry: async (taskId: string): Promise<void> => {
    unwrap(await window.electronAPI.transfer.retry(taskId))
  },

  retryAll: async (sessionId?: string): Promise<void> => {
    unwrap(await window.electronAPI.transfer.retryAll(sessionId))
  },

  getTasks: async (sessionId?: string): Promise<TransferTask[]> =>
    unwrap(await window.electronAPI.transfer.getTasks(sessionId)),

  getConcurrency: async (direction: TransferDirection): Promise<number> =>
    unwrap(await window.electronAPI.transfer.getConcurrency(direction)),

  setConcurrency: async (value: number, direction: TransferDirection): Promise<void> => {
    unwrap(await window.electronAPI.transfer.setConcurrency(value, direction))
  },

  checkLocalFiles: async (localDir: string): Promise<LocalFileInfo[]> =>
    unwrap(await window.electronAPI.transfer.checkLocalFiles(localDir)),

  getLastDir: async (key: LastDirKey): Promise<string | null> =>
    unwrap(await window.electronAPI.transfer.getLastDir(key)),

  setLastDir: async (key: LastDirKey, dir: string): Promise<void> => {
    unwrap(await window.electronAPI.transfer.setLastDir(key, dir))
  },
}

type TransferEventApi = typeof window.electronAPI.transfer

export const transferEvents = {
  onTasksEnqueued: (callback: Parameters<TransferEventApi['onTasksEnqueued']>[0]) =>
    window.electronAPI.transfer.onTasksEnqueued(callback),
  onProgress: (callback: Parameters<TransferEventApi['onProgress']>[0]) =>
    window.electronAPI.transfer.onProgress(callback),
  onTaskCompleted: (callback: Parameters<TransferEventApi['onTaskCompleted']>[0]) =>
    window.electronAPI.transfer.onTaskCompleted(callback),
  onTaskFailed: (callback: Parameters<TransferEventApi['onTaskFailed']>[0]) =>
    window.electronAPI.transfer.onTaskFailed(callback),
  onTaskRemoved: (callback: Parameters<TransferEventApi['onTaskRemoved']>[0]) =>
    window.electronAPI.transfer.onTaskRemoved(callback),
}
