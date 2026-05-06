import { describe, expect, it, vi } from 'vitest'
import type { TransferTask } from '@shared/types/index.js'
import {
  CONFLICT_ACTION,
  ERROR_CODE,
  FILE_TYPE,
  OPERATION_STATUS,
  TRANSFER_DIRECTION,
} from '@shared/constants/index.js'
import type { LocalFs } from './local-fs.js'
import { ProviderError } from '../providers/errors.js'
import { createFakeProvider } from '../providers/test-utils/fake-provider.js'
import { resolveDownloadTarget, resolveUploadTarget } from './conflict.js'

function uploadTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 't1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/a.txt',
    localDir: '/local',
    remotePath: '/remote/a.txt',
    itemName: 'a.txt',
    itemType: FILE_TYPE.FILE,
    status: OPERATION_STATUS.WAITING,
    fileSize: 1,
    transferredSize: 0,
    createdAt: 1,
    ...overrides,
  }
}

function downloadTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return uploadTask({ direction: TRANSFER_DIRECTION.DOWNLOAD, ...overrides })
}

function missing(): Promise<never> {
  return Promise.reject(new ProviderError(ERROR_CODE.NOT_FOUND, 'missing'))
}

function makeLocalFs(existing: string[]): LocalFs {
  return {
    stat: (path) =>
      existing.includes(path)
        ? Promise.resolve({ size: 1, isDirectory: false })
        : Promise.reject(new Error('ENOENT')),
    mkdir: () => Promise.resolve(),
    readdir: () => Promise.resolve([]),
    rename: () => Promise.resolve(),
    rm: () => Promise.resolve(),
    unlink: () => Promise.resolve(),
    createReadStream: () => {
      throw new Error('not used')
    },
    createWriteStream: () => {
      throw new Error('not used')
    },
  }
}

describe('resolveUploadTarget', () => {
  it('远端不存在时返回原路径且不覆盖', async () => {
    const provider = createFakeProvider()
    provider.stat = vi.fn(() => missing())

    await expect(resolveUploadTarget(provider, uploadTask())).resolves.toEqual({
      path: '/remote/a.txt',
      overwrite: false,
    })
  })

  it('存在且 action=skip 返回 skip', async () => {
    const provider = createFakeProvider()
    provider.stat = vi.fn(() => Promise.resolve({} as never))

    await expect(
      resolveUploadTarget(provider, uploadTask({ conflictAction: CONFLICT_ACTION.SKIP })),
    ).resolves.toEqual({ skip: true })
  })

  it('存在且 action=overwrite 返回 overwrite:true', async () => {
    const provider = createFakeProvider()
    provider.stat = vi.fn(() => Promise.resolve({} as never))

    await expect(
      resolveUploadTarget(provider, uploadTask({ conflictAction: CONFLICT_ACTION.OVERWRITE })),
    ).resolves.toEqual({ path: '/remote/a.txt', overwrite: true })
  })

  it('keepBoth 生成不冲突的新名字', async () => {
    const provider = createFakeProvider()
    let call = 0
    provider.stat = vi.fn((_path: string) => {
      call += 1
      return call === 1 ? Promise.resolve({} as never) : missing()
    })

    const target = await resolveUploadTarget(
      provider,
      uploadTask({ conflictAction: CONFLICT_ACTION.KEEP_BOTH }),
    )

    if ('skip' in target) throw new Error('unexpected skip')
    expect(target.overwrite).toBe(false)
    expect(target.path).not.toBe('/remote/a.txt')
    expect(target.path.startsWith('/remote/')).toBe(true)
    expect(target.path).toContain('a_')
  })
})

describe('resolveDownloadTarget', () => {
  it('本地不存在时返回原路径且不覆盖', async () => {
    const localFs = makeLocalFs([])

    await expect(resolveDownloadTarget(localFs, downloadTask())).resolves.toEqual({
      path: '/local/a.txt',
      overwrite: false,
    })
  })

  it('存在且 action=skip 返回 skip', async () => {
    const localFs = makeLocalFs(['/local/a.txt'])

    await expect(
      resolveDownloadTarget(localFs, downloadTask({ conflictAction: CONFLICT_ACTION.SKIP })),
    ).resolves.toEqual({ skip: true })
  })

  it('存在且 action=overwrite 返回 overwrite:true', async () => {
    const localFs = makeLocalFs(['/local/a.txt'])

    await expect(
      resolveDownloadTarget(localFs, downloadTask({ conflictAction: CONFLICT_ACTION.OVERWRITE })),
    ).resolves.toEqual({ path: '/local/a.txt', overwrite: true })
  })

  it('keepBoth 在本地生成不冲突的新名字', async () => {
    const localFs = makeLocalFs(['/local/a.txt'])

    const target = await resolveDownloadTarget(
      localFs,
      downloadTask({ conflictAction: CONFLICT_ACTION.KEEP_BOTH }),
    )

    if ('skip' in target) throw new Error('unexpected skip')
    expect(target.overwrite).toBe(false)
    expect(target.path).not.toBe('/local/a.txt')
    expect(target.path).toContain('a_')
  })

  it('缺少 localDir 时抛错', async () => {
    const localFs = makeLocalFs([])
    const task = downloadTask()
    delete task.localDir

    await expect(resolveDownloadTarget(localFs, task)).rejects.toThrow('localDir')
  })
})
