import crypto from 'node:crypto'
import path from 'node:path'

import type { ErrorInfo, UploadOperation, TransferTask } from '@shared/types/index.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import {
  type TransferDirection,
  type TransferOperationType,
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
} from '@shared/constants/transfer.js'
import { joinPaths } from '@shared/utils/index.js'
import type { SpeedSample } from './transfer-progress.js'

export const TEMP_FILE_SUFFIX = '.rivet-download'

export function isAbortError(error: ErrorInfo): boolean {
  return (
    error.code === ERROR_CODE.UPLOAD_ABORTED ||
    error.code === ERROR_CODE.DOWNLOAD_ABORTED ||
    error.code === ERROR_CODE.REQUEST_ABORTED
  )
}

export interface TransferContext {
  // State access
  readonly tasks: TransferTask[]
  operations: UploadOperation[]
  readonly operationsByTask: Map<string, UploadOperation[]>
  abortControllers: Map<string, AbortController>
  readonly folderRunningOps: Map<string, number>
  readonly speedSamples: Map<string, SpeedSample[]>
  readonly opSpeedSamples: Map<string, SpeedSample[]>
  readonly lastProgressTime: Map<string, number>
  readonly lastOpProgressTime: Map<string, number>
  readonly cancelledTaskIds: Set<string>
  runningUploadTasks: number
  runningDownloadTasks: number

  // State mutation
  decrementRunningTasks(direction: TransferDirection): void

  // Methods
  isTaskCancelled(taskId: string): boolean
  addOperation(op: UploadOperation): void
  removeOperation(operationId: string, parentTaskId: string): void
  failOperation(op: UploadOperation, errorMessage: string): void
  cancelTaskWaitingOperations(taskId: string): void
  abortTaskRunningOperations(taskId: string): void
  updateTaskStats(task: TransferTask): void
  checkTaskCompletion(task: TransferTask): void
  scheduleFolderOps(taskId: string): void
  throttledSendProgress(task: TransferTask): void
  onOperationProgress(op: UploadOperation, task: TransferTask, transferred: number): void
  onFileProgress(task: TransferTask, transferred: number): void
  removeTask(taskId: string): void
  sendProgress(task: TransferTask): void
  sendTaskCompleted(task: TransferTask): void
  sendTaskFailed(task: TransferTask): void
  sendTaskRemoved(task: TransferTask): void
  send(channel: string, data: unknown): void
  scheduleTasks(): void
  getConcurrency(direction: TransferDirection): number
  failTaskAndCleanup(task: TransferTask, errorMessage: string): void
  cleanupDownloadTempFiles(task: TransferTask): void
  createInitialOperations(task: TransferTask): void
}

export interface DirectoryExpanderEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  size: number
}

export interface DirectoryExpanderStrategy {
  listEntries(
    task: TransferTask,
    localDir: string,
    remoteDir: string,
  ): Promise<{ ok: true; entries: DirectoryExpanderEntry[] } | { ok: false; errorMessage: string }>
  resolveFileSize(entry: DirectoryExpanderEntry, localPath: string): Promise<number>
  readonly mkdirIncludesLocalPath: boolean
  readonly fileOperationType: TransferOperationType
}

export async function expandDirectory(
  ctx: TransferContext,
  task: TransferTask,
  remoteDir: string,
  strategy: DirectoryExpanderStrategy,
): Promise<void> {
  if (ctx.isTaskCancelled(task.id)) return

  const relativePath = path.posix.relative(task.remotePath, remoteDir)
  const localDir = relativePath === '' ? task.localPath : path.join(task.localPath, relativePath)

  const result = await strategy.listEntries(task, localDir, remoteDir)
  if (!result.ok) {
    ctx.failTaskAndCleanup(task, result.errorMessage)
    return
  }

  for (const entry of result.entries) {
    const childRemotePath = joinPaths(remoteDir, entry.name)

    if (entry.isDirectory) {
      const op: UploadOperation = {
        id: crypto.randomUUID(),
        parentTaskId: task.id,
        type: TRANSFER_OPERATION_TYPE.MKDIR,
        remotePath: childRemotePath,
        itemName: entry.name,
        status: OPERATION_STATUS.WAITING,
        transferredSize: 0,
      }
      if (strategy.mkdirIncludesLocalPath) {
        op.localPath = path.join(localDir, entry.name)
      }
      ctx.addOperation(op)
    } else if (entry.isFile) {
      const childLocalPath = path.join(localDir, entry.name)
      const fileSize = await strategy.resolveFileSize(entry, childLocalPath)

      task.totalFileCount = (task.totalFileCount ?? 0) + 1

      ctx.addOperation({
        id: crypto.randomUUID(),
        parentTaskId: task.id,
        type: strategy.fileOperationType,
        remotePath: childRemotePath,
        localPath: childLocalPath,
        itemName: entry.name,
        status: OPERATION_STATUS.WAITING,
        fileSize,
        transferredSize: 0,
      })
    }
  }

  ctx.updateTaskStats(task)
  ctx.scheduleFolderOps(task.id)
  ctx.throttledSendProgress(task)
}
