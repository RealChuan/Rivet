import { Readable, Writable } from 'node:stream'
import { finished } from 'node:stream/promises'
import type { Capabilities, Entry } from '@shared/domain/entry.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { getParentPath, joinPaths, normalizePath } from '@shared/utils/index.js'
import type { FileProvider, ReadHandle, WriteHandle } from '../types.js'
import type { RawSftpEntry, SftpConnection } from './connection-types.js'
import { remoteTempPath } from '../../utils/temp-path.js'
import { ProviderError } from '../errors.js'
import { SFTP_OPEN_FLAG } from './connection-types.js'

const CAPABILITIES: Capabilities = {
  chmod: true,
  symlink: true,
  serverSideCopy: false,
  serverSideMove: true,
  atomicRename: true,
  dirIsEntity: true,
  caseSensitive: true,
}

function toEntry(raw: RawSftpEntry, parentPath: string): Entry {
  return {
    name: raw.name,
    kind: raw.kind,
    size: raw.size,
    mtime: raw.mtime,
    ...(raw.permissions !== undefined ? { permissions: raw.permissions } : {}),
    ...(raw.owner !== undefined ? { owner: raw.owner } : {}),
    path: joinPaths(parentPath, raw.name),
  }
}

async function removePath(
  connection: SftpConnection,
  path: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  const info = await connection.stat(path, signal)

  if (info.kind === 'directory') {
    const children = await connection.list(path, signal)
    for (const child of children) {
      signal?.throwIfAborted()
      await removePath(connection, joinPaths(path, child.name), signal)
    }
    await connection.rmdir(path, signal)
    return
  }

  await connection.unlink(path, signal)
}

async function unlinkIfExists(
  connection: SftpConnection,
  path: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  try {
    await connection.unlink(path, signal)
  } catch (error) {
    if (!(error instanceof ProviderError && error.code === ERROR_CODE.NOT_FOUND)) throw error
  }
}

async function isDirectory(
  connection: SftpConnection,
  path: string,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  try {
    const info = await connection.stat(path, signal)
    return info.kind === 'directory'
  } catch {
    return false
  }
}

/**
 * SFTPv3 没有「已存在」状态码：OpenSSH 把 EEXIST 折成 SSH_FX_FAILURE，和权限错误在
 * 状态码上无法区分。所以失败后回查一次目标，确认它已经是目录才当作成功。
 */
async function ensureDirectory(
  connection: SftpConnection,
  path: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  try {
    await connection.mkdir(path, signal)
  } catch (error) {
    if (error instanceof ProviderError && error.code === ERROR_CODE.ALREADY_EXISTS) return
    if (signal?.aborted) throw error
    if (await isDirectory(connection, path, signal)) return
    throw error
  }
}

export function createSftpProvider(
  connection: SftpConnection,
  options: { hostVerifier?: (publicKey: Buffer) => boolean } = {},
): FileProvider {
  return {
    kind: 'sftp',
    capabilities: CAPABILITIES,

    connect: async (credentials, signal) => {
      const connectOptions = {
        ...(options.hostVerifier !== undefined ? { hostVerifier: options.hostVerifier } : {}),
        ...(signal !== undefined ? { signal } : {}),
      }
      await connection.connect(
        credentials,
        Object.keys(connectOptions).length > 0 ? connectOptions : undefined,
      )
    },

    disconnect: () => connection.disconnect(),
    ping: (signal) => connection.ping(signal),

    list: async function* (path, opts) {
      const entries = await connection.list(path, opts.signal)
      for (const raw of entries) {
        opts.signal.throwIfAborted()
        yield toEntry(raw, path)
      }
    },

    stat: async (path, signal) => toEntry(await connection.stat(path, signal), getParentPath(path)),

    mkdir: async (path, opts) => {
      const normalized = normalizePath(path)
      if (!opts.recursive) {
        await connection.mkdir(normalized, opts.signal)
        return
      }

      const segments = normalized.split('/').filter(Boolean)
      const absolute = normalized.startsWith('/')
      let current = ''
      for (const segment of segments) {
        current = current ? `${current}/${segment}` : absolute ? `/${segment}` : segment
        await ensureDirectory(connection, current, opts.signal)
      }
    },

    remove: (path, signal) => removePath(connection, path, signal),

    rename: async (from, to, signal) => {
      try {
        await removePath(connection, to, signal)
      } catch (error) {
        if (!(error instanceof ProviderError && error.code === ERROR_CODE.NOT_FOUND)) throw error
      }
      await connection.rename(from, to, signal)
    },

    chmod: (path, mode, signal) => connection.chmod(path, mode, signal),

    openRead: async (path, opts): Promise<ReadHandle> => {
      const signal = opts.signal ?? new AbortController().signal
      const nodeStream = await connection.openRead(path, opts.start ?? 0, signal)
      return {
        stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        close: () => {
          nodeStream.destroy()
          return Promise.resolve()
        },
      }
    },

    openWrite: async (path, opts): Promise<WriteHandle> => {
      const signal = opts.signal ?? new AbortController().signal
      let exists = false
      try {
        await connection.stat(path, signal)
        exists = true
      } catch (error) {
        if (!(error instanceof ProviderError && error.code === ERROR_CODE.NOT_FOUND)) throw error
      }

      if (exists && !opts.overwrite) {
        throw new ProviderError(ERROR_CODE.ALREADY_EXISTS, `target exists: ${path}`)
      }

      const tempPath = remoteTempPath(path)
      const nodeStream = await connection.openWrite(tempPath, SFTP_OPEN_FLAG.EXCLUSIVE, signal)

      return {
        stream: Writable.toWeb(nodeStream) as WritableStream<Uint8Array>,
        commit: async () => {
          await finished(nodeStream)
          try {
            // SFTP v3 的 RENAME 不能覆盖已存在目标，覆盖写先删目标（与 provider.rename 一致）。
            if (exists) await unlinkIfExists(connection, path, signal)
            await connection.rename(tempPath, path, signal)
          } catch (error) {
            await connection.unlink(tempPath, signal).catch(() => {})
            throw error
          }
        },
        abort: async () => {
          nodeStream.destroy()
          await connection.unlink(tempPath, signal).catch(() => {})
        },
      }
    },
  }
}
