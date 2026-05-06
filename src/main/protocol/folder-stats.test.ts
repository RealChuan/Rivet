import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '@shared/domain/entry.js'
import type { FileProvider } from '../providers/types.js'
import { createFakeProvider } from '../providers/test-utils/fake-provider.js'
import { calculateFolderStats } from './folder-stats.js'

function entry(path: string, kind: Entry['kind'], size = 0): Entry {
  return { name: path.split('/').pop() ?? '', kind, size, mtime: 0, path }
}

function treeProvider(tree: Map<string, Entry[]>): FileProvider {
  return {
    ...createFakeProvider(),
    list: (path) =>
      (async function* () {
        await Promise.resolve()
        yield* tree.get(path) ?? []
      })(),
  }
}

describe('calculateFolderStats', () => {
  it('统计嵌套目录的文件数、目录数与总大小', async () => {
    const tree = new Map<string, Entry[]>([
      ['/', [entry('/a.txt', 'file', 10), entry('/sub', 'directory')]],
      ['/sub', [entry('/sub/b.txt', 'file', 20), entry('/sub/deep', 'directory')]],
      ['/sub/deep', [entry('/sub/deep/c.txt', 'file', 30)]],
    ])
    const progress = vi.fn()

    const stats = await calculateFolderStats(treeProvider(tree), '/', {
      signal: new AbortController().signal,
      onProgress: progress,
    })

    expect(stats).toMatchObject({
      fileCount: 3,
      folderCount: 2,
      totalSize: 60,
      isComplete: true,
      isCancelled: false,
      errorCount: 0,
    })
    expect(progress).toHaveBeenCalled()
  })

  it('空目录返回全零', async () => {
    const stats = await calculateFolderStats(treeProvider(new Map()), '/empty', {
      signal: new AbortController().signal,
      onProgress: () => {},
    })

    expect(stats).toMatchObject({ fileCount: 0, folderCount: 0, totalSize: 0, isComplete: true })
  })

  it('单个目录读取失败只增加 errorCount', async () => {
    const tree = new Map<string, Entry[]>([['/', [entry('/sub', 'directory')]]])
    const provider: FileProvider = {
      ...createFakeProvider(),
      list: (path) =>
        (async function* () {
          await Promise.resolve()
          if (path === '/sub') throw new Error('permission denied')
          yield* tree.get(path) ?? []
        })(),
    }

    const stats = await calculateFolderStats(provider, '/', {
      signal: new AbortController().signal,
      onProgress: () => {},
    })

    expect(stats.errorCount).toBe(1)
    expect(stats.isComplete).toBe(true)
  })

  it('取消后返回 isCancelled，不再继续遍历', async () => {
    const controller = new AbortController()
    const provider: FileProvider = {
      ...createFakeProvider(),
      list: () =>
        (async function* () {
          await Promise.resolve()
          yield entry('/sub', 'directory')
          controller.abort()
        })(),
    }

    const stats = await calculateFolderStats(provider, '/', {
      signal: controller.signal,
      onProgress: () => {},
    })

    expect(stats.isCancelled).toBe(true)
    expect(stats.isComplete).toBe(false)
  })
})
