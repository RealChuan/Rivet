import type { Readable, Writable } from 'node:stream'
import { createRequire } from 'node:module'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'
import {
  listDirectory,
  type SmbRawDirEntry,
  type SmbReaddirPorts,
  type SmbRequestError,
} from './readdir.js'

interface Smb2Options {
  share: string
  username: string
  domain: string
  password: string
  port?: number
  packetConcurrency?: number
  autoCloseTimeout?: number
}

interface Smb2Instance {
  disconnect(): void
  stat(path: string): Promise<SmbStatLike>
  mkdir(path: string): Promise<void>
  rmdir(path: string): Promise<void>
  unlink(path: string): Promise<void>
  rename(from: string, to: string, options: { replace: boolean }): Promise<void>
  createReadStream(path: string, options?: { start?: number }): Promise<Readable>
  createWriteStream(path: string, options?: { flags?: string }): Promise<Writable>
}

interface Smb2Constructor {
  new (options: Smb2Options): Smb2Instance
}

interface Smb2CreateRequest {
  DesiredAccess?: number
}

interface Smb2CreateMessage {
  request: Smb2CreateRequest
}

interface Smb2CreateMessageModule {
  generate: (connection: object, params: object) => Smb2CreateMessage
}

/** FILE_DELETE_CHILD 只对目录有意义；v9u-smb2 却把它加进每次 CREATE 的 DesiredAccess。 */
const FILE_DELETE_CHILD = 0x00000040
/** 两个模块各自固定了 DesiredAccess，都需要剔除该位。 */
const CREATE_MESSAGE_MODULES = [
  'v9u-smb2/lib/messages/create.js',
  'v9u-smb2/lib/messages/open_folder.js',
]

let createAccessMaskPatched = false

function loadMessageModule(id: string): Smb2CreateMessageModule {
  const require = createRequire(import.meta.url) as (id: string) => Smb2CreateMessageModule
  return require(id)
}

/**
 * Samba 在打开既有文件时若 DesiredAccess 含 FILE_DELETE_CHILD，会直接返回
 * STATUS_ACCESS_DENIED（新建文件不受影响），于是 stat/读取/删除/重命名全部失败。
 * CREATE 消息在发送前才序列化，这里在生成阶段把该位去掉。
 */
function stripDeleteChildAccess(module: Smb2CreateMessageModule): void {
  const generate = module.generate
  module.generate = (connection, params) => {
    const message = generate(connection, params)
    const access = message.request.DesiredAccess
    if (typeof access === 'number' && (access & FILE_DELETE_CHILD) !== 0) {
      message.request.DesiredAccess = access & ~FILE_DELETE_CHILD
    }
    return message
  }
}

function patchCreateAccessMask(): void {
  if (createAccessMaskPatched) return
  createAccessMaskPatched = true
  for (const id of CREATE_MESSAGE_MODULES) {
    stripDeleteChildAccess(loadMessageModule(id))
  }
}

/** v9u-smb2 是 CommonJS 包，且声明文件不足以在 NodeNext 下直接 default import。 */
function loadSmb2(): Smb2Constructor {
  patchCreateAccessMask()
  const require = createRequire(import.meta.url) as (id: string) => Smb2Constructor
  return require('v9u-smb2')
}

interface SmbRequestTool {
  request(
    name: string,
    params: object,
    connection: object,
    callback: (error: SmbRequestError | null, result?: unknown) => void,
  ): void
}

interface SmbAutoPromise {
  <A extends unknown[], R>(
    method: (...args: [...A, (error: SmbRequestError | null, result?: R) => void]) => void,
  ): (...args: A) => Promise<R>
}

interface SmbRequireConnect {
  <A extends unknown[], R>(
    method: (...args: [...A, (error: SmbRequestError | null, result?: R) => void]) => void,
  ): (this: object, ...args: A) => void
}

interface SmbStatsTool {
  (file: SmbRawDirEntry): SmbStatLike
}

function loadTool<T>(id: string): T {
  const require = createRequire(import.meta.url) as (moduleId: string) => T
  return require(id)
}

interface SmbDirectoryLister {
  list(connection: object, path: string): Promise<SmbDirEntryLike[]>
}

let directoryLister: SmbDirectoryLister | null = null

/** 用上游的消息层自己列目录（原因见 readdir.ts），连接与错误回传沿用它的包装。 */
function loadDirectoryLister(): SmbDirectoryLister {
  if (directoryLister !== null) return directoryLister

  const forge = loadTool<SmbRequestTool>('v9u-smb2/lib/tools/smb2-forge.js')
  const stats = loadTool<SmbStatsTool>('v9u-smb2/lib/tools/stats.js')
  const autoPromise = loadTool<SmbAutoPromise>('v9u-smb2/lib/tools/auto-promise.js')
  const { requireConnect } = loadTool<{ requireConnect: SmbRequireConnect }>(
    'v9u-smb2/lib/tools/smb2-connection.js',
  )

  const ports: SmbReaddirPorts = {
    request: (name, params, connection, callback) => {
      forge.request(name, params, connection, callback)
    },
    stats,
  }

  function readdir(
    this: object,
    path: string,
    callback: (error: SmbRequestError | null, result?: SmbDirEntryLike[]) => void,
  ): void {
    void listDirectory(ports, this, path).then(
      (entries) => callback(null, entries),
      (error: unknown) => {
        callback(error instanceof Error ? error : new Error(String(error)))
      },
    )
  }

  const withConnection = autoPromise<[string], SmbDirEntryLike[]>(
    requireConnect<[string], SmbDirEntryLike[]>(readdir),
  )

  const lister: SmbDirectoryLister = {
    list: (connection, path) => withConnection.call(connection, path),
  }
  directoryLister = lister
  return lister
}

/** v9u-smb2 的 stats 运行时包含 size，但类型声明没有，这里补上可选字段。 */
export interface SmbStatLike {
  readonly birthtime: Date
  readonly atime: Date
  readonly mtime: Date
  readonly ctime: Date
  readonly size?: number
  isDirectory(): boolean
}

export interface SmbDirEntryLike extends SmbStatLike {
  readonly name: string
}

export interface SmbClientPort {
  disconnect(): void
  stat(path: string): Promise<SmbStatLike>
  readdir(path: string, options: { stats: true }): Promise<SmbDirEntryLike[]>
  mkdir(path: string): Promise<void>
  rmdir(path: string): Promise<void>
  unlink(path: string): Promise<void>
  rename(from: string, to: string, options: { replace: boolean }): Promise<void>
  createReadStream(path: string, options?: { start?: number }): Promise<Readable>
  createWriteStream(path: string, options?: { flags?: string }): Promise<Writable>
}

/** v9u 的 share 选项要求完整 UNC 路径，而不是单独的共享名。 */
export function toUncShare(config: ConnectionConfig): string {
  if (!config.share) {
    throw new ProviderError(ERROR_CODE.INVALID_CONFIG, 'SMB share is required')
  }
  return `\\\\${config.host}\\${config.share}`
}

export function createV9uSmbClient(
  config: ConnectionConfig,
  credentials: Credentials,
): SmbClientPort {
  if (credentials.kind !== 'password') {
    throw new ProviderError(ERROR_CODE.INVALID_CONFIG, 'SMB only supports password authentication')
  }

  const SMB2 = loadSmb2()
  const client = new SMB2({
    share: toUncShare(config),
    username: credentials.username,
    domain: config.domain ?? '',
    password: credentials.password,
    port: config.port,
    autoCloseTimeout: 0,
  })

  const lister = loadDirectoryLister()

  return {
    disconnect: () => client.disconnect(),
    stat: (path) => client.stat(path),
    readdir: (path, _options) => lister.list(client, path),
    mkdir: (path) => client.mkdir(path),
    rmdir: (path) => client.rmdir(path),
    unlink: (path) => client.unlink(path),
    rename: (from, to, options) => client.rename(from, to, options),
    createReadStream: (path, options) => client.createReadStream(path, options ?? {}),
    createWriteStream: (path, options) => client.createWriteStream(path, options ?? {}),
  }
}
