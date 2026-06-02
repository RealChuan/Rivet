import fs from 'node:fs'
import path from 'node:path'
import { logger } from '@main/utils/index.js'
import {
  TRANSFER_CONFIG,
  TRANSFER_ITEM_TYPE,
  TRANSFER_TASK_STATUS,
  UPLOAD_OPERATION_STATUS,
  UPLOAD_OPERATION_TYPE,
  ERROR_CODE,
  TRANSFER_CHANNELS,
} from '@shared/constants/index.js'
import { type ErrorInfo, isErr } from '@shared/types/index.js'
import {
  type DeduplicateResult,
  type OperationProgressInfo,
  type TransferProgressData,
  type TransferTask,
  type UploadOperation,
} from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { joinPaths } from '@shared/utils/index.js'
import { protocolService } from '../protocol/protocol-service.js'

function isAbortError(error: ErrorInfo): boolean {
  return error.code === ERROR_CODE.UPLOAD_ABORTED || error.code === ERROR_CODE.REQUEST_ABORTED
}

interface SpeedSample {
  timestamp: number
  transferredSize: number
}

const SPEED_WINDOW_MS = 3000
const SPEED_MIN_SAMPLES = 2

export class TransferService {
  private tasks: TransferTask[] = []
  private operations: UploadOperation[] = []
  private runningTasks = 0
  private folderRunningOps = new Map<string, number>()
  private maxConcurrency: number = TRANSFER_CONFIG.MAX_CONCURRENCY
  private abortControllers = new Map<string, AbortController>()
  private lastProgressTime = new Map<string, number>()
  private lastOpProgressTime = new Map<string, number>()
  private speedSamples = new Map<string, SpeedSample[]>()
  private mainWindow: Electron.BrowserWindow | null = null

  setMainWindow(window: Electron.BrowserWindow): void {
    this.mainWindow = window
  }

  addTasks(tasks: TransferTask[]): DeduplicateResult {
    const added: TransferTask[] = []
    const duplicates: TransferTask[] = []

    for (const task of tasks) {
      const isDuplicate = this.tasks.some(
        t =>
          t.sessionId === task.sessionId &&
          t.localPath === task.localPath &&
          t.remotePath === task.remotePath
      )
      if (isDuplicate) {
        duplicates.push(task)
      } else {
        task.status = TRANSFER_TASK_STATUS.WAITING

        if (task.itemType === TRANSFER_ITEM_TYPE.FILE && task.fileSize === 0) {
          try {
            const stat = fs.statSync(task.localPath)
            task.fileSize = stat.size
          } catch {
            // ignore stat errors
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

  private createInitialOperations(task: TransferTask): void {
    if (task.itemType === TRANSFER_ITEM_TYPE.FOLDER) {
      this.operations.push({
        id: crypto.randomUUID(),
        parentTaskId: task.id,
        type: UPLOAD_OPERATION_TYPE.MKDIR,
        remotePath: task.remotePath,
        itemName: task.itemName,
        status: UPLOAD_OPERATION_STATUS.WAITING,
        transferredSize: 0,
      })
    }
  }

  private scheduleTasks(): void {
    while (this.runningTasks < this.maxConcurrency) {
      const task = this.tasks.find(t => t.status === TRANSFER_TASK_STATUS.WAITING)
      if (!task) break

      task.status = TRANSFER_TASK_STATUS.RUNNING
      task.startedAt = Date.now()
      this.runningTasks++

      if (task.itemType === TRANSFER_ITEM_TYPE.FILE) {
        void this.executeFileTask(task)
      } else {
        this.folderRunningOps.set(task.id, 0)
        this.scheduleFolderOps(task.id)
      }
    }
  }

  private scheduleFolderOps(taskId: string): void {
    const runningOps = this.folderRunningOps.get(taskId) ?? 0
    if (runningOps >= this.maxConcurrency) return

    const pendingOps = this.operations.filter(
      op => op.parentTaskId === taskId && op.status === UPLOAD_OPERATION_STATUS.WAITING
    )

    let currentRunning = runningOps
    for (const op of pendingOps) {
      if (currentRunning >= this.maxConcurrency) break
      currentRunning++
      this.folderRunningOps.set(taskId, currentRunning)
      void this.executeFolderOp(op)
    }
  }

  private async executeFileTask(task: TransferTask): Promise<void> {
    const controller = new AbortController()
    this.abortControllers.set(task.id, controller)

    this.sendProgress(task)

    try {
      const result = await protocolService.upload(
        task.sessionId,
        task.localPath,
        task.remotePath,
        transferred => this.onFileProgress(task, transferred),
        controller.signal
      )

      if (isErr(result)) {
        if (isAbortError(result.error)) {
          this.removeTask(task.id)
          this.sendTaskRemoved(task)
        } else {
          task.status = TRANSFER_TASK_STATUS.FAILED
          task.errorMessage = result.error.message
          this.speedSamples.delete(task.id)
          this.lastProgressTime.delete(task.id)
          this.sendTaskFailed(task)
        }
      } else {
        task.transferredSize = task.fileSize
        task.status = TRANSFER_TASK_STATUS.COMPLETED
        this.speedSamples.delete(task.id)
        this.lastProgressTime.delete(task.id)
        this.sendProgress(task)
        this.sendTaskCompleted(task)
        this.removeTask(task.id)
      }
    } catch (_error) {
      task.status = TRANSFER_TASK_STATUS.FAILED
      task.errorMessage = formatErrorMessage(_error)
      this.speedSamples.delete(task.id)
      this.lastProgressTime.delete(task.id)
      this.sendTaskFailed(task)
    } finally {
      this.runningTasks--
      this.abortControllers.delete(task.id)
      this.scheduleTasks()
    }
  }

  private async executeFolderOp(op: UploadOperation): Promise<void> {
    op.status = UPLOAD_OPERATION_STATUS.RUNNING
    op.startedAt = Date.now()
    const task = this.tasks.find(t => t.id === op.parentTaskId)
    if (task) this.updateTaskStats(task)

    try {
      if (op.type === UPLOAD_OPERATION_TYPE.MKDIR) {
        const sessionId = task?.sessionId ?? ''
        const result = await protocolService.mkdir(sessionId, op.remotePath)

        if (!result.success) {
          this.failOperation(op, result.error?.message ?? 'Mkdir failed')
          return
        }

        op.status = UPLOAD_OPERATION_STATUS.COMPLETED

        if (task) {
          this.expandDirectory(task, op.remotePath, task.localPath)
        }
      } else if (op.type === UPLOAD_OPERATION_TYPE.UPLOAD) {
        const controller = new AbortController()
        this.abortControllers.set(op.id, controller)

        try {
          const sessionId = task?.sessionId ?? ''
          const result = await protocolService.upload(
            sessionId,
            op.localPath ?? '',
            op.remotePath,
            transferred => {
              if (task) this.onOperationProgress(op, task, transferred)
            },
            controller.signal
          )

          if (isErr(result)) {
            if (isAbortError(result.error)) {
              this.operations = this.operations.filter(o => o.id !== op.id)
            } else {
              this.failOperation(op, result.error.message)
              return
            }
          } else {
            op.status = UPLOAD_OPERATION_STATUS.COMPLETED
            op.transferredSize = op.fileSize ?? 0
          }
        } finally {
          this.abortControllers.delete(op.id)
        }
      }
    } catch (error) {
      this.failOperation(op, formatErrorMessage(error))
      return
    }

    if (task) {
      this.lastOpProgressTime.delete(op.id)
      const runningOps = this.folderRunningOps.get(task.id) ?? 1
      this.folderRunningOps.set(task.id, Math.max(0, runningOps - 1))
      this.updateTaskStats(task)
      this.sendProgress(task)
      this.checkTaskCompletion(task)
      this.scheduleFolderOps(task.id)
    }
  }

  private expandDirectory(task: TransferTask, remoteDir: string, _localBaseDir: string): void {
    const relativePath = path.posix.relative(task.remotePath, remoteDir)
    const localDir = relativePath === '' ? task.localPath : path.join(task.localPath, relativePath)

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(localDir, { withFileTypes: true })
    } catch (_error) {
      logger.error(`Failed to read directory: ${localDir}`)
      return
    }

    for (const entry of entries) {
      const childRemotePath = joinPaths(remoteDir, entry.name)
      const childLocalPath = path.join(localDir, entry.name)

      if (entry.isDirectory()) {
        this.operations.push({
          id: crypto.randomUUID(),
          parentTaskId: task.id,
          type: UPLOAD_OPERATION_TYPE.MKDIR,
          remotePath: childRemotePath,
          itemName: entry.name,
          status: UPLOAD_OPERATION_STATUS.WAITING,
          transferredSize: 0,
        })
      } else if (entry.isFile()) {
        let fileSize = 0
        try {
          const stat = fs.statSync(childLocalPath)
          fileSize = stat.size
        } catch {
          // ignore stat errors
        }

        task.totalFileCount = (task.totalFileCount ?? 0) + 1

        this.operations.push({
          id: crypto.randomUUID(),
          parentTaskId: task.id,
          type: UPLOAD_OPERATION_TYPE.UPLOAD,
          localPath: childLocalPath,
          remotePath: childRemotePath,
          itemName: entry.name,
          status: UPLOAD_OPERATION_STATUS.WAITING,
          fileSize,
          transferredSize: 0,
        })
      }
    }

    this.updateTaskStats(task)
    this.scheduleFolderOps(task.id)
    this.sendProgress(task)
  }

  private failOperation(op: UploadOperation, errorMessage: string): void {
    op.status = UPLOAD_OPERATION_STATUS.FAILED
    op.errorMessage = errorMessage

    const task = this.tasks.find(t => t.id === op.parentTaskId)
    if (!task) return

    task.status = TRANSFER_TASK_STATUS.FAILED
    task.errorMessage = errorMessage

    this.cancelTaskWaitingOperations(task.id)
    this.abortTaskRunningOperations(task.id)

    this.folderRunningOps.delete(task.id)
    this.runningTasks--
    this.abortControllers.delete(op.id)
    this.speedSamples.delete(task.id)
    this.lastProgressTime.delete(task.id)

    this.sendTaskFailed(task)
    this.scheduleTasks()
  }

  private cancelTaskWaitingOperations(taskId: string): void {
    for (const op of this.operations) {
      if (op.parentTaskId === taskId && op.status === UPLOAD_OPERATION_STATUS.WAITING) {
        op.status = UPLOAD_OPERATION_STATUS.FAILED
      }
    }
  }

  private abortTaskRunningOperations(taskId: string): void {
    for (const op of this.operations) {
      if (op.parentTaskId === taskId && op.status === UPLOAD_OPERATION_STATUS.RUNNING) {
        const controller = this.abortControllers.get(op.id)
        if (controller) {
          controller.abort()
        }
        op.status = UPLOAD_OPERATION_STATUS.FAILED
      }
    }
  }

  private updateTaskStats(task: TransferTask): void {
    const taskOps = this.operations.filter(op => op.parentTaskId === task.id)
    const completedOps = taskOps.filter(op => op.status === UPLOAD_OPERATION_STATUS.COMPLETED)
    const runningOps = taskOps.filter(op => op.status === UPLOAD_OPERATION_STATUS.RUNNING)
    const waitingOps = taskOps.filter(op => op.status === UPLOAD_OPERATION_STATUS.WAITING)

    task.completedFileCount = completedOps.filter(
      op => op.type === UPLOAD_OPERATION_TYPE.UPLOAD
    ).length
    task.activeFileCount = runningOps.filter(op => op.type === UPLOAD_OPERATION_TYPE.UPLOAD).length
    task.waitingFileCount = waitingOps.filter(op => op.type === UPLOAD_OPERATION_TYPE.UPLOAD).length

    task.transferredSize =
      completedOps.reduce((sum, op) => sum + op.transferredSize, 0) +
      runningOps.reduce((sum, op) => sum + op.transferredSize, 0)
  }

  private checkTaskCompletion(task: TransferTask): void {
    if (task.status === TRANSFER_TASK_STATUS.FAILED) return

    const taskOps = this.operations.filter(op => op.parentTaskId === task.id)
    const allDone = taskOps.every(
      op =>
        op.status === UPLOAD_OPERATION_STATUS.COMPLETED ||
        op.status === UPLOAD_OPERATION_STATUS.FAILED
    )

    if (!allDone) return

    const hasFailed = taskOps.some(op => op.status === UPLOAD_OPERATION_STATUS.FAILED)

    if (hasFailed) {
      task.status = TRANSFER_TASK_STATUS.FAILED
      this.speedSamples.delete(task.id)
      this.lastProgressTime.delete(task.id)
      this.sendTaskFailed(task)
    } else {
      task.status = TRANSFER_TASK_STATUS.COMPLETED
      this.sendTaskCompleted(task)
      this.removeTask(task.id)
    }

    this.folderRunningOps.delete(task.id)
    this.runningTasks--
    this.scheduleTasks()
  }

  private onFileProgress(task: TransferTask, transferred: number): void {
    task.transferredSize = transferred
    this.addSpeedSample(task.id, transferred)

    const now = Date.now()
    const lastTime = this.lastProgressTime.get(task.id) ?? 0
    if (now - lastTime >= TRANSFER_CONFIG.PROGRESS_THROTTLE_MS) {
      this.lastProgressTime.set(task.id, now)
      this.sendProgress(task)
    }
  }

  private onOperationProgress(op: UploadOperation, task: TransferTask, transferred: number): void {
    op.transferredSize = transferred
    this.updateTaskStats(task)
    this.addSpeedSample(task.id, task.transferredSize)

    const now = Date.now()
    const lastTime = this.lastOpProgressTime.get(op.id) ?? 0
    if (now - lastTime >= TRANSFER_CONFIG.PROGRESS_THROTTLE_MS) {
      this.lastOpProgressTime.set(op.id, now)
      this.sendProgress(task)
    }
  }

  cancel(taskId: string): void {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId)
    if (taskIndex === -1) return

    const task = this.tasks[taskIndex]
    if (!task) return

    if (task.status === TRANSFER_TASK_STATUS.WAITING) {
      this.removeTask(task.id)
      this.sendTaskRemoved(task)
      this.scheduleTasks()
      return
    }

    if (task.status === TRANSFER_TASK_STATUS.RUNNING) {
      if (task.itemType === TRANSFER_ITEM_TYPE.FILE) {
        const controller = this.abortControllers.get(task.id)
        if (controller) controller.abort()
      } else {
        for (const op of this.operations) {
          if (op.parentTaskId === taskId && op.status === UPLOAD_OPERATION_STATUS.RUNNING) {
            const controller = this.abortControllers.get(op.id)
            if (controller) controller.abort()
          }
        }
      }

      this.removeTask(task.id)
      this.operations = this.operations.filter(op => op.parentTaskId !== taskId)
      this.folderRunningOps.delete(taskId)
      this.runningTasks--
      this.sendTaskRemoved(task)
      this.scheduleTasks()
      return
    }

    if (
      task.status === TRANSFER_TASK_STATUS.FAILED ||
      task.status === TRANSFER_TASK_STATUS.COMPLETED
    ) {
      this.removeTask(task.id)
      this.sendTaskRemoved(task)
    }
  }

  cancelAll(sessionId?: string): void {
    const tasksToCancel = sessionId
      ? this.tasks.filter(t => t.sessionId === sessionId)
      : [...this.tasks]

    for (const task of tasksToCancel) {
      this.cancel(task.id)
    }
  }

  setConcurrency(max: number): void {
    this.maxConcurrency = Math.min(
      TRANSFER_CONFIG.MAX_CONCURRENCY,
      Math.max(TRANSFER_CONFIG.MIN_CONCURRENCY, max)
    )
    this.scheduleTasks()

    for (const task of this.tasks) {
      if (
        task.status === TRANSFER_TASK_STATUS.RUNNING &&
        task.itemType === TRANSFER_ITEM_TYPE.FOLDER
      ) {
        this.scheduleFolderOps(task.id)
      }
    }
  }

  retry(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId)
    if (task?.status !== TRANSFER_TASK_STATUS.FAILED) return

    this.operations = this.operations.filter(op => op.parentTaskId !== taskId)
    this.folderRunningOps.delete(taskId)

    task.status = TRANSFER_TASK_STATUS.WAITING
    delete task.errorMessage
    task.transferredSize = 0
    delete task.startedAt
    delete task.completedFileCount
    delete task.activeFileCount
    delete task.waitingFileCount

    this.createInitialOperations(task)
    this.scheduleTasks()
  }

  retryAll(sessionId?: string): void {
    const tasksToRetry = sessionId
      ? this.tasks.filter(
          t => t.sessionId === sessionId && t.status === TRANSFER_TASK_STATUS.FAILED
        )
      : this.tasks.filter(t => t.status === TRANSFER_TASK_STATUS.FAILED)

    for (const task of tasksToRetry) {
      this.retry(task.id)
    }
  }

  hasActiveTasks(sessionId?: string): boolean {
    const tasks = sessionId ? this.tasks.filter(t => t.sessionId === sessionId) : this.tasks
    return tasks.some(
      t => t.status === TRANSFER_TASK_STATUS.WAITING || t.status === TRANSFER_TASK_STATUS.RUNNING
    )
  }

  getTasks(sessionId?: string): TransferTask[] {
    return sessionId ? this.tasks.filter(t => t.sessionId === sessionId) : [...this.tasks]
  }

  getActiveOperations(taskId: string): OperationProgressInfo[] {
    const taskOps = this.operations.filter(op => op.parentTaskId === taskId)

    const activeOps = taskOps.filter(
      op =>
        op.status === UPLOAD_OPERATION_STATUS.RUNNING ||
        op.status === UPLOAD_OPERATION_STATUS.WAITING
    )

    const completedUploadOps = taskOps
      .filter(
        op =>
          op.status === UPLOAD_OPERATION_STATUS.COMPLETED &&
          op.type === UPLOAD_OPERATION_TYPE.UPLOAD
      )
      .slice(-TRANSFER_CONFIG.MAX_INLINE_OPERATIONS)

    return [...activeOps, ...completedUploadOps].map(op => {
      const opSpeed = this.computeOpSpeed(op)
      const info: OperationProgressInfo = {
        id: op.id,
        itemName: op.itemName,
        type: op.type,
        transferredSize: op.transferredSize,
        status: op.status,
      }
      if (op.fileSize !== undefined) {
        info.fileSize = op.fileSize
      }
      if (op.startedAt !== undefined) {
        info.startedAt = op.startedAt
      }
      if (opSpeed > 0) {
        info.speed = opSpeed
      }
      return info
    })
  }

  private removeTask(taskId: string): void {
    const taskOps = this.operations.filter(op => op.parentTaskId === taskId)
    for (const op of taskOps) {
      this.lastOpProgressTime.delete(op.id)
    }
    this.tasks = this.tasks.filter(t => t.id !== taskId)
    this.operations = this.operations.filter(op => op.parentTaskId !== taskId)
    this.lastProgressTime.delete(taskId)
    this.speedSamples.delete(taskId)
  }

  private sendTasksEnqueued(tasks: TransferTask[]): void {
    this.send(TRANSFER_CHANNELS.TASKS_ENQUEUED, tasks)
  }

  private addSpeedSample(taskId: string, transferredSize: number): void {
    let samples = this.speedSamples.get(taskId)
    if (!samples) {
      samples = []
      this.speedSamples.set(taskId, samples)
    }

    const now = Date.now()
    samples.push({ timestamp: now, transferredSize })

    const cutoff = now - SPEED_WINDOW_MS
    while (samples.length > SPEED_MIN_SAMPLES && samples[0] && samples[0].timestamp < cutoff) {
      samples.shift()
    }
  }

  private computeSpeed(taskId: string): number {
    const samples = this.speedSamples.get(taskId)

    if (samples && samples.length >= SPEED_MIN_SAMPLES) {
      const oldest = samples[0]
      const latest = samples[samples.length - 1]
      if (oldest && latest) {
        const elapsed = (latest.timestamp - oldest.timestamp) / 1000
        if (elapsed > 0) {
          return (latest.transferredSize - oldest.transferredSize) / elapsed
        }
      }
    }

    return 0
  }

  private computeOpSpeed(op: UploadOperation): number {
    if (!op.startedAt || op.transferredSize === 0) return 0
    const elapsed = (Date.now() - op.startedAt) / 1000
    if (elapsed <= 0) return 0
    return op.transferredSize / elapsed
  }

  private sendProgress(task: TransferTask): void {
    const speed = this.computeSpeed(task.id)
    const data: TransferProgressData = {
      taskId: task.id,
      transferredSize: task.transferredSize,
    }
    if (task.fileSize > 0) data.fileSize = task.fileSize
    if (speed > 0) data.speed = speed
    if (task.totalFileCount !== undefined) data.totalFileCount = task.totalFileCount
    if (task.completedFileCount !== undefined) data.completedFileCount = task.completedFileCount
    if (task.activeFileCount !== undefined) data.activeFileCount = task.activeFileCount
    if (task.waitingFileCount !== undefined) data.waitingFileCount = task.waitingFileCount

    if (task.itemType === TRANSFER_ITEM_TYPE.FOLDER) {
      data.activeOperations = this.getActiveOperations(task.id)
    }

    this.send(TRANSFER_CHANNELS.PROGRESS, data)
  }

  private sendTaskCompleted(task: TransferTask): void {
    const data = {
      taskId: task.id,
      transferredSize: task.transferredSize,
      fileSize: task.fileSize,
    }
    this.send(TRANSFER_CHANNELS.TASK_COMPLETED, data)
  }

  private sendTaskFailed(task: TransferTask): void {
    const data = {
      taskId: task.id,
      errorMessage: task.errorMessage ?? 'Unknown error',
    }
    this.send(TRANSFER_CHANNELS.TASK_FAILED, data)
  }

  private sendTaskRemoved(task: TransferTask): void {
    this.send(TRANSFER_CHANNELS.TASK_REMOVED, { taskId: task.id })
  }

  private send(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}
