import type { OperationProgressInfo, TransferProgressData } from '@shared/types/transfer.js'
import { OPERATION_STATUS } from '@shared/constants/index.js'
import type { TaskProgress } from './transfer.js'

/** Progress data separated from task list to avoid triggering list re-renders */
interface ProgressBatchState {
  buffer: TransferProgressData[]
  timerId: ReturnType<typeof setTimeout> | null
}

export function createProgressBatchState(): ProgressBatchState {
  return { buffer: [], timerId: null }
}

function hasProgressChanged(
  current: TaskProgress | undefined,
  data: TransferProgressData,
): boolean {
  if (current === undefined) return true
  return (
    data.transferredSize !== current.transferredSize ||
    (data.speed !== undefined && data.speed !== current.speed) ||
    (data.fileSize !== undefined && data.fileSize !== current.fileSize) ||
    (data.totalFileCount !== undefined && data.totalFileCount !== current.totalFileCount) ||
    (data.completedFileCount !== undefined &&
      data.completedFileCount !== current.completedFileCount) ||
    (data.activeFileCount !== undefined && data.activeFileCount !== current.activeFileCount) ||
    (data.waitingFileCount !== undefined && data.waitingFileCount !== current.waitingFileCount)
  )
}

function hasOperationsChanged(
  currentOps: OperationProgressInfo[] | undefined,
  incomingOps: OperationProgressInfo[],
): boolean {
  if (currentOps === undefined) return true
  if (incomingOps.length !== currentOps.length) return true
  return !incomingOps.every(
    (incoming, i) =>
      incoming.id === currentOps[i]?.id &&
      incoming.transferredSize === currentOps[i]?.transferredSize &&
      incoming.status === currentOps[i]?.status &&
      incoming.fileSize === currentOps[i]?.fileSize,
  )
}

function buildUpdatedProgress(
  current: TaskProgress | undefined,
  data: TransferProgressData,
): TaskProgress {
  return {
    transferredSize: data.transferredSize,
    speed: data.speed ?? current?.speed,
    fileSize: data.fileSize ?? current?.fileSize,
    totalFileCount: data.totalFileCount ?? current?.totalFileCount,
    completedFileCount: data.completedFileCount ?? current?.completedFileCount,
    activeFileCount: data.activeFileCount ?? current?.activeFileCount,
    waitingFileCount: data.waitingFileCount ?? current?.waitingFileCount,
  }
}

/** Minimal state slice needed by applyProgressBatch */
interface ProgressBatchStateSlice<T extends { id: string; status: string }> {
  tasks: T[]
  taskProgress: Map<string, TaskProgress>
  activeOperations: Map<string, OperationProgressInfo[]>
}

interface ProgressBatchResult<T extends { id: string; status: string }> {
  taskProgress?: Map<string, TaskProgress>
  activeOperations?: Map<string, OperationProgressInfo[]>
  tasks?: T[]
  statusChanged?: boolean
}

export function applyProgressBatch<T extends { id: string; status: string }>(
  state: ProgressBatchStateSlice<T>,
  batch: TransferProgressData[],
): ProgressBatchResult<T> | null {
  let taskProgress = state.taskProgress
  let activeOperations = state.activeOperations
  let tasks = state.tasks
  let progressChanged = false
  let opsChanged = false
  let statusChanged = false

  for (const data of batch) {
    const taskIndex = state.tasks.findIndex((t) => t.id === data.taskId)
    if (taskIndex === -1) continue

    const current = taskProgress.get(data.taskId)
    const progressUnchanged = !hasProgressChanged(current, data)

    const incomingOps = data.activeOperations ?? []
    const currentOps = activeOperations.get(data.taskId)
    const opsUnchanged = !hasOperationsChanged(currentOps, incomingOps)

    if (progressUnchanged && opsUnchanged) continue

    if (!progressUnchanged) {
      if (taskProgress === state.taskProgress) {
        taskProgress = new Map(state.taskProgress)
      }
      taskProgress.set(data.taskId, buildUpdatedProgress(current, data))
      progressChanged = true
    }

    if (!opsUnchanged) {
      if (activeOperations === state.activeOperations) {
        activeOperations = new Map(state.activeOperations)
      }
      activeOperations.set(data.taskId, incomingOps)
      opsChanged = true
    }

    // Sync task status: receiving progress means the task is RUNNING
    const task = state.tasks[taskIndex]
    if (task?.status === OPERATION_STATUS.WAITING) {
      if (tasks === state.tasks) {
        tasks = state.tasks.map((t) =>
          t.id === data.taskId ? { ...t, status: OPERATION_STATUS.RUNNING } : t,
        )
      } else {
        tasks = tasks.map((t) =>
          t.id === data.taskId ? { ...t, status: OPERATION_STATUS.RUNNING } : t,
        )
      }
      statusChanged = true
    }
  }

  if (!progressChanged && !opsChanged && !statusChanged) return null

  const result: ProgressBatchResult<T> = {}
  if (progressChanged) result.taskProgress = taskProgress
  if (opsChanged) result.activeOperations = activeOperations
  if (statusChanged) {
    result.tasks = tasks
    result.statusChanged = true
  }
  return result
}

export function flushProgressBatch(
  batchState: ProgressBatchState,
  applyBatch: (batch: TransferProgressData[]) => void,
): void {
  if (batchState.timerId !== null) {
    clearTimeout(batchState.timerId)
    batchState.timerId = null
  }
  const batch = batchState.buffer
  batchState.buffer = []
  if (batch.length === 0) return
  applyBatch(batch)
}
