import type { FileInfo, ConnectionConfig, OperationResult } from '@shared/types/index.js'
import { normalizePath, joinPaths, getParentPath, sanitizePath } from '@shared/utils/index.js'
import { type ProtocolType, TIMEOUTS } from '@shared/constants/index.js'
import { logger } from '@main/utils/index.js'
import {
  type Result,
  ok,
  err,
  isErr,
  type ErrorInfo,
  createErrorInfo,
} from '@shared/types/result.js'
import type { FileProtocol, SessionInfo } from './protocol-types.js'

export type { FileProtocol, SessionInfo } from './protocol-types.js'

export abstract class AbstractProtocol<T> implements FileProtocol {
  abstract readonly protocolType: ProtocolType

  abstract connect(
    config: ConnectionConfig,
    password: string
  ): Promise<Result<OperationResult, ErrorInfo>>
  abstract disconnect(sessionId: string): Promise<Result<void, ErrorInfo>>

  protected abstract getSessionInfo(sessionId: string): SessionInfo | null
  protected abstract setSessionClosing(sessionId: string): void
  protected abstract listImpl(
    client: T,
    path: string,
    basePath: string
  ): Promise<Result<FileInfo[], ErrorInfo>>
  protected abstract mkdirImpl(
    client: T,
    path: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract renameImpl(
    client: T,
    oldPath: string,
    newPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract deleteImpl(
    client: T,
    path: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract copyImpl(
    client: T,
    sourcePath: string,
    targetPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract moveImpl(
    client: T,
    sourcePath: string,
    targetPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract pingImpl(client: T, basePath: string): Promise<Result<void, ErrorInfo>>

  protected getClient(sessionId: string): Result<T, ErrorInfo> {
    const info = this.getSessionInfo(sessionId)
    if (!info) {
      return err(createErrorInfo('SESSION_NOT_FOUND', `Session not found: ${sessionId}`))
    }

    if (info.isClosing) {
      return err(createErrorInfo('SESSION_CLOSING', `Session is closing: ${sessionId}`))
    }

    // 类型安全：info.client 由具体子类的 getSessionInfo 保证类型正确
    // 每个具体协议（SftpProtocol/WebdavProtocol）都正确实现了类型匹配
    return ok(info.client as T)
  }

  protected getBasePath(sessionId: string): string {
    const info = this.getSessionInfo(sessionId)
    return info?.basePath ?? ''
  }

  private async withAbort<T>(
    signal: AbortSignal | undefined,
    operation: () => Promise<Result<T, ErrorInfo>>,
    timeout: number,
    timeoutErrorCode: string,
    abortErrorCode: string
  ): Promise<Result<T, ErrorInfo>> {
    if (!signal) {
      return operation()
    }

    if (signal.aborted) {
      return err(createErrorInfo(abortErrorCode, 'Operation was already aborted'))
    }

    return new Promise<Result<T, ErrorInfo>>(resolve => {
      const timeoutId = setTimeout(() => {
        resolve(err(createErrorInfo(timeoutErrorCode, `Operation timed out after ${timeout}ms`)))
      }, timeout)

      const originalAbort = signal.onabort
      signal.onabort = () => {
        clearTimeout(timeoutId)
        resolve(err(createErrorInfo(abortErrorCode, 'Operation was aborted')))
      }

      operation()
        .then(result => {
          clearTimeout(timeoutId)
          signal.onabort = originalAbort
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          signal.onabort = originalAbort
          resolve(err(createErrorInfo(timeoutErrorCode, String(error))))
        })
    })
  }

  async list(
    sessionId: string,
    path: string,
    signal?: AbortSignal
  ): Promise<Result<FileInfo[], ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedPath: string
    try {
      sanitizedPath = sanitizePath(path)
    } catch (e) {
      return err(createErrorInfo('PATH_TRAVERSAL', e instanceof Error ? e.message : String(e)))
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.listImpl(clientResult.value, sanitizedPath, basePath),
      TIMEOUTS.LIST,
      'LIST_TIMEOUT',
      'LIST_ABORTED'
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'list',
        sessionId,
        path: sanitizedPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }

  async mkdir(
    sessionId: string,
    path: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedPath: string
    try {
      sanitizedPath = sanitizePath(path)
    } catch (e) {
      return err(createErrorInfo('PATH_TRAVERSAL', e instanceof Error ? e.message : String(e)))
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.mkdirImpl(clientResult.value, sanitizedPath, basePath),
      TIMEOUTS.MKDIR,
      'MKDIR_TIMEOUT',
      'MKDIR_ABORTED'
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'mkdir',
        sessionId,
        path: sanitizedPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }

  async rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedCurrentPath: string
    let sanitizedNewPath: string
    try {
      sanitizedCurrentPath = sanitizePath(file.absolutePath)
      const parentPath = getParentPath(sanitizedCurrentPath)
      sanitizedNewPath = sanitizePath(joinPaths(parentPath, newName))
    } catch (e) {
      return err(createErrorInfo('PATH_TRAVERSAL', e instanceof Error ? e.message : String(e)))
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.renameImpl(clientResult.value, sanitizedCurrentPath, sanitizedNewPath, basePath),
      TIMEOUTS.RENAME,
      'RENAME_TIMEOUT',
      'RENAME_ABORTED'
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'rename',
        sessionId,
        from: sanitizedCurrentPath,
        to: sanitizedNewPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }

  async delete(
    sessionId: string,
    file: FileInfo,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedPath: string
    try {
      sanitizedPath = sanitizePath(file.absolutePath)
    } catch (e) {
      return err(createErrorInfo('PATH_TRAVERSAL', e instanceof Error ? e.message : String(e)))
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.deleteImpl(clientResult.value, sanitizedPath, basePath),
      TIMEOUTS.DELETE,
      'DELETE_TIMEOUT',
      'DELETE_ABORTED'
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'delete',
        sessionId,
        path: sanitizedPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }

  async copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedSourcePath: string
    let sanitizedTargetPath: string
    try {
      sanitizedSourcePath = sanitizePath(file.absolutePath)
      sanitizedTargetPath = sanitizePath(targetPath)
    } catch (e) {
      return err(createErrorInfo('PATH_TRAVERSAL', e instanceof Error ? e.message : String(e)))
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.copyImpl(clientResult.value, sanitizedSourcePath, sanitizedTargetPath, basePath),
      TIMEOUTS.COPY,
      'COPY_TIMEOUT',
      'COPY_ABORTED'
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'copy',
        sessionId,
        from: sanitizedSourcePath,
        to: sanitizedTargetPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }

  async move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedSourcePath: string
    let sanitizedTargetPath: string
    try {
      sanitizedSourcePath = sanitizePath(file.absolutePath)
      sanitizedTargetPath = sanitizePath(targetPath)
    } catch (e) {
      return err(createErrorInfo('PATH_TRAVERSAL', e instanceof Error ? e.message : String(e)))
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.moveImpl(clientResult.value, sanitizedSourcePath, sanitizedTargetPath, basePath),
      TIMEOUTS.MOVE,
      'MOVE_TIMEOUT',
      'MOVE_ABORTED'
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'move',
        sessionId,
        from: sanitizedSourcePath,
        to: sanitizedTargetPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }

  async ping(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.pingImpl(clientResult.value, basePath)

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: 'ping',
        sessionId,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }
}
