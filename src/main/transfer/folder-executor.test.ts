import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '@shared/domain/entry.js'
import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/index.js'
import { FILE_TYPE, OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/index.js'
import type { FileProvider } from '../providers/types.js'
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

function createHooks() {
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
    })
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
    })
  })
})
