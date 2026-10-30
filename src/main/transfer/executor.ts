import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Entry } from '@shared/domain/entry.js'
import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/index.js'
import {
  FILE_TYPE,
  OPERATION_STATUS,
  TRANSFER_CONFIG,
  TRANSFER_DIRECTION,
  TRANSFER_OPERATION_TYPE,
} from '@shared/constants/index.js'
import { joinPaths } from '@shared/utils/index.js'
import type { FileProvider } from '../providers/types.js'
import type { ExecutorHooks, TaskOutcome, TransferExecutor } from './executor-types.js'
import type { LocalFs } from './local-fs.js'
import { localTempPath } from '../utils/temp-path.js'
import { resolveDownloadTarget, resolveUploadTarget } from './conflict.js'

export interface FileTransferExecutorOptions {
  getProvider(sessionId: string): FileProvider | undefined
  localFs: LocalFs
}

interface FolderDir {
  local: string
  remote: string
}

interface FolderFileOp {
  id: string
  localPath: string
  localDir: string
  remotePath: string
  itemName: string
  fileSize: number
}

interface ProgressReporter {
  report(transferredSize: number): void
  flush(): void
}

/**
 * 分块事件可能每秒上千次，先在这里按时间窗口合并，再由主进程 ProgressAggregator
 * 按 200ms 批量发给渲染层。flush 保证结束/取消时一定发出最终字节数。
 */
function createProgressReporter(
  task: TransferTask,
  report: (data: TransferProgressData) => void,
): ProgressReporter {
  let latest = 0
  let lastSentAt = 0
  let timer: NodeJS.Timeout | null = null

  const send = (): void => {
    lastSentAt = Date.now()
    report({ fileSize: task.fileSize, taskId: task.id, transferredSize: latest })
  }

  return {
    report: (transferredSize) => {
      latest = transferredSize
      if (timer !== null) return

      const elapsed = Date.now() - lastSentAt
      if (elapsed >= TRANSFER_CONFIG.PROGRESS_THROTTLE_MS) {
        send()
        return
      }

      timer = setTimeout(() => {
        timer = null
        send()
      }, TRANSFER_CONFIG.PROGRESS_THROTTLE_MS - elapsed)
    },
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      send()
    },
  }
}

/**
 * 文件任务执行器：上传走 openWrite + commit，下载先写本地临时文件再 rename。
 * 目录任务在 Task 22 接入；这里只返回不支持错误。
 */
export class FileTransferExecutor implements TransferExecutor {
  private readonly options: FileTransferExecutorOptions

  constructor(options: FileTransferExecutorOptions) {
    this.options = options
  }

  async execute(
    task: TransferTask,
    signal: AbortSignal,
    hooks: ExecutorHooks,
  ): Promise<TaskOutcome> {
    const provider = this.options.getProvider(task.sessionId)
    if (!provider) {
      return { kind: 'failed', message: `Session not found: ${task.sessionId}` }
    }

    if (task.itemType === FILE_TYPE.DIRECTORY) {
      return this.executeFolder(provider, task, signal, hooks)
    }

    try {
      return task.direction === TRANSFER_DIRECTION.UPLOAD
        ? await this.upload(provider, task, signal, hooks)
        : await this.download(provider, task, signal, hooks)
    } catch (error) {
      if (signal.aborted) return { kind: 'cancelled' }
      return {
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async executeFolder(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    hooks: ExecutorHooks,
  ): Promise<TaskOutcome> {
    const controller = new AbortController()
    const onAbort = (): void => controller.abort(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) controller.abort(signal.reason)

    const running: Promise<void>[] = []
    const failures: unknown[] = []

    task.totalFileCount = 0
    task.completedFileCount = 0
    task.activeFileCount = 0
    task.waitingFileCount = 0
    task.transferredSize = 0
    this.reportFolder(task, hooks)

    const startFile = (op: FolderFileOp): void => {
      task.totalFileCount = (task.totalFileCount ?? 0) + 1
      task.waitingFileCount = (task.waitingFileCount ?? 0) + 1
      this.reportFolder(task, hooks)

      running.push(
        this.runFolderOp(provider, task, op, controller.signal, hooks).catch((error: unknown) => {
          if (!controller.signal.aborted) {
            failures.push(error)
            controller.abort()
          }
        }),
      )
    }

    try {
      if (task.direction === TRANSFER_DIRECTION.UPLOAD) {
        await this.expandUpload(provider, task, controller.signal, startFile)
      } else {
        const skipped = await this.expandDownload(provider, task, controller.signal, startFile)
        if (skipped) return { kind: 'completed' }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        failures.push(error)
        controller.abort()
      }
    } finally {
      signal.removeEventListener('abort', onAbort)
    }

    await Promise.allSettled(running)

    if (signal.aborted) return { kind: 'cancelled' }

    const [firstFailure] = failures
    if (firstFailure !== undefined) {
      return {
        kind: 'failed',
        message:
          firstFailure instanceof Error ? firstFailure.message : 'Unknown folder transfer error',
      }
    }

    return { kind: 'completed' }
  }

  private async expandUpload(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    startFile: (op: FolderFileOp) => void,
  ): Promise<void> {
    await provider.mkdir(task.remotePath, { recursive: true, signal })

    const queue: FolderDir[] = [{ local: task.localPath, remote: task.remotePath }]
    let index = 0

    while (queue.length > 0) {
      signal.throwIfAborted()
      const dir = queue.shift()
      if (!dir) break

      const entries = await this.options.localFs.readdir(dir.local)
      for (const entry of entries) {
        signal.throwIfAborted()
        const remotePath = joinPaths(dir.remote, entry.name)

        if (entry.type === FILE_TYPE.DIRECTORY) {
          await provider.mkdir(remotePath, { recursive: true, signal })
          queue.push({ local: joinPaths(dir.local, entry.name), remote: remotePath })
          continue
        }

        const localPath = joinPaths(dir.local, entry.name)
        let fileSize = entry.size
        if (fileSize === 0) {
          try {
            fileSize = (await this.options.localFs.stat(localPath)).size
          } catch {
            fileSize = 0
          }
        }

        startFile({
          id: `${task.id}:op:${index}`,
          localPath,
          localDir: dir.local,
          remotePath,
          itemName: entry.name,
          fileSize,
        })
        index += 1
      }
    }
  }

  private async expandDownload(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    startFile: (op: FolderFileOp) => void,
  ): Promise<boolean> {
    const target = await resolveDownloadTarget(this.options.localFs, task, { signal })
    if ('skip' in target) return true

    await this.options.localFs.mkdir(target.path)

    const queue: FolderDir[] = [{ local: target.path, remote: task.remotePath }]
    let index = 0

    while (queue.length > 0) {
      signal.throwIfAborted()
      const dir = queue.shift()
      if (!dir) break

      const entries: Entry[] = []
      for await (const entry of provider.list(dir.remote, { signal })) {
        entries.push(entry)
      }

      for (const entry of entries) {
        signal.throwIfAborted()
        const localPath = joinPaths(dir.local, entry.name)

        if (entry.kind === 'directory') {
          await this.options.localFs.mkdir(localPath)
          queue.push({ local: localPath, remote: entry.path })
          continue
        }

        startFile({
          id: `${task.id}:op:${index}`,
          localPath,
          localDir: dir.local,
          remotePath: entry.path,
          itemName: entry.name,
          fileSize: entry.size,
        })
        index += 1
      }
    }

    return false
  }

  private async runFolderOp(
    provider: FileProvider,
    parent: TransferTask,
    op: FolderFileOp,
    signal: AbortSignal,
    hooks: ExecutorHooks,
  ): Promise<void> {
    await hooks.acquire(op.id, signal)

    parent.waitingFileCount = Math.max(0, (parent.waitingFileCount ?? 0) - 1)
    parent.activeFileCount = (parent.activeFileCount ?? 0) + 1
    this.reportFolder(parent, hooks)

    const info: OperationProgressInfo = {
      id: op.id,
      itemName: op.itemName,
      type:
        parent.direction === TRANSFER_DIRECTION.UPLOAD
          ? TRANSFER_OPERATION_TYPE.UPLOAD
          : TRANSFER_OPERATION_TYPE.DOWNLOAD,
      transferredSize: 0,
      fileSize: op.fileSize,
      status: OPERATION_STATUS.RUNNING,
    }
    hooks.reportOperation(info)

    let lastReported = 0
    const childTask: TransferTask = {
      ...parent,
      id: op.id,
      itemType: FILE_TYPE.FILE,
      localPath: op.localPath,
      localDir: op.localDir,
      remotePath: op.remotePath,
      itemName: op.itemName,
      fileSize: op.fileSize,
      transferredSize: 0,
      status: OPERATION_STATUS.RUNNING,
    }

    const childHooks: ExecutorHooks = {
      acquire: (key, signal) => hooks.acquire(key, signal),
      release: (key) => hooks.release(key),
      reportOperation: (op) => hooks.reportOperation(op),
      isCancelled: (taskId) => hooks.isCancelled(taskId),
      report: (data) => {
        const delta = data.transferredSize - lastReported
        lastReported = data.transferredSize
        parent.transferredSize += Math.max(0, delta)

        // 子文件进度必须写回 activeOperations，否则 UI 一直显示 0%，直到完成才消失。
        hooks.reportOperation({
          ...info,
          status: OPERATION_STATUS.RUNNING,
          transferredSize: data.transferredSize,
        })
        this.reportFolder(parent, hooks)
      },
    }

    try {
      if (parent.direction === TRANSFER_DIRECTION.UPLOAD) {
        await this.upload(provider, childTask, signal, childHooks)
      } else {
        await this.download(provider, childTask, signal, childHooks)
      }

      parent.completedFileCount = (parent.completedFileCount ?? 0) + 1
      hooks.reportOperation({
        ...info,
        transferredSize: op.fileSize,
        status: OPERATION_STATUS.COMPLETED,
      })
    } catch (error) {
      hooks.reportOperation({ ...info, status: OPERATION_STATUS.FAILED })
      throw error
    } finally {
      parent.activeFileCount = Math.max(0, (parent.activeFileCount ?? 0) - 1)
      hooks.release(op.id)
      this.reportFolder(parent, hooks)
    }
  }

  private reportFolder(task: TransferTask, hooks: ExecutorHooks): void {
    const data: TransferProgressData = {
      taskId: task.id,
      transferredSize: task.transferredSize,
      totalFileCount: task.totalFileCount ?? 0,
      completedFileCount: task.completedFileCount ?? 0,
      activeFileCount: task.activeFileCount ?? 0,
      waitingFileCount: task.waitingFileCount ?? 0,
    }
    hooks.report(data)
  }

  private async upload(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    hooks: ExecutorHooks,
  ): Promise<TaskOutcome> {
    const target = await resolveUploadTarget(provider, task, { signal })
    if ('skip' in target) return { kind: 'completed' }

    const handle = await provider.openWrite(target.path, {
      overwrite: target.overwrite,
      signal,
    })
    const reporter = createProgressReporter(task, (data) => hooks.report(data))

    try {
      let transferred = 0
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform: (chunk, controller) => {
          transferred += chunk.length
          reporter.report(transferred)
          controller.enqueue(chunk)
        },
      })

      const source = Readable.toWeb(
        this.options.localFs.createReadStream(task.localPath),
      ) as ReadableStream<Uint8Array>
      await source.pipeThrough(counter).pipeTo(handle.stream, { signal })
      await handle.commit()
      return { kind: 'completed' }
    } catch (error) {
      await handle.abort().catch(() => {})
      if (signal.aborted) return { kind: 'cancelled' }
      throw error
    } finally {
      reporter.flush()
    }
  }

  private async download(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    hooks: ExecutorHooks,
  ): Promise<TaskOutcome> {
    const target = await resolveDownloadTarget(this.options.localFs, task, { signal })
    if ('skip' in target) return { kind: 'completed' }

    const tempPath = localTempPath(target.path)

    const handle = await provider.openRead(task.remotePath, { signal })
    const reporter = createProgressReporter(task, (data) => hooks.report(data))

    try {
      let transferred = 0
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          transferred += chunk.length
          reporter.report(transferred)
          callback(null, chunk)
        },
      })

      await pipeline(
        Readable.fromWeb(handle.stream as NodeReadableStream<Uint8Array>),
        counter,
        this.options.localFs.createWriteStream(tempPath),
        { signal },
      )
      await this.options.localFs.rename(tempPath, target.path)
      return { kind: 'completed' }
    } catch (error) {
      await this.options.localFs.unlink(tempPath).catch(() => {})
      if (signal.aborted) return { kind: 'cancelled' }
      throw error
    } finally {
      reporter.flush()
      await handle.close().catch(() => {})
    }
  }
}
