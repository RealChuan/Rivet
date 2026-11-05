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

/** 删除后确认条目已消失；delete-on-close 可能在连接关闭后才由服务端完成。 */
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

export function createSmbProvider(options: SmbProviderOptions): FileProvider {
  const createClient = options.createClient ?? createV9uSmbClient
  let connectionFactory: (() => SmbClientPort) | null = null

  function createOperationClient(): SmbClientPort {
    if (!connectionFactory) {
      throw new ProviderError(ERROR_CODE.INVALID_STATE, 'SMB provider is not connected')
    }
    return connectionFactory()
  }

  async function withClient<T>(
    signal: AbortSignal | undefined,
    operation: (client: SmbClientPort) => Promise<T>,
  ): Promise<T> {
    signal?.throwIfAborted()
    const client = createOperationClient()
    try {
      return await operation(client)
    } finally {
      client.disconnect()
    }
  }

  async function waitUntilRemoved(smbPath: string, signal: AbortSignal | undefined): Promise<void> {
    await withClient(signal, async (client) => {
      for (let attempt = 0; attempt < DELETE_VERIFY_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, DELETE_VERIFY_INTERVAL_MS)
          })
          signal?.throwIfAborted()
        }

        try {
          const remaining = await statIfExists(client, smbPath, ERROR_CODE.DELETE_ERROR)
          if (!remaining) return
        } catch (error) {
          const providerError = toProviderError(error, ERROR_CODE.DELETE_ERROR)
          if (providerError.detail?.status !== 'STATUS_DELETE_PENDING') throw providerError
        }
      }
      throw new ProviderError(ERROR_CODE.DELETE_ERROR, `delete did not take effect: ${smbPath}`)
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
      connectionFactory = () => createClient(options.config, credentials)
      return Promise.resolve()
    },

    disconnect: () => {
      connectionFactory = null
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
      const client = createOperationClient()

      let nodeStream: Readable
      try {
        nodeStream = await client.createReadStream(
          smbPath,
          opts.start !== undefined ? { start: opts.start } : {},
        )
      } catch (error) {
        client.disconnect()
        throw toProviderError(error, ERROR_CODE.DOWNLOAD_ERROR)
      }

      closeReadableOnce(nodeStream)

      let released = false
      const release = (): void => {
        if (released) return
        released = true
        client.disconnect()
      }
      const onAbort = (): void => {
        nodeStream.destroy()
        release()
      }
      opts.signal?.addEventListener('abort', onAbort, { once: true })
      const detach = (): void => {
        opts.signal?.removeEventListener('abort', onAbort)
      }
      nodeStream.once('close', () => {
        detach()
        release()
      })

      return {
        stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        close: () => {
          detach()
          nodeStream.destroy()
          release()
          return Promise.resolve()
        },
      }
    },

    openWrite: async (path, opts): Promise<WriteHandle> => {
      opts.signal?.throwIfAborted()
      const client = createOperationClient()
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
        client.disconnect()
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
            client.disconnect()
          }
        },

        abort: async () => {
          aborted = true
          detach()
          nodeStream.destroy()
          await finished(nodeStream).catch(() => {})
          await removeTemp()
          client.disconnect()
        },
      }
    },
  }
}
