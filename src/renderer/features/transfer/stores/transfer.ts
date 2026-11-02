import { create } from 'zustand'
import type { TransferDirection } from '@shared/constants/transfer.js'
import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/transfer.js'
import {
  OPERATION_STATUS,
  TRANSFER_CONFIG,
  TRANSFER_DIRECTION,
  TRANSFER_SCOPE,
  type TransferScope,
} from '@shared/constants/index.js'
import { transferApi, transferEvents } from '../../../api/transfer.js'
import logger from '../../../utils/logger.js'
import { applyProgressBatch } from './transfer-progress-batch.js'

export function selectRunningTaskCount(state: TransferState): number {
  return state.tasks.filter(
    (t) => t.status === OPERATION_STATUS.RUNNING || t.status === OPERATION_STATUS.WAITING,
  ).length
}

/** Progress data separated from task list to avoid triggering list re-renders */
export interface TaskProgress {
  transferredSize: number
  speed?: number | undefined
  fileSize?: number | undefined
  totalFileCount?: number | undefined
  completedFileCount?: number | undefined
  activeFileCount?: number | undefined
  waitingFileCount?: number | undefined
  scanCompleted?: boolean | undefined
}

export interface TransferState {
  tasks: TransferTask[]
  taskProgress: Map<string, TaskProgress>
  activeOperations: Map<string, OperationProgressInfo[]>
  activeTab: TransferDirection
  scope: TransferScope
  maxUploadConcurrency: number
  maxDownloadConcurrency: number

  setActiveTab: (direction: TransferDirection) => void
  setScope: (scope: TransferScope) => void
  setMaxUploadConcurrency: (value: number) => void
  setMaxDownloadConcurrency: (value: number) => void

  handleTasksEnqueued: (tasks: TransferTask[]) => void
  handleProgress: (batch: TransferProgressData[]) => void
  handleTaskCompleted: (data: {
    taskId: string
    transferredSize?: number | undefined
    fileSize?: number | undefined
  }) => void
  handleTaskFailed: (data: { taskId: string; errorMessage: string }) => void
  handleTaskRemoved: (data: { taskId: string }) => void

  restoreActiveTasks: () => Promise<void>
  loadConcurrency: () => Promise<void>
  startListening: () => () => void
}

/**
 * Build a state updater that applies a progress batch.
 * Returns the original state reference when nothing changed so Zustand skips re-renders.
 */
function applyBatchToState(
  batch: TransferProgressData[],
): (state: TransferState) => TransferState | Partial<TransferState> {
  return (state) => applyProgressBatch(state, batch) ?? state
}

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  taskProgress: new Map(),
  activeOperations: new Map(),
  activeTab: TRANSFER_DIRECTION.UPLOAD,
  scope: TRANSFER_SCOPE.CURRENT,
  maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,

  setActiveTab: (direction) => {
    set({ activeTab: direction })
  },

  setScope: (scope) => {
    set({ scope })
  },

  setMaxUploadConcurrency: (value) => {
    set({ maxUploadConcurrency: value })
    void transferApi.setConcurrency(value, TRANSFER_DIRECTION.UPLOAD).catch((error) => {
      logger.catch(error, { action: 'set-concurrency', direction: TRANSFER_DIRECTION.UPLOAD })
    })
  },

  setMaxDownloadConcurrency: (value) => {
    set({ maxDownloadConcurrency: value })
    void transferApi.setConcurrency(value, TRANSFER_DIRECTION.DOWNLOAD).catch((error) => {
      logger.catch(error, { action: 'set-concurrency', direction: TRANSFER_DIRECTION.DOWNLOAD })
    })
  },

  handleTasksEnqueued: (tasks) => {
    set((state) => {
      const taskProgress = new Map(state.taskProgress)
      for (const task of tasks) {
        taskProgress.set(task.id, {
          transferredSize: task.transferredSize,
          fileSize: task.fileSize > 0 ? task.fileSize : undefined,
        })
      }
      return {
        tasks: [...state.tasks, ...tasks],
        taskProgress,
      }
    })
  },

  handleProgress: (batch) => {
    // 主进程已按 200ms 窗口聚合，渲染层只合并快照。
    set(applyBatchToState(batch))
  },

  handleTaskCompleted: (data) => {
    set((state) => {
      const tasks = state.tasks.filter((t) => t.id !== data.taskId)
      const taskProgress = new Map(state.taskProgress)
      taskProgress.delete(data.taskId)
      const activeOperations = new Map(state.activeOperations)
      activeOperations.delete(data.taskId)
      return { tasks, taskProgress, activeOperations }
    })
  },

  handleTaskFailed: (data) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === data.taskId
          ? { ...task, status: OPERATION_STATUS.FAILED, errorMessage: data.errorMessage }
          : task,
      ),
    }))
  },

  handleTaskRemoved: (data) => {
    set((state) => {
      const tasks = state.tasks.filter((t) => t.id !== data.taskId)
      const taskProgress = new Map(state.taskProgress)
      taskProgress.delete(data.taskId)
      const activeOperations = new Map(state.activeOperations)
      activeOperations.delete(data.taskId)
      return { tasks, taskProgress, activeOperations }
    })
  },

  /** 只接回仍在排队/运行的任务；失败任务是上次运行的残留，不恢复。 */
  restoreActiveTasks: async () => {
    let existingTasks: TransferTask[]
    try {
      existingTasks = await transferApi.getTasks()
    } catch (error) {
      logger.catch(error, { action: 'restore-active-tasks' })
      return
    }

    const activeTasks = existingTasks.filter(
      (task) =>
        task.status === OPERATION_STATUS.WAITING || task.status === OPERATION_STATUS.RUNNING,
    )
    if (activeTasks.length === 0) return

    set((state) => {
      const currentIds = new Set(state.tasks.map((t) => t.id))
      const newTasks = activeTasks.filter((t) => !currentIds.has(t.id))
      if (newTasks.length === 0) return state
      const taskProgress = new Map(state.taskProgress)
      for (const task of newTasks) {
        taskProgress.set(task.id, {
          transferredSize: task.transferredSize,
          fileSize: task.fileSize > 0 ? task.fileSize : undefined,
        })
      }
      return { tasks: [...state.tasks, ...newTasks], taskProgress }
    })
  },

  loadConcurrency: async () => {
    try {
      const [upload, download] = await Promise.all([
        transferApi.getConcurrency(TRANSFER_DIRECTION.UPLOAD),
        transferApi.getConcurrency(TRANSFER_DIRECTION.DOWNLOAD),
      ])
      set({ maxUploadConcurrency: upload, maxDownloadConcurrency: download })
    } catch (error) {
      logger.catch(error, { action: 'load-concurrency' })
    }
  },

  startListening: () => {
    const unsubs = [
      transferEvents.onTasksEnqueued((tasks) => get().handleTasksEnqueued(tasks)),
      transferEvents.onProgress((data) => get().handleProgress(data)),
      transferEvents.onTaskCompleted((data) => get().handleTaskCompleted(data)),
      transferEvents.onTaskFailed((data) => get().handleTaskFailed(data)),
      transferEvents.onTaskRemoved((data) => get().handleTaskRemoved(data)),
    ]
    return () => unsubs.forEach((fn) => fn())
  },
}))
