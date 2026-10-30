import type { Credentials } from '@shared/domain/credentials.js'
import type { Capabilities, Entry, ProviderKind } from '@shared/domain/entry.js'

export interface ReadHandle {
  readonly stream: ReadableStream<Uint8Array>
  close(): Promise<void>
}

export interface WriteHandle {
  readonly stream: WritableStream<Uint8Array>
  /** 数据落盘且服务端确认后调用；有 atomicRename 能力时在此 rename 临时文件。 */
  commit(): Promise<void>
  /** 失败/取消时调用；负责删除远端临时文件，不抛错。 */
  abort(): Promise<void>
}

export interface FileProvider {
  readonly kind: ProviderKind
  readonly capabilities: Capabilities

  connect(credentials: Credentials, signal?: AbortSignal): Promise<void>
  disconnect(): Promise<void>
  ping(signal?: AbortSignal): Promise<void>

  list(path: string, opts: { signal: AbortSignal }): AsyncIterable<Entry>
  stat(path: string, signal?: AbortSignal): Promise<Entry>

  mkdir(path: string, opts: { recursive: boolean; signal?: AbortSignal }): Promise<void>
  remove(path: string, signal?: AbortSignal): Promise<void>
  rename(from: string, to: string, signal?: AbortSignal): Promise<void>
  copy?(from: string, to: string, signal?: AbortSignal): Promise<void>
  chmod?(path: string, mode: number, signal?: AbortSignal): Promise<void>

  openRead(path: string, opts: { start?: number; signal?: AbortSignal }): Promise<ReadHandle>
  openWrite(path: string, opts: { overwrite: boolean; signal?: AbortSignal }): Promise<WriteHandle>
}
