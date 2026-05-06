import type { Readable, Writable } from 'node:stream'
import type { Credentials } from '@shared/domain/credentials.js'
import type { EntryKind } from '@shared/domain/entry.js'
import type { ErrorCode } from '@shared/domain/error.js'
import type { ConnectionConfig } from '@shared/types/index.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { pathBasename } from '@shared/utils/index.js'
import type {
  RawSftpEntry,
  SftpConnectOptions,
  SftpConnection,
  SftpOpenFlag,
} from './connection-types.js'
import { ProviderError } from '../errors.js'
import { buildSshAuthConfig, mapSshAuthError } from './auth.js'
import { ssh2 } from './ssh2-module.js'

export interface Ssh2Stats {
  isDirectory(): boolean
  isFile(): boolean
  isSymbolicLink(): boolean
  size: number
  mtime: number
  mode: number
}

export interface Ssh2DirEntry {
  filename: string
  longname: string
  attrs: Ssh2Stats
}

export interface Ssh2SftpPort {
  readdir(path: string, callback: (error: Error | undefined, entries: Ssh2DirEntry[]) => void): void
  stat(path: string, callback: (error: Error | undefined, attrs: Ssh2Stats) => void): void
  mkdir(path: string, callback: (error?: Error | null) => void): void
  rmdir(path: string, callback: (error?: Error | null) => void): void
  unlink(path: string, callback: (error?: Error | null) => void): void
  rename(from: string, to: string, callback: (error?: Error | null) => void): void
  chmod(path: string, mode: number, callback: (error?: Error | null) => void): void
  createReadStream(path: string, options: { start: number }): Readable
  createWriteStream(path: string, options: { flags: SftpOpenFlag; mode: number }): Writable
}

export interface Ssh2ClientPort {
  on(event: 'ready', listener: () => void): void
  on(event: 'error', listener: (error: Error) => void): void
  removeListener(event: 'ready', listener: () => void): void
  removeListener(event: 'error', listener: (error: Error) => void): void
  connect(options: Record<string, unknown>): void
  end(): void
  sftp(callback: (error: Error | undefined, sftp: Ssh2SftpPort) => void): void
}

/** ssh2 把 SFTP 状态码放在 `error.code`（数值），这里只映射语义稳定且可区分的几个。 */
const SFTP_STATUS = {
  NO_SUCH_FILE: 2,
  PERMISSION_DENIED: 3,
  OP_UNSUPPORTED: 8,
} as const

function mapSftpStatus(error: Error, fallback: ErrorCode): ErrorCode {
  const status = 'code' in error && typeof error.code === 'number' ? error.code : undefined
  if (status === SFTP_STATUS.NO_SUCH_FILE) return ERROR_CODE.NOT_FOUND
  if (status === SFTP_STATUS.PERMISSION_DENIED) return ERROR_CODE.PERMISSION_DENIED
  if (status === SFTP_STATUS.OP_UNSUPPORTED) return ERROR_CODE.NOT_SUPPORTED
  return fallback
}

/** 上传文件的默认权限位（rw-r--r--），服务端 umask 可能再收窄。 */
const UPLOAD_FILE_MODE = 0o644

const MODE_BITS = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'] as const

function formatMode(mode: number): string {
  return `${MODE_BITS[(mode >> 6) & 7]}${MODE_BITS[(mode >> 3) & 7]}${MODE_BITS[mode & 7]}`
}

function kindOf(attrs: Ssh2Stats): EntryKind {
  if (attrs.isSymbolicLink()) return 'symlink'
  if (attrs.isDirectory()) return 'directory'
  return 'file'
}

function ownerOf(longname: string): string {
  const parts = longname.split(/\s+/)
  return parts.length >= 4 ? (parts[2] ?? '') : ''
}

function toRaw(name: string, attrs: Ssh2Stats, longname = ''): RawSftpEntry {
  return {
    name,
    kind: kindOf(attrs),
    size: attrs.size,
    mtime: attrs.mtime * 1000,
    permissions: formatMode(attrs.mode),
    owner: ownerOf(longname),
  }
}

/**
 * ssh2 的唯一调用面。provider 只依赖 SftpConnection 端口，测试可注入 fake client。
 */
export class Ssh2SftpConnection implements SftpConnection {
  private readonly config: ConnectionConfig
  private readonly deps: { createClient?: () => Ssh2ClientPort }
  private client: Ssh2ClientPort | undefined
  private sftp: Ssh2SftpPort | undefined

  constructor(config: ConnectionConfig, deps: { createClient?: () => Ssh2ClientPort } = {}) {
    this.config = config
    this.deps = deps
  }

  private requireSftp(): Ssh2SftpPort {
    if (!this.sftp) throw new ProviderError(ERROR_CODE.CONN_FAILED, 'SFTP channel is not ready')
    return this.sftp
  }

  private call<T>(
    code: ErrorCode,
    invoke: (callback: (error?: Error | null, result?: T) => void) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      invoke((error, result) => {
        if (error) {
          reject(
            new ProviderError(mapSftpStatus(error, code), error.message, {
              serverMessage: error.message,
            }),
          )
          return
        }
        resolve(result as T)
      })
    })
  }

  async connect(credentials: Credentials, opts?: SftpConnectOptions): Promise<void> {
    const auth = await buildSshAuthConfig(credentials)
    const client = this.deps.createClient?.() ?? new ssh2.Client()
    this.client = client

    const connectOptions: Record<string, unknown> = {
      host: this.config.host,
      port: this.config.port,
      username: auth.username,
      ...(auth.password !== undefined ? { password: auth.password } : {}),
      ...(auth.privateKey !== undefined ? { privateKey: auth.privateKey } : {}),
      ...(auth.passphrase !== undefined ? { passphrase: auth.passphrase } : {}),
      ...(auth.agent !== undefined ? { agent: auth.agent } : {}),
      readyTimeout: auth.readyTimeout,
      ...(opts?.hostVerifier !== undefined ? { hostVerifier: opts.hostVerifier } : {}),
    }

    const signal = opts?.signal
    try {
      await new Promise<void>((resolve, reject) => {
        const onReady = (): void => {
          cleanup()
          resolve()
        }
        const onError = (error: Error): void => {
          cleanup()
          const mapped = mapSshAuthError(error, credentials.kind)
          reject(new ProviderError(mapped.code, mapped.message, mapped.detail))
        }
        const onAbort = (): void => {
          cleanup()
          client.end()
          reject(new ProviderError(ERROR_CODE.REQUEST_ABORTED, 'connection aborted'))
        }
        const cleanup = (): void => {
          client.removeListener('ready', onReady)
          client.removeListener('error', onError)
          signal?.removeEventListener('abort', onAbort)
        }

        client.on('ready', onReady)
        client.on('error', onError)
        signal?.addEventListener('abort', onAbort, { once: true })
        client.connect(connectOptions)
      })

      this.sftp = await new Promise<Ssh2SftpPort>((resolve, reject) => {
        client.sftp((error, sftp) => {
          if (error) {
            reject(new ProviderError(ERROR_CODE.CONN_FAILED, error.message))
            return
          }
          resolve(sftp)
        })
      })
    } catch (error) {
      this.client = undefined
      this.sftp = undefined
      client.end()
      throw error
    }
  }

  disconnect(): Promise<void> {
    this.client?.end()
    this.client = undefined
    this.sftp = undefined
    return Promise.resolve()
  }

  ping(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    return this.call<void>(ERROR_CODE.PING_ERROR, (callback) => {
      this.requireSftp().stat('/', (error) => callback(error))
    })
  }

  async list(path: string, signal?: AbortSignal): Promise<RawSftpEntry[]> {
    signal?.throwIfAborted()
    const entries = await this.call<Ssh2DirEntry[]>(ERROR_CODE.LIST_ERROR, (callback) => {
      this.requireSftp().readdir(path, (error, result) => callback(error, result))
    })
    return entries.map((entry) => toRaw(entry.filename, entry.attrs, entry.longname))
  }

  async stat(path: string, signal?: AbortSignal): Promise<RawSftpEntry> {
    signal?.throwIfAborted()
    const attrs = await this.call<Ssh2Stats>(ERROR_CODE.LIST_ERROR, (callback) => {
      this.requireSftp().stat(path, (error, result) => callback(error, result))
    })
    return toRaw(pathBasename(path), attrs)
  }

  async mkdir(path: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    await this.call<void>(ERROR_CODE.MKDIR_ERROR, (callback) => {
      this.requireSftp().mkdir(path, callback)
    })
  }

  async rmdir(path: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    await this.call<void>(ERROR_CODE.DELETE_ERROR, (callback) => {
      this.requireSftp().rmdir(path, callback)
    })
  }

  async unlink(path: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    await this.call<void>(ERROR_CODE.DELETE_ERROR, (callback) => {
      this.requireSftp().unlink(path, callback)
    })
  }

  async rename(from: string, to: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    await this.call<void>(ERROR_CODE.RENAME_ERROR, (callback) => {
      this.requireSftp().rename(from, to, callback)
    })
  }

  async chmod(path: string, mode: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    await this.call<void>(ERROR_CODE.INVALID_STATE, (callback) => {
      this.requireSftp().chmod(path, mode, callback)
    })
  }

  openRead(path: string, start: number, signal: AbortSignal): Promise<Readable> {
    signal.throwIfAborted()
    const stream = this.requireSftp().createReadStream(path, { start })
    signal.addEventListener('abort', () => stream.destroy(), { once: true })
    return Promise.resolve(stream)
  }

  openWrite(path: string, flags: SftpOpenFlag, signal: AbortSignal): Promise<Writable> {
    signal.throwIfAborted()
    const stream = this.requireSftp().createWriteStream(path, { flags, mode: UPLOAD_FILE_MODE })
    signal.addEventListener('abort', () => stream.destroy(), { once: true })
    return Promise.resolve(stream)
  }
}
