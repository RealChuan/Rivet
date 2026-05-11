import { type FileInfo, type ConnectionConfig } from '@shared/types/index.js'
import { normalizePath, joinPaths } from '@shared/utils/index.js'
import logger from '../../utils/logger.js'

export interface FileProtocol {
  connect(config: ConnectionConfig): Promise<string>
  disconnect(sessionId: string): Promise<void>
  list(sessionId: string, path: string): Promise<FileInfo[]>
  uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  mkdir(sessionId: string, path: string): Promise<void>
  rename(sessionId: string, file: FileInfo, newName: string): Promise<void>
  delete(sessionId: string, files: FileInfo[]): Promise<void>
  copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
  move(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
}

export abstract class BaseProtocolImpl<T> implements FileProtocol {
  protected sessions: Map<string, SessionHandle<T>> = new Map()
  protected abstract protocolName: string

  protected getSessionHandle(sessionId: string): SessionHandle<T> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    return handle
  }

  protected calculateProgress(transferred: number, totalSize: number): number {
    if (totalSize <= 0) return 100
    return Math.min(Math.round((transferred / totalSize) * 100), 100)
  }

  protected joinPaths = joinPaths
  protected normalizePath = normalizePath

  protected setupAbortHandler(signal?: AbortSignal): { aborted: boolean } {
    const state = { aborted: false }
    if (signal) {
      signal.addEventListener('abort', () => {
        state.aborted = true
      })
    }
    return state
  }

  protected logOperation(operation: string, source: string, target: string, error?: unknown): void {
    const prefix = `${this.protocolName.toUpperCase()}`
    if (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error)
      logger.error(`${prefix} ${operation} failed: ${source} -> ${target} - ${errorMsg}`)
    } else {
      logger.info(`${prefix} ${operation}: ${source} -> ${target}`)
    }
  }

  protected logCancelled(operation: string, path: string): void {
    logger.info(`${this.protocolName.toUpperCase()} ${operation} cancelled: ${path}`)
  }

  connect(_config: ConnectionConfig): Promise<string> {
    return Promise.reject(new Error('Not implemented'))
  }

  disconnect(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
    return Promise.resolve()
  }

  list(_sessionId: string, _path: string): Promise<FileInfo[]> {
    return Promise.reject(new Error('Not implemented'))
  }

  uploadFile(
    _sessionId: string,
    _localPath: string,
    _remotePath: string,
    _onProgress: (percent: number) => void,
    _signal?: AbortSignal
  ): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  downloadFile(
    _sessionId: string,
    _file: FileInfo,
    _localPath: string,
    _onProgress: (percent: number) => void,
    _signal?: AbortSignal
  ): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  mkdir(_sessionId: string, _path: string): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  rename(_sessionId: string, _file: FileInfo, _newName: string): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  delete(_sessionId: string, _files: FileInfo[]): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  copy(_sessionId: string, _file: FileInfo, _targetPath: string): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  move(_sessionId: string, _file: FileInfo, _targetPath: string): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }
}

export interface SessionHandle<T> {
  client: T
  config: ConnectionConfig
}

export default FileProtocol
