import { Readable, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { TransferTask } from '@shared/types/index.js'
import { FILE_TYPE, OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/index.js'
import type { LocalFs } from './local-fs.js'
import { cleanupLocalTemps } from './temp-cleanup.js'

function makeLocalFs(tree: Record<string, 'file' | 'dir'>) {
  const unlinked: string[] = []
  const entries = { ...tree }

  const localFs: LocalFs = {
    stat: (path: string) => {
      const kind = entries[path]
      if (kind === undefined) return Promise.reject(new Error('ENOENT'))
      return Promise.resolve({ size: 0, isDirectory: kind === 'dir' })
    },
    mkdir: () => Promise.resolve(),
    readdir: (dir: string) =>
      Promise.resolve(
        Object.entries(entries)
          .filter(
            ([path]) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'),
          )
          .map(([path, kind]) => ({
            name: path.slice(dir.length + 1),
            size: 0,
            type: kind === 'dir' ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
          })),
      ),
    rename: () => Promise.resolve(),
    rm: () => Promise.resolve(),
    unlink: (path: string) => {
      unlinked.push(path)
      delete entries[path]
      return Promise.resolve()
    },
    createReadStream: () => Readable.from([]),
    createWriteStream: () => new Writable({ write: (_chunk, _encoding, callback) => callback() }),
  }

  return { localFs, unlinked, entries }
}

function task(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 't1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.DOWNLOAD,
    localPath: '/l/a.txt',
    localDir: '/l',
    remotePath: '/r/a.txt',
    itemName: 'a.txt',
    itemType: FILE_TYPE.FILE,
    status: OPERATION_STATUS.PAUSED,
    fileSize: 10,
    transferredSize: 4,
    createdAt: 1,
    ...overrides,
  }
}

describe('cleanupLocalTemps', () => {
  it('单文件：原名与改名后的半成品都删掉', async () => {
    const fs = makeLocalFs({
      '/l/a.txt.rivet-download': 'file',
      '/l/a (1).txt.rivet-download': 'file',
      '/l/keep.txt': 'file',
    })

    await cleanupLocalTemps(fs.localFs, task({ resolvedLocalPath: '/l/a (1).txt' }))

    expect(fs.unlinked.sort()).toEqual(['/l/a (1).txt.rivet-download', '/l/a.txt.rivet-download'])
    expect(fs.entries['/l/keep.txt']).toBe('file')
  })

  it('目录：递归删掉所有半成品，正常文件不动', async () => {
    const fs = makeLocalFs({
      '/l/x.bin.rivet-download': 'file',
      '/l/keep.txt': 'file',
      '/l/sub': 'dir',
      '/l/sub/y.bin.rivet-download': 'file',
      '/l/sub/keep2.txt': 'file',
    })

    await cleanupLocalTemps(
      fs.localFs,
      task({ itemType: FILE_TYPE.DIRECTORY, localPath: '/l', resolvedLocalPath: '/l' }),
    )

    expect(fs.unlinked.sort()).toEqual(['/l/sub/y.bin.rivet-download', '/l/x.bin.rivet-download'])
    expect(Object.keys(fs.entries).sort()).toEqual(['/l/keep.txt', '/l/sub', '/l/sub/keep2.txt'])
  })

  it('目录没有解析过目标时不扫描（那说明没写过任何半成品）', async () => {
    const fs = makeLocalFs({ '/l/x.bin.rivet-download': 'file' })

    await cleanupLocalTemps(fs.localFs, task({ itemType: FILE_TYPE.DIRECTORY, localPath: '/l' }))

    expect(fs.unlinked).toEqual([])
  })

  it('上传任务没有本地半成品，什么都不做', async () => {
    const fs = makeLocalFs({ '/l/a.txt.rivet-download': 'file' })

    await cleanupLocalTemps(fs.localFs, task({ direction: TRANSFER_DIRECTION.UPLOAD }))

    expect(fs.unlinked).toEqual([])
  })

  it('目标已不存在时不报错', async () => {
    const fs = makeLocalFs({})

    await expect(
      cleanupLocalTemps(
        fs.localFs,
        task({ itemType: FILE_TYPE.DIRECTORY, resolvedLocalPath: '/l' }),
      ),
    ).resolves.toBeUndefined()
  })
})
