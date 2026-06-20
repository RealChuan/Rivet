import fs from 'node:fs'
import path from 'node:path'
import type { LastDirKey, TransferDirection } from '@shared/constants/index.js'
import { logger } from '@main/utils/index.js'
import {
  TRANSFER_CONFIG,
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
  TRANSFER_DIRECTION,
  TRANSFER_CHANNELS,
  FILE_TYPE,
  STORE_KEY,
} from '@shared/constants/index.js'
import {
  type DeduplicateResult,
  type LocalFileInfo,
  type OperationProgressInfo,
  type TransferTask,
  type UploadOperation,
} from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import type { TransferContext } from './transfer-context.js'
import { getFromMemory, setToMemory } from '../../stores/config/store.js'
import { deleteLocalFile, cleanupDownloadFolder } from './download-executor.js'
import { cancel, cancelAll, retry, retryAll } from './transfer-cancellation.js'
import { TEMP_FILE_SUFFIX } from './transfer-context.js'
import {
  type SpeedSample,
  computeSpeed,
  shouldThrottle,
  markProgressSent,
  buildProgressData,
  getActiveOperationInfos,
} from './transfer-progress.js'
import {
  scheduleTasks,
  scheduleFolderOps,
  createInitialOperations,
  onFileProgress,
  onOperationProgress,
} from './transfer-scheduler.js'

export class TransferService implements TransferContext {
  tasks: TransferTask[] = []
  operations: UploadOperation[] = []
  operationsByTask = new Map<string, UploadOperation[]>()
  runningUploadTasks = 0
  runningDownloadTasks = 0
  folderRunningOps = new Map<string, number>()
  abortControllers = new Map<string, AbortController>()
  lastProgressTime = new Map<string, number>()
  lastOpProgressTime = new Map<string, number>()
  speedSamples = new Map<string, SpeedSample[]>()
  opSpeedSamples = new Map<string, SpeedSample[]>()
  lastDirs = new Map<LastDirKey, string>()
  cancelledTaskIds = new Set<string>()
  private mainWindow: Electron.BrowserWindow | null = null

  decrementRunningTasks(direction: TransferDirection): void {
    if (direction === TRANSFER_DIRECTION.UPLOAD) {
      this.runningUploadTasks--
    } else {
      this.runningDownloadTasks--
    }
  }

  setMainWindow(window: Electron.BrowserWindow): void {
    this.mainWindow = window
  }

  // ── Task management ──

  async addTasks(tasks: TransferTask[]): Promise<DeduplicateResult> {
    const added: TransferTask[] = []
    const duplicates: TransferTask[] = []

    for (const task of tasks) {
      const isDuplicate = this.tasks.some(
        (t) =>
          t.sessionId === task.sessionId &&
          t.localPath === task.localPath &&
          t.remotePath === task.remotePath,
      )
      if (isDuplicate) {
        duplicates.push(task)
      } else {
        task.status = OPERATION_STATUS.WAITING

        if (task.itemType === FILE_TYPE.FILE && task.fileSize === 0) {
          try {
            const stat = await fs.promises.stat(task.localPath)
            task.fileSize = stat.size
          } catch (err) {
            logger.debug('Failed to stat file for size detection', {
              path: task.localPath,
              error: formatErrorMessage(err),
            })
          }
        }

        added.push(task)
      }
    }

    this.tasks.push(...added)

    for (const task of added) {
      this.createInitialOperations(task)
    }

    this.scheduleTasks()

    if (added.length > 0) {
      this.sendTasksEnqueued(added)
    }

    return { added, duplicates }
  }

  hasActiveTasks(sessionId?: string): boolean {
    const tasks = sessionId ? this.tasks.filter((t) => t.sessionId === sessionId) : this.tasks
    return tasks.some(
      (t) => t.status === OPERATION_STATUS.WAITING || t.status === OPERATION_STATUS.RUNNING,
    )
  }

  getTasks(sessionId?: string): TransferTask[] {
    return sessionId ? this.tasks.filter((t) => t.sessionId === sessionId) : [...this.tasks]
  }

  getActiveOperations(taskId: string): OperationProgressInfo[] {
    return getActiveOperationInfos(this.operationsByTask, this.opSpeedSamples, taskId)
  }

  checkLocalFiles(localDir: string): Promise<LocalFileInfo[]> {
    return fs.promises
      .readdir(localDir, { withFileTypes: true })
      .then((entries) =>
        entries
          .filter((entry) => entry.isFile() || entry.isDirectory())
          .map((entry) => ({
            name: entry.name,
            size: 0,
            type: entry.isDirectory() ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
          })),
      )
      .catch((err) => {
        logger.debug('Failed to read local directory', { localDir, error: formatErrorMessage(err) })
        return []
      })
  }

  // ── Concurrency ──

  getConcurrency(direction: TransferDirection): number {
    const settings = getFromMemory(STORE_KEY.TRANSFER_SETTINGS)
    return direction === TRANSFER_DIRECTION.UPLOAD
      ? settings.maxUploadConcurrency
      : settings.maxDownloadConcurrency
  }

  setConcurrency(max: number, direction: TransferDirection): void {
    const clamped = Math.min(
      TRANSFER_CONFIG.MAX_CONCURRENCY,
      Math.max(TRANSFER_CONFIG.MIN_CONCURRENCY, max),
    )

    const settings = { ...getFromMemory(STORE_KEY.TRANSFER_SETTINGS) }
    if (direction === TRANSFER_DIRECTION.UPLOAD) {
      settings.maxUploadConcurrency = clamped
    } else {
      settings.maxDownloadConcurrency = clamped
    }
    setToMemory(STORE_KEY.TRANSFER_SETTINGS, settings)

    this.scheduleTasks()

    for (const task of this.tasks) {
      if (task.status === OPERATION_STATUS.RUNNING && task.itemType === FILE_TYPE.DIRECTORY) {
        this.scheduleFolderOps(task.id)
      }
    }
  }

  // ── Operations CRUD ──

  addOperation(op: UploadOperation): void {
    this.operations.push(op)
    const list = this.operationsByTask.get(op.parentTaskId)
    if (list) {
      list.push(op)
    } else {
      this.operationsByTask.set(op.parentTaskId, [op])
    }
  }

  removeOperation(operationId: string, parentTaskId: string): void {
    this.operations = this.operations.filter((op) => op.id !== operationId)
    const taskOpList = this.operationsByTask.get(parentTaskId)
    if (taskOpList) {
      const idx = taskOpList.findIndex((op) => op.id === operationId)
      if (idx !== -1) taskOpList.splice(idx, 1)
    }
  }

  // ── Delegated: Scheduling ──

  scheduleTasks(): void {
    scheduleTasks(this)
  }

  scheduleFolderOps(taskId: string): void {
    scheduleFolderOps(this, taskId)
  }

  createInitialOperations(task: TransferTask): void {
    createInitialOperations(this, task)
  }

  isTaskCancelled(taskId: string): boolean {
    return this.cancelledTaskIds.has(taskId)
  }

  onFileProgress(task: TransferTask, transferred: number): void {
    onFileProgress(this, task, transferred)
  }

  onOperationProgress(op: UploadOperation, task: TransferTask, transferred: number): void {
    onOperationProgress(this, op, task, transferred)
  }

  // ── Task stats / completion ──

  updateTaskStats(task: TransferTask): void {
    const taskOps = this.operationsByTask.get(task.id) ?? []
    const completedOps = taskOps.filter((op) => op.status === OPERATION_STATUS.COMPLETED)
    const runningOps = taskOps.filter((op) => op.status === OPERATION_STATUS.RUNNING)
    const waitingOps = taskOps.filter((op) => op.status === OPERATION_STATUS.WAITING)

    const isFileOp = (op: UploadOperation) =>
      op.type === TRANSFER_OPERATION_TYPE.UPLOAD || op.type === TRANSFER_OPERATION_TYPE.DOWNLOAD

    task.completedFileCount = completedOps.filter(isFileOp).length
    task.activeFileCount = runningOps.filter(isFileOp).length
    task.waitingFileCount = waitingOps.filter(isFileOp).length

    task.transferredSize =
      completedOps.reduce((sum, op) => sum + op.transferredSize, 0) +
      runningOps.reduce((sum, op) => sum + op.transferredSize, 0)
  }

  checkTaskCompletion(task: TransferTask): void {
    if (task.status === OPERATION_STATUS.FAILED) return

    const taskOps = this.operationsByTask.get(task.id) ?? []
    const allDone = taskOps.every(
      (op) => op.status === OPERATION_STATUS.COMPLETED || op.status === OPERATION_STATUS.FAILED,
    )

    if (!allDone) return

    const hasFailed = taskOps.some((op) => op.status === OPERATION_STATUS.FAILED)

    if (hasFailed) {
      task.status = OPERATION_STATUS.FAILED
      this.speedSamples.delete(task.id)
      this.lastProgressTime.delete(task.id)
      this.sendTaskFailed(task)
    } else {
      task.status = OPERATION_STATUS.COMPLETED
      this.sendTaskCompleted(task)
      this.removeTask(task.id)
    }

    this.folderRunningOps.delete(task.id)
    this.decrementRunningTasks(task.direction)
    this.scheduleTasks()
  }

  failOperation(op: UploadOperation, errorMessage: string): void {
    op.status = OPERATION_STATUS.FAILED
    op.errorMessage = errorMessage
    this.opSpeedSamples.delete(op.id)

    const task = this.tasks.find((t) => t.id === op.parentTaskId)
    if (!task) return

    task.status = OPERATION_STATUS.FAILED
    task.errorMessage = errorMessage

    this.cancelTaskWaitingOperations(task.id)
    this.abortTaskRunningOperations(task.id)

    this.folderRunningOps.delete(task.id)
    this.decrementRunningTasks(task.direction)
    this.abortControllers.delete(op.id)
    this.speedSamples.delete(task.id)
    this.lastProgressTime.delete(task.id)

    this.sendTaskFailed(task)
    this.scheduleTasks()
  }

  failTaskAndCleanup(task: TransferTask, errorMessage: string): void {
    task.status = OPERATION_STATUS.FAILED
    task.errorMessage = errorMessage
    this.cancelTaskWaitingOperations(task.id)
    this.folderRunningOps.delete(task.id)
    this.decrementRunningTasks(task.direction)
    this.speedSamples.delete(task.id)
    this.lastProgressTime.delete(task.id)
    this.sendTaskFailed(task)
    this.scheduleTasks()
  }

  cancelTaskWaitingOperations(taskId: string): void {
    for (const op of this.operationsByTask.get(taskId) ?? []) {
      if (op.status === OPERATION_STATUS.WAITING) {
        op.status = OPERATION_STATUS.FAILED
      }
    }
  }

  abortTaskRunningOperations(taskId: string): void {
    for (const op of this.operationsByTask.get(taskId) ?? []) {
      if (op.status === OPERATION_STATUS.RUNNING) {
        const controller = this.abortControllers.get(op.id)
        if (controller) {
          controller.abort()
        }
        op.status = OPERATION_STATUS.FAILED
      }
    }
  }

  // ── Delegated: Cancellation / Retry ──

  cancel(taskId: string): void {
    cancel(this, taskId)
  }

  cancelAll(sessionId?: string): void {
    cancelAll(this, sessionId)
  }

  retry(taskId: string): void {
    retry(this, taskId)
  }

  retryAll(sessionId?: string): void {
    retryAll(this, sessionId)
  }

  // ── Cleanup ──

  removeTask(taskId: string): void {
    const taskOps = this.operationsByTask.get(taskId) ?? []
    for (const op of taskOps) {
      this.lastOpProgressTime.delete(op.id)
      this.opSpeedSamples.delete(op.id)
    }
    this.operationsByTask.delete(taskId)
    this.tasks = this.tasks.filter((t) => t.id !== taskId)
    this.operations = this.operations.filter((op) => op.parentTaskId !== taskId)
    this.lastProgressTime.delete(taskId)
    this.speedSamples.delete(taskId)
  }

  cleanupDownloadTempFiles(task: TransferTask): void {
    if (task.direction === TRANSFER_DIRECTION.DOWNLOAD && task.localDir) {
      if (task.itemType === FILE_TYPE.FILE) {
        const tempPath = path.join(task.localDir, task.itemName + TEMP_FILE_SUFFIX)
        void deleteLocalFile(tempPath)
      } else {
        void cleanupDownloadFolder(task)
      }
    }
  }

  cleanupSessionTasks(sessionId?: string): void {
    const tasksToClean = sessionId
      ? this.tasks.filter((t) => t.sessionId === sessionId)
      : [...this.tasks]

    for (const task of tasksToClean) {
      if (task.direction === TRANSFER_DIRECTION.DOWNLOAD) {
        if (task.status === OPERATION_STATUS.RUNNING) {
          if (task.itemType === FILE_TYPE.FILE) {
            const controller = this.abortControllers.get(task.id)
            if (controller) controller.abort()
          } else {
            for (const op of this.operationsByTask.get(task.id) ?? []) {
              if (op.status === OPERATION_STATUS.RUNNING) {
                const controller = this.abortControllers.get(op.id)
                if (controller) controller.abort()
              }
            }
          }
        }
        if (task.itemType === FILE_TYPE.FILE && task.localDir) {
          const tempPath = path.join(task.localDir, task.itemName + TEMP_FILE_SUFFIX)
          void deleteLocalFile(tempPath)
        } else {
          void cleanupDownloadFolder(task)
        }
      }
      this.removeTask(task.id)
    }

    this.runningUploadTasks = this.tasks.filter(
      (t) => t.status === OPERATION_STATUS.RUNNING && t.direction === TRANSFER_DIRECTION.UPLOAD,
    ).length
    this.runningDownloadTasks = this.tasks.filter(
      (t) => t.status === OPERATION_STATUS.RUNNING && t.direction === TRANSFER_DIRECTION.DOWNLOAD,
    ).length
  }

  // ── IPC send ──

  send(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  sendProgress(task: TransferTask): void {
    const speed = computeSpeed(this.speedSamples, task.id)
    const activeOperations =
      task.itemType === FILE_TYPE.DIRECTORY ? this.getActiveOperations(task.id) : undefined
    const data = buildProgressData(task, speed, activeOperations)
    this.send(TRANSFER_CHANNELS.PROGRESS, data)
  }

  throttledSendProgress(task: TransferTask): void {
    if (!shouldThrottle(this.lastProgressTime, task.id)) {
      markProgressSent(this.lastProgressTime, task.id)
      this.sendProgress(task)
    }
  }

  private sendTasksEnqueued(tasks: TransferTask[]): void {
    this.send(TRANSFER_CHANNELS.TASKS_ENQUEUED, tasks)
  }

  sendTaskCompleted(task: TransferTask): void {
    this.send(TRANSFER_CHANNELS.TASK_COMPLETED, {
      taskId: task.id,
      transferredSize: task.transferredSize,
      fileSize: task.fileSize,
    })
  }

  sendTaskFailed(task: TransferTask): void {
    this.send(TRANSFER_CHANNELS.TASK_FAILED, {
      taskId: task.id,
      errorMessage: task.errorMessage ?? 'Unknown error',
    })
  }

  sendTaskRemoved(task: TransferTask): void {
    this.send(TRANSFER_CHANNELS.TASK_REMOVED, { taskId: task.id })
  }

  // ── Last dir ──

  getLastDir(key: LastDirKey): string | null {
    return this.lastDirs.get(key) ?? null
  }

  setLastDir(key: LastDirKey, dir: string): void {
    this.lastDirs.set(key, dir)
  }
}
