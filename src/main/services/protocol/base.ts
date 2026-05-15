import { type FileInfo, type ConnectionConfig, type OperationResult } from '@shared/types/index.js'
import type { ProtocolType } from '@shared/constants/index.js'
import { normalizePath, joinPaths, getParentPath, toErrorMessage } from '@shared/utils/index.js'
import logger from '../../utils/logger.js'
import { sessionManager } from '../session-manager.js'

export interface FileProtocol {
  readonly protocolType: ProtocolType
  connect(config: ConnectionConfig): Promise<OperationResult>
  disconnect(sessionId: string): Promise<void>
  list(sessionId: string, path: string): Promise<FileInfo[]>
  mkdir(sessionId: string, path: string): Promise<void>
  rename(sessionId: string, file: FileInfo, newName: string): Promise<void>
  delete(sessionId: string, file: FileInfo): Promise<void>
  copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
  move(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
  ping(sessionId: string): Promise<void>
}

export interface SessionHandle<T = unknown> {
  client: T
  config: ConnectionConfig
}

export abstract class BaseProtocolImpl<T> {
  abstract readonly protocolType: ProtocolType

  protected getClient(sessionId: string): T {
    const handle = sessionManager.get<T>(sessionId)
    if (!handle) {
      throw new Error(`Invalid ${this.protocolType} session: ${sessionId}`)
    }
    return handle.client
  }

  protected getSessionConfig(sessionId: string): ConnectionConfig | undefined {
    return sessionManager.get(sessionId)?.config
  }

  protected calculateProgress(transferred: number, totalSize: number): number {
    if (totalSize <= 0) return 100
    return Math.min(Math.round((transferred / totalSize) * 100), 100)
  }

  protected joinPaths = joinPaths
  protected normalizePath = normalizePath
  protected getParentPath = getParentPath

  protected setupAbortHandler(signal?: AbortSignal): {
    getAborted: () => boolean
    cleanup: () => void
  } {
    let aborted = false
    const handler = () => {
      aborted = true
    }
    signal?.addEventListener('abort', handler)

    return {
      getAborted: () => aborted,
      cleanup: () => signal?.removeEventListener('abort', handler),
    }
  }

  protected logOperation(operation: string, source: string, target: string, error?: unknown): void {
    const prefix = this.protocolType.toUpperCase()
    if (error) {
      const errorMsg = toErrorMessage(error)
      logger.error(`${prefix} ${operation} failed: ${source} -> ${target} - ${errorMsg}`)
    } else {
      logger.info(`${prefix} ${operation}: ${source} -> ${target}`)
    }
  }

  protected logCancelled(operation: string, path: string): void {
    logger.info(`${this.protocolType.toUpperCase()} ${operation} cancelled: ${path}`)
  }
}

export default FileProtocol
