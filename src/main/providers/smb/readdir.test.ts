import { describe, expect, it } from 'vitest'
import type { SmbStatLike } from './client.js'
import {
  listDirectory,
  type SmbRawDirEntry,
  type SmbReaddirPorts,
  type SmbRequestError,
} from './readdir.js'

function rawEntry(name: string): SmbRawDirEntry {
  return {
    Filename: name,
    CreationTime: Buffer.alloc(8, 1),
    LastAccessTime: Buffer.alloc(8, 2),
    LastWriteTime: Buffer.alloc(8, 3),
    ChangeTime: Buffer.alloc(8, 4),
    EndofFile: Buffer.alloc(8, 5),
    FileAttributes: 0,
  }
}

function smbError(code: string): SmbRequestError {
  return Object.assign(new Error(code), { code })
}

/** 只关心「时间与大小是怎么换出来的」，具体数值由用例覆盖。 */
function fakeStats(file: SmbRawDirEntry): SmbStatLike {
  return {
    birthtime: new Date(file.CreationTime[0] ?? 0),
    atime: new Date(file.LastAccessTime[0] ?? 0),
    mtime: new Date(file.LastWriteTime[0] ?? 0),
    ctime: new Date(file.ChangeTime[0] ?? 0),
    size: file.EndofFile[0] ?? 0,
    isDirectory: () => false,
  }
}

interface HarnessOptions {
  batches: SmbRawDirEntry[][]
  /** 第几次 query_directory 失败（0 基），用来验证失败路径同样还句柄。 */
  failAt?: number
}

function createHarness(options: HarnessOptions) {
  const handle = { FileId: Buffer.from('dir-handle') }
  const queries: object[] = []
  const closed: object[] = []
  let batchIndex = 0

  const request: SmbReaddirPorts['request'] = (name, params, _connection, callback) => {
    if (name === 'open') {
      callback(null, handle)
      return
    }

    if (name === 'close') {
      closed.push(params)
      callback(null, {})
      return
    }

    queries.push(params)
    if (options.failAt === batchIndex) {
      callback(smbError('STATUS_ACCESS_DENIED'))
      return
    }

    const batch = options.batches[batchIndex]
    if (batch === undefined) {
      callback(smbError('STATUS_NO_MORE_FILES'))
      return
    }

    batchIndex += 1
    callback(null, batch)
  }

  return { closed, handle, ports: { request, stats: fakeStats }, queries }
}

describe('listDirectory', () => {
  it('翻页合并结果，并跳过 . 与 ..', async () => {
    const harness = createHarness({
      batches: [[rawEntry('.'), rawEntry('a.txt'), rawEntry('..')], [rawEntry('b.txt')]],
    })

    const entries = await listDirectory(harness.ports, {}, '/share')

    expect(entries.map((entry) => entry.name)).toEqual(['a.txt', 'b.txt'])
    expect(entries[0]?.size).toBe(5)
    // 两批数据 + 一次用来收尾的 STATUS_NO_MORE_FILES。
    expect(harness.queries).toHaveLength(3)
  })

  it('关闭的是 open 返回的同一个目录句柄', async () => {
    const harness = createHarness({ batches: [[rawEntry('a.txt')]] })

    await listDirectory(harness.ports, {}, '/share')

    // 上游把 filesBatch 当成句柄传给 CLOSE，这里断言句柄来自 open。
    expect(harness.closed).toEqual([harness.handle])
  })

  it('翻页失败时同样关闭句柄，并把错误原样抛出', async () => {
    const harness = createHarness({
      batches: [[rawEntry('a.txt')], [rawEntry('b.txt')]],
      failAt: 1,
    })

    await expect(listDirectory(harness.ports, {}, '/share')).rejects.toMatchObject({
      code: 'STATUS_ACCESS_DENIED',
    })

    expect(harness.closed).toEqual([harness.handle])
  })

  it('STATUS_NO_MORE_FILES 视为正常结束', async () => {
    const harness = createHarness({ batches: [] })

    const entries = await listDirectory(harness.ports, {}, '/share')

    expect(entries).toEqual([])
    expect(harness.closed).toEqual([harness.handle])
  })
})
