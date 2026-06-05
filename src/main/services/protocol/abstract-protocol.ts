import { logger } from '@main/utils/index.js'
import {
  ERROR_CODE,
  ERROR_MESSAGE,
  FILE_OPERATION,
  type ProtocolType,
  TIMEOUTS,
} from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  createErrorInfo,
  err,
  type ErrorInfo,
  type FileInfo,
  isErr,
  ok,
  type OperationResult,
  type Result,
} from '@shared/types/index.js'
import { getParentPath, joinPaths, normalizePath, sanitizePath } from '@shared/utils/index.js'
import type { FileProtocol, HostVerifier, SessionInfo } from './protocol-types.js'

export type { FileProtocol, HostVerifier, SessionInfo } from './protocol-types.js'

export abstract class AbstractProtocol<T> implements FileProtocol {
  abstract readonly protocolType: ProtocolType

  abstract connect(
    config: ConnectionConfig,
    password: string,
    hostVerifier?: HostVerifier
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
    basePath: string,
    fileType: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract copyImpl(
    client: T,
    sourcePath: string,
    targetPath: string,
    basePath: string,
    fileType: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract moveImpl(
    client: T,
    sourcePath: string,
    targetPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>>
  protected abstract uploadImpl(
    client: T,
    localPath: string,
    remotePath: string,
    basePath: string,
    onProgress: (transferred: number) => void,
    signal: AbortSignal
  ): Promise<Result<void, ErrorInfo>>
  protected abstract pingImpl(client: T, basePath: string): Promise<Result<void, ErrorInfo>>

  protected getClient(sessionId: string): Result<T, ErrorInfo> {
    const info = this.getSessionInfo(sessionId)
    if (!info) {
      return err(createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Session not found: ${sessionId}`))
    }

    if (info.isClosing) {
      return err(createErrorInfo(ERROR_CODE.SESSION_CLOSING, `Session is closing: ${sessionId}`))
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
      return err(createErrorInfo(abortErrorCode, ERROR_MESSAGE.OPERATION_ALREADY_ABORTED))
    }

    return new Promise<Result<T, ErrorInfo>>(resolve => {
      let settled = false

      const cleanup = () => {
        clearTimeout(timeoutId)
        signal.removeEventListener('abort', onAbort)
      }

      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        resolve(err(createErrorInfo(timeoutErrorCode, `Operation timed out after ${timeout}ms`)))
      }, timeout)

      const onAbort = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve(err(createErrorInfo(abortErrorCode, ERROR_MESSAGE.OPERATION_ABORTED)))
      }

      signal.addEventListener('abort', onAbort)

      operation()
        .then(result => {
          if (settled) return
          settled = true
          cleanup()
          resolve(result)
        })
        .catch(error => {
          if (settled) return
          settled = true
          cleanup()
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
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.listImpl(clientResult.value, sanitizedPath, basePath),
      TIMEOUTS.LIST,
      ERROR_CODE.LIST_TIMEOUT,
      ERROR_CODE.LIST_ABORTED
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.LIST,
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
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.mkdirImpl(clientResult.value, sanitizedPath, basePath),
      TIMEOUTS.MKDIR,
      ERROR_CODE.MKDIR_TIMEOUT,
      ERROR_CODE.MKDIR_ABORTED
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.MKDIR,
        sessionId,
        path: sanitizedPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    } else {
      logger.info('Protocol operation succeeded', {
        protocol: this.protocolType,
        action: FILE_OPERATION.MKDIR,
        sessionId,
        path: sanitizedPath,
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
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.renameImpl(clientResult.value, sanitizedCurrentPath, sanitizedNewPath, basePath),
      TIMEOUTS.RENAME,
      ERROR_CODE.RENAME_TIMEOUT,
      ERROR_CODE.RENAME_ABORTED
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.RENAME,
        sessionId,
        from: sanitizedCurrentPath,
        to: sanitizedNewPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    } else {
      logger.info('Protocol operation succeeded', {
        protocol: this.protocolType,
        action: FILE_OPERATION.RENAME,
        sessionId,
        from: sanitizedCurrentPath,
        to: sanitizedNewPath,
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
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.deleteImpl(clientResult.value, sanitizedPath, basePath, file.type),
      TIMEOUTS.DELETE,
      ERROR_CODE.DELETE_TIMEOUT,
      ERROR_CODE.DELETE_ABORTED
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.DELETE,
        sessionId,
        path: sanitizedPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    } else {
      logger.info('Protocol operation succeeded', {
        protocol: this.protocolType,
        action: FILE_OPERATION.DELETE,
        sessionId,
        path: sanitizedPath,
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
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () =>
        this.copyImpl(
          clientResult.value,
          sanitizedSourcePath,
          sanitizedTargetPath,
          basePath,
          file.type
        ),
      TIMEOUTS.COPY,
      ERROR_CODE.COPY_TIMEOUT,
      ERROR_CODE.COPY_ABORTED
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.COPY,
        sessionId,
        from: sanitizedSourcePath,
        to: sanitizedTargetPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    } else {
      logger.info('Protocol operation succeeded', {
        protocol: this.protocolType,
        action: FILE_OPERATION.COPY,
        sessionId,
        from: sanitizedSourcePath,
        to: sanitizedTargetPath,
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
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.withAbort(
      signal,
      () => this.moveImpl(clientResult.value, sanitizedSourcePath, sanitizedTargetPath, basePath),
      TIMEOUTS.MOVE,
      ERROR_CODE.MOVE_TIMEOUT,
      ERROR_CODE.MOVE_ABORTED
    )

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.MOVE,
        sessionId,
        from: sanitizedSourcePath,
        to: sanitizedTargetPath,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    } else {
      logger.info('Protocol operation succeeded', {
        protocol: this.protocolType,
        action: FILE_OPERATION.MOVE,
        sessionId,
        from: sanitizedSourcePath,
        to: sanitizedTargetPath,
      })
    }

    return result
  }

  async upload(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (transferred: number) => void,
    signal?: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    let sanitizedRemotePath: string
    try {
      sanitizedRemotePath = sanitizePath(remotePath)
    } catch (e) {
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e))
      )
    }
    const basePath = normalizePath(this.getBasePath(sessionId))
    const controller = new AbortController()

    const onSignalAbort = () => controller.abort()
    if (signal) {
      signal.addEventListener('abort', onSignalAbort)
    }

    try {
      const result = await this.withAbort(
        signal,
        () =>
          this.uploadImpl(
            clientResult.value,
            localPath,
            sanitizedRemotePath,
            basePath,
            onProgress,
            controller.signal
          ),
        TIMEOUTS.UPLOAD,
        ERROR_CODE.UPLOAD_TIMEOUT,
        ERROR_CODE.UPLOAD_ABORTED
      )

      if (isErr(result)) {
        controller.abort()
        logger.warn('Protocol operation failed', {
          protocol: this.protocolType,
          action: FILE_OPERATION.UPLOAD,
          sessionId,
          remotePath: sanitizedRemotePath,
          errorCode: result.error.code,
          errorMessage: result.error.message,
        })
      } else {
        logger.info('Protocol operation succeeded', {
          protocol: this.protocolType,
          action: FILE_OPERATION.UPLOAD,
          sessionId,
          remotePath: sanitizedRemotePath,
        })
      }

      return result
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onSignalAbort)
      }
    }
  }

  async ping(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    const basePath = normalizePath(this.getBasePath(sessionId))

    const result = await this.pingImpl(clientResult.value, basePath)

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: FILE_OPERATION.PING,
        sessionId,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    }

    return result
  }
}
