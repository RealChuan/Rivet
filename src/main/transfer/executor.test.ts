import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { TransferProgressData, TransferTask } from '@shared/types/index.js'
import type { OperationProgressInfo } from '@shared/types/index.js'
import {
  ERROR_CODE,
  FILE_TYPE,
  OPERATION_STATUS,
  TRANSFER_DIRECTION,
} from '@shared/constants/index.js'
import type { FileProvider } from '../providers/types.js'
import type { ExecutorHooks, TaskOutcome } from './executor-types.js'
import type { LocalFs } from './local-fs.js'
import { ProviderError } from '../providers/errors.js'
import { createFakeProvider } from '../providers/test-utils/fake-provider.js'
import { FileTransferExecutor } from './executor.js'

function fileTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 't1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/a.txt',
    localDir: '/local',
    remotePath: '/remote/a.txt',
    itemName: 'a.txt',
    itemType: FILE_TYPE.FILE,
    status: OPERATION_STATUS.RUNNING,
    fileSize: 11,
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

function missing(): Promise<never> {
  return Promise.reject(new ProviderError(ERROR_CODE.NOT_FOUND, 'missing'))
}

function makeProvider(options: { remote?: Record<string, string>; failWrite?: Error } = {}) {
  const files = new Map(Object.entries(options.remote ?? {}))
  const written: Record<string, Uint8Array[]> = {}
  const commits: string[] = []
  const aborts: string[] = []
  const closes: string[] = []

  const openWrite = vi.fn((path: string) => {
    if (options.failWrite) return Promise.reject(options.failWrite)
    written[path] = []
    return Promise.resolve({
      stream: new WritableStream<Uint8Array>({
        write(chunk) {
          written[path]?.push(chunk)
        },
      }),
      commit: () => {
        commits.push(path)
        return Promise.resolve()
      },
      abort: () => {
        aborts.push(path)
        return Promise.resolve()
      },
    })
  })

  const provider: FileProvider = {
    ...createFakeProvider(),
    stat: vi.fn((path: string) => (files.has(path) ? Promise.resolve({} as never) : missing())),
    openRead: (path) =>
      Promise.resolve({
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(files.get(path) ?? ''))
            controller.close()
          },
        }),
        close: () => {
          closes.push(path)
          return Promise.resolve()
        },
      }),
    openWrite,
  }

  return { provider, files, written, commits, aborts, closes, openWrite }
}

function makeLocalFs(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial))
  const mkdirs: string[] = []
  const renames: Array<[string, string]> = []
  const unlinks: string[] = []

  const localFs: LocalFs = {
    stat: (path: string) =>
      files.has(path)
        ? Promise.resolve({ size: files.get(path)?.length ?? 0, isDirectory: false })
        : Promise.reject(new Error('ENOENT')),
    mkdir: (path) => {
      mkdirs.push(path)
      return Promise.resolve()
    },
    readdir: () => Promise.resolve([]),
    rename: (from, to) => {
      renames.push([from, to])
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
      unlinks.push(path)
      files.delete(path)
      return Promise.resolve()
    },
    createReadStream: (path) => Readable.from([Buffer.from(files.get(path) ?? '')]),
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

  return { localFs, files, mkdirs, renames, unlinks }
}

function createExecutor(provider: FileProvider, localFs: LocalFs): FileTransferExecutor {
  return new FileTransferExecutor({ getProvider: () => provider, localFs })
}

function text(chunks: Uint8Array[] | undefined): string {
  return Buffer.concat((chunks ?? []).map((chunk) => Buffer.from(chunk))).toString()
}

describe('FileTransferExecutor 上传', () => {
  it('openWrite → 写入两段数据 → commit，并回报递增字节数', async () => {
    const provider = makeProvider()
    const local = makeLocalFs({ '/local/a.txt': 'hello world' })
    const { hooks, report } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)
    const controller = new AbortController()

    const outcome = await executor.execute(fileTask(), controller.signal, hooks)

    expect(outcome).toEqual({ kind: 'completed' })
    expect(text(provider.written['/remote/a.txt'])).toBe('hello world')
    expect(provider.commits).toEqual(['/remote/a.txt'])
    expect(provider.aborts).toEqual([])
    const reported = report.mock.calls.map(([data]) => data.transferredSize)
    expect(reported.at(-1)).toBe(11)
    expect(provider.openWrite).toHaveBeenCalledWith(
      '/remote/a.txt',
      expect.objectContaining({ overwrite: false }),
    )
  })

  it('取消时调用 abort 并返回 cancelled', async () => {
    const provider = makeProvider()
    const local = makeLocalFs({ '/local/a.txt': 'hello' })
    const { hooks } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)
    const controller = new AbortController()
    controller.abort()

    const outcome = await executor.execute(fileTask(), controller.signal, hooks)

    expect(outcome).toEqual({ kind: 'cancelled' })
    expect(provider.aborts).toEqual(['/remote/a.txt'])
    expect(provider.commits).toEqual([])
  })

  it('provider 抛错时 abort 并把错误返回给服务', async () => {
    const provider = makeProvider({ failWrite: new Error('provider exploded') })
    const local = makeLocalFs({ '/local/a.txt': 'hello' })
    const { hooks } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)

    const outcome: TaskOutcome = await executor.execute(
      fileTask(),
      new AbortController().signal,
      hooks,
    )

    expect(outcome).toEqual({ kind: 'failed', message: 'provider exploded' })
    expect(provider.aborts).toEqual([])
  })
})

describe('FileTransferExecutor 下载', () => {
  it('openRead → 写本地临时文件 → rename 到最终路径', async () => {
    const provider = makeProvider({ remote: { '/remote/a.txt': 'abcdef' } })
    const local = makeLocalFs()
    const { hooks, report } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)

    const outcome = await executor.execute(
      fileTask({ direction: TRANSFER_DIRECTION.DOWNLOAD }),
      new AbortController().signal,
      hooks,
    )

    expect(outcome).toEqual({ kind: 'completed' })
    expect(local.files.get('/local/a.txt')).toBe('abcdef')
    expect(local.renames).toEqual([['/local/a.txt.rivet-download', '/local/a.txt']])
    expect(provider.closes).toEqual(['/remote/a.txt'])
    const reported = report.mock.calls.map(([data]) => data.transferredSize)
    expect(reported.at(-1)).toBe(6)
  })

  it('下载中断时删除临时文件并返回 cancelled', async () => {
    const provider = makeProvider({ remote: { '/remote/a.txt': 'abcdef' } })
    const local = makeLocalFs()
    const { hooks } = createHooks()
    const executor = createExecutor(provider.provider, local.localFs)
    const controller = new AbortController()
    controller.abort()

    const outcome = await executor.execute(
      fileTask({ direction: TRANSFER_DIRECTION.DOWNLOAD }),
      controller.signal,
      hooks,
    )

    expect(outcome).toEqual({ kind: 'cancelled' })
    expect(local.unlinks).toContain('/local/a.txt.rivet-download')
    expect(local.renames).toEqual([])
    expect(provider.closes).toEqual(['/remote/a.txt'])
  })
})
