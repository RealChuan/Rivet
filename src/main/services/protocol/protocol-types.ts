import type { FileInfo, ConnectionConfig, OperationResult } from '@shared/types/index.js'
import type { ProtocolType } from '@shared/constants/index.js'
import type { Result, ErrorInfo } from '@shared/types/result.js'

export interface SessionInfo {
  client: unknown
  basePath: string
  isClosing: boolean
}

export interface FileProtocol {
  readonly protocolType: ProtocolType
  connect(config: ConnectionConfig, password: string): Promise<Result<OperationResult, ErrorInfo>>
  disconnect(sessionId: string): Promise<Result<void, ErrorInfo>>
  list(
    sessionId: string,
    path: string,
    signal?: AbortSignal
  ): Promise<Result<FileInfo[], ErrorInfo>>
  mkdir(sessionId: string, path: string, signal?: AbortSignal): Promise<Result<void, ErrorInfo>>
  rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>>
  delete(sessionId: string, file: FileInfo, signal?: AbortSignal): Promise<Result<void, ErrorInfo>>
  copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>>
  move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>>
  ping(sessionId: string): Promise<Result<void, ErrorInfo>>
}
