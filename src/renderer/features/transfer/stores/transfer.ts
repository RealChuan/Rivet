import { create } from 'zustand'
import type { TransferDirection } from '@shared/constants/transfer.js'
import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/transfer.js'
import { logger } from '@renderer/utils/index.js'
import {
  OPERATION_STATUS,
  TRANSFER_CONFIG,
  TRANSFER_DIRECTION,
  TIMEOUTS,
} from '@shared/constants/index.js'
import {
  createProgressBatchState,
  applyProgressBatch,
  flushProgressBatch,
} from './transfer-progress-batch.js'

interface SessionTaskSummary {
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
  return [...new Set(tasks.map(t => t.sessionId))]
}

function computeDerivedState(tasks: TransferTask[]) {
  return {
    sessionTaskSummaries: computeSessionSummaries(tasks),
    sessionIds: computeSessionIds(tasks),
    runningTaskCount: tasks.filter(
      t => t.status === OPERATION_STATUS.RUNNING || t.status === OPERATION_STATUS.WAITING
    ).length,
  }
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

interface TransferState {
  tasks: TransferTask[]
  taskProgress: Map<string, TaskProgress>
  sessionTaskSummaries: SessionTaskSummary[]
  sessionIds: string[]
  runningTaskCount: number
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
  handleProgress: (data: TransferProgressData) => void
  handleTaskCompleted: (data: {
    taskId: string
    transferredSize?: number
    fileSize?: number
  }) => void
  handleTaskFailed: (data: { taskId: string; errorMessage: string }) => void
  handleTaskRemoved: (data: { taskId: string }) => void

  loadExistingTasks: () => Promise<void>
  loadConcurrency: () => Promise<void>
  startListening: () => () => void
}

const progressBatch = createProgressBatchState()

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  taskProgress: new Map(),
  sessionTaskSummaries: [],
  sessionIds: [],
  runningTaskCount: 0,
  selectedSessionId: null,
  activeTab: TRANSFER_DIRECTION.UPLOAD,
  activeOperations: new Map(),
  isVisible: true,
  maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,

  setActiveTab: direction => {
    set({ activeTab: direction })
  },

  setSelectedSessionId: sessionId => {
    set({ selectedSessionId: sessionId })
  },

  setVisible: visible => {
    set({ isVisible: visible })
    // When becoming visible, flush any buffered progress updates immediately
    if (visible && progressBatch.buffer.length > 0) {
      flushProgressBatch(progressBatch, batch => {
        useTransferStore.setState(state => {
          const result = applyProgressBatch(state, batch)
          if (result === null) return state
          const derived =
            result.statusChanged && result.tasks ? computeDerivedState(result.tasks) : {}
          return { ...result, ...derived }
        })
      })
    }
  },

  setMaxUploadConcurrency: value => {
    set({ maxUploadConcurrency: value })
    void window.electronAPI.transfer
      .setConcurrency(value, TRANSFER_DIRECTION.UPLOAD)
      .catch(error => {
        logger.catch(error, { action: 'set-concurrency', direction: TRANSFER_DIRECTION.UPLOAD })
      })
  },

  setMaxDownloadConcurrency: value => {
    set({ maxDownloadConcurrency: value })
    void window.electronAPI.transfer
      .setConcurrency(value, TRANSFER_DIRECTION.DOWNLOAD)
      .catch(error => {
        logger.catch(error, { action: 'set-concurrency', direction: TRANSFER_DIRECTION.DOWNLOAD })
      })
  },

  handleTasksEnqueued: tasks => {
    set(state => {
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
        ...computeDerivedState(updatedTasks),
      }
    })
  },

  handleProgress: data => {
    progressBatch.buffer.push(data)

    // When not visible, only buffer — skip flush to avoid re-renders on hidden page.
    // Progress will be flushed when the page becomes visible again (setVisible(true)).
    if (!get().isVisible) return

    progressBatch.timerId ??= setTimeout(() => {
      const batch = progressBatch.buffer
      progressBatch.buffer = []
      progressBatch.timerId = null

      if (batch.length === 0) return

      set(state => {
        const result = applyProgressBatch(state, batch)
        if (result === null) return state
        const derived =
          result.statusChanged && result.tasks ? computeDerivedState(result.tasks) : {}
        return { ...result, ...derived }
      })
    }, TIMEOUTS.PROGRESS_FLUSH_MS)
  },

  handleTaskCompleted: data => {
    // Flush pending progress batch before removing the task.
    // Without this, the final progress update (100%) arrives via
    // handleProgress and sits in the batch buffer, but handleTaskCompleted
    // removes the task immediately — so when the batch timer fires,
    // the task is already gone and the progress update is silently dropped.
    // The user sees the task jump from partial progress to "done" instantly.
    flushProgressBatch(progressBatch, batch => {
      useTransferStore.setState(state => {
        const result = applyProgressBatch(state, batch)
        if (result === null) return state
        const derived =
          result.statusChanged && result.tasks ? computeDerivedState(result.tasks) : {}
        return { ...result, ...derived }
      })
    })

    set(state => {
      const tasks = state.tasks.filter(t => t.id !== data.taskId)
      const taskProgress = new Map(state.taskProgress)
      taskProgress.delete(data.taskId)
      const activeOperations = new Map(state.activeOperations)
      activeOperations.delete(data.taskId)
      return {
        tasks,
        taskProgress,
        activeOperations,
        ...computeDerivedState(tasks),
      }
    })
  },

  handleTaskFailed: data => {
    set(state => {
      const tasks = state.tasks.map(task =>
        task.id === data.taskId
          ? { ...task, status: OPERATION_STATUS.FAILED, errorMessage: data.errorMessage }
          : task
      )
      return {
        tasks,
        ...computeDerivedState(tasks),
      }
    })
  },

  handleTaskRemoved: data => {
    set(state => {
      const tasks = state.tasks.filter(t => t.id !== data.taskId)
      const taskProgress = new Map(state.taskProgress)
      taskProgress.delete(data.taskId)
      const activeOperations = new Map(state.activeOperations)
      activeOperations.delete(data.taskId)
      return {
        tasks,
        taskProgress,
        activeOperations,
        ...computeDerivedState(tasks),
      }
    })
  },

  loadExistingTasks: async () => {
    const existingTasks = await window.electronAPI.transfer.getTasks()
    if (existingTasks.length > 0) {
      set(state => {
        const currentIds = new Set(state.tasks.map(t => t.id))
        const newTasks = existingTasks.filter(t => !currentIds.has(t.id))
        if (newTasks.length === 0) return state
        const tasks = [...state.tasks, ...newTasks]
        const taskProgress = new Map(state.taskProgress)
        for (const task of newTasks) {
          taskProgress.set(task.id, {
            transferredSize: task.transferredSize,
            fileSize: task.fileSize > 0 ? task.fileSize : undefined,
          })
        }
        return {
          tasks,
          taskProgress,
          ...computeDerivedState(tasks),
        }
      })
    }
  },

  loadConcurrency: async () => {
    const [uploadConcurrency, downloadConcurrency] = await Promise.all([
      window.electronAPI.transfer.getConcurrency(TRANSFER_DIRECTION.UPLOAD),
      window.electronAPI.transfer.getConcurrency(TRANSFER_DIRECTION.DOWNLOAD),
    ])
    set({
      maxUploadConcurrency: uploadConcurrency,
      maxDownloadConcurrency: downloadConcurrency,
    })
  },

  startListening: () => {
    const api = window.electronAPI.transfer
    const unsubs = [
      api.onTasksEnqueued(tasks => get().handleTasksEnqueued(tasks)),
      api.onProgress(data => get().handleProgress(data)),
      api.onTaskCompleted(data => get().handleTaskCompleted(data)),
      api.onTaskFailed(data => get().handleTaskFailed(data)),
      api.onTaskRemoved(data => get().handleTaskRemoved(data)),
    ]
    return () => unsubs.forEach(fn => fn())
  },
}))

export const selectTasksForSessionByDirection = (
  state: TransferState,
  sessionId: string,
  direction: TransferDirection
): TransferTask[] => state.tasks.filter(t => t.sessionId === sessionId && t.direction === direction)
