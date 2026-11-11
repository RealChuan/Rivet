import type { SmbDirEntryLike, SmbStatLike } from './client.js'

/** 消息层返回的错误：`code` 是 SMB2 状态名。 */
export interface SmbRequestError extends Error {
  code?: string
}

/** `query_directory` 的一条原始记录，字段名沿用上游解包后的形状。 */
export interface SmbRawDirEntry {
  readonly Filename: string
  readonly CreationTime: Buffer
  readonly LastAccessTime: Buffer
  readonly LastWriteTime: Buffer
  readonly ChangeTime: Buffer
  readonly EndofFile: Buffer
  readonly FileAttributes: number
}

export interface SmbFileHandle {
  readonly FileId: Buffer
}

/** 上游的消息层与 stats 工具；注入是为了能脱离真实连接写用例。 */
export interface SmbReaddirPorts {
  request(
    name: string,
    params: object,
    connection: object,
    callback: (error: SmbRequestError | null, result?: unknown) => void,
  ): void
  stats(file: SmbRawDirEntry): SmbStatLike
}

const STATUS_NO_MORE_FILES = 'STATUS_NO_MORE_FILES'
const CURRENT_DIR = '.'
const PARENT_DIR = '..'

function isNoMoreFiles(error: SmbRequestError): boolean {
  return error.code === STATUS_NO_MORE_FILES
}

function asDirEntries(result: unknown): SmbRawDirEntry[] {
  return result as SmbRawDirEntry[]
}

function asFileHandle(result: unknown): SmbFileHandle {
  return result as SmbFileHandle
}

/**
 * 上游 `readdir` 结束时把文件列表当成句柄传给 CLOSE（`lib/api/readdir.js` 的
 * `file` 参数被 `filesBatch` 覆盖），目录句柄就此泄漏。这里复用它的消息层
 * 自己走 `open → query_directory… → close`，句柄始终在我们手里。
 */
export async function listDirectory(
  ports: SmbReaddirPorts,
  connection: object,
  path: string,
): Promise<SmbDirEntryLike[]> {
  const file = await new Promise<SmbFileHandle>((resolve, reject) => {
    ports.request('open', { path }, connection, (error, result) => {
      if (error === null) resolve(asFileHandle(result))
      else reject(error)
    })
  })

  const entries: SmbDirEntryLike[] = []

  try {
    for (;;) {
      const batch = await new Promise<SmbRawDirEntry[] | null>((resolve, reject) => {
        ports.request('query_directory', file, connection, (error, result) => {
          if (error === null) resolve(asDirEntries(result))
          else if (isNoMoreFiles(error)) resolve(null)
          else reject(error)
        })
      })

      if (batch === null) break

      for (const entry of batch) {
        if (entry.Filename === CURRENT_DIR || entry.Filename === PARENT_DIR) continue
        entries.push({ ...ports.stats(entry), name: entry.Filename })
      }
    }
  } finally {
    await new Promise<void>((resolve) => {
      ports.request('close', file, connection, () => resolve())
    })
  }

  return entries
}
