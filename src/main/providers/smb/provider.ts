import { Readable, Writable } from 'node:stream'
import { finished } from 'node:stream/promises'
import type { Credentials } from '@shared/domain/credentials.js'
import type { Capabilities, Entry } from '@shared/domain/entry.js'
import type { ErrorCode } from '@shared/domain/error.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { joinPaths, normalizePath, pathBasename } from '@shared/utils/index.js'
import type { FileProvider, ReadHandle, WriteHandle } from '../types.js'
import { remoteTempPath } from '../../utils/temp-path.js'
import { ProviderError } from '../errors.js'
import {
  createV9uSmbClient,
  toUncShare,
  type SmbClientPort,
  type SmbDirEntryLike,
  type SmbStatLike,
} from './client.js'
import { toProviderError } from './error-map.js'

const CAPABILITIES: Capabilities = {
  chmod: false,
  symlink: false,
  serverSideCopy: false,
  serverSideMove: true,
  atomicRename: true,
  dirIsEntity: true,
  caseSensitive: false,
}

/** 服务端明确回 delete-pending 时的等待上限；其余情况一次 stat 就下结论。 */
const DELETE_VERIFY_ATTEMPTS = 10
const DELETE_VERIFY_INTERVAL_MS = 100

export interface SmbProviderOptions {
  config: ConnectionConfig
  /** 测试注入点；缺省时构造真实 v9u-smb2 客户端。 */
  createClient?: (config: ConnectionConfig, credentials: Credentials) => SmbClientPort
}

function toSmbPath(path: string): string {
  const normalized = normalizePath(path)
  const withoutLeading = normalized.startsWith('/') ? normalized.slice(1) : normalized
  return withoutLeading.replace(/\//g, '\\')
}

function joinSmbPath(parent: string, name: string): string {
  return parent ? `${parent}\\${name}` : name
}

function toEntry(stat: SmbStatLike, name: string, virtualPath: string): Entry {
  return {
    name,
    kind: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size ?? 0,
    mtime: stat.mtime.getTime(),
    path: virtualPath,
  }
}

async function statIfExists(
  client: SmbClientPort,
  smbPath: string,
  fallback: ErrorCode,
): Promise<SmbStatLike | undefined> {
  try {
    return await client.stat(smbPath)
  } catch (error) {
    const providerError = toProviderError(error, fallback)
    if (providerError.code === ERROR_CODE.NOT_FOUND) return undefined
    throw providerError
  }
}

type RemovalState = 'gone' | 'exists' | 'pending'

/** delete-pending 是「已标记删除、还有句柄没关」，只有它会自己变成 gone；其余都是最终结果。 */
async function removalState(client: SmbClientPort, smbPath: string): Promise<RemovalState> {
  let remaining: SmbStatLike | undefined
  try {
    remaining = await statIfExists(client, smbPath, ERROR_CODE.DELETE_ERROR)
  } catch (error) {
    const providerError = toProviderError(error, ERROR_CODE.DELETE_ERROR)
    if (providerError.detail?.status !== 'STATUS_DELETE_PENDING') throw providerError
    return 'pending'
  }

  return remaining === undefined ? 'gone' : 'exists'
}

async function ensureDirectory(
  client: SmbClientPort,
  smbPath: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  signal?.throwIfAborted()
  try {
    await client.mkdir(smbPath)
  } catch (error) {
    const providerError = toProviderError(error, ERROR_CODE.MKDIR_ERROR)
    if (providerError.code === ERROR_CODE.ALREADY_EXISTS) return

    // 部分服务器对已存在目录只回 ACCESS_DENIED，回查一次再决定。
    const existing = await statIfExists(client, smbPath, ERROR_CODE.MKDIR_ERROR).catch(
      () => undefined,
    )
    if (existing?.isDirectory()) return
    throw providerError
  }
}

async function removePath(
  client: SmbClientPort,
  smbPath: string,
  virtualPath: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  signal?.throwIfAborted()

  const stat = await statIfExists(client, smbPath, ERROR_CODE.DELETE_ERROR)
  if (!stat) {
    throw new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${virtualPath}`)
  }

  if (!stat.isDirectory()) {
    await client.unlink(smbPath)
    return
  }

  const children = await client.readdir(smbPath, { stats: true })
  for (const child of children) {
    signal?.throwIfAborted()
    await removePath(
      client,
      joinSmbPath(smbPath, child.name),
      joinPaths(virtualPath, child.name),
      signal,
    )
  }
  await client.rmdir(smbPath)
}

/**
 * v9u-smb2 的写流在 `_final` 和 `_destroy` 里各发一次 CLOSE，第二次会收到
 * STATUS_FILE_CLOSED。这里只允许关闭一次：正常结束时跳过销毁阶段的重复关闭。
 */
function closeWritableOnce(nodeStream: Writable): void {
  let finalized = false
  const final = nodeStream._final?.bind(nodeStream)
  const destroy = nodeStream._destroy?.bind(nodeStream)

  if (final !== undefined) {
    nodeStream._final = function (callback) {
      finalized = true
      final(callback)
    }
  }
  if (destroy !== undefined) {
    nodeStream._destroy = function (error, callback) {
      if (finalized) {
        callback(error)
        return
      }
      destroy(error, callback)
    }
  }
}

/** 读流到达 EOF 后 v9u-smb2 还会在销毁阶段重复 CLOSE，这里跳过这一次。 */
function closeReadableOnce(nodeStream: Readable): void {
  const destroy = nodeStream._destroy?.bind(nodeStream)
  if (destroy === undefined) return

  nodeStream._destroy = function (error, callback) {
    if (nodeStream.readableEnded) {
      callback(error)
      return
    }
    destroy(error, callback)
  }
}

/** 空闲会话上限：复用握手成本，又不会无限堆积连接。 */
const IDLE_SESSION_LIMIT = 4

export function createSmbProvider(options: SmbProviderOptions): FileProvider {
  const createClient = options.createClient ?? createV9uSmbClient
  let credentialsInUse: Credentials | null = null
  /** 所有活着的会话；断开时一并关掉，包括正被流占用的那些。 */
  const sessions = new Set<SmbClientPort>()
  const idle: SmbClientPort[] = []

  function openSession(): SmbClientPort {
    if (credentialsInUse === null) {
      throw new ProviderError(ERROR_CODE.INVALID_STATE, 'SMB provider is not connected')
    }

    const reused = idle.pop()
    if (reused !== undefined) return reused

    const client = createClient(options.config, credentialsInUse)
    sessions.add(client)
    return client
  }

  function disposeSession(client: SmbClientPort): void {
    // disconnect 已经收掉、或失败路径已经处置过的会话，不重复关闭。
    if (!sessions.delete(client)) return
    client.disconnect()
  }

  /** 只有正常结束才放回池里。失败一律换新会话：脏状态判断不了，猜错就是把残留带进下一个操作。 */
  function parkSession(client: SmbClientPort): void {
    if (!sessions.has(client) || idle.includes(client)) return
    if (idle.length >= IDLE_SESSION_LIMIT) {
      disposeSession(client)
      return
    }
    idle.push(client)
  }

  async function withClient<T>(
    signal: AbortSignal | undefined,
    operation: (client: SmbClientPort) => Promise<T>,
  ): Promise<T> {
    signal?.throwIfAborted()
    const client = openSession()
    try {
      const result = await operation(client)
      parkSession(client)
      return result
    } catch (error) {
      disposeSession(client)
      throw error
    }
  }

  /** 删除后确认条目消失。只有服务端明确回 delete-pending 时才值得等。 */
  async function waitUntilRemoved(smbPath: string, signal: AbortSignal | undefined): Promise<void> {
    await withClient(signal, async (client) => {
      for (let attempt = 0; ; attempt += 1) {
        const state = await removalState(client, smbPath)
        if (state === 'gone') return

        if (state === 'exists') {
          throw new ProviderError(ERROR_CODE.DELETE_ERROR, `delete did not take effect: ${smbPath}`)
        }

        if (attempt >= DELETE_VERIFY_ATTEMPTS - 1) {
          throw new ProviderError(ERROR_CODE.DELETE_ERROR, `delete still pending: ${smbPath}`)
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, DELETE_VERIFY_INTERVAL_MS)
        })
        signal?.throwIfAborted()
      }
    })
  }

  return {
    kind: 'smb',
    capabilities: CAPABILITIES,

    connect: (credentials, signal) => {
      signal?.throwIfAborted()
      if (credentials.kind !== 'password') {
        return Promise.reject(
          new ProviderError(ERROR_CODE.INVALID_CONFIG, 'SMB only supports password authentication'),
        )
      }
      toUncShare(options.config)
      credentialsInUse = credentials
      return Promise.resolve()
    },

    disconnect: () => {
      credentialsInUse = null
      for (const client of [...sessions]) disposeSession(client)
      idle.length = 0
      return Promise.resolve()
    },

    ping: async (signal) => {
      try {
        await withClient(signal, (client) => client.stat(''))
      } catch (error) {
        throw toProviderError(error, ERROR_CODE.PING_ERROR)
      }
    },

    list: async function* (path, opts) {
      const virtualPath = normalizePath(path)
      const smbPath = toSmbPath(virtualPath)
      opts.signal.throwIfAborted()

      let entries: SmbDirEntryLike[]
      try {
        entries = await withClient(opts.signal, (client) =>
          client.readdir(smbPath, { stats: true }),
        )
      } catch (error) {
        throw toProviderError(error, ERROR_CODE.LIST_ERROR)
      }

      for (const entry of entries) {
        opts.signal.throwIfAborted()
        yield toEntry(entry, entry.name, joinPaths(virtualPath, entry.name))
      }
    },

    stat: async (path, signal) => {
      signal?.throwIfAborted()
      const virtualPath = normalizePath(path)
      try {
        const stat = await withClient(signal, (client) => client.stat(toSmbPath(virtualPath)))
        return toEntry(stat, pathBasename(virtualPath), virtualPath)
      } catch (error) {
        throw toProviderError(error, ERROR_CODE.LIST_ERROR)
      }
    },

    mkdir: async (path, opts) => {
      opts.signal?.throwIfAborted()
      const virtualPath = normalizePath(path)

      try {
        await withClient(opts.signal, async (client) => {
          if (!opts.recursive) {
            await client.mkdir(toSmbPath(virtualPath))
            return
          }

          let current = ''
          for (const segment of virtualPath.split('/').filter(Boolean)) {
            opts.signal?.throwIfAborted()
            current = joinSmbPath(current, segment)
            await ensureDirectory(client, current, opts.signal)
          }
        })
      } catch (error) {
        throw toProviderError(error, ERROR_CODE.MKDIR_ERROR)
      }
    },

    remove: async (path, signal) => {
      signal?.throwIfAborted()
      const virtualPath = normalizePath(path)
      const smbPath = toSmbPath(virtualPath)
      try {
        await withClient(signal, (client) => removePath(client, smbPath, virtualPath, signal))
        await waitUntilRemoved(smbPath, signal)
      } catch (error) {
        throw toProviderError(error, ERROR_CODE.DELETE_ERROR)
      }
    },

    rename: async (from, to, signal) => {
      signal?.throwIfAborted()
      try {
        await withClient(signal, (client) =>
          client.rename(toSmbPath(normalizePath(from)), toSmbPath(normalizePath(to)), {
            replace: true,
          }),
        )
      } catch (error) {
        throw toProviderError(error, ERROR_CODE.RENAME_ERROR)
      }
    },

    openRead: async (path, opts): Promise<ReadHandle> => {
      opts.signal?.throwIfAborted()
      const smbPath = toSmbPath(normalizePath(path))
      const client = openSession()

      let nodeStream: Readable
      try {
        nodeStream = await client.createReadStream(
          smbPath,
          opts.start !== undefined ? { start: opts.start } : {},
        )
      } catch (error) {
        disposeSession(client)
        throw toProviderError(error, ERROR_CODE.DOWNLOAD_ERROR)
      }

      closeReadableOnce(nodeStream)

      let settled = false
      const park = (): void => {
        if (settled) return
        settled = true
        parkSession(client)
      }
      const drop = (): void => {
        if (settled) return
        settled = true
        disposeSession(client)
      }
      // 读流报错说明会话状态可疑，不再放回池里。
      nodeStream.once('error', drop)

      const onAbort = (): void => {
        nodeStream.destroy()
      }
      opts.signal?.addEventListener('abort', onAbort, { once: true })
      const detach = (): void => {
        opts.signal?.removeEventListener('abort', onAbort)
      }
      nodeStream.once('close', () => {
        detach()
        park()
      })

      return {
        stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        close: () => {
          detach()
          nodeStream.destroy()
          park()
          return Promise.resolve()
        },
      }
    },

    openWrite: async (path, opts): Promise<WriteHandle> => {
      opts.signal?.throwIfAborted()
      const client = openSession()
      const virtualPath = normalizePath(path)
      const targetPath = toSmbPath(virtualPath)
      const tempPath = toSmbPath(remoteTempPath(virtualPath))

      let nodeStream: Writable
      let existing: SmbStatLike | undefined
      let stage = 'stat-target'
      try {
        existing = await statIfExists(client, targetPath, ERROR_CODE.UPLOAD_ERROR)
        if (existing !== undefined && !opts.overwrite) {
          throw new ProviderError(ERROR_CODE.ALREADY_EXISTS, `target exists: ${virtualPath}`)
        }
        stage = 'create-temp'
        nodeStream = await client.createWriteStream(tempPath, { flags: 'wx' })
      } catch (error) {
        disposeSession(client)
        const providerError = toProviderError(error, ERROR_CODE.UPLOAD_ERROR)
        throw new ProviderError(
          providerError.code,
          `${stage}: ${providerError.message}`,
          providerError.detail,
        )
      }

      closeWritableOnce(nodeStream)

      let aborted = false
      const onAbort = (): void => {
        aborted = true
        nodeStream.destroy()
      }
      opts.signal?.addEventListener('abort', onAbort, { once: true })
      const detach = (): void => {
        opts.signal?.removeEventListener('abort', onAbort)
      }

      const removeTemp = async (): Promise<void> => {
        await client.unlink(tempPath).catch(() => {})
      }

      return {
        stream: Writable.toWeb(nodeStream) as WritableStream<Uint8Array>,

        commit: async () => {
          let committed = false
          try {
            await finished(nodeStream)
            if (aborted) {
              throw new ProviderError(ERROR_CODE.UPLOAD_ABORTED, 'upload aborted')
            }

            try {
              await client.rename(tempPath, targetPath, { replace: true })
            } catch (error) {
              const providerError = toProviderError(error, ERROR_CODE.UPLOAD_ERROR)
              // 少数服务器忽略 ReplaceIfExists，退化为先删目标再 rename。
              if (existing !== undefined && providerError.code === ERROR_CODE.ALREADY_EXISTS) {
                await client.unlink(targetPath).catch(() => {})
                await client.rename(tempPath, targetPath, { replace: true })
              } else {
                throw providerError
              }
            }
            committed = true
          } catch (error) {
            await removeTemp()
            const providerError = toProviderError(error, ERROR_CODE.UPLOAD_ERROR)
            throw new ProviderError(
              providerError.code,
              `commit: ${providerError.message}`,
              providerError.detail,
            )
          } finally {
            detach()
            if (committed) parkSession(client)
            else disposeSession(client)
          }
        },

        abort: async () => {
          aborted = true
          detach()
          nodeStream.destroy()
          await finished(nodeStream).catch(() => {})
          await removeTemp()
          // 半途中断的写流不值得复用，换一条会话。
          disposeSession(client)
        },
      }
    },
  }
}
