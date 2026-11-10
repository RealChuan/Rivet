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
import { isPauseAbort } from './abort-reason.js'
import { resolveDownloadTarget, resolveUploadTarget } from './conflict.js'
import { TaskSemaphore } from './semaphore.js'

export interface FileTransferExecutorOptions {
  getProvider(sessionId: string): FileProvider | undefined
  localFs: LocalFs
}

interface FolderDir {
  local: string
  remote: string
  /** 子目录的远端创建（上传）/ 枚举（下载）与扫描并行推进，出队时才等待。 */
  created?: Promise<void>
  listed?: Promise<Entry[]>
}

/** 扫描期的有限并发槽：远端 mkdir/list 并行，本地 stat 单独限流。 */
function runWithSlot<T>(
  slots: TaskSemaphore,
  key: string,
  signal: AbortSignal,
  run: () => Promise<T>,
): Promise<T> {
  return slots
    .acquire(key, signal)
    .then(run)
    .finally(() => {
      slots.release(key)
    })
}

/**
 * 目录枚举的工作池：队列会被正在枚举的子目录继续追加，
 * 因此 worker 只在“自己这一轮队列为空”时退出——那时不存在在途枚举，不会漏目录。
 */
async function drainDirQueue(
  queue: FolderDir[],
  signal: AbortSignal,
  processDir: (dir: FolderDir) => Promise<void>,
): Promise<void> {
  let failure: { error: unknown } | undefined

  const worker = async (): Promise<void> => {
    try {
      for (;;) {
        if (failure !== undefined) return
        signal.throwIfAborted()
        const dir = queue.shift()
        if (dir === undefined) return
        await processDir(dir)
      }
    } catch (error) {
      failure ??= { error }
    }
  }

  await Promise.all(Array.from({ length: TRANSFER_CONFIG.FOLDER_SCAN_CONCURRENCY }, () => worker()))
  if (failure !== undefined) throw failure.error
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
      if (isPauseAbort(signal)) return { kind: 'paused' }
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

    const failures: unknown[] = []
    // 准入窗口：已登记但未完成的子操作数量上限，按并发推导（并发 × 10）。
    // 每个排队文件要占住 op 对象 + 队列 Promise + 信号量 waiter（实测约 1.9KB），
    // 而传输能力只有并发那么大，堆更多既不会更快，也只会白占内存。
    const queueLimit = Math.max(
      1,
      hooks.getConcurrency() * TRANSFER_CONFIG.FOLDER_QUEUE_CONCURRENCY_FACTOR,
    )
    const admission = new TaskSemaphore(queueLimit)
    let inFlight = 0
    const idleWaiters: Array<() => void> = []

    task.totalFileCount = 0
    task.completedFileCount = 0
    task.activeFileCount = 0
    task.waitingFileCount = 0
    task.transferredSize = 0
    // 续传会重新扫一遍，之前的“扫描完成”不再成立。
    task.scanCompleted = false
    // 文件夹的字节总量只能边扫边累加；扫描结束前它就是“已发现字节数”。
    task.fileSize = 0
    this.reportFolder(task, hooks)

    const releaseOp = (opId: string): void => {
      inFlight -= 1
      admission.release(opId)
      if (inFlight === 0) {
        for (const resolve of idleWaiters.splice(0)) resolve()
      }
    }

    const waitForIdle = (): Promise<void> => {
      if (inFlight === 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        idleWaiters.push(resolve)
      })
    }

    const startFile = async (op: FolderFileOp): Promise<void> => {
      // 窗口满时在这里等：扫描进度跟着传输进度走，内存不会随文件数线性增长。
      await admission.acquire(op.id, controller.signal)

      task.totalFileCount = (task.totalFileCount ?? 0) + 1
      task.waitingFileCount = (task.waitingFileCount ?? 0) + 1
      task.fileSize += op.fileSize
      this.reportFolder(task, hooks)

      inFlight += 1
      void this.runFolderOp(provider, task, op, controller.signal, hooks)
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            failures.push(error)
            controller.abort()
          }
        })
        .finally(() => {
          releaseOp(op.id)
        })
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

    // 扫描结束后 totalFileCount 才是真正的总数；在此之前它只是“已发现”。
    task.scanCompleted = true
    this.reportFolder(task, hooks)

    await waitForIdle()

    // 暂停与取消都终止了扫描，区别在于父任务状态由服务决定。
    if (isPauseAbort(signal)) return { kind: 'paused' }
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
    startFile: (op: FolderFileOp) => Promise<void>,
  ): Promise<void> {
    const scanSlots = new TaskSemaphore(TRANSFER_CONFIG.FOLDER_SCAN_CONCURRENCY)
    const statSlots = new TaskSemaphore(TRANSFER_CONFIG.FOLDER_STAT_CONCURRENCY)
    const pendingFiles: Promise<void>[] = []
    // 补 size 的在途 promise 也要有窗口，否则单个大目录就能堆出与文件数等量的 Promise。
    const maxPendingStats = TRANSFER_CONFIG.FOLDER_STAT_CONCURRENCY * 4

    const flushPendingFiles = async (): Promise<void> => {
      if (pendingFiles.length === 0) return
      await Promise.all(pendingFiles.splice(0))
    }

    // 子目录 mkdir 不参与扫描的关键路径：先发起，出队枚举该目录时再等。
    const createDir = (remotePath: string): Promise<void> => {
      const key = `mkdir:${remotePath}`
      const created = runWithSlot(scanSlots, key, signal, () =>
        provider.mkdir(remotePath, { recursive: true, signal }),
      )
      // 扫描被取消时这个 Promise 可能没人消费，先挂空 catch 避免未处理拒绝。
      created.catch(() => undefined)
      return created
    }

    const queue: FolderDir[] = [
      { local: task.localPath, remote: task.remotePath, created: createDir(task.remotePath) },
    ]
    let index = 0

    const processDir = async (dir: FolderDir): Promise<void> => {
      await (dir.created ?? createDir(dir.remote))
      const entries = await this.options.localFs.readdir(dir.local)

      for (const entry of entries) {
        signal.throwIfAborted()
        const remotePath = joinPaths(dir.remote, entry.name)
        const localPath = joinPaths(dir.local, entry.name)

        if (entry.type === FILE_TYPE.DIRECTORY) {
          // 宽目录（成千上万个兄弟目录）只在队列短时预取，避免堆出等量等待者。
          const prefetch = queue.length < TRANSFER_CONFIG.FOLDER_SCAN_PREFETCH
          queue.push({
            local: localPath,
            remote: remotePath,
            ...(prefetch ? { created: createDir(remotePath) } : {}),
          })
          continue
        }

        const op: FolderFileOp = {
          id: `${task.id}:op:${index}`,
          localPath,
          localDir: dir.local,
          remotePath,
          itemName: entry.name,
          fileSize: entry.size,
        }
        index += 1

        if (entry.size > 0) {
          await startFile(op)
          continue
        }

        // readdir 不带大小；补 size 的本地 stat 并行做，避免大目录里串行等 IO
        // 把已发现的文件压在扫描后面。
        pendingFiles.push(
          runWithSlot(statSlots, `stat:${localPath}`, signal, () =>
            this.options.localFs.stat(localPath).catch(() => ({ size: 0, isDirectory: false })),
          ).then((stat) => {
            op.fileSize = stat.size
            return startFile(op)
          }),
        )
        if (pendingFiles.length >= maxPendingStats) await flushPendingFiles()
      }
    }

    await drainDirQueue(queue, signal, processDir)

    // 所有文件必须在 scanCompleted 之前登记，否则 totalFileCount 会在扫描结束后继续增长。
    await flushPendingFiles()
  }

  private async expandDownload(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    startFile: (op: FolderFileOp) => Promise<void>,
  ): Promise<boolean> {
    // 续传沿用首次解析出的目录，不再重问冲突；只有首次执行才判定目标。
    const resumingPath = task.resumeDownload === true ? task.resolvedLocalPath : undefined
    let localRoot: string

    if (resumingPath === undefined) {
      const target = await resolveDownloadTarget(this.options.localFs, task, { signal })
      if ('skip' in target) return true
      localRoot = target.path
      task.resolvedLocalPath = localRoot
    } else {
      localRoot = resumingPath
    }

    await this.options.localFs.mkdir(localRoot)

    const scanSlots = new TaskSemaphore(TRANSFER_CONFIG.FOLDER_SCAN_CONCURRENCY)

    // 远端 list 与扫描并行推进：出队枚举时再等，避免逐层串行把传输饿死。
    const listDir = (remotePath: string): Promise<Entry[]> => {
      const key = `list:${remotePath}`
      const listed = runWithSlot(scanSlots, key, signal, async () => {
        const entries: Entry[] = []
        for await (const entry of provider.list(remotePath, { signal })) {
          entries.push(entry)
        }
        return entries
      })
      listed.catch(() => undefined)
      return listed
    }

    const queue: FolderDir[] = [{ local: localRoot, remote: task.remotePath }]
    const resuming = resumingPath !== undefined
    let index = 0

    const processDir = async (dir: FolderDir): Promise<void> => {
      const entries = await (dir.listed ?? listDir(dir.remote))
      for (const entry of entries) {
        signal.throwIfAborted()
        const localPath = joinPaths(dir.local, entry.name)

        if (entry.kind === 'directory') {
          await this.options.localFs.mkdir(localPath)
          const prefetch = queue.length < TRANSFER_CONFIG.FOLDER_SCAN_PREFETCH
          queue.push({
            local: localPath,
            remote: entry.path,
            ...(prefetch ? { listed: listDir(entry.path) } : {}),
          })
          continue
        }

        // 续传时「文件在且没有半成品」即视为上次已下完；服务器改没改不重下。
        if (resuming && (await this.isAlreadyDownloaded(localPath))) {
          task.totalFileCount = (task.totalFileCount ?? 0) + 1
          task.completedFileCount = (task.completedFileCount ?? 0) + 1
          task.fileSize += entry.size
          task.transferredSize += entry.size
          continue
        }

        await startFile({
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

    await drainDirQueue(queue, signal, processDir)

    return false
  }

  /** 目录里已经落盘、且没有 `.rivet-download` 半成品的文件，视为上次已下完。 */
  private async isAlreadyDownloaded(localPath: string): Promise<boolean> {
    const stat = await this.options.localFs.stat(localPath).catch(() => null)
    if (stat === null || stat.isDirectory) return false

    const temp = await this.options.localFs.stat(localTempPath(localPath)).catch(() => null)
    return temp === null
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
    // 先登记子操作再推快照：否则快照会先带着“已激活但看不到子操作”的空窗出去。
    hooks.reportOperation(info)
    this.reportFolder(parent, hooks)

    let lastReported = 0
    const childTask: TransferTask = {
      ...parent,
      id: op.id,
      itemType: FILE_TYPE.FILE,
      // 父任务记的是目录路径，子文件必须自己重新判定落盘目标。
      resolvedLocalPath: op.localPath,
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
      getConcurrency: () => hooks.getConcurrency(),
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
      const outcome =
        parent.direction === TRANSFER_DIRECTION.UPLOAD
          ? await this.upload(provider, childTask, signal, childHooks)
          : await this.download(provider, childTask, signal, childHooks)

      // 暂停/取消的子文件没传完，不能算进已完成数；父任务的状态由服务统一收口。
      if (outcome.kind !== 'completed') return

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
      ...(task.fileSize > 0 ? { fileSize: task.fileSize } : {}),
      totalFileCount: task.totalFileCount ?? 0,
      completedFileCount: task.completedFileCount ?? 0,
      activeFileCount: task.activeFileCount ?? 0,
      waitingFileCount: task.waitingFileCount ?? 0,
      ...(task.scanCompleted ? { scanCompleted: true } : {}),
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

  /**
   * 续传检查点：上次停在 `<target>.rivet-download` 里，字节数就是下次的起点。
   * 目标路径只在首次解析冲突时确定，之后沿用，避免续传又弹一次冲突。
   */
  private async resumePoint(
    task: TransferTask,
  ): Promise<{ path: string; tempPath: string; offset: number } | null> {
    // 只有「继续/重试」才认临时文件；否则可能是上一个任务的残留，续上去就是脏数据。
    if (task.resumeDownload !== true) return null

    // 冲突解析可能改了落盘名（保留两者），所以优先用当时记下的路径。
    const targetPath = task.resolvedLocalPath ?? task.localPath
    const tempPath = localTempPath(targetPath)
    const stat = await this.options.localFs.stat(tempPath).catch(() => null)
    if (stat === null || stat.isDirectory || stat.size <= 0) return null
    // 临时文件已经与源文件等长：无法判断内容是否完整，重下比假装完整安全。
    if (task.fileSize > 0 && stat.size >= task.fileSize) return null

    return { path: targetPath, tempPath, offset: stat.size }
  }

  private async download(
    provider: FileProvider,
    task: TransferTask,
    signal: AbortSignal,
    hooks: ExecutorHooks,
  ): Promise<TaskOutcome> {
    const resumed = await this.resumePoint(task)
    let targetPath: string
    let offset = 0

    if (resumed !== null) {
      targetPath = resumed.path
      offset = resumed.offset
      task.resolvedLocalPath = targetPath
    } else {
      const target = await this.resolveDownloadTargetFor(task, signal)
      if (target === null) return { kind: 'completed' }
      targetPath = target.path
    }

    const tempPath = localTempPath(targetPath)

    const handle = await provider.openRead(task.remotePath, {
      signal,
      ...(offset > 0 ? { start: offset } : {}),
    })
    const reporter = createProgressReporter(task, (data) => hooks.report(data))

    try {
      let transferred = offset
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
        this.options.localFs.createWriteStream(tempPath, { append: offset > 0 }),
        { signal },
      )
      await this.options.localFs.rename(tempPath, targetPath)
      return { kind: 'completed' }
    } catch (error) {
      // 只有暂停保留半成品；取消和失败都清掉，避免留下无法继续的垃圾。
      if (isPauseAbort(signal)) return { kind: 'paused' }
      await this.options.localFs.unlink(tempPath).catch(() => {})
      if (signal.aborted) return { kind: 'cancelled' }
      throw error
    } finally {
      reporter.flush()
      await handle.close().catch(() => {})
    }
  }

  /** 解析下载目标并记下路径；冲突策略判定被跳过时返回 null。 */
  private async resolveDownloadTargetFor(
    task: TransferTask,
    signal: AbortSignal,
  ): Promise<{ path: string } | null> {
    const target = await resolveDownloadTarget(this.options.localFs, task, { signal })
    if ('skip' in target) return null
    task.resolvedLocalPath = target.path
    return target
  }
}
