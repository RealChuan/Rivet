import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { SmbClientPort, SmbDirEntryLike, SmbStatLike } from './client.js'
import { ProviderError } from '../errors.js'
import { createSmbProvider } from './provider.js'

const config: ConnectionConfig = {
  id: 'smb-1',
  name: 'files',
  protocol: 'smb',
  host: 'files.example.com',
  port: 445,
  username: 'u',
  share: 'public',
  domain: 'WORKGROUP',
  authKind: 'password',
}

const credentials: Credentials = { kind: 'password', username: 'u', password: 'p' }

function stat(kind: 'file' | 'directory', mtime = 0, size = 0): SmbStatLike {
  const date = new Date(mtime)
  return {
    birthtime: date,
    atime: date,
    mtime: date,
    ctime: date,
    ...(kind === 'file' ? { size } : {}),
    isDirectory: () => kind === 'directory',
  }
}

function entry(name: string, kind: 'file' | 'directory', size = 0): SmbDirEntryLike {
  return { name, ...stat(kind, 0, size) }
}

function makeWritable(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
}

function makeClient() {
  const stats = new Map<string, SmbStatLike>()
  const entries = new Map<string, SmbDirEntryLike[]>()

  const client = {
    disconnect: vi.fn(),
    stat: vi.fn((path: string): Promise<SmbStatLike> => {
      const value = stats.get(path)
      return value !== undefined
        ? Promise.resolve(value)
        : Promise.reject(new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${path}`))
    }),
    readdir: vi.fn((path: string): Promise<SmbDirEntryLike[]> =>
      Promise.resolve(entries.get(path) ?? []),
    ),
    mkdir: vi.fn((path: string): Promise<void> => {
      if (stats.has(path)) {
        return Promise.reject(new ProviderError(ERROR_CODE.ALREADY_EXISTS, `exists: ${path}`))
      }
      stats.set(path, stat('directory'))
      return Promise.resolve()
    }),
    rmdir: vi.fn((path: string): Promise<void> => {
      stats.delete(path)
      return Promise.resolve()
    }),
    unlink: vi.fn((_path: string): Promise<void> => Promise.resolve()),
    rename: vi.fn((_from: string, _to: string): Promise<void> => Promise.resolve()),
    createReadStream: vi.fn((_path: string): Promise<Readable> =>
      Promise.resolve(Readable.from([Buffer.from('abc')])),
    ),
    createWriteStream: vi.fn((_path: string): Promise<Writable> => Promise.resolve(makeWritable())),
  }

  const port: SmbClientPort = client
  return { client, port, stats, entries }
}

async function collectEntries(provider: ReturnType<typeof createSmbProvider>, path: string) {
  const result: unknown[] = []
  for await (const item of provider.list(path, { signal: new AbortController().signal })) {
    result.push(item)
  }
  return result
}

describe('createSmbProvider', () => {
  it('连续操作复用同一条会话', async () => {
    const { client, port, stats } = makeClient()
    stats.set('root\\a.txt', stat('file'))
    const createClient = vi.fn(() => port)
    const provider = createSmbProvider({ config, createClient })
    const signal = new AbortController().signal

    await provider.connect(credentials)
    expect(createClient).not.toHaveBeenCalled()

    await provider.stat('/root/a.txt', signal)
    await provider.stat('/root/a.txt', signal)
    await provider.stat('/root/a.txt', signal)

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(config, credentials)
    expect(client.disconnect).not.toHaveBeenCalled()
  })

  it('操作失败后丢弃会话，下次重新创建', async () => {
    const { client, port, stats } = makeClient()
    stats.set('root\\a.txt', stat('file'))
    const createClient = vi.fn(() => port)
    const provider = createSmbProvider({ config, createClient })
    const signal = new AbortController().signal

    await provider.connect(credentials)
    await expect(provider.stat('/missing.txt', signal)).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    })
    expect(client.disconnect).toHaveBeenCalledTimes(1)

    await provider.stat('/root/a.txt', signal)
    expect(createClient).toHaveBeenCalledTimes(2)
  })

  it('并发读各占一条会话，关闭后回到池里复用', async () => {
    const { port } = makeClient()
    const createClient = vi.fn(() => port)
    const provider = createSmbProvider({ config, createClient })
    const signal = new AbortController().signal

    await provider.connect(credentials)
    const first = await provider.openRead('/root/a.txt', { signal })
    const second = await provider.openRead('/root/a.txt', { signal })
    expect(createClient).toHaveBeenCalledTimes(2)

    await first.close()
    await second.close()

    const third = await provider.openRead('/root/a.txt', { signal })
    await third.close()
    expect(createClient).toHaveBeenCalledTimes(2)
  })

  it('disconnect 关闭所有会话，之后的操作报 INVALID_STATE', async () => {
    const { client, port } = makeClient()
    const provider = createSmbProvider({ config, createClient: () => port })
    const signal = new AbortController().signal

    await provider.connect(credentials)
    const handle = await provider.openRead('/root/a.txt', { signal })

    await provider.disconnect()
    expect(client.disconnect).toHaveBeenCalledTimes(1)

    await handle.close()
    await expect(provider.stat('/root/a.txt', signal)).rejects.toMatchObject({
      code: ERROR_CODE.INVALID_STATE,
    })
  })

  it('非密码凭据在 connect 时抛 INVALID_CONFIG', async () => {
    const provider = createSmbProvider({ config, createClient: () => makeClient().port })

    await expect(provider.connect({ kind: 'agent', username: 'u' })).rejects.toMatchObject({
      code: ERROR_CODE.INVALID_CONFIG,
    })
  })

  it('list 把共享相对路径映射成虚拟绝对路径', async () => {
    const { client, port, entries } = makeClient()
    entries.set('root', [entry('a.txt', 'file', 3), entry('docs', 'directory')])
    client.readdir.mockImplementation((path: string) => Promise.resolve(entries.get(path) ?? []))

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    expect(await collectEntries(provider, '/root')).toEqual([
      { name: 'a.txt', kind: 'file', size: 3, mtime: 0, path: '/root/a.txt' },
      { name: 'docs', kind: 'directory', size: 0, mtime: 0, path: '/root/docs' },
    ])
    expect(client.readdir).toHaveBeenCalledWith('root', { stats: true })
  })

  it('stat 映射文件元信息', async () => {
    const { port, stats } = makeClient()
    stats.set('root\\a.txt', stat('file', 1_700_000_000_000, 12))

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await expect(provider.stat('/root/a.txt', new AbortController().signal)).resolves.toEqual({
      name: 'a.txt',
      kind: 'file',
      size: 12,
      mtime: 1_700_000_000_000,
      path: '/root/a.txt',
    })
  })

  it('mkdir recursive 逐段创建并忽略已存在目录', async () => {
    const { client, port, stats } = makeClient()
    stats.set('a', stat('directory'))

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await provider.mkdir('/a/b', {
      recursive: true,
      signal: new AbortController().signal,
    })

    expect(client.mkdir.mock.calls.map(([path]) => path)).toEqual(['a', 'a\\b'])
  })

  it('remove 递归删除目录内容', async () => {
    const { client, port, stats, entries } = makeClient()
    stats.set('root\\dir', stat('directory'))
    stats.set('root\\dir\\a.txt', stat('file'))
    stats.set('root\\dir\\sub', stat('directory'))
    entries.set('root\\dir', [entry('a.txt', 'file'), entry('sub', 'directory')])
    entries.set('root\\dir\\sub', [])

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await provider.remove('/root/dir', new AbortController().signal)

    expect(client.unlink.mock.calls.map(([path]) => path)).toEqual(['root\\dir\\a.txt'])
    expect(client.rmdir.mock.calls.map(([path]) => path)).toEqual(['root\\dir\\sub', 'root\\dir'])
  })

  it('删除后服务端回 delete-pending 时继续等待，条目消失即返回', async () => {
    const { client, port } = makeClient()
    const directory = stat('directory')

    client.stat
      .mockResolvedValueOnce(directory)
      .mockRejectedValueOnce(
        new ProviderError(ERROR_CODE.PERMISSION_DENIED, 'delete pending', {
          status: 'STATUS_DELETE_PENDING',
        }),
      )
      .mockRejectedValueOnce(new ProviderError(ERROR_CODE.NOT_FOUND, 'gone'))

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await provider.remove('/pending', new AbortController().signal)

    expect(client.stat).toHaveBeenCalledTimes(3)
    expect(client.rmdir).toHaveBeenCalledWith('pending')
  })

  it('删除后条目仍在时立即失败，不空等', async () => {
    const { client, port } = makeClient()
    const directory = stat('directory')

    client.stat.mockResolvedValueOnce(directory).mockResolvedValueOnce(directory)

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await expect(provider.remove('/stuck', new AbortController().signal)).rejects.toMatchObject({
      code: ERROR_CODE.DELETE_ERROR,
    })
    expect(client.stat).toHaveBeenCalledTimes(2)
  })

  it('rename 使用 replace 语义', async () => {
    const { client, port } = makeClient()
    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await provider.rename('/root/a.txt', '/root/b.txt', new AbortController().signal)

    expect(client.rename).toHaveBeenCalledWith('root\\a.txt', 'root\\b.txt', { replace: true })
  })

  it('openRead 从指定偏移打开流', async () => {
    const { client, port } = makeClient()
    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    const handle = await provider.openRead('/root/a.txt', {
      start: 5,
      signal: new AbortController().signal,
    })
    const reader = handle.stream.getReader()
    const first = await reader.read()
    await reader.cancel()
    await handle.close()

    expect(client.createReadStream).toHaveBeenCalledWith('root\\a.txt', { start: 5 })
    expect(first.value).toBeInstanceOf(Uint8Array)
  })

  it('openWrite 写入临时文件后 rename 覆盖目标', async () => {
    const { client, port } = makeClient()
    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    const handle = await provider.openWrite('/root/a.txt', {
      overwrite: true,
      signal: new AbortController().signal,
    })
    const writer = handle.stream.getWriter()
    await writer.write(new TextEncoder().encode('hello'))
    await writer.close()
    await handle.commit()

    const tempPath = client.createWriteStream.mock.calls[0]?.[0]
    expect(tempPath).toMatch(/^root\\.a\.txt\..+\.rivet-tmp$/)
    expect(client.rename).toHaveBeenCalledWith(tempPath, 'root\\a.txt', { replace: true })
    expect(client.unlink).not.toHaveBeenCalled()
  })

  it('openWrite 只关闭底层写流一次', async () => {
    const { client, port } = makeClient()
    let closeCalls = 0
    const closeStream = (callback: (error?: Error | null) => void): void => {
      closeCalls += 1
      callback(null)
    }
    const nodeStream = new Writable({
      write(_chunk, _encoding, callback) {
        callback()
      },
      final(callback) {
        closeStream(callback)
      },
      destroy(error, callback) {
        closeStream(() => {
          callback(error)
        })
      },
    })
    client.createWriteStream.mockImplementation(() => Promise.resolve(nodeStream))

    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    const handle = await provider.openWrite('/root/new.txt', {
      overwrite: true,
      signal: new AbortController().signal,
    })
    const writer = handle.stream.getWriter()
    await writer.write(new TextEncoder().encode('hello'))
    await writer.close()
    await handle.commit()

    expect(closeCalls).toBe(1)
  })

  it('openWrite 在 abort 时删除临时文件', async () => {
    const { client, port } = makeClient()
    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    const handle = await provider.openWrite('/root/a.txt', {
      overwrite: true,
      signal: new AbortController().signal,
    })
    await handle.abort()

    const tempPath = client.createWriteStream.mock.calls[0]?.[0]
    expect(client.unlink).toHaveBeenCalledWith(tempPath)
  })

  it('openWrite 在 overwrite=false 且目标存在时拒绝', async () => {
    const { port, stats } = makeClient()
    stats.set('root\\a.txt', stat('file'))
    const provider = createSmbProvider({ config, createClient: () => port })
    await provider.connect(credentials)

    await expect(
      provider.openWrite('/root/a.txt', {
        overwrite: false,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.ALREADY_EXISTS })
  })
})
