import { FileInfo, ConnectionConfig } from '../../shared/types.js'
import { normalizePath, joinPaths } from '../../shared/utils.js'
import logger from '../utils/logger.js'

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

export abstract class BaseProtocolImpl<T = any> implements FileProtocol {
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
      logger.error(`${prefix} ${operation} failed: ${source} -> ${target} - ${error}`)
    } else {
      logger.info(`${prefix} ${operation}: ${source} -> ${target}`)
    }
  }

  protected logCancelled(operation: string, path: string): void {
    logger.info(`${this.protocolName.toUpperCase()} ${operation} cancelled: ${path}`)
  }

  async connect(config: ConnectionConfig): Promise<string> {
    throw new Error('Not implemented')
  }

  async disconnect(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async list(sessionId: string, path: string): Promise<FileInfo[]> {
    throw new Error('Not implemented')
  }

  async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  async downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async delete(sessionId: string, files: FileInfo[]): Promise<void> {
    throw new Error('Not implemented')
  }

  async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    throw new Error('Not implemented')
  }
}

export interface SessionHandle<T = any> {
  client: T
  config: ConnectionConfig
}

export default FileProtocol
