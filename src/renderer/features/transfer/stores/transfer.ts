import { create } from 'zustand'
import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/transfer.js'
import { SORT_ORDER, type SortOrderWithDirection } from '@shared/constants/sort.js'
import {
  TRANSFER_CONFIG,
  TRANSFER_SORT_FIELD,
  TRANSFER_TASK_STATUS,
  type TransferSortField,
} from '@shared/constants/transfer.js'

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
      if (
        task.status === TRANSFER_TASK_STATUS.RUNNING ||
        task.status === TRANSFER_TASK_STATUS.WAITING
      ) {
        existing.running++
      }
      if (task.status === TRANSFER_TASK_STATUS.FAILED) {
        existing.failed++
      }
    } else {
      map.set(task.sessionId, {
        sessionId: task.sessionId,
        running:
          task.status === TRANSFER_TASK_STATUS.RUNNING ||
          task.status === TRANSFER_TASK_STATUS.WAITING
            ? 1
            : 0,
        failed: task.status === TRANSFER_TASK_STATUS.FAILED ? 1 : 0,
        total: 1,
      })
    }
  }
  return [...map.values()]
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
  runningTaskCount: number
  sortBy: TransferSortField
  sortOrder: SortOrderWithDirection
  maxConcurrency: number
  selectedSessionId: string | null
  activeOperations: Map<string, OperationProgressInfo[]>

  setSort: (sortBy: TransferSortField, sortOrder: SortOrderWithDirection) => void
  setSelectedSessionId: (sessionId: string | null) => void
  setConcurrency: (max: number) => void

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
  startListening: () => () => void
}

// Progress batch buffer: accumulate progress updates and flush on a time-based throttle
let progressBuffer: TransferProgressData[] = []
let progressTimerId: ReturnType<typeof setTimeout> | null = null
const PROGRESS_FLUSH_MS = 250

function applyProgressBatch(
  state: TransferState,
  batch: TransferProgressData[]
): Partial<TransferState> | null {
  let taskProgress = state.taskProgress
  let activeOperations = state.activeOperations
  let progressChanged = false
  let opsChanged = false

  for (const data of batch) {
    const taskExists = state.tasks.some(t => t.id === data.taskId)
    if (!taskExists) continue

    const current = taskProgress.get(data.taskId)
    const transferredChanged =
      current !== undefined && data.transferredSize !== current.transferredSize
    const speedChanged = data.speed !== undefined && data.speed !== current?.speed
    const fileSizeChanged = data.fileSize !== undefined && data.fileSize !== current?.fileSize
    const totalFileCountChanged =
      data.totalFileCount !== undefined && data.totalFileCount !== current?.totalFileCount
    const completedFileCountChanged =
      data.completedFileCount !== undefined &&
      data.completedFileCount !== current?.completedFileCount
    const activeFileCountChanged =
      data.activeFileCount !== undefined && data.activeFileCount !== current?.activeFileCount
    const waitingFileCountChanged =
      data.waitingFileCount !== undefined && data.waitingFileCount !== current?.waitingFileCount

    const progressUnchanged =
      current !== undefined &&
      !transferredChanged &&
      !speedChanged &&
      !fileSizeChanged &&
      !totalFileCountChanged &&
      !completedFileCountChanged &&
      !activeFileCountChanged &&
      !waitingFileCountChanged

    const incomingOps = data.activeOperations ?? []
    const currentOps = activeOperations.get(data.taskId)
    const currentOpsUnchanged =
      currentOps !== undefined &&
      incomingOps.length === currentOps?.length &&
      incomingOps.every(
        (incoming, i) =>
          incoming.id === currentOps[i]?.id &&
          incoming.transferredSize === currentOps[i]?.transferredSize &&
          incoming.status === currentOps[i]?.status &&
          incoming.fileSize === currentOps[i]?.fileSize
      )

    if (progressUnchanged && currentOpsUnchanged) continue

    if (!progressUnchanged) {
      if (taskProgress === state.taskProgress) {
        taskProgress = new Map(state.taskProgress)
      }
      taskProgress.set(data.taskId, {
        transferredSize: data.transferredSize,
        speed: data.speed ?? current?.speed,
        fileSize: data.fileSize ?? current?.fileSize,
        totalFileCount: data.totalFileCount ?? current?.totalFileCount,
        completedFileCount: data.completedFileCount ?? current?.completedFileCount,
        activeFileCount: data.activeFileCount ?? current?.activeFileCount,
        waitingFileCount: data.waitingFileCount ?? current?.waitingFileCount,
      })
      progressChanged = true
    }

    if (!currentOpsUnchanged) {
      if (activeOperations === state.activeOperations) {
        activeOperations = new Map(state.activeOperations)
      }
      activeOperations.set(data.taskId, incomingOps)
      opsChanged = true
    }
  }

  if (!progressChanged && !opsChanged) return null

  const result: Partial<TransferState> = {}
  if (progressChanged) result.taskProgress = taskProgress
  if (opsChanged) result.activeOperations = activeOperations
  return result
}

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  taskProgress: new Map(),
  sessionTaskSummaries: [],
  runningTaskCount: 0,
  sortBy: TRANSFER_SORT_FIELD.CREATED_AT,
  sortOrder: SORT_ORDER.DESC,
  maxConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  selectedSessionId: null,
  activeOperations: new Map(),

  setSort: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder })
  },

  setSelectedSessionId: sessionId => {
    set({ selectedSessionId: sessionId })
  },

  setConcurrency: concurrency => {
    set({ maxConcurrency: concurrency })
    void window.electronAPI.transfer.setConcurrency(concurrency)
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
        sessionTaskSummaries: computeSessionSummaries(updatedTasks),
        runningTaskCount: updatedTasks.filter(
          t =>
            t.status === TRANSFER_TASK_STATUS.RUNNING || t.status === TRANSFER_TASK_STATUS.WAITING
        ).length,
      }
    })
  },

  handleProgress: data => {
    progressBuffer.push(data)

    if (
      (progressTimerId ??= setTimeout(() => {
        const batch = progressBuffer
        progressBuffer = []
        progressTimerId = null

        if (batch.length === 0) return

        set(state => {
          const result = applyProgressBatch(state, batch)
          return result ?? state
        })
      }, PROGRESS_FLUSH_MS)) !== null
    ) {
      // Timer already running, no action needed
    }
  },

  handleTaskCompleted: data => {
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
        sessionTaskSummaries: computeSessionSummaries(tasks),
        runningTaskCount: tasks.filter(
          t =>
            t.status === TRANSFER_TASK_STATUS.RUNNING || t.status === TRANSFER_TASK_STATUS.WAITING
        ).length,
      }
    })
  },

  handleTaskFailed: data => {
    set(state => {
      const tasks = state.tasks.map(task =>
        task.id === data.taskId
          ? { ...task, status: TRANSFER_TASK_STATUS.FAILED, errorMessage: data.errorMessage }
          : task
      )
      return {
        tasks,
        sessionTaskSummaries: computeSessionSummaries(tasks),
        runningTaskCount: tasks.filter(
          t =>
            t.status === TRANSFER_TASK_STATUS.RUNNING || t.status === TRANSFER_TASK_STATUS.WAITING
        ).length,
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
        sessionTaskSummaries: computeSessionSummaries(tasks),
        runningTaskCount: tasks.filter(
          t =>
            t.status === TRANSFER_TASK_STATUS.RUNNING || t.status === TRANSFER_TASK_STATUS.WAITING
        ).length,
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
          sessionTaskSummaries: computeSessionSummaries(tasks),
          runningTaskCount: tasks.filter(
            t =>
              t.status === TRANSFER_TASK_STATUS.RUNNING || t.status === TRANSFER_TASK_STATUS.WAITING
          ).length,
        }
      })
    }
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

export const selectSessionIds = (state: TransferState): string[] => [
  ...new Set(state.tasks.map(t => t.sessionId)),
]

export const selectTasksBySession = (state: TransferState): Map<string, TransferTask[]> => {
  const map = new Map<string, TransferTask[]>()
  for (const task of state.tasks) {
    const list = map.get(task.sessionId)
    if (list) {
      list.push(task)
    } else {
      map.set(task.sessionId, [task])
    }
  }
  return map
}

export const selectSortedTasks = (state: TransferState): TransferTask[] => {
  const { tasks, sortBy, sortOrder } = state
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case TRANSFER_SORT_FIELD.NAME:
        cmp = a.itemName.localeCompare(b.itemName)
        break
      case TRANSFER_SORT_FIELD.CREATED_AT:
        cmp = a.createdAt - b.createdAt
        break
      case TRANSFER_SORT_FIELD.STATUS:
        cmp = a.status.localeCompare(b.status)
        break
      case TRANSFER_SORT_FIELD.REMAINING_TIME: {
        const aProgress = state.taskProgress.get(a.id)
        const bProgress = state.taskProgress.get(b.id)
        const aRemaining =
          aProgress?.totalFileCount && aProgress.completedFileCount !== undefined
            ? aProgress.totalFileCount - aProgress.completedFileCount
            : 0
        const bRemaining =
          bProgress?.totalFileCount && bProgress.completedFileCount !== undefined
            ? bProgress.totalFileCount - bProgress.completedFileCount
            : 0
        cmp = aRemaining - bRemaining
        break
      }
    }
    return sortOrder === SORT_ORDER.ASC ? cmp : -cmp
  })
  return sorted
}

export const selectRunningTaskCount = (state: TransferState): number =>
  state.tasks.filter(
    t => t.status === TRANSFER_TASK_STATUS.RUNNING || t.status === TRANSFER_TASK_STATUS.WAITING
  ).length

export default useTransferStore
