/* eslint-disable @typescript-eslint/no-unsafe-return -- mock 透传 any 参数 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { Entry, ProviderKind } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import type { FileInfo, KnownHostRecord } from '@shared/types/index.js'
import { ERROR_CODE, FILE_TYPE, MAX_LIST_ENTRIES, TIMEOUTS } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { ok } from '@shared/domain/result.js'
import type { ProviderFactoryOptions } from '../providers/registry.js'
import type { FileProvider } from '../providers/types.js'
import { RequestRegistry } from '../ipc/request-registry.js'
import { ProviderError } from '../providers/errors.js'
import { SessionRegistry } from '../providers/session-registry.js'
import { FAKE_CAPABILITIES, FAKE_ENTRY } from '../providers/test-utils/fake-provider.js'
import { logger } from '../utils/logger.js'
import { ProtocolService } from './protocol-service.js'

const mockSendToMainWindow = vi.fn()
const mockGetKnownHost = vi.fn()

vi.mock('../app/main-window.js', () => ({
  sendToMainWindow: (...args: unknown[]) => mockSendToMainWindow(...args),
}))

vi.mock('../stores/known-hosts.js', () => ({
  getKnownHost: (...args: unknown[]) => mockGetKnownHost(...args),
}))

vi.mock('../providers/sftp/host-key.js', () => ({
  parseHostPublicKey: () => ({ algorithm: 'ssh-ed25519', fingerprint: 'SHA256:new' }),
}))

const config: ConnectionConfig = {
  id: 'c1',
  name: 'Test',
  protocol: 'sftp',
  host: 'example.com',
  port: 22,
  username: 'user',
  authKind: 'password',
}

async function* emptyEntries(): AsyncGenerator<Entry> {
  await Promise.resolve()
  for (const entry of [] as Entry[]) {
    yield entry
  }
}

async function* entriesOf(...entries: Entry[]): AsyncGenerator<Entry> {
  await Promise.resolve()
  for (const entry of entries) yield entry
}

async function* hangingEntries(): AsyncGenerator<Entry> {
  await new Promise<never>(() => {})
  yield FAKE_ENTRY
}

function createTestProvider() {
  const connect = vi.fn((_credentials: Credentials) => Promise.resolve())
  const disconnect = vi.fn(() => Promise.resolve())
  const list = vi.fn<FileProvider['list']>(() => emptyEntries())
  const mkdir = vi.fn(() => Promise.resolve())
  const remove = vi.fn(() => Promise.resolve())
  const rename = vi.fn(() => Promise.resolve())

  const openRead = vi.fn<FileProvider['openRead']>(() =>
    Promise.resolve({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      }),
      close: () => Promise.resolve(),
    }),
  )
  const openWrite = vi.fn<FileProvider['openWrite']>(() =>
    Promise.resolve({
      stream: new WritableStream<Uint8Array>(),
      commit: () => Promise.resolve(),
      abort: () => Promise.resolve(),
    }),
  )

  const provider: FileProvider = {
    kind: 'sftp',
    capabilities: FAKE_CAPABILITIES,
    connect,
    disconnect,
    ping: () => Promise.resolve(),
    list,
    stat: () => Promise.resolve(FAKE_ENTRY),
    mkdir,
    remove,
    rename,
    openRead,
    openWrite,
  }

  return { provider, connect, disconnect, list, mkdir, remove, rename, openRead, openWrite }
}

function makeHarness(providerOverride?: FileProvider) {
  const sessions = new SessionRegistry()
  const requests = new RequestRegistry()
  const testProvider = createTestProvider()
  const provider = providerOverride ?? testProvider.provider
  const createProvider = vi.fn(
    (_kind: ProviderKind, _options: ProviderFactoryOptions): FileProvider => provider,
  )
  const getConnectionSecret = vi.fn((_connectionId: string) =>
    Promise.resolve(ok<string | undefined>('secret')),
  )
  const saveConnectionSecret = vi.fn(() => Promise.resolve(ok({ stored: true })))
  const deleteConnectionSecret = vi.fn()
  const hasActiveTasks = vi.fn((_sessionId: string) => false)

  const service = new ProtocolService({
    sessions,
    requests,
    createProvider,
    getConnectionSecret,
    saveConnectionSecret,
    deleteConnectionSecret,
    hasActiveTasks,
  })

  const registerSession = (sessionId = 's1'): void => {
    sessions.register(sessionId, {
      provider,
      config,
      protocolType: 'sftp',
      isClosing: false,
    })
  }

  return {
    service,
    sessions,
    requests,
    ...testProvider,
    provider,
    createProvider,
    getConnectionSecret,
    saveConnectionSecret,
    deleteConnectionSecret,
    hasActiveTasks,
    registerSession,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ProtocolService.connect', () => {
  beforeEach(() => {
    mockGetKnownHost.mockReturnValue(ok<undefined>(undefined))
  })

  it('密码认证：从主进程读秘密、建会话并返回能力快照', async () => {
    const harness = makeHarness()
    let captured: Credentials | undefined
    let observedConfig: ConnectionConfig | undefined

    harness.createProvider.mockImplementation((_kind, options) => {
      observedConfig = options.config
      harness.connect.mockImplementation((credentials) => {
        captured = credentials
        return Promise.resolve()
      })
      return harness.provider
    })

    const response = await harness.service.connect({ connection: config })

    expect(response.success).toBe(true)
    if (!response.success) return
    expect(response.value.sessionId).toMatch(/^sftp_/)
    expect(response.value.capabilities).toEqual(FAKE_CAPABILITIES)
    expect(observedConfig).toBe(config)
    expect(harness.getConnectionSecret).toHaveBeenCalledWith('c1')
    expect(captured).toEqual({ kind: 'password', username: 'user', password: 'secret' })
    expect(harness.sessions.get(response.value.sessionId)?.provider).toBe(harness.provider)
  })

  it('未知主机密钥返回 HOST_KEY_UNKNOWN 且不注册会话', async () => {
    const harness = makeHarness()
    harness.createProvider.mockImplementation((_kind, options) => {
      harness.connect.mockImplementation(() => {
        options.hostVerifier?.(Buffer.from('key'))
        return Promise.reject(new ProviderError(ERROR_CODE.HOST_KEY_ERROR, 'unknown'))
      })
      return harness.provider
    })

    const response = await harness.service.connect({ connection: config })

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error).toEqual({
      code: ERROR_CODE.HOST_KEY_UNKNOWN,
      message: 'Unknown host key',
      detail: {
        host: 'example.com',
        port: 22,
        algorithm: 'ssh-ed25519',
        fingerprint: 'SHA256:new',
      },
    })
    expect(harness.sessions.count).toBe(0)
    expect(harness.disconnect).toHaveBeenCalled()
  })

  it('已记录且匹配时连接成功', async () => {
    const harness = makeHarness()
    mockGetKnownHost.mockReturnValue(
      ok<KnownHostRecord>({
        host: 'example.com',
        port: 22,
        algorithm: 'ssh-ed25519',
        fingerprint: 'SHA256:new',
        createdAt: 1,
      }),
    )
    harness.createProvider.mockImplementation((_kind, options) => {
      harness.connect.mockImplementation(() => {
        expect(options.hostVerifier?.(Buffer.from('key'))).toBe(true)
        return Promise.resolve()
      })
      return harness.provider
    })

    const response = await harness.service.connect({ connection: config })

    expect(response.success).toBe(true)
  })

  it('主机密钥不匹配返回 HOST_KEY_MISMATCH 且带旧指纹', async () => {
    const harness = makeHarness()
    mockGetKnownHost.mockReturnValue(
      ok<KnownHostRecord>({
        host: 'example.com',
        port: 22,
        algorithm: 'ssh-ed25519',
        fingerprint: 'SHA256:old',
        createdAt: 1,
      }),
    )
    harness.createProvider.mockImplementation((_kind, options) => {
      harness.connect.mockImplementation(() => {
        expect(options.hostVerifier?.(Buffer.from('key'))).toBe(false)
        return Promise.reject(new ProviderError(ERROR_CODE.HOST_KEY_ERROR, 'mismatch'))
      })
      return harness.provider
    })

    const response = await harness.service.connect({ connection: config })

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error).toMatchObject({
      code: ERROR_CODE.HOST_KEY_MISMATCH,
      detail: { previousFingerprint: 'SHA256:old' },
    })
    expect(harness.sessions.count).toBe(0)
  })

  it('私钥认证：privateKeyPath 转成 Credentials，秘密作为 passphrase', async () => {
    const harness = makeHarness()
    let captured: Credentials | undefined
    harness.connect.mockImplementation((credentials) => {
      captured = credentials
      return Promise.resolve()
    })

    const response = await harness.service.connect({
      connection: {
        ...config,
        authKind: 'privateKey',
        privateKeyPath: '/home/user/.ssh/id_ed25519',
      },
    })

    expect(response.success).toBe(true)
    expect(captured).toEqual({
      kind: 'privateKey',
      username: 'user',
      privateKeyPath: '/home/user/.ssh/id_ed25519',
      passphrase: 'secret',
    })
  })

  it('私钥认证缺少路径返回 INVALID_CONFIG', async () => {
    const harness = makeHarness()

    const response = await harness.service.connect({
      connection: { ...config, authKind: 'privateKey' },
    })

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.INVALID_CONFIG)
    expect(harness.connect).not.toHaveBeenCalled()
  })

  it('缺少密码返回 AUTH_ERROR', async () => {
    const harness = makeHarness()
    harness.getConnectionSecret.mockResolvedValue(ok(undefined))

    const response = await harness.service.connect({ connection: config })

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.AUTH_ERROR)
  })

  it('saveSecret true 保存密码，false 删除秘密', async () => {
    const harness = makeHarness()

    await harness.service.connect({ connection: config, secret: 'pw', saveSecret: true })
    expect(harness.saveConnectionSecret).toHaveBeenCalledWith('c1', 'pw')

    await harness.service.connect({ connection: config, secret: 'pw', saveSecret: false })
    expect(harness.deleteConnectionSecret).toHaveBeenCalledWith('c1')
  })

  it('provider 连接异常收敛为 CONN_FAILED 并清理', async () => {
    const harness = makeHarness()
    harness.connect.mockImplementation(() => Promise.reject(new Error('boom')))

    const response = await harness.service.connect({ connection: config })

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.CONN_FAILED)
    expect(harness.disconnect).toHaveBeenCalled()
  })
})

describe('ProtocolService 请求包装', () => {
  it('未知会话返回 SESSION_NOT_FOUND', async () => {
    const harness = makeHarness()

    const response = await harness.service.list('missing', '/')

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.SESSION_NOT_FOUND)
  })

  it('list 把 AsyncIterable<Entry> 累积为 FileInfo[]', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation(() =>
      entriesOf(
        { name: 'a.txt', kind: 'file', size: 3, mtime: 10, path: '/a.txt' },
        { name: 'sub', kind: 'directory', size: 0, mtime: 20, path: '/sub' },
      ),
    )

    const response = await harness.service.list('s1', '/', 'req-list')

    expect(response.success).toBe(true)
    if (!response.success) return
    expect(response.value).toEqual([
      {
        name: 'a.txt',
        type: FILE_TYPE.FILE,
        size: 3,
        modifyTime: 10,
        permissions: '',
        owner: '',
        absolutePath: '/a.txt',
      },
      {
        name: 'sub',
        type: FILE_TYPE.DIRECTORY,
        size: 0,
        modifyTime: 20,
        permissions: '',
        owner: '',
        absolutePath: '/sub',
      },
    ])
  })

  it('list 超过 MAX_LIST_ENTRIES 时截断并只警告一次', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation(() =>
      (async function* () {
        await Promise.resolve()
        for (let i = 0; i < MAX_LIST_ENTRIES + 5; i += 1) {
          yield { ...FAKE_ENTRY, name: `f${i}`, path: `/f${i}` }
        }
      })(),
    )
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    const response = await harness.service.list('s1', '/')

    expect(response.success).toBe(true)
    if (!response.success) return
    expect(response.value).toHaveLength(MAX_LIST_ENTRIES)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('list 超时返回 REQUEST_TIMEOUT', async () => {
    vi.useFakeTimers()
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation(() => hangingEntries())

    const pending = harness.service.list('s1', '/', 'req-timeout')
    await vi.advanceTimersByTimeAsync(TIMEOUTS.LIST + 1)
    const response = await pending

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.REQUEST_TIMEOUT)
  })

  it('cancel(requestId) 返回 REQUEST_ABORTED', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation(() => hangingEntries())

    const pending = harness.service.list('s1', '/', 'req-cancel')
    harness.service.cancel('req-cancel')
    const response = await pending

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.REQUEST_ABORTED)
  })

  it('mkdir 失败以 warn 记录协议层日志', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.mkdir.mockRejectedValueOnce(new Error('permission denied'))
    const warn = vi.spyOn(logger, 'warn')

    const response = await harness.service.mkdir('s1', '/new', 'req-mkdir-fail')

    expect(response.success).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      'Protocol mkdir failed',
      expect.objectContaining({ sessionId: 's1', code: ERROR_CODE.MKDIR_ERROR }),
    )
    warn.mockRestore()
  })

  it('mkdir/rename/delete/move 转调 provider 并回传 requestId', async () => {
    const harness = makeHarness()
    harness.registerSession()
    const file: FileInfo = {
      name: 'old.txt',
      type: FILE_TYPE.FILE,
      size: 0,
      modifyTime: 0,
      absolutePath: '/dir/old.txt',
    }

    await harness.service.mkdir('s1', '/new', 'req-mkdir')
    await harness.service.rename('s1', file, 'new.txt', 'req-rename')
    await harness.service.delete('s1', file, 'req-delete')
    await harness.service.move('s1', file, '/other/new.txt', 'req-move')

    expect(harness.mkdir).toHaveBeenCalledWith('/new', expect.objectContaining({ recursive: true }))
    expect(harness.rename).toHaveBeenCalledWith(
      '/dir/old.txt',
      '/dir/new.txt',
      expect.any(AbortSignal),
    )
    expect(harness.remove).toHaveBeenCalledWith('/dir/old.txt', expect.any(AbortSignal))
    expect(harness.rename).toHaveBeenCalledWith(
      '/dir/old.txt',
      '/other/new.txt',
      expect.any(AbortSignal),
    )
  })

  it('路径遍历被拒绝为 PATH_TRAVERSAL', async () => {
    const harness = makeHarness()
    harness.registerSession()

    const response = await harness.service.list('s1', '/../etc')

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.PATH_TRAVERSAL)
  })
})

describe('ProtocolService.copy', () => {
  const file: FileInfo = {
    name: 'a.txt',
    type: FILE_TYPE.FILE,
    size: 0,
    modifyTime: 0,
    absolutePath: '/a.txt',
  }

  it('provider 有服务端 copy 时直接调用，不打开流', async () => {
    const base = makeHarness()
    const copy = vi.fn((_from: string, _to: string, _signal?: AbortSignal) => Promise.resolve())
    const provider: FileProvider = {
      ...base.provider,
      capabilities: { ...FAKE_CAPABILITIES, serverSideCopy: true },
      copy,
    }
    const harness = makeHarness(provider)
    harness.registerSession()

    const response = await harness.service.copy('s1', file, '/b.txt', 'req-copy')

    expect(response.success).toBe(true)
    expect(copy).toHaveBeenCalledWith('/a.txt', '/b.txt', expect.any(AbortSignal))
    expect(harness.openRead).not.toHaveBeenCalled()
    expect(harness.openWrite).not.toHaveBeenCalled()
  })

  it('provider 无 copy 时回退到 openRead/openWrite', async () => {
    const base = makeHarness()
    const commit = vi.fn(() => Promise.resolve())
    const close = vi.fn(() => Promise.resolve())
    const openRead = vi.fn<FileProvider['openRead']>(() =>
      Promise.resolve({
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data'))
            controller.close()
          },
        }),
        close,
      }),
    )
    const openWrite = vi.fn<FileProvider['openWrite']>(() =>
      Promise.resolve({
        stream: new WritableStream<Uint8Array>(),
        commit,
        abort: vi.fn(() => Promise.resolve()),
      }),
    )
    const provider: FileProvider = {
      ...base.provider,
      capabilities: FAKE_CAPABILITIES,
      openRead,
      openWrite,
    }
    const harness = makeHarness(provider)
    harness.registerSession()

    const response = await harness.service.copy('s1', file, '/b.txt', 'req-copy')

    expect(response.success).toBe(true)
    expect(openRead).toHaveBeenCalledWith('/a.txt', expect.any(Object))
    expect(openWrite).toHaveBeenCalledWith('/b.txt', expect.objectContaining({ overwrite: true }))
    expect(commit).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })
})

describe('ProtocolService.calculateFolderStats', () => {
  function makeWindow() {
    return { send: mockSendToMainWindow }
  }

  function statsEvents(send: typeof mockSendToMainWindow): unknown[] {
    return send.mock.calls
      .filter(([channel]) => channel === EVENT_CHANNEL.FOLDER_STATS_PROGRESS)
      .map(([, payload]) => payload)
  }

  it('统计完成发送 isComplete:true，并使用 tag 且无超时', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation((path: string) => {
      if (path === '/') {
        return entriesOf(
          { name: 'sub', kind: 'directory', size: 0, mtime: 0, path: '/sub' },
          { name: 'a.txt', kind: 'file', size: 3, mtime: 0, path: '/a.txt' },
        )
      }
      if (path === '/sub') {
        return entriesOf({ name: 'b.txt', kind: 'file', size: 4, mtime: 0, path: '/sub/b.txt' })
      }
      return emptyEntries()
    })
    const run = vi.spyOn(harness.requests, 'run')
    const { send } = makeWindow()

    const result = await harness.service.calculateFolderStats('s1', '/')

    expect(result.success).toBe(true)
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'stats:s1', timeoutMs: null }),
      expect.any(Function),
    )
    expect(statsEvents(send).at(-1)).toMatchObject({
      sessionId: 's1',
      fileCount: 2,
      folderCount: 1,
      totalSize: 7,
      isComplete: true,
      isCancelled: false,
    })
  })

  it('统计不设置超时：推进任意假时钟后仍完成', async () => {
    vi.useFakeTimers()
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation(() =>
      entriesOf({ name: 'a.txt', kind: 'file', size: 1, mtime: 0, path: '/a.txt' }),
    )
    const { send } = makeWindow()

    const pending = harness.service.calculateFolderStats('s1', '/')
    await vi.advanceTimersByTimeAsync(1_000_000_000)
    const result = await pending

    expect(result.success).toBe(true)
    expect(statsEvents(send).at(-1)).toMatchObject({ isComplete: true })
  })

  it('取消发送 isCancelled:true 并返回成功', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.list.mockImplementation((_path: string, opts: { signal: AbortSignal }) =>
      (async function* () {
        await new Promise<void>((resolve) => {
          if (opts.signal.aborted) {
            resolve()
            return
          }
          opts.signal.addEventListener('abort', () => resolve(), { once: true })
        })
        yield FAKE_ENTRY
      })(),
    )
    const { send } = makeWindow()

    const pending = harness.service.calculateFolderStats('s1', '/')
    harness.service.cancelCalculateFolderStats('s1')
    const result = await pending

    expect(result.success).toBe(true)
    expect(statsEvents(send).at(-1)).toMatchObject({
      sessionId: 's1',
      isComplete: false,
      isCancelled: true,
    })
  })

  it('同一 session 重复启动统计时旧请求被 cancelByTag 取消', async () => {
    const harness = makeHarness()
    harness.registerSession()
    let call = 0
    harness.list.mockImplementation((_path: string, opts: { signal: AbortSignal }) => {
      call += 1
      if (call > 1) return emptyEntries()
      return (async function* () {
        await new Promise<void>((resolve) => {
          opts.signal.addEventListener('abort', () => resolve(), { once: true })
        })
        yield FAKE_ENTRY
      })()
    })
    const cancelByTag = vi.spyOn(harness.requests, 'cancelByTag')
    const first = harness.service.calculateFolderStats('s1', '/')
    const second = harness.service.calculateFolderStats('s1', '/')

    expect(cancelByTag).toHaveBeenCalledWith('stats:s1')
    await first
    const secondResult = await second
    expect(secondResult.success).toBe(true)
  })
})

describe('ProtocolService.disconnect', () => {
  it('有活跃任务时返回 UPLOAD_IN_PROGRESS 且不调用 provider', async () => {
    const harness = makeHarness()
    harness.registerSession()
    harness.hasActiveTasks.mockReturnValue(true)

    const response = await harness.service.disconnect('s1')

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.UPLOAD_IN_PROGRESS)
    expect(harness.disconnect).not.toHaveBeenCalled()
  })

  it('断开后从会话表移除', async () => {
    const harness = makeHarness()
    harness.registerSession()

    const response = await harness.service.disconnect('s1', 'req-disconnect')

    expect(response.success).toBe(true)
    expect(harness.disconnect).toHaveBeenCalled()
    expect(harness.sessions.has('s1')).toBe(false)
  })

  it('未知会话返回 SESSION_NOT_FOUND', async () => {
    const harness = makeHarness()

    const response = await harness.service.disconnect('missing')

    expect(response.success).toBe(false)
    if (response.success) return
    expect(response.error.code).toBe(ERROR_CODE.SESSION_NOT_FOUND)
  })
})
