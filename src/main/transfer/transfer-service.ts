import type { LastDirKey, TransferDirection } from '@shared/constants/index.js'
import type {
  DeduplicateResult,
  LocalFileInfo,
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/index.js'
import {
  FILE_TYPE,
  MAX_FINISHED_TASKS,
  OPERATION_STATUS,
  TRANSFER_CONFIG,
  TRANSFER_DIRECTION,
} from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import type { FileProvider } from '../providers/types.js'
import type {
  ExecutorHooks,
  TaskOutcome,
  TaskStatPort,
  TransferExecutor,
} from './executor-types.js'
import type { ProgressAggregator } from './progress-aggregator.js'
import { logger } from '../utils/logger.js'
import { TaskSemaphore } from './semaphore.js'

export interface TransferServiceOptions {
  getProvider(sessionId: string): FileProvider | undefined
  executor: TransferExecutor
  localFs: TaskStatPort
  send(channel: string, payload: unknown): void
  progress: ProgressAggregator
  maxFinishedTasks?: number
}

function taskKey(task: TransferTask): string {
  return `${task.sessionId}\0${task.localPath}\0${task.remotePath}`
}

function clampConcurrency(value: number): number {
  return Math.min(TRANSFER_CONFIG.MAX_CONCURRENCY, Math.max(TRANSFER_CONFIG.MIN_CONCURRENCY, value))
}

/**
 * 显式状态机：WAITING（queued）→ RUNNING → COMPLETED / FAILED / CANCELLED。
 * 取消只通过每任务的 AbortController 与方向信号量，没有旁路取消集合。
 */
export class TransferService {
  private readonly options: TransferServiceOptions
  private readonly maxFinishedTasks: number
  private readonly tasks = new Map<string, TransferTask>()
  private readonly taskKeys = new Map<string, string>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly pendingAcquires = new Set<string>()
  private readonly operationsByTask = new Map<string, Map<string, OperationProgressInfo>>()
  private readonly lastDirs = new Map<LastDirKey, string>()
  private readonly concurrency: Record<TransferDirection, number> = {
    [TRANSFER_DIRECTION.UPLOAD]: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
    [TRANSFER_DIRECTION.DOWNLOAD]: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  }

  private readonly uploads = new TaskSemaphore(TRANSFER_CONFIG.DEFAULT_CONCURRENCY)
  private readonly downloads = new TaskSemaphore(TRANSFER_CONFIG.DEFAULT_CONCURRENCY)
  private disposed = false

  constructor(options: TransferServiceOptions) {
    this.options = options
    this.maxFinishedTasks = options.maxFinishedTasks ?? MAX_FINISHED_TASKS
  }

  private emit(channel: string, payload: unknown): void {
    this.options.send(channel, payload)
  }

  async addTasks(tasks: TransferTask[]): Promise<DeduplicateResult> {
    const added: TransferTask[] = []
    const duplicates: TransferTask[] = []

    // 同步段只做去重与插入，保证并发 addTasks 不会重复入队。
    for (const task of tasks) {
      const key = taskKey(task)
      if (this.taskKeys.has(key)) {
        duplicates.push(task)
        continue
      }

      task.status = OPERATION_STATUS.WAITING
      this.tasks.set(task.id, task)
      this.taskKeys.set(key, task.id)
      added.push(task)
    }

    if (duplicates.length > 0 && added.length === 0) {
      return { added, duplicates }
    }

    await Promise.all(
      added.map(async (task) => {
        if (task.itemType !== FILE_TYPE.FILE || task.fileSize !== 0) return
        try {
          const stat = await this.options.localFs.stat(task.localPath)
          task.fileSize = stat.size
        } catch (error) {
          // Ruling：stat 失败仍保留任务，传输阶段再失败。
          logger.debug('Failed to stat file for size detection', {
            path: task.localPath,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }),
    )

    if (added.length > 0) {
      this.emit(EVENT_CHANNEL.TASKS_ENQUEUED, added)
      this.schedule()
    }

    return { added, duplicates }
  }

  getTasks(sessionId?: string): TransferTask[] {
    const tasks = [...this.tasks.values()]
    return sessionId ? tasks.filter((task) => task.sessionId === sessionId) : tasks
  }

  hasActiveTasks(sessionId?: string): boolean {
    return this.getTasks(sessionId).some(
      (task) =>
        task.status === OPERATION_STATUS.WAITING || task.status === OPERATION_STATUS.RUNNING,
    )
  }

  cancel(taskId: string): Promise<void> {
    this.cancelSync(taskId)
    return Promise.resolve()
  }

  private cancelSync(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    if (task.status === OPERATION_STATUS.FAILED) {
      this.removeTaskWithEvent(task)
      return
    }

    if (task.status === OPERATION_STATUS.WAITING) {
      task.status = OPERATION_STATUS.CANCELLED
      const controller = this.controllers.get(taskId)
      if (controller) {
        controller.abort()
      } else {
        this.removeTaskWithEvent(task)
      }
      return
    }

    if (task.status === OPERATION_STATUS.RUNNING) {
      task.status = OPERATION_STATUS.CANCELLED
      this.controllers.get(taskId)?.abort()
    }
  }

  cancelAll(sessionId?: string): void {
    for (const task of this.getTasks(sessionId)) {
      this.cancelSync(task.id)
    }
  }

  retry(taskId: string): Promise<void> {
    this.retrySync(taskId)
    return Promise.resolve()
  }

  private retrySync(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task?.status !== OPERATION_STATUS.FAILED) return

    task.status = OPERATION_STATUS.WAITING
    task.errorMessage = undefined
    task.transferredSize = 0
    task.startedAt = undefined
    task.completedFileCount = undefined
    task.activeFileCount = undefined
    task.waitingFileCount = undefined
    this.operationsByTask.delete(taskId)
    this.schedule()
  }

  retryAll(sessionId?: string): void {
    for (const task of this.getTasks(sessionId)) {
      if (task.status === OPERATION_STATUS.FAILED) {
        this.retrySync(task.id)
      }
    }
  }

  getConcurrency(direction: TransferDirection): number {
    return this.concurrency[direction]
  }

  setConcurrency(max: number, direction: TransferDirection): void {
    const clamped = clampConcurrency(max)
    this.concurrency[direction] = clamped
    this.semaphoreFor(direction).setCapacity(clamped)
    this.schedule()
  }

  async checkLocalFiles(localDir: string): Promise<LocalFileInfo[]> {
    try {
      return await this.options.localFs.readdir(localDir)
    } catch (error) {
      logger.debug('Failed to read local directory', {
        localDir,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  getLastDir(key: LastDirKey): string | null {
    return this.lastDirs.get(key) ?? null
  }

  setLastDir(key: LastDirKey, dir: string): void {
    this.lastDirs.set(key, dir)
  }

  cleanupSessionTasks(sessionId?: string): void {
    for (const task of this.getTasks(sessionId)) {
      const wasActive =
        task.status === OPERATION_STATUS.WAITING || task.status === OPERATION_STATUS.RUNNING
      if (wasActive) {
        task.status = OPERATION_STATUS.CANCELLED
        this.controllers.get(task.id)?.abort()
      }
      this.removeTaskWithEvent(task)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const controller of this.controllers.values()) {
      controller.abort()
    }
    this.controllers.clear()
    this.pendingAcquires.clear()
    this.operationsByTask.clear()
    this.tasks.clear()
    this.taskKeys.clear()
    this.options.progress.dispose()
  }

  private semaphoreFor(direction: TransferDirection): TaskSemaphore {
    return direction === TRANSFER_DIRECTION.UPLOAD ? this.uploads : this.downloads
  }

  private schedule(): void {
    if (this.disposed) return
    for (const task of this.tasks.values()) {
      if (task.status !== OPERATION_STATUS.WAITING) continue

      if (task.itemType === FILE_TYPE.DIRECTORY) {
        this.startDirectoryTask(task)
        continue
      }

      this.queueFileTask(task)
    }
  }

  private startDirectoryTask(task: TransferTask): void {
    task.status = OPERATION_STATUS.RUNNING
    task.startedAt = Date.now()
    const controller = new AbortController()
    this.controllers.set(task.id, controller)
    void this.executeTask(task, controller)
  }

  private queueFileTask(task: TransferTask): void {
    if (this.pendingAcquires.has(task.id)) return

    const controller = new AbortController()
    this.controllers.set(task.id, controller)
    this.pendingAcquires.add(task.id)

    const semaphore = this.semaphoreFor(task.direction)
    void semaphore.acquire(task.id, controller.signal).then(
      () => {
        this.pendingAcquires.delete(task.id)
        if (this.tasks.get(task.id) !== task || task.status !== OPERATION_STATUS.WAITING) {
          semaphore.release(task.id)
          if (task.status === OPERATION_STATUS.CANCELLED) {
            this.removeTaskWithEvent(task)
          }
          return
        }
        task.status = OPERATION_STATUS.RUNNING
        task.startedAt = Date.now()
        void this.executeTask(task, controller)
      },
      () => {
        this.pendingAcquires.delete(task.id)
        if (task.status === OPERATION_STATUS.CANCELLED) {
          this.removeTaskWithEvent(task)
        }
      },
    )
  }

  private async executeTask(task: TransferTask, controller: AbortController): Promise<void> {
    const semaphore = this.semaphoreFor(task.direction)

    try {
      this.progress(task)

      let outcome: TaskOutcome
      try {
        outcome = await this.options.executor.execute(
          task,
          controller.signal,
          this.createHooks(task),
        )
      } catch (error) {
        outcome = {
          kind: 'failed',
          message: error instanceof Error ? error.message : String(error),
        }
      }

      this.controllers.delete(task.id)
      this.operationsByTask.delete(task.id)
      semaphore.release(task.id)

      if (task.status === OPERATION_STATUS.CANCELLED) {
        outcome = { kind: 'cancelled' }
      }

      this.options.progress.flush()

      if (!this.tasks.has(task.id)) return

      switch (outcome.kind) {
        case 'completed':
          this.completeTask(task)
          break
        case 'failed':
          logger.error(`Transfer task failed: ${outcome.message}`, {
            taskId: task.id,
            direction: task.direction,
            localPath: task.localPath,
            remotePath: task.remotePath,
          })
          this.failTask(task, outcome.message)
          break
        case 'cancelled':
          this.removeTaskWithEvent(task)
          break
      }
    } finally {
      this.schedule()
    }
  }

  private completeTask(task: TransferTask): void {
    task.status = OPERATION_STATUS.COMPLETED
    if (task.fileSize > 0) {
      task.transferredSize = task.fileSize
    }
    this.emit(EVENT_CHANNEL.TASK_COMPLETED, {
      taskId: task.id,
      transferredSize: task.transferredSize,
      fileSize: task.fileSize,
    })
    this.removeTask(task.id)
  }

  private failTask(task: TransferTask, message: string): void {
    task.status = OPERATION_STATUS.FAILED
    task.errorMessage = message
    this.emit(EVENT_CHANNEL.TASK_FAILED, {
      taskId: task.id,
      errorMessage: message,
    })
    this.enforceFinishedLimit()
  }

  private enforceFinishedLimit(): void {
    const failed = [...this.tasks.values()]
      .filter((task) => task.status === OPERATION_STATUS.FAILED)
      .sort((left, right) => left.createdAt - right.createdAt)

    while (failed.length > this.maxFinishedTasks) {
      const oldest = failed.shift()
      if (!oldest) return
      this.removeTaskWithEvent(oldest)
    }
  }

  private createHooks(task: TransferTask): ExecutorHooks {
    const semaphore = this.semaphoreFor(task.direction)

    return {
      acquire: (key, signal) => semaphore.acquire(key, signal),
      release: (key) => {
        semaphore.release(key)
      },
      report: (data) => {
        this.options.progress.update(this.withOperations(task.id, data))
      },
      reportOperation: (op) => {
        this.upsertOperation(task.id, op)
      },
      isCancelled: (taskId) => this.tasks.get(taskId)?.status === OPERATION_STATUS.CANCELLED,
    }
  }

  private upsertOperation(taskId: string, op: OperationProgressInfo): void {
    let operations = this.operationsByTask.get(taskId)
    if (!operations) {
      operations = new Map()
      this.operationsByTask.set(taskId, operations)
    }

    if (op.status === OPERATION_STATUS.RUNNING || op.status === OPERATION_STATUS.WAITING) {
      operations.set(op.id, op)
    } else {
      operations.delete(op.id)
    }
  }

  private withOperations(taskId: string, data: TransferProgressData): TransferProgressData {
    const operations = this.operationsByTask.get(taskId)
    if (!operations || operations.size === 0) return data

    return {
      ...data,
      activeOperations: [...operations.values()].slice(0, TRANSFER_CONFIG.MAX_INLINE_OPERATIONS),
    }
  }

  private progress(task: TransferTask): void {
    this.options.progress.update(
      this.withOperations(task.id, {
        taskId: task.id,
        transferredSize: task.transferredSize,
        ...(task.fileSize > 0 ? { fileSize: task.fileSize } : {}),
        ...(task.totalFileCount !== undefined ? { totalFileCount: task.totalFileCount } : {}),
        ...(task.completedFileCount !== undefined
          ? { completedFileCount: task.completedFileCount }
          : {}),
        ...(task.activeFileCount !== undefined ? { activeFileCount: task.activeFileCount } : {}),
        ...(task.waitingFileCount !== undefined ? { waitingFileCount: task.waitingFileCount } : {}),
      }),
    )
  }

  private removeTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    this.tasks.delete(taskId)
    this.taskKeys.delete(taskKey(task))
    this.controllers.delete(taskId)
    this.operationsByTask.delete(taskId)
  }

  private removeTaskWithEvent(task: TransferTask): void {
    this.removeTask(task.id)
    this.emit(EVENT_CHANNEL.TASK_REMOVED, { taskId: task.id })
  }
}
