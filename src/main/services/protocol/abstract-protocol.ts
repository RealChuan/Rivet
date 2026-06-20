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
    hostVerifier?: HostVerifier,
  ): Promise<Result<OperationResult, ErrorInfo>>
  abstract disconnect(sessionId: string): Promise<Result<void, ErrorInfo>>

  protected abstract getSessionInfo(sessionId: string): SessionInfo | null
  protected abstract setSessionClosing(sessionId: string): void
  protected abstract listImpl(
    client: T,
    path: string,
    basePath: string,
  ): Promise<Result<FileInfo[], ErrorInfo>>
  protected abstract mkdirImpl(
    client: T,
    path: string,
    basePath: string,
  ): Promise<Result<void, ErrorInfo>>
  protected abstract renameImpl(
    client: T,
    oldPath: string,
    newPath: string,
    basePath: string,
  ): Promise<Result<void, ErrorInfo>>
  protected abstract deleteImpl(
    client: T,
    path: string,
    basePath: string,
    fileType: string,
  ): Promise<Result<void, ErrorInfo>>
  protected abstract copyImpl(
    client: T,
    sourcePath: string,
    targetPath: string,
    basePath: string,
    fileType: string,
  ): Promise<Result<void, ErrorInfo>>
  protected abstract moveImpl(
    client: T,
    sourcePath: string,
    targetPath: string,
    basePath: string,
  ): Promise<Result<void, ErrorInfo>>
  protected abstract uploadImpl(
    client: T,
    localPath: string,
    remotePath: string,
    basePath: string,
    onProgress: (transferred: number) => void,
    signal: AbortSignal,
  ): Promise<Result<void, ErrorInfo>>
  protected abstract downloadImpl(
    client: T,
    remotePath: string,
    localPath: string,
    basePath: string,
    onProgress: (transferred: number) => void,
    signal: AbortSignal,
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

  private sanitizePathOrError(path: string): Result<string, ErrorInfo> {
    try {
      return ok(sanitizePath(path))
    } catch (e) {
      return err(
        createErrorInfo(ERROR_CODE.PATH_TRAVERSAL, e instanceof Error ? e.message : String(e)),
      )
    }
  }

  private async withAbort<R>(
    signal: AbortSignal | undefined,
    operation: () => Promise<Result<R, ErrorInfo>>,
    timeout?: number,
    timeoutErrorCode?: string,
    abortedErrorCode?: string,
  ): Promise<Result<R, ErrorInfo>> {
    if (!signal) {
      return operation()
    }

    if (signal.aborted) {
      return err(
        createErrorInfo(
          abortedErrorCode ?? ERROR_CODE.REQUEST_ABORTED,
          ERROR_MESSAGE.OPERATION_ALREADY_ABORTED,
        ),
      )
    }

    return new Promise<Result<R, ErrorInfo>>((resolve) => {
      let settled = false

      const cleanup = () => {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        signal.removeEventListener('abort', onAbort)
      }

      const timeoutId =
        timeout !== undefined
          ? setTimeout(() => {
              if (settled) return
              settled = true
              cleanup()
              resolve(
                err(
                  createErrorInfo(
                    timeoutErrorCode ?? ERROR_CODE.REQUEST_ABORTED,
                    `Operation timed out after ${timeout}ms`,
                  ),
                ),
              )
            }, timeout)
          : undefined

      const onAbort = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve(
          err(
            createErrorInfo(
              abortedErrorCode ?? ERROR_CODE.REQUEST_ABORTED,
              ERROR_MESSAGE.OPERATION_ABORTED,
            ),
          ),
        )
      }

      signal.addEventListener('abort', onAbort)

      operation()
        .then((result) => {
          if (settled) return
          settled = true
          cleanup()
          resolve(result)
        })
        .catch((error) => {
          if (settled) return
          settled = true
          cleanup()
          resolve(err(createErrorInfo(ERROR_CODE.INVALID_STATE, String(error))))
        })
    })
  }

  private async executePathOperation<R>(
    sessionId: string,
    operation: (client: T, basePath: string) => Promise<Result<R, ErrorInfo>>,
    logAction: string,
    logData: Record<string, unknown> = {},
  ): Promise<Result<R, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    const basePath = normalizePath(this.getBasePath(sessionId))

    let result: Result<R, ErrorInfo>
    try {
      result = await operation(clientResult.value, basePath)
    } catch (error) {
      logger.catch(error, { protocol: this.protocolType, action: logAction, sessionId, ...logData })
      return err(
        createErrorInfo(
          ERROR_CODE.INVALID_STATE,
          error instanceof Error ? error.message : String(error),
        ),
      )
    }

    if (isErr(result)) {
      logger.warn('Protocol operation failed', {
        protocol: this.protocolType,
        action: logAction,
        sessionId,
        ...logData,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
    } else if (logAction !== FILE_OPERATION.LIST) {
      logger.info('Protocol operation succeeded', {
        protocol: this.protocolType,
        action: logAction,
        sessionId,
        ...logData,
      })
    }

    return result
  }

  async list(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Result<FileInfo[], ErrorInfo>> {
    const pathResult = this.sanitizePathOrError(path)
    if (isErr(pathResult)) return pathResult
    const sanitizedPath = pathResult.value

    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () => this.listImpl(client, sanitizedPath, basePath),
          TIMEOUTS.LIST,
          ERROR_CODE.LIST_TIMEOUT,
          ERROR_CODE.LIST_ABORTED,
        ),
      FILE_OPERATION.LIST,
      { path: sanitizedPath },
    )
  }

  async mkdir(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    const pathResult = this.sanitizePathOrError(path)
    if (isErr(pathResult)) return pathResult
    const sanitizedPath = pathResult.value

    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () => this.mkdirImpl(client, sanitizedPath, basePath),
          TIMEOUTS.MKDIR,
          ERROR_CODE.MKDIR_TIMEOUT,
          ERROR_CODE.MKDIR_ABORTED,
        ),
      FILE_OPERATION.MKDIR,
      { path: sanitizedPath },
    )
  }

  async rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    const currentPathResult = this.sanitizePathOrError(file.absolutePath)
    if (isErr(currentPathResult)) return currentPathResult
    const sanitizedCurrentPath = currentPathResult.value

    const parentPath = getParentPath(sanitizedCurrentPath)
    const newPathResult = this.sanitizePathOrError(joinPaths(parentPath, newName))
    if (isErr(newPathResult)) return newPathResult
    const sanitizedNewPath = newPathResult.value

    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () => this.renameImpl(client, sanitizedCurrentPath, sanitizedNewPath, basePath),
          TIMEOUTS.RENAME,
          ERROR_CODE.RENAME_TIMEOUT,
          ERROR_CODE.RENAME_ABORTED,
        ),
      FILE_OPERATION.RENAME,
      { from: sanitizedCurrentPath, to: sanitizedNewPath },
    )
  }

  async delete(
    sessionId: string,
    file: FileInfo,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    const pathResult = this.sanitizePathOrError(file.absolutePath)
    if (isErr(pathResult)) return pathResult
    const sanitizedPath = pathResult.value

    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () => this.deleteImpl(client, sanitizedPath, basePath, file.type),
          TIMEOUTS.DELETE,
          ERROR_CODE.DELETE_TIMEOUT,
          ERROR_CODE.DELETE_ABORTED,
        ),
      FILE_OPERATION.DELETE,
      { path: sanitizedPath },
    )
  }

  async copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    const sourcePathResult = this.sanitizePathOrError(file.absolutePath)
    if (isErr(sourcePathResult)) return sourcePathResult
    const sanitizedSourcePath = sourcePathResult.value

    const targetPathResult = this.sanitizePathOrError(targetPath)
    if (isErr(targetPathResult)) return targetPathResult
    const sanitizedTargetPath = targetPathResult.value

    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () =>
            this.copyImpl(client, sanitizedSourcePath, sanitizedTargetPath, basePath, file.type),
          undefined,
          undefined,
          ERROR_CODE.COPY_ABORTED,
        ),
      FILE_OPERATION.COPY,
      { from: sanitizedSourcePath, to: sanitizedTargetPath },
    )
  }

  async move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    const sourcePathResult = this.sanitizePathOrError(file.absolutePath)
    if (isErr(sourcePathResult)) return sourcePathResult
    const sanitizedSourcePath = sourcePathResult.value

    const targetPathResult = this.sanitizePathOrError(targetPath)
    if (isErr(targetPathResult)) return targetPathResult
    const sanitizedTargetPath = targetPathResult.value

    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () => this.moveImpl(client, sanitizedSourcePath, sanitizedTargetPath, basePath),
          undefined,
          undefined,
          ERROR_CODE.MOVE_ABORTED,
        ),
      FILE_OPERATION.MOVE,
      { from: sanitizedSourcePath, to: sanitizedTargetPath },
    )
  }

  private async executeTransferOperation(
    sessionId: string,
    remotePath: string,
    operation: (
      client: T,
      sanitizedRemotePath: string,
      basePath: string,
      controller: AbortController,
    ) => Promise<Result<void, ErrorInfo>>,
    action: string,
    abortedErrorCode: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    const clientResult = this.getClient(sessionId)
    if (isErr(clientResult)) return clientResult

    const pathResult = this.sanitizePathOrError(remotePath)
    if (isErr(pathResult)) return pathResult
    const sanitizedRemotePath = pathResult.value

    const basePath = normalizePath(this.getBasePath(sessionId))
    const controller = new AbortController()

    const onSignalAbort = () => controller.abort()
    if (signal) {
      signal.addEventListener('abort', onSignalAbort)
    }

    try {
      const result = await this.withAbort(
        signal,
        () => operation(clientResult.value, sanitizedRemotePath, basePath, controller),
        undefined,
        undefined,
        abortedErrorCode,
      )

      if (isErr(result)) {
        controller.abort()
        logger.warn('Protocol operation failed', {
          protocol: this.protocolType,
          action,
          sessionId,
          remotePath: sanitizedRemotePath,
          errorCode: result.error.code,
          errorMessage: result.error.message,
        })
      } else {
        logger.info('Protocol operation succeeded', {
          protocol: this.protocolType,
          action,
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

  async upload(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (transferred: number) => void,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    return this.executeTransferOperation(
      sessionId,
      remotePath,
      (client, sanitizedRemotePath, basePath, controller) =>
        this.uploadImpl(
          client,
          localPath,
          sanitizedRemotePath,
          basePath,
          onProgress,
          controller.signal,
        ),
      FILE_OPERATION.UPLOAD,
      ERROR_CODE.UPLOAD_ABORTED,
      signal,
    )
  }

  async download(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress: (transferred: number) => void,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    return this.executeTransferOperation(
      sessionId,
      remotePath,
      (client, sanitizedRemotePath, basePath, controller) =>
        this.downloadImpl(
          client,
          sanitizedRemotePath,
          localPath,
          basePath,
          onProgress,
          controller.signal,
        ),
      FILE_OPERATION.DOWNLOAD,
      ERROR_CODE.DOWNLOAD_ABORTED,
      signal,
    )
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
