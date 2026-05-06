import { create } from 'zustand'
import type { TransferDirection } from '@shared/constants/transfer.js'
import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/transfer.js'
import { OPERATION_STATUS, TRANSFER_CONFIG, TRANSFER_DIRECTION } from '@shared/constants/index.js'
import { transferApi, transferEvents } from '../../../api/transfer.js'
import logger from '../../../utils/logger.js'
import { applyProgressBatch } from './transfer-progress-batch.js'

export interface SessionTaskSummary {
  sessionId: string
  running: number
  failed: number
  total: number
}

function computeSessionSummaries(tasks: TransferTask[]): SessionTaskSummary[] {
  const map = new Map<string, SessionTaskSummary>()
  for (const task of tasks) {
    const existing = map.get(task.sessionId)
    if (existing) {
      existing.total++
      if (task.status === OPERATION_STATUS.RUNNING || task.status === OPERATION_STATUS.WAITING) {
        existing.running++
      }
      if (task.status === OPERATION_STATUS.FAILED) {
        existing.failed++
      }
    } else {
      map.set(task.sessionId, {
        sessionId: task.sessionId,
        running:
          task.status === OPERATION_STATUS.RUNNING || task.status === OPERATION_STATUS.WAITING
            ? 1
            : 0,
        failed: task.status === OPERATION_STATUS.FAILED ? 1 : 0,
        total: 1,
      })
    }
  }
  return [...map.values()]
}

function computeSessionIds(tasks: TransferTask[]): string[] {
  return [...new Set(tasks.map((t) => t.sessionId))]
}

const summaryCache = new WeakMap<TransferTask[], SessionTaskSummary[]>()
const sessionIdsCache = new WeakMap<TransferTask[], string[]>()

/** 派生值不入 state：同一 tasks 引用返回同一数组引用，避免无谓重渲染。 */
export function selectSessionTaskSummaries(state: TransferState): SessionTaskSummary[] {
  const cached = summaryCache.get(state.tasks)
  if (cached) return cached
  const computed = computeSessionSummaries(state.tasks)
  summaryCache.set(state.tasks, computed)
  return computed
}

export function selectSessionIds(state: TransferState): string[] {
  const cached = sessionIdsCache.get(state.tasks)
  if (cached) return cached
  const computed = computeSessionIds(state.tasks)
  sessionIdsCache.set(state.tasks, computed)
  return computed
}

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
}

export interface TransferState {
  tasks: TransferTask[]
  taskProgress: Map<string, TaskProgress>
  selectedSessionId: string | null
  activeOperations: Map<string, OperationProgressInfo[]>
  isVisible: boolean
  activeTab: TransferDirection
  maxUploadConcurrency: number
  maxDownloadConcurrency: number

  setSelectedSessionId: (sessionId: string | null) => void
  setVisible: (visible: boolean) => void
  setActiveTab: (direction: TransferDirection) => void
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

  loadExistingTasks: () => Promise<void>
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
  return (state) => {
    const result = applyProgressBatch(state, batch)
    if (result === null) return state
    return result
  }
}

/** 不可见时暂存主进程发来的批次，重新可见时一次性应用。 */
let hiddenProgress: TransferProgressData[] = []

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  taskProgress: new Map(),
  selectedSessionId: null,
  activeTab: TRANSFER_DIRECTION.UPLOAD,
  activeOperations: new Map(),
  isVisible: true,
  maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,

  setActiveTab: (direction) => {
    set({ activeTab: direction })
  },

  setSelectedSessionId: (sessionId) => {
    set({ selectedSessionId: sessionId })
  },

  setVisible: (visible) => {
    set({ isVisible: visible })
    if (visible && hiddenProgress.length > 0) {
      const batch = hiddenProgress
      hiddenProgress = []
      useTransferStore.setState(applyBatchToState(batch))
    }
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
      const updatedTasks = [...state.tasks, ...tasks]
      const selectedSessionId = state.selectedSessionId ?? tasks[0]?.sessionId ?? null
      const taskProgress = new Map(state.taskProgress)
      for (const task of tasks) {
        taskProgress.set(task.id, {
          transferredSize: task.transferredSize,
          fileSize: task.fileSize > 0 ? task.fileSize : undefined,
        })
      }
      return {
        tasks: updatedTasks,
        taskProgress,
        selectedSessionId,
      }
    })
  },

  handleProgress: (batch) => {
    // 主进程已按 200ms 窗口聚合；不可见时只暂存，避免隐藏页重渲染。
    if (!get().isVisible) {
      hiddenProgress.push(...batch)
      return
    }

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

  loadExistingTasks: async () => {
    let existingTasks: TransferTask[]
    try {
      existingTasks = await transferApi.getTasks()
    } catch (error) {
      logger.catch(error, { action: 'load-existing-tasks' })
      return
    }
    if (existingTasks.length === 0) return

    set((state) => {
      const currentIds = new Set(state.tasks.map((t) => t.id))
      const newTasks = existingTasks.filter((t) => !currentIds.has(t.id))
      if (newTasks.length === 0) return state
      const tasks = [...state.tasks, ...newTasks]
      const taskProgress = new Map(state.taskProgress)
      for (const task of newTasks) {
        taskProgress.set(task.id, {
          transferredSize: task.transferredSize,
          fileSize: task.fileSize > 0 ? task.fileSize : undefined,
        })
      }
      return { tasks, taskProgress }
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

export const selectTasksForSessionByDirection = (
  state: TransferState,
  sessionId: string,
  direction: TransferDirection,
): TransferTask[] =>
  state.tasks.filter((t) => t.sessionId === sessionId && t.direction === direction)
