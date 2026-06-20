import type { TransferTask } from '@shared/types/index.js'
import { OPERATION_STATUS, FILE_TYPE } from '@shared/constants/index.js'
import type { TransferContext } from './transfer-context.js'
import { scheduleTasks } from './transfer-scheduler.js'

export function cancel(ctx: TransferContext, taskId: string): void {
  const taskIndex = ctx.tasks.findIndex((t) => t.id === taskId)
  if (taskIndex === -1) return

  const task = ctx.tasks[taskIndex]
  if (!task) return

  ctx.cancelledTaskIds.add(taskId)

  if (task.status === OPERATION_STATUS.WAITING) {
    cancelWaitingTask(ctx, task)
    return
  }

  if (task.status === OPERATION_STATUS.RUNNING) {
    cancelRunningTask(ctx, task)
    return
  }

  if (task.status === OPERATION_STATUS.FAILED || task.status === OPERATION_STATUS.COMPLETED) {
    cancelFinishedTask(ctx, task)
  }
}

export function cancelAll(ctx: TransferContext, sessionId?: string): void {
  const tasksToCancel = sessionId
    ? ctx.tasks.filter((t) => t.sessionId === sessionId)
    : [...ctx.tasks]

  for (const task of tasksToCancel) {
    cancel(ctx, task.id)
  }
}

function cancelWaitingTask(ctx: TransferContext, task: TransferTask): void {
  ctx.cleanupDownloadTempFiles(task)
  ctx.removeTask(task.id)
  ctx.sendTaskRemoved(task)
  scheduleTasks(ctx)
}

function cancelRunningTask(ctx: TransferContext, task: TransferTask): void {
  if (task.itemType === FILE_TYPE.FILE) {
    const controller = ctx.abortControllers.get(task.id)
    if (controller) controller.abort()
  } else {
    for (const op of ctx.operationsByTask.get(task.id) ?? []) {
      if (op.status === OPERATION_STATUS.RUNNING) {
        const controller = ctx.abortControllers.get(op.id)
        if (controller) controller.abort()
      }
    }
    const taskOps = ctx.operationsByTask.get(task.id) ?? []
    for (const op of taskOps) {
      ctx.opSpeedSamples.delete(op.id)
    }
    ctx.operationsByTask.delete(task.id)
    ctx.operations = ctx.operations.filter((op) => op.parentTaskId !== task.id)
    ctx.folderRunningOps.delete(task.id)
  }

  ctx.cleanupDownloadTempFiles(task)
  ctx.removeTask(task.id)
  ctx.decrementRunningTasks(task.direction)
  ctx.sendTaskRemoved(task)
  scheduleTasks(ctx)
}

function cancelFinishedTask(ctx: TransferContext, task: TransferTask): void {
  ctx.cleanupDownloadTempFiles(task)
  ctx.removeTask(task.id)
  ctx.sendTaskRemoved(task)
}

export function retry(ctx: TransferContext, taskId: string): void {
  const task = ctx.tasks.find((t) => t.id === taskId)
  if (task?.status !== OPERATION_STATUS.FAILED) return

  ctx.cancelledTaskIds.delete(taskId)
  ctx.operationsByTask.delete(taskId)
  ctx.operations = ctx.operations.filter((op) => op.parentTaskId !== taskId)
  ctx.folderRunningOps.delete(taskId)

  task.status = OPERATION_STATUS.WAITING
  task.errorMessage = undefined
  task.transferredSize = 0
  task.startedAt = undefined
  task.completedFileCount = undefined
  task.activeFileCount = undefined
  task.waitingFileCount = undefined

  ctx.createInitialOperations(task)
  scheduleTasks(ctx)
}

export function retryAll(ctx: TransferContext, sessionId?: string): void {
  const tasksToRetry = sessionId
    ? ctx.tasks.filter((t) => t.sessionId === sessionId && t.status === OPERATION_STATUS.FAILED)
    : ctx.tasks.filter((t) => t.status === OPERATION_STATUS.FAILED)

  for (const task of tasksToRetry) {
    retry(ctx, task.id)
  }
}
