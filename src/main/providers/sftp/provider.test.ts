import { Readable, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { SftpConnectOptions } from './connection-types.js'
import { ProviderError } from '../errors.js'
import { createSftpProvider } from './provider.js'

const credentials: Credentials = { kind: 'password', username: 'u', password: 'p' }

function raw(name: string, kind: 'file' | 'directory', path: string, size = 0) {
  return { name, kind, size, mtime: 0, path }
}

function makeConnection() {
  const entries = new Map<string, ReturnType<typeof raw>[]>()
  const stats = new Map<string, ReturnType<typeof raw>>()

  return {
    entries,
    stats,
    connect: vi.fn((_credentials: Credentials, _opts?: SftpConnectOptions) => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    ping: vi.fn(() => Promise.resolve()),
    list: vi.fn((path: string) => Promise.resolve(entries.get(path) ?? [])),
    stat: vi.fn((path: string) => Promise.resolve(stats.get(path) ?? raw('', 'file', path))),
    mkdir: vi.fn((_path: string) => Promise.resolve()),
    rmdir: vi.fn((_path: string) => Promise.resolve()),
    unlink: vi.fn((_path: string) => Promise.resolve()),
    rename: vi.fn((_from: string, _to: string) => Promise.resolve()),
    chmod: vi.fn((_path: string, _mode: number) => Promise.resolve()),
    openRead: vi.fn((_path: string, _start: number) => Promise.resolve(Readable.from(['abc']))),
    openWrite: vi.fn((_path: string) =>
      Promise.resolve(
        new Writable({
          write(_chunk, _encoding, callback) {
            callback()
          },
        }),
      ),
    ),
  }
}

async function writeAll(stream: WritableStream<Uint8Array>, text: string): Promise<void> {
  const writer = stream.getWriter()
  await writer.write(new TextEncoder().encode(text))
  await writer.close()
}

describe('createSftpProvider', () => {
  it('connect 透传 hostVerifier 并报告能力快照', async () => {
    const connection = makeConnection()
    const hostVerifier = vi.fn(() => true)
    const provider = createSftpProvider(connection, { hostVerifier })

    await provider.connect(credentials)

    expect(connection.connect).toHaveBeenCalledWith(credentials, { hostVerifier })
    expect(provider.capabilities).toEqual({
      chmod: true,
      symlink: true,
      serverSideCopy: false,
      serverSideMove: true,
      atomicRename: true,
      dirIsEntity: true,
      caseSensitive: true,
    })
  })

  it('list 产出带绝对路径的 Entry', async () => {
    const connection = makeConnection()
    connection.entries.set('/dir', [raw('a.txt', 'file', '/dir/a.txt', 3)])
    const provider = createSftpProvider(connection)

    const result: unknown[] = []
    for await (const entry of provider.list('/dir', { signal: new AbortController().signal })) {
      result.push(entry)
    }

    expect(result).toEqual([{ name: 'a.txt', kind: 'file', size: 3, mtime: 0, path: '/dir/a.txt' }])
  })

  it('mkdir recursive 逐段创建并忽略已存在', async () => {
    const connection = makeConnection()
    connection.mkdir.mockRejectedValueOnce(new ProviderError(ERROR_CODE.ALREADY_EXISTS))
    const provider = createSftpProvider(connection)

    await provider.mkdir('/a/b', { recursive: true, signal: new AbortController().signal })

    expect(connection.mkdir.mock.calls.map(([path]) => path)).toEqual(['/a', '/a/b'])
  })

  it('mkdir recursive 把协议无法区分的“已存在”当成已就绪', async () => {
    const connection = makeConnection()
    connection.stats.set('/a', raw('a', 'directory', '/a'))
    connection.stats.set('/a/b', raw('b', 'directory', '/a/b'))
    // OpenSSH 的 SFTPv3 对已存在目录只回 SSH_FX_FAILURE，没有专门的“已存在”状态码。
    connection.mkdir.mockImplementation((path: string) =>
      connection.stats.has(path)
        ? Promise.reject(new ProviderError(ERROR_CODE.MKDIR_ERROR, 'Failure'))
        : Promise.resolve(),
    )
    const provider = createSftpProvider(connection)

    await provider.mkdir('/a/b/c', { recursive: true, signal: new AbortController().signal })

    expect(connection.mkdir.mock.calls.map(([path]) => path)).toEqual(['/a', '/a/b', '/a/b/c'])
  })

  it('mkdir recursive 在父路径不是目录时仍抛错', async () => {
    const connection = makeConnection()
    connection.stats.set('/a', raw('a', 'file', '/a'))
    connection.mkdir.mockRejectedValue(new ProviderError(ERROR_CODE.MKDIR_ERROR, 'Failure'))
    const provider = createSftpProvider(connection)

    await expect(
      provider.mkdir('/a/b', { recursive: true, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: ERROR_CODE.MKDIR_ERROR })
  })

  it('remove 对目录递归删除子项', async () => {
    const connection = makeConnection()
    connection.stats.set('/dir', raw('dir', 'directory', '/dir'))
    connection.entries.set('/dir', [
      raw('a.txt', 'file', '/dir/a.txt'),
      raw('sub', 'directory', '/dir/sub'),
    ])
    connection.stats.set('/dir/sub', raw('sub', 'directory', '/dir/sub'))
    connection.entries.set('/dir/sub', [])
    const provider = createSftpProvider(connection)

    await provider.remove('/dir')

    expect(connection.unlink).toHaveBeenCalledWith('/dir/a.txt', undefined)
    expect(connection.rmdir.mock.calls.map(([path]) => path).sort()).toEqual(['/dir', '/dir/sub'])
  })

  it('openWrite 写临时文件并在 commit 时 rename', async () => {
    const connection = makeConnection()
    const provider = createSftpProvider(connection)

    const handle = await provider.openWrite('/dir/a.txt', { overwrite: true })
    await writeAll(handle.stream, 'hello')
    await handle.commit()

    const [tempPath, targetPath] = connection.rename.mock.calls[0] ?? []
    expect(targetPath).toBe('/dir/a.txt')
    expect(tempPath).toMatch(/^\/dir\/\.a\.txt\..+\.rivet-tmp$/)
    expect(connection.openWrite).toHaveBeenCalledWith(tempPath, 'wx', expect.any(AbortSignal))
  })

  it('openWrite 覆盖已存在目标时先删目标再 rename', async () => {
    const connection = makeConnection()
    connection.stats.set('/dir/a.txt', raw('a.txt', 'file', '/dir/a.txt'))
    connection.unlink.mockImplementation((path: string) => {
      connection.stats.delete(path)
      return Promise.resolve()
    })
    // SFTPv3 的 RENAME 不覆盖已存在目标，OpenSSH 只回 SSH_FX_FAILURE。
    connection.rename.mockImplementation((_from: string, to: string) =>
      connection.stats.has(to)
        ? Promise.reject(new ProviderError(ERROR_CODE.RENAME_ERROR, 'Failure'))
        : Promise.resolve(),
    )
    const provider = createSftpProvider(connection)

    const handle = await provider.openWrite('/dir/a.txt', { overwrite: true })
    await writeAll(handle.stream, 'hello')
    await handle.commit()

    expect(connection.unlink.mock.calls.map(([path]) => path)).toEqual(['/dir/a.txt'])
    expect(connection.rename).toHaveBeenCalledTimes(1)
  })

  it('openWrite 目标不存在时 commit 不删除远端文件', async () => {
    const connection = makeConnection()
    connection.stat.mockRejectedValue(new ProviderError(ERROR_CODE.NOT_FOUND, 'no such file'))
    const provider = createSftpProvider(connection)

    const handle = await provider.openWrite('/dir/a.txt', { overwrite: true })
    await writeAll(handle.stream, 'hello')
    await handle.commit()

    expect(connection.unlink).not.toHaveBeenCalled()
    expect(connection.rename).toHaveBeenCalledTimes(1)
  })

  it('openWrite 的 abort 删除临时文件', async () => {
    const connection = makeConnection()
    const provider = createSftpProvider(connection)

    const handle = await provider.openWrite('/dir/a.txt', { overwrite: true })
    await handle.abort()

    const tempPath = connection.openWrite.mock.calls[0]?.[0]
    expect(connection.unlink).toHaveBeenCalledWith(tempPath, expect.any(AbortSignal))
  })

  it('overwrite 为 false 且目标存在时直接拒绝', async () => {
    const connection = makeConnection()
    connection.stats.set('/dir/a.txt', raw('a.txt', 'file', '/dir/a.txt'))
    const provider = createSftpProvider(connection)

    await expect(provider.openWrite('/dir/a.txt', { overwrite: false })).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    })
    expect(connection.openWrite).not.toHaveBeenCalled()
  })

  it('openRead 关闭时销毁底层流', async () => {
    const connection = makeConnection()
    const provider = createSftpProvider(connection)

    const handle = await provider.openRead('/a.txt', {})
    await handle.close()

    const stream = (await connection.openRead.mock.results[0]?.value) as Readable
    expect(stream.destroyed).toBe(true)
  })
})
