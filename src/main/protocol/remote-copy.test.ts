import { describe, expect, it, vi } from 'vitest'
import type { Entry, EntryKind } from '@shared/domain/entry.js'
import type { FileProvider, ReadHandle, WriteHandle } from '../providers/types.js'
import { createFakeProvider, FAKE_CAPABILITIES } from '../providers/test-utils/fake-provider.js'
import { copyRemoteEntry } from './remote-copy.js'

function withOverrides(overrides: Partial<FileProvider>): FileProvider {
  return { ...createFakeProvider(), ...overrides }
}

function collectWriteHandle(commitImpl: () => Promise<void> = () => Promise.resolve()): {
  handle: WriteHandle
  chunks: Uint8Array[]
  commit: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
} {
  const chunks: Uint8Array[] = []
  const commit = vi.fn(commitImpl)
  const abort = vi.fn(() => Promise.resolve())
  const handle: WriteHandle = {
    stream: new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk)
      },
    }),
    commit,
    abort,
  }
  return { handle, chunks, commit, abort }
}

function readHandle(chunks: string[]): ReadHandle {
  const encoded = chunks.map((chunk) => new TextEncoder().encode(chunk))
  return {
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of encoded) controller.enqueue(chunk)
        controller.close()
      },
    }),
    close: vi.fn(() => Promise.resolve()),
  }
}

const fileSource: { path: string; kind: EntryKind } = { path: '/src/a.txt', kind: 'file' }

describe('copyRemoteEntry', () => {
  it('有服务端复制能力时直接调用 provider.copy', async () => {
    const copy = vi.fn(() => Promise.resolve())
    const openRead = vi.fn()
    const provider = withOverrides({
      capabilities: { ...FAKE_CAPABILITIES, serverSideCopy: true },
      copy,
      openRead,
    })

    await copyRemoteEntry(provider, fileSource, '/dst/a.txt', {
      signal: new AbortController().signal,
      overwrite: true,
    })

    expect(copy).toHaveBeenCalledWith('/src/a.txt', '/dst/a.txt', expect.any(AbortSignal))
    expect(openRead).not.toHaveBeenCalled()
  })

  it('没有 copy 时走流式复制并 commit', async () => {
    const { handle, chunks, commit, abort } = collectWriteHandle()
    const provider = withOverrides({
      capabilities: { ...FAKE_CAPABILITIES, serverSideCopy: false },
      openRead: () => Promise.resolve(readHandle(['hello', ' world'])),
      openWrite: () => Promise.resolve(handle),
    })

    await copyRemoteEntry(provider, fileSource, '/dst/a.txt', {
      signal: new AbortController().signal,
      overwrite: true,
    })

    expect(chunks.map((chunk) => new TextDecoder().decode(chunk)).join('')).toBe('hello world')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(abort).not.toHaveBeenCalled()
  })

  it('commit 失败时调用 abort 并继续抛错', async () => {
    const { handle, abort } = collectWriteHandle(() => Promise.reject(new Error('commit failed')))
    const provider = withOverrides({
      capabilities: { ...FAKE_CAPABILITIES, serverSideCopy: false },
      openRead: () => Promise.resolve(readHandle(['x'])),
      openWrite: () => Promise.resolve(handle),
    })

    await expect(
      copyRemoteEntry(provider, fileSource, '/dst/a.txt', {
        signal: new AbortController().signal,
        overwrite: true,
      }),
    ).rejects.toThrow('commit failed')

    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('目录递归创建并复制每个子项', async () => {
    const entriesByPath = new Map<string, Entry[]>([
      [
        '/src',
        [
          { name: 'sub', kind: 'directory', size: 0, mtime: 0, path: '/src/sub' },
          { name: 'a.txt', kind: 'file', size: 1, mtime: 0, path: '/src/a.txt' },
        ],
      ],
      ['/src/sub', [{ name: 'b.txt', kind: 'file', size: 1, mtime: 0, path: '/src/sub/b.txt' }]],
    ])
    const { handle } = collectWriteHandle()
    const mkdir = vi.fn((path: string) => {
      void path
      return Promise.resolve()
    })
    const openWrite = vi.fn((path: string) => {
      void path
      return Promise.resolve(handle)
    })
    const provider = withOverrides({
      capabilities: { ...FAKE_CAPABILITIES, serverSideCopy: false },
      mkdir,
      openWrite,
      openRead: () => Promise.resolve(readHandle(['x'])),
      list: (path) =>
        (async function* () {
          await Promise.resolve()
          yield* entriesByPath.get(path) ?? []
        })(),
    })

    await copyRemoteEntry(provider, { path: '/src', kind: 'directory' }, '/dst', {
      signal: new AbortController().signal,
      overwrite: true,
    })

    expect(mkdir.mock.calls.map(([path]) => path)).toEqual(['/dst', '/dst/sub'])
    expect(openWrite.mock.calls.map(([path]) => path).sort()).toEqual([
      '/dst/a.txt',
      '/dst/sub/b.txt',
    ])
  })

  it('signal 已中止时不做任何 IO', async () => {
    const openRead = vi.fn()
    const provider = withOverrides({ openRead })
    const controller = new AbortController()
    controller.abort()

    await expect(
      copyRemoteEntry(provider, fileSource, '/dst/a.txt', {
        signal: controller.signal,
        overwrite: true,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(openRead).not.toHaveBeenCalled()
  })
})
