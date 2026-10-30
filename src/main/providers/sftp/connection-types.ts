import type { Readable, Writable } from 'node:stream'
import type { Credentials } from '@shared/domain/credentials.js'
import type { EntryKind } from '@shared/domain/entry.js'

export interface RawSftpEntry {
  name: string
  kind: EntryKind
  size: number
  mtime: number
  permissions?: string
  owner?: string
}

export interface SftpConnectOptions {
  signal?: AbortSignal
  hostVerifier?: (publicKey: Buffer) => boolean
}

/** SFTP 打开模式：`w` 覆盖创建，`wx` 只在目标不存在时创建。 */
export const SFTP_OPEN_FLAG = {
  WRITE: 'w',
  EXCLUSIVE: 'wx',
} as const

export type SftpOpenFlag = (typeof SFTP_OPEN_FLAG)[keyof typeof SFTP_OPEN_FLAG]

/**
 * ssh2 调用面收窄到这里。provider 只依赖这个端口，测试用 fake 实现。
 */
export interface SftpConnection {
  connect(credentials: Credentials, opts?: SftpConnectOptions): Promise<void>
  disconnect(): Promise<void>
  ping(signal?: AbortSignal): Promise<void>

  list(path: string, signal?: AbortSignal): Promise<RawSftpEntry[]>
  stat(path: string, signal?: AbortSignal): Promise<RawSftpEntry>
  mkdir(path: string, signal?: AbortSignal): Promise<void>
  rmdir(path: string, signal?: AbortSignal): Promise<void>
  unlink(path: string, signal?: AbortSignal): Promise<void>
  rename(from: string, to: string, signal?: AbortSignal): Promise<void>
  chmod(path: string, mode: number, signal?: AbortSignal): Promise<void>

  openRead(path: string, start: number, signal: AbortSignal): Promise<Readable>
  openWrite(path: string, flags: SftpOpenFlag, signal: AbortSignal): Promise<Writable>
}
