import crypto from 'node:crypto'
import type { TransferTask, UploadOperation } from '@shared/types/index.js'
import { logger } from '@main/utils/index.js'
import {
  TRANSFER_CONFIG,
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
  TRANSFER_DIRECTION,
  FILE_TYPE,
} from '@shared/constants/index.js'
import { isErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import type { TransferContext } from './transfer-context.js'
import { protocolService } from '../protocol/protocol-service.js'
import { executeDownloadFile, executeDownloadFolderOp } from './download-executor.js'
import { isAbortError } from './transfer-context.js'
import { addSpeedSample, shouldThrottle, markProgressSent } from './transfer-progress.js'
import { executeUploadFolderOp } from './upload-executor.js'

function scheduleByDirection(
  ctx: TransferContext,
  direction: (typeof TRANSFER_DIRECTION)[keyof typeof TRANSFER_DIRECTION]
): void {
  const getRunningCount = () =>
    direction === TRANSFER_DIRECTION.UPLOAD ? ctx.runningUploadTasks : ctx.runningDownloadTasks
  const concurrency = ctx.getConcurrency(direction)

  while (getRunningCount() < concurrency) {
    const task = ctx.tasks.find(
      t => t.status === OPERATION_STATUS.WAITING && t.direction === direction
    )
    if (!task) break

    task.status = OPERATION_STATUS.RUNNING
    task.startedAt = Date.now()

    if (direction === TRANSFER_DIRECTION.UPLOAD) {
      ctx.runningUploadTasks++
    } else {
      ctx.runningDownloadTasks++
    }

    if (task.itemType === FILE_TYPE.FILE) {
      void executeFileTask(ctx, task).catch(err => {
        logger.catch(err, { action: 'execute-file-task', taskId: task.id })
        task.status = OPERATION_STATUS.FAILED
        task.errorMessage = formatErrorMessage(err)
        ctx.sendTaskFailed(task)
        ctx.decrementRunningTasks(task.direction)
        ctx.scheduleTasks()
      })
    } else {
      ctx.folderRunningOps.set(task.id, 0)
      scheduleFolderOps(ctx, task.id)
    }
  }
}

export function scheduleTasks(ctx: TransferContext): void {
  scheduleByDirection(ctx, TRANSFER_DIRECTION.UPLOAD)
  scheduleByDirection(ctx, TRANSFER_DIRECTION.DOWNLOAD)
}

export function scheduleFolderOps(ctx: TransferContext, taskId: string): void {
  if (ctx.cancelledTaskIds.has(taskId)) return

  const task = ctx.tasks.find(t => t.id === taskId)
  const maxOps = task ? ctx.getConcurrency(task.direction) : TRANSFER_CONFIG.MAX_CONCURRENCY

  const runningOps = ctx.folderRunningOps.get(taskId) ?? 0
  if (runningOps >= maxOps) return

  const pendingOps = (ctx.operationsByTask.get(taskId) ?? []).filter(
    op => op.status === OPERATION_STATUS.WAITING
  )

  let currentRunning = runningOps
  for (const op of pendingOps) {
    if (currentRunning >= maxOps) break
    if (ctx.cancelledTaskIds.has(taskId)) return
    currentRunning++
    ctx.folderRunningOps.set(taskId, currentRunning)
    void executeFolderOp(ctx, op).catch(err => {
      logger.catch(err, { action: 'execute-folder-op', opId: op.id })
      op.status = OPERATION_STATUS.FAILED
      op.errorMessage = formatErrorMessage(err)
      ctx.failOperation(op, formatErrorMessage(err))
    })
  }
}

export function createInitialOperations(ctx: TransferContext, task: TransferTask): void {
  if (task.itemType === FILE_TYPE.DIRECTORY) {
    const op: UploadOperation = {
      id: crypto.randomUUID(),
      parentTaskId: task.id,
      type: TRANSFER_OPERATION_TYPE.MKDIR,
      remotePath: task.remotePath,
      itemName: task.itemName,
      status: OPERATION_STATUS.WAITING,
      transferredSize: 0,
    }
    if (task.direction === TRANSFER_DIRECTION.DOWNLOAD && task.localPath) {
      op.localPath = task.localPath
    }
    ctx.addOperation(op)
  }
}

export async function executeFileTask(ctx: TransferContext, task: TransferTask): Promise<void> {
  const controller = new AbortController()
  ctx.abortControllers.set(task.id, controller)

  ctx.sendProgress(task)

  try {
    const result =
      task.direction === TRANSFER_DIRECTION.UPLOAD
        ? await protocolService.upload(
            task.sessionId,
            task.localPath,
            task.remotePath,
            transferred => onFileProgress(ctx, task, transferred),
            controller.signal
          )
        : await executeDownloadFile(task, controller.signal, transferred =>
            onFileProgress(ctx, task, transferred)
          )

    if (ctx.isTaskCancelled(task.id)) return

    if (isErr(result)) {
      if (isAbortError(result.error)) {
        ctx.removeTask(task.id)
        ctx.sendTaskRemoved(task)
      } else {
        task.status = OPERATION_STATUS.FAILED
        task.errorMessage = result.error.message
        ctx.speedSamples.delete(task.id)
        ctx.lastProgressTime.delete(task.id)
        ctx.sendTaskFailed(task)
      }
    } else {
      task.transferredSize = task.fileSize
      task.status = OPERATION_STATUS.COMPLETED
      ctx.speedSamples.delete(task.id)
      ctx.lastProgressTime.delete(task.id)
      ctx.sendProgress(task)
      ctx.sendTaskCompleted(task)
      ctx.removeTask(task.id)
    }
  } catch (_error) {
    if (ctx.isTaskCancelled(task.id)) return
    task.status = OPERATION_STATUS.FAILED
    task.errorMessage = formatErrorMessage(_error)
    ctx.speedSamples.delete(task.id)
    ctx.lastProgressTime.delete(task.id)
    ctx.sendTaskFailed(task)
  } finally {
    if (!ctx.isTaskCancelled(task.id)) {
      ctx.decrementRunningTasks(task.direction)
    }
    ctx.abortControllers.delete(task.id)
    ctx.cancelledTaskIds.delete(task.id)
    scheduleTasks(ctx)
  }
}

export async function executeFolderOp(ctx: TransferContext, op: UploadOperation): Promise<void> {
  if (ctx.isTaskCancelled(op.parentTaskId)) return

  op.status = OPERATION_STATUS.RUNNING
  op.startedAt = Date.now()
  const task = ctx.tasks.find(t => t.id === op.parentTaskId)
  if (task) ctx.updateTaskStats(task)

  try {
    if (task?.direction === TRANSFER_DIRECTION.DOWNLOAD) {
      await executeDownloadFolderOp(ctx, op, task)
    } else {
      await executeUploadFolderOp(ctx, op, task)
    }
  } catch (error) {
    if (ctx.isTaskCancelled(op.parentTaskId)) return
    ctx.failOperation(op, formatErrorMessage(error))
    return
  }

  if (task && !ctx.isTaskCancelled(op.parentTaskId)) {
    ctx.lastOpProgressTime.delete(op.id)
    ctx.opSpeedSamples.delete(op.id)
    const runningOps = ctx.folderRunningOps.get(task.id) ?? 1
    ctx.folderRunningOps.set(task.id, Math.max(0, runningOps - 1))
    ctx.updateTaskStats(task)
    ctx.throttledSendProgress(task)
    ctx.checkTaskCompletion(task)
    scheduleFolderOps(ctx, task.id)
  }
}

export function onFileProgress(
  ctx: TransferContext,
  task: TransferTask,
  transferred: number
): void {
  task.transferredSize = transferred
  addSpeedSample(ctx.speedSamples, task.id, transferred)

  if (!shouldThrottle(ctx.lastProgressTime, task.id)) {
    markProgressSent(ctx.lastProgressTime, task.id)
    ctx.sendProgress(task)
  }
}

export function onOperationProgress(
  ctx: TransferContext,
  op: UploadOperation,
  task: TransferTask,
  transferred: number
): void {
  op.transferredSize = transferred
  addSpeedSample(ctx.opSpeedSamples, op.id, transferred)
  ctx.updateTaskStats(task)
  addSpeedSample(ctx.speedSamples, task.id, task.transferredSize)

  if (!shouldThrottle(ctx.lastProgressTime, task.id)) {
    markProgressSent(ctx.lastProgressTime, task.id)
    ctx.sendProgress(task)
  }
}
