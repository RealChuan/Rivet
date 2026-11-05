import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
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
} from '@shared/constants/index.js'
import type { FileProvider, WriteHandle } from '../providers/types.js'
import type { ExecutorHooks } from './executor-types.js'
import type { LocalFs } from './local-fs.js'
import { ProviderError } from '../providers/errors.js'
import { createFakeProvider } from '../providers/test-utils/fake-provider.js'
import { FileTransferExecutor } from './executor.js'

function folderTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'folder-1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/folder',
    localDir: '/local',
    remotePath: '/remote/folder',
    itemName: 'folder',
    itemType: FILE_TYPE.DIRECTORY,
    status: OPERATION_STATUS.RUNNING,
    fileSize: 0,
    transferredSize: 0,
    createdAt: 1,
    ...overrides,
  }
}

function createHooks(concurrency: number = TRANSFER_CONFIG.DEFAULT_CONCURRENCY) {
  const acquire = vi.fn<(key: string, signal: AbortSignal) => Promise<void>>(() =>
    Promise.resolve(),
  )
  const release = vi.fn<(key: string) => void>()
  const report = vi.fn<(data: TransferProgressData) => void>()
  const reportOperation = vi.fn<(op: OperationProgressInfo) => void>()
  const hooks: ExecutorHooks = {
    acquire,
    release,
    report,
    reportOperation,
    isCancelled: () => false,
    getConcurrency: () => concurrency,
  }
  return { hooks, acquire, release, report, reportOperation }
}

function makeProvider(options: {
  remote?: Record<string, Entry[]>
  write?: (path: string) => Promise<void> | undefined
}) {
  const mkdirs: string[] = []
  const writes: string[] = []
  const provider: FileProvider = {
    ...createFakeProvider(),
    mkdir: vi.fn((path: string) => {
      mkdirs.push(path)
      return Promise.resolve()
    }),
    list: (path: string) =>
      (async function* () {
        await Promise.resolve()
        for (const entry of options.remote?.[path] ?? []) yield entry
      })(),
    stat: () => Promise.reject(new ProviderError('NOT_FOUND', 'missing')),
    openWrite: vi.fn((path: string) => {
      writes.push(path)
      if (options.write) {
        const failing = options.write(path)
        if (failing) return failing.then(() => Promise.reject(new Error('unused')))
      }
      return Promise.resolve({
        stream: new WritableStream<Uint8Array>(),
        commit: () => Promise.resolve(),
        abort: () => Promise.resolve(),
      })
    }),
    openRead: (path: string) =>
      Promise.resolve({
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data:${path}`))
            controller.close()
          },
        }),
        close: () => Promise.resolve(),
      }),
  }
  return { provider, mkdirs, writes }
}

function makeLocalFs(options: {
  tree?: Record<string, Array<{ name: string; dir: boolean; size?: number }>>
}) {
  const dirs = new Set<string>(['/'])
  const files = new Map<string, string>()
  const mkdirs: string[] = []
  const localFs: LocalFs = {
    stat: (path) =>
      files.has(path)
        ? Promise.resolve({ size: files.get(path)?.length ?? 0, isDirectory: false })
        : Promise.reject(new Error('ENOENT')),
    mkdir: (path) => {
      mkdirs.push(path)
      dirs.add(path)
      return Promise.resolve()
    },
    readdir: (path) =>
      Promise.resolve(
        (options.tree?.[path] ?? []).map((entry) => ({
          name: entry.name,
          size: entry.size ?? 0,
          type: entry.dir ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
        })),
      ),
    rename: (from, to) => {
      const data = files.get(from)
      if (data === undefined) return Promise.reject(new Error('ENOENT'))
      files.delete(from)
      files.set(to, data)
      return Promise.resolve()
    },
    rm: (path) => {
      files.delete(path)
      return Promise.resolve()
    },
    unlink: (path) => {
      files.delete(path)
      return Promise.resolve()
    },
    createReadStream: (path) => Readable.from([Buffer.from(files.get(path) ?? 'x')]),
    createWriteStream: (path) => {
      const chunks: Buffer[] = []
      const stream = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk)
          callback()
        },
      })
      stream.on('finish', () => {
        files.set(path, Buffer.concat(chunks).toString())
      })
      return stream
    },
  }
  return { localFs, files, mkdirs }
}

function createExecutor(provider: FileProvider, localFs: LocalFs): FileTransferExecutor {
  return new FileTransferExecutor({ getProvider: () => provider, localFs })
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  const state: { resolve?: () => void } = {}
  const promise = new Promise<void>((resolve) => {
    state.resolve = resolve
  })
  return {
    promise,
    resolve: () => {
      state.resolve?.()
    },
  }
}

describe('FileTransferExecutor 文件夹上传', () => {
  it('递归 mkdir 并上传两层文件，完成时计数正确', async () => {
    const provider = makeProvider({})
    const local = makeLocalFs({
      tree: {
        '/local/folder': [
          { name: 'sub', dir: true },
          { name: 'a.txt', dir: false, size: 4 },
        ],
        '/local/folder/sub': [{ name: 'b.txt', dir: false, size: 5 }],
      },
    })
    local.files.set('/local/folder/a.txt', 'aaaa')
    local.files.set('/local/folder/sub/b.txt', 'bbbbb')
    const { hooks, report, reportOperation } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)

    const outcome = await executor.execute(folderTask(), new AbortController().signal, hooks)

    expect(outcome).toEqual({ kind: 'completed' })
    expect(provider.mkdirs).toEqual(['/remote/folder', '/remote/folder/sub'])
    expect(provider.writes.sort()).toEqual(['/remote/folder/a.txt', '/remote/folder/sub/b.txt'])

    // 子文件正在传输时必须持续刷新 activeOperations，而不是只在开始/结束时上报。
    const runningUpdates = reportOperation.mock.calls
      .map(([op]) => op)
      .filter((op) => op.status === OPERATION_STATUS.RUNNING && op.transferredSize > 0)
    expect(runningUpdates.length).toBeGreaterThan(0)

    const lastReport = report.mock.calls.at(-1)?.[0]
    expect(lastReport).toMatchObject({
      taskId: 'folder-1',
      totalFileCount: 2,
      completedFileCount: 2,
      activeFileCount: 0,
      waitingFileCount: 0,
      transferredSize: 9,
      // 文件夹也要有字节总量，汇总行的“剩余时间”才有分母。
      fileSize: 9,
      scanCompleted: true,
    })

    // 扫描结束前上报的 totalFileCount 只是“已发现”，不能带 scanCompleted。
    const scanCompletedIndex = report.mock.calls.findIndex(([data]) => data.scanCompleted === true)
    expect(scanCompletedIndex).toBeGreaterThan(0)
  })

  it('先登记子操作再推文件夹快照，快照里不会出现“已激活但没有子操作”', async () => {
    const provider = makeProvider({})
    const local = makeLocalFs({
      tree: {
        '/local/folder': [{ name: 'a.txt', dir: false, size: 4 }],
      },
    })
    local.files.set('/local/folder/a.txt', 'aaaa')
    const { hooks, report, reportOperation } = createHooks()
    const sequence: string[] = []
    report.mockImplementation((data) => {
      if ((data.activeFileCount ?? 0) > 0) sequence.push('report-active')
    })
    reportOperation.mockImplementation((op) => {
      if (op.status === OPERATION_STATUS.RUNNING) sequence.push('op-running')
    })
    const executor = createExecutor(provider.provider, local.localFs)

    await executor.execute(folderTask(), new AbortController().signal, hooks)

    expect(sequence).toContain('report-active')
    expect(sequence.indexOf('op-running')).toBeLessThan(sequence.indexOf('report-active'))
  })

  it('兄弟目录的 mkdir 并行发起，不逐层串行等待', async () => {
    const provider = makeProvider({})
    const gates = new Map<string, { promise: Promise<void>; resolve: () => void }>()
    provider.provider.mkdir = vi.fn((path: string) => {
      const gate = deferred()
      gates.set(path, gate)
      return gate.promise
    })
    const local = makeLocalFs({
      tree: {
        '/local/folder': [
          { name: 'a', dir: true },
          { name: 'b', dir: true },
        ],
      },
    })
    const { hooks } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)
    const done = executor.execute(folderTask(), new AbortController().signal, hooks)

    await vi.waitFor(() => expect(gates.has('/remote/folder')).toBe(true))
    gates.get('/remote/folder')?.resolve()

    // 修复前 b 的 mkdir 要等 a 完成才会发起，扫描被逐层串行拖慢。
    await vi.waitFor(() =>
      expect([...gates.keys()]).toEqual(['/remote/folder', '/remote/folder/a', '/remote/folder/b']),
    )
    gates.get('/remote/folder/a')?.resolve()
    gates.get('/remote/folder/b')?.resolve()

    await expect(done).resolves.toEqual({ kind: 'completed' })
  })

  it('同层文件不必等兄弟目录 mkdir 完成就开始传输', async () => {
    const provider = makeProvider({})
    const gate = deferred()
    provider.provider.mkdir = vi.fn((path: string) =>
      path === '/remote/folder' ? Promise.resolve() : gate.promise,
    )
    const local = makeLocalFs({
      tree: {
        '/local/folder': [
          { name: 'sub', dir: true },
          { name: 'a.txt', dir: false, size: 4 },
        ],
      },
    })
    local.files.set('/local/folder/a.txt', 'aaaa')
    const { hooks } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)
    const done = executor.execute(folderTask(), new AbortController().signal, hooks)

    await vi.waitFor(() => expect(provider.writes).toContain('/remote/folder/a.txt'))

    gate.resolve()
    await expect(done).resolves.toEqual({ kind: 'completed' })
  })

  it('登记窗口满时暂停扫描，不会把所有文件一次性排进内存', async () => {
    const provider = makeProvider({})
    const releases: Array<() => void> = []
    const openWrite = vi.fn(
      () =>
        new Promise<WriteHandle>((resolve) => {
          releases.push(() => {
            resolve({
              stream: new WritableStream<Uint8Array>(),
              commit: () => Promise.resolve(),
              abort: () => Promise.resolve(),
            })
          })
        }),
    )
    provider.provider.openWrite = openWrite

    // 并发 1 → 窗口 1 × 10 = 10，用 12 个文件验证第 11 个不会入队。
    const fileCount = 12
    const entries = Array.from({ length: fileCount }, (_, i) => ({
      name: `f${i}.txt`,
      dir: false,
      size: 1,
    }))
    const local = makeLocalFs({ tree: { '/local/folder': entries } })
    for (let i = 0; i < fileCount; i += 1) {
      local.files.set(`/local/folder/f${i}.txt`, 'x')
    }

    const { hooks } = createHooks(1)
    const task = folderTask()
    const executor = createExecutor(provider.provider, local.localFs)
    const done = executor.execute(task, new AbortController().signal, hooks)

    const expectedQueue = TRANSFER_CONFIG.FOLDER_QUEUE_CONCURRENCY_FACTOR
    await vi.waitFor(() => expect(openWrite).toHaveBeenCalledTimes(expectedQueue))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(task.totalFileCount).toBe(expectedQueue)
    expect(task.fileSize).toBe(expectedQueue)

    const drain = setInterval(() => {
      for (const release of releases.splice(0)) release()
    }, 5)
    await expect(done).resolves.toEqual({ kind: 'completed' })
    clearInterval(drain)

    expect(task.totalFileCount).toBe(fileCount)
    expect(task.completedFileCount).toBe(fileCount)
  })

  it('取消父任务时不再启动新的子操作', async () => {
    const provider = makeProvider({})
    const local = makeLocalFs({
      tree: {
        '/local/folder': [
          { name: 'a.txt', dir: false, size: 1 },
          { name: 'b.txt', dir: false, size: 1 },
        ],
      },
    })
    local.files.set('/local/folder/a.txt', 'a')
    local.files.set('/local/folder/b.txt', 'b')
    const { hooks, acquire } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)
    const controller = new AbortController()

    acquire.mockImplementation(
      (key: string) =>
        new Promise<void>((_resolve, reject) => {
          controller.abort()
          reject(new ProviderError('REQUEST_ABORTED', `aborted ${key}`))
        }),
    )

    const outcome = await executor.execute(folderTask(), controller.signal, hooks)

    expect(outcome).toEqual({ kind: 'cancelled' })
    expect(provider.writes).toEqual([])
  })

  it('子操作失败时父任务 failed，其余等待操作被取消', async () => {
    const provider = makeProvider({
      write: () => Promise.reject(new Error('write failed')),
    })
    const local = makeLocalFs({
      tree: {
        '/local/folder': [
          { name: 'a.txt', dir: false, size: 1 },
          { name: 'b.txt', dir: false, size: 1 },
        ],
      },
    })
    local.files.set('/local/folder/a.txt', 'a')
    local.files.set('/local/folder/b.txt', 'b')
    const { hooks } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)

    const outcome = await executor.execute(folderTask(), new AbortController().signal, hooks)

    expect(outcome).toMatchObject({ kind: 'failed' })
    expect(provider.writes.length).toBeLessThanOrEqual(2)
  })
})

describe('FileTransferExecutor 文件夹下载', () => {
  it('按远端目录树创建本地目录并写入文件', async () => {
    const provider = makeProvider({
      remote: {
        '/remote/folder': [
          { name: 'sub', kind: 'directory', size: 0, mtime: 0, path: '/remote/folder/sub' },
          { name: 'a.txt', kind: 'file', size: 1, mtime: 0, path: '/remote/folder/a.txt' },
        ],
        '/remote/folder/sub': [
          { name: 'b.txt', kind: 'file', size: 1, mtime: 0, path: '/remote/folder/sub/b.txt' },
        ],
      },
    })
    const local = makeLocalFs({})
    const { hooks, report } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)

    const outcome = await executor.execute(
      folderTask({ direction: TRANSFER_DIRECTION.DOWNLOAD, localDir: '/downloads' }),
      new AbortController().signal,
      hooks,
    )

    expect(outcome).toEqual({ kind: 'completed' })
    expect(local.mkdirs).toEqual(['/downloads/folder', '/downloads/folder/sub'])
    expect(local.files.has('/downloads/folder/a.txt')).toBe(true)
    expect(local.files.has('/downloads/folder/sub/b.txt')).toBe(true)
    const lastReport = report.mock.calls.at(-1)?.[0]
    expect(lastReport).toMatchObject({
      totalFileCount: 2,
      completedFileCount: 2,
      transferredSize: 54,
      fileSize: 2,
    })
  })
})
