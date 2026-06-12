import type { TransferDirection } from '@shared/constants/transfer.js'
import type { ErrorInfo, UploadOperation, TransferTask } from '@shared/types/index.js'
import { ERROR_CODE } from '@shared/constants/index.js'
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
