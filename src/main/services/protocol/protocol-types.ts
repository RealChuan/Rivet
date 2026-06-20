import type { ProtocolType, StatusCode } from '@shared/constants/index.js'
import type {
  ConnectionConfig,
  ErrorInfo,
  FileInfo,
  OperationResult,
  Result,
  SftpConnectDetail,
} from '@shared/types/index.js'

export interface SessionInfo {
  client: unknown
  basePath: string
  isClosing: boolean
}

export interface HostVerifierResult {
  detail: SftpConnectDetail | null
  status: StatusCode | null
}

export type HostVerifier = (hashedKey: string) => HostVerifierResult

export interface FileProtocol {
  readonly protocolType: ProtocolType
  connect(
    config: ConnectionConfig,
    password: string,
    hostVerifier?: HostVerifier,
  ): Promise<Result<OperationResult, ErrorInfo>>
  disconnect(sessionId: string): Promise<Result<void, ErrorInfo>>
  list(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Result<FileInfo[], ErrorInfo>>
  mkdir(sessionId: string, path: string, signal?: AbortSignal): Promise<Result<void, ErrorInfo>>
  rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>>
  delete(sessionId: string, file: FileInfo, signal?: AbortSignal): Promise<Result<void, ErrorInfo>>
  copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>>
  move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>>
  upload(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (transferred: number) => void,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>>
  download(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress: (transferred: number) => void,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>>
  ping(sessionId: string): Promise<Result<void, ErrorInfo>>
}
