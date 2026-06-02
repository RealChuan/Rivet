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

interface TransferState {
  tasks: TransferTask[]
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

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  sessionTaskSummaries: [],
  runningTaskCount: 0,
  sortBy: TRANSFER_SORT_FIELD.CREATED_AT,
  sortOrder: SORT_ORDER.DESC,
  maxConcurrency: TRANSFER_CONFIG.MAX_CONCURRENCY,
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
      return {
        tasks: updatedTasks,
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
    set(state => {
      const targetIndex = state.tasks.findIndex(t => t.id === data.taskId)
      if (targetIndex === -1) return state

      const target = state.tasks[targetIndex]
      if (!target) return state
      const speedChanged = data.speed !== undefined && data.speed !== target.speed
      const fileSizeChanged = data.fileSize !== undefined && data.fileSize !== target.fileSize
      const totalFileCountChanged =
        data.totalFileCount !== undefined && data.totalFileCount !== target.totalFileCount
      const completedFileCountChanged =
        data.completedFileCount !== undefined &&
        data.completedFileCount !== target.completedFileCount
      const activeFileCountChanged =
        data.activeFileCount !== undefined && data.activeFileCount !== target.activeFileCount
      const waitingFileCountChanged =
        data.waitingFileCount !== undefined && data.waitingFileCount !== target.waitingFileCount
      const transferredChanged = data.transferredSize !== target.transferredSize

      const taskUnchanged =
        !transferredChanged &&
        !speedChanged &&
        !fileSizeChanged &&
        !totalFileCountChanged &&
        !completedFileCountChanged &&
        !activeFileCountChanged &&
        !waitingFileCountChanged

      const incomingOps = data.activeOperations ?? []
      const currentOps = state.activeOperations.get(data.taskId)
      const opsUnchanged =
        currentOps !== undefined &&
        incomingOps.length === currentOps?.length &&
        incomingOps.every(
          (incoming, i) =>
            incoming.id === currentOps[i]?.id &&
            incoming.transferredSize === currentOps[i]?.transferredSize &&
            incoming.status === currentOps[i]?.status &&
            incoming.fileSize === currentOps[i]?.fileSize
        )

      if (taskUnchanged && opsUnchanged) return state

      let tasks = state.tasks
      if (!taskUnchanged) {
        const updated: TransferTask = {
          ...target,
          transferredSize: data.transferredSize,
        }
        if (fileSizeChanged && data.fileSize !== undefined) updated.fileSize = data.fileSize
        if (speedChanged && data.speed !== undefined) updated.speed = data.speed
        if (totalFileCountChanged && data.totalFileCount !== undefined)
          updated.totalFileCount = data.totalFileCount
        if (completedFileCountChanged && data.completedFileCount !== undefined)
          updated.completedFileCount = data.completedFileCount
        if (activeFileCountChanged && data.activeFileCount !== undefined)
          updated.activeFileCount = data.activeFileCount
        if (waitingFileCountChanged && data.waitingFileCount !== undefined)
          updated.waitingFileCount = data.waitingFileCount
        tasks = state.tasks.with(targetIndex, updated)
      }

      if (opsUnchanged) return { tasks }

      const activeOperations = new Map(state.activeOperations)
      activeOperations.set(data.taskId, incomingOps)
      return { tasks, activeOperations }
    })
  },

  handleTaskCompleted: data => {
    set(state => {
      const tasks = state.tasks.filter(t => t.id !== data.taskId)
      const activeOperations = new Map(state.activeOperations)
      activeOperations.delete(data.taskId)
      return {
        tasks,
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
      const activeOperations = new Map(state.activeOperations)
      activeOperations.delete(data.taskId)
      return {
        tasks,
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
        return {
          tasks,
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
        const aRemaining =
          a.totalFileCount && a.completedFileCount !== undefined
            ? a.totalFileCount - a.completedFileCount
            : 0
        const bRemaining =
          b.totalFileCount && b.completedFileCount !== undefined
            ? b.totalFileCount - b.completedFileCount
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
