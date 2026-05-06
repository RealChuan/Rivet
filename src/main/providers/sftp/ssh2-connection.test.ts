import { Readable, Writable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import { TIMEOUTS } from '@shared/constants/index.js'
import type { Ssh2SftpPort } from './ssh2-connection.js'
import { Ssh2SftpConnection } from './ssh2-connection.js'

const config: ConnectionConfig = {
  id: 'conn-1',
  name: 'Test',
  protocol: 'sftp',
  host: 'example.com',
  port: 2222,
  username: 'alice',
}

type Listener = (...args: unknown[]) => void

function stats(options: {
  directory?: boolean
  symlink?: boolean
  size?: number
  mtime?: number
  mode?: number
}) {
  return {
    isDirectory: () => options.directory ?? false,
    isFile: () => !options.directory && !options.symlink,
    isSymbolicLink: () => options.symlink ?? false,
    size: options.size ?? 0,
    mtime: options.mtime ?? 0,
    mode: options.mode ?? 0o100644,
  }
}

/** 复刻 ssh2 的 SFTP 错误形状：message 是状态码文案，code 是数值状态码。 */
function statusError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code })
}

function makeSftp() {
  return {
    readdir: vi.fn((_path: string, cb: (error?: Error | null, entries?: unknown[]) => void) =>
      cb(null, []),
    ),
    stat: vi.fn((_path: string, cb: (error?: Error | null, result?: unknown) => void) =>
      cb(null, stats({})),
    ),
    mkdir: vi.fn((_path: string, cb: (error?: Error | null) => void) => cb(null)),
    rmdir: vi.fn((_path: string, cb: (error?: Error | null) => void) => cb(null)),
    unlink: vi.fn((_path: string, cb: (error?: Error | null) => void) => cb(null)),
    rename: vi.fn((_from: string, _to: string, cb: (error?: Error | null) => void) => cb(null)),
    chmod: vi.fn((_path: string, _mode: number, cb: (error?: Error | null) => void) => cb(null)),
    createReadStream: vi.fn(() => Readable.from(['abc'])),
    createWriteStream: vi.fn(
      () =>
        new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          },
        }),
    ),
  }
}

function makeClient(options: { autoReady?: boolean; sftp?: Ssh2SftpPort } = {}) {
  const listeners = new Map<string, Listener[]>()
  const client = {
    on: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
    }),
    removeListener: vi.fn((event: string, listener: Listener) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((item) => item !== listener),
      )
    }),
    connect: vi.fn((_options: Record<string, unknown>) => {
      if (options.autoReady !== false) {
        queueMicrotask(() => emit('ready'))
      }
    }),
    end: vi.fn(),
    sftp: vi.fn((cb: (error?: Error | null, sftp?: Ssh2SftpPort) => void) => {
      queueMicrotask(() => cb(null, options.sftp ?? makeSftp()))
    }),
    emit,
  }

  function emit(event: 'ready' | 'error', ...args: unknown[]): void {
    for (const listener of listeners.get(event) ?? []) listener(...args)
  }

  return client
}

describe('Ssh2SftpConnection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('connect 把认证配置与 hostVerifier 交给 ssh2', async () => {
    const client = makeClient()
    const hostVerifier = vi.fn(() => true)
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })

    await connection.connect(
      { kind: 'password', username: 'alice', password: 'secret' },
      { hostVerifier },
    )

    expect(client.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'example.com',
        port: 2222,
        username: 'alice',
        password: 'secret',
        readyTimeout: TIMEOUTS.SFTP_READY,
        hostVerifier,
      }),
    )
  })

  it('私钥认证把 Buffer 与 passphrase 交给 ssh2', async () => {
    const client = makeClient()
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })

    await connection.connect({
      kind: 'privateKey',
      username: 'alice',
      privateKeyPath: process.execPath,
      passphrase: 'p@ss',
    })

    const connectOptions = client.connect.mock.calls[0]?.[0]
    expect(connectOptions?.privateKey).toBeInstanceOf(Buffer)
    expect(connectOptions?.passphrase).toBe('p@ss')
  })

  it('认证错误映射为稳定错误码', async () => {
    // agent 认证依赖环境变量；Ubuntu CI 没有 ssh-agent，显式注入保证测试可重复。
    vi.stubEnv('SSH_AUTH_SOCK', '/tmp/rivet-test-agent.sock')
    const client = makeClient({ autoReady: false })
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })

    const pending = expect(
      connection.connect({ kind: 'agent', username: 'alice' }),
    ).rejects.toMatchObject({ code: 'AGENT_NO_IDENTITY' })
    await vi.waitFor(() => {
      expect(client.on).toHaveBeenCalled()
    })
    client.emit('error', new Error('All configured authentication methods failed'))

    await pending
    expect(client.end).toHaveBeenCalled()
  })

  it('list 映射 ssh2 的 attrs、longname 与时间', async () => {
    const sftp = makeSftp()
    sftp.readdir.mockImplementation(
      (_path: string, cb: (error?: Error | null, entries?: unknown[]) => void) => {
        cb(null, [
          {
            filename: 'a.txt',
            longname: '-rw-r--r-- 1 alice staff 3 Jan 1 00:00 a.txt',
            attrs: stats({ size: 3, mtime: 1700000000, mode: 0o100644 }),
          },
        ])
      },
    )
    const client = makeClient({ sftp })
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })
    await connection.connect({ kind: 'password', username: 'alice', password: 'secret' })

    const entries = await connection.list('/dir')

    expect(entries).toEqual([
      {
        name: 'a.txt',
        kind: 'file',
        size: 3,
        mtime: 1700000000000,
        permissions: 'rw-r--r--',
        owner: 'alice',
      },
    ])
  })

  it('stat 把类型与路径映射为 RawSftpEntry', async () => {
    const sftp = makeSftp()
    sftp.stat.mockImplementation(
      (_path: string, cb: (error?: Error | null, result?: unknown) => void) => {
        cb(null, stats({ directory: true, size: 0, mtime: 1, mode: 0o40755 }))
      },
    )
    const client = makeClient({ sftp })
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })
    await connection.connect({ kind: 'password', username: 'alice', password: 'secret' })

    expect(await connection.stat('/dir')).toMatchObject({
      name: 'dir',
      kind: 'directory',
      permissions: 'rwxr-xr-x',
    })
  })

  it('保留 ssh2 SFTP 状态码的语义', async () => {
    const sftp = makeSftp()
    sftp.stat.mockImplementation((_path: string, cb: (error?: Error | null) => void) =>
      cb(statusError(2, 'No such file or directory')),
    )
    sftp.unlink.mockImplementation((_path: string, cb: (error?: Error | null) => void) =>
      cb(statusError(3, 'Permission denied')),
    )
    sftp.mkdir.mockImplementation((_path: string, cb: (error?: Error | null) => void) =>
      cb(statusError(4, 'Failure')),
    )
    const client = makeClient({ sftp })
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })
    await connection.connect({ kind: 'password', username: 'alice', password: 'secret' })

    await expect(connection.stat('/missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(connection.unlink('/x')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
    await expect(connection.mkdir('/exists')).rejects.toMatchObject({
      code: 'MKDIR_ERROR',
      message: 'Failure',
    })
  })

  it('signal 中止会销毁打开的读流', async () => {
    const sftp = makeSftp()
    const client = makeClient({ sftp })
    const connection = new Ssh2SftpConnection(config, { createClient: () => client })
    await connection.connect({ kind: 'password', username: 'alice', password: 'secret' })
    const controller = new AbortController()

    const stream = await connection.openRead('/a.txt', 0, controller.signal)
    controller.abort()

    expect(stream.destroyed).toBe(true)
  })
})
