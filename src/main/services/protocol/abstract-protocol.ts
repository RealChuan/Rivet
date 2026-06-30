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
import type { FileProtocol, HostVerifier } from './protocol-types.js'

/**
 * 会话信息：泛型 T 为 client 的具体类型，由具体协议子类约束。
 * 默认 unknown 与 protocol-types.ts 中原始定义保持结构兼容。
 */
export interface SessionInfo<T = unknown> {
  client: T
  basePath: string
  isClosing: boolean
}

export abstract class AbstractProtocol<T> implements FileProtocol {
  abstract readonly protocolType: ProtocolType

  abstract connect(
    config: ConnectionConfig,
    password: string,
    hostVerifier?: HostVerifier,
  ): Promise<Result<OperationResult, ErrorInfo>>
  abstract disconnect(sessionId: string): Promise<Result<void, ErrorInfo>>

  protected abstract getSessionInfo(sessionId: string): SessionInfo<T> | null
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

    return ok(info.client)
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

  /**
   * 路径操作通用执行器：包裹 executePathOperation + withAbort。
   * 调用方在 impl 闭包中绑定已清理的路径与具体 *Impl 方法。
   */
  private async runPathOp<R>(
    sessionId: string,
    impl: (client: T, basePath: string) => Promise<Result<R, ErrorInfo>>,
    logAction: string,
    logData: Record<string, unknown>,
    signal: AbortSignal | undefined,
    timeout: number | undefined,
    timeoutErrorCode: string | undefined,
    abortedErrorCode: string,
  ): Promise<Result<R, ErrorInfo>> {
    return this.executePathOperation(
      sessionId,
      (client, basePath) =>
        this.withAbort(
          signal,
          () => impl(client, basePath),
          timeout,
          timeoutErrorCode,
          abortedErrorCode,
        ),
      logAction,
      logData,
    )
  }

  /**
   * 单路径操作快捷方法：清理单个路径后委托 runPathOp，logData 形如 { path }。
   */
  private async runSinglePathOp<R>(
    sessionId: string,
    path: string,
    impl: (client: T, basePath: string, sanitizedPath: string) => Promise<Result<R, ErrorInfo>>,
    logAction: string,
    signal: AbortSignal | undefined,
    timeout: number | undefined,
    timeoutErrorCode: string | undefined,
    abortedErrorCode: string,
  ): Promise<Result<R, ErrorInfo>> {
    const sanitized = this.sanitizePathOrError(path)
    if (isErr(sanitized)) return sanitized
    return this.runPathOp(
      sessionId,
      (client, basePath) => impl(client, basePath, sanitized.value),
      logAction,
      { path: sanitized.value },
      signal,
      timeout,
      timeoutErrorCode,
      abortedErrorCode,
    )
  }

  /**
   * 双路径操作快捷方法：依次清理两个独立路径后委托 runPathOp，logData 形如 { from, to }。
   */
  private async runDualPathOp<R>(
    sessionId: string,
    sourcePath: string,
    targetPath: string,
    impl: (
      client: T,
      basePath: string,
      sanitizedSource: string,
      sanitizedTarget: string,
    ) => Promise<Result<R, ErrorInfo>>,
    logAction: string,
    signal: AbortSignal | undefined,
    timeout: number | undefined,
    timeoutErrorCode: string | undefined,
    abortedErrorCode: string,
  ): Promise<Result<R, ErrorInfo>> {
    const sourceResult = this.sanitizePathOrError(sourcePath)
    if (isErr(sourceResult)) return sourceResult
    const targetResult = this.sanitizePathOrError(targetPath)
    if (isErr(targetResult)) return targetResult
    return this.runPathOp(
      sessionId,
      (client, basePath) => impl(client, basePath, sourceResult.value, targetResult.value),
      logAction,
      { from: sourceResult.value, to: targetResult.value },
      signal,
      timeout,
      timeoutErrorCode,
      abortedErrorCode,
    )
  }

  async list(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Result<FileInfo[], ErrorInfo>> {
    return this.runSinglePathOp(
      sessionId,
      path,
      (client, basePath, sanitizedPath) => this.listImpl(client, sanitizedPath, basePath),
      FILE_OPERATION.LIST,
      signal,
      TIMEOUTS.LIST,
      ERROR_CODE.LIST_TIMEOUT,
      ERROR_CODE.LIST_ABORTED,
    )
  }

  async mkdir(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    return this.runSinglePathOp(
      sessionId,
      path,
      (client, basePath, sanitizedPath) => this.mkdirImpl(client, sanitizedPath, basePath),
      FILE_OPERATION.MKDIR,
      signal,
      TIMEOUTS.MKDIR,
      ERROR_CODE.MKDIR_TIMEOUT,
      ERROR_CODE.MKDIR_ABORTED,
    )
  }

  async rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    // getParentPath 过滤空段、joinPaths 经 normalizePath，故从原路径计算新路径等价于从 sanitized 路径计算
    const newPath = joinPaths(getParentPath(file.absolutePath), newName)
    return this.runDualPathOp(
      sessionId,
      file.absolutePath,
      newPath,
      (client, basePath, sanitizedCurrent, sanitizedNew) =>
        this.renameImpl(client, sanitizedCurrent, sanitizedNew, basePath),
      FILE_OPERATION.RENAME,
      signal,
      TIMEOUTS.RENAME,
      ERROR_CODE.RENAME_TIMEOUT,
      ERROR_CODE.RENAME_ABORTED,
    )
  }

  async delete(
    sessionId: string,
    file: FileInfo,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    return this.runSinglePathOp(
      sessionId,
      file.absolutePath,
      (client, basePath, sanitizedPath) =>
        this.deleteImpl(client, sanitizedPath, basePath, file.type),
      FILE_OPERATION.DELETE,
      signal,
      TIMEOUTS.DELETE,
      ERROR_CODE.DELETE_TIMEOUT,
      ERROR_CODE.DELETE_ABORTED,
    )
  }

  async copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    return this.runDualPathOp(
      sessionId,
      file.absolutePath,
      targetPath,
      (client, basePath, sanitizedSource, sanitizedTarget) =>
        this.copyImpl(client, sanitizedSource, sanitizedTarget, basePath, file.type),
      FILE_OPERATION.COPY,
      signal,
      undefined,
      undefined,
      ERROR_CODE.COPY_ABORTED,
    )
  }

  async move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    signal?: AbortSignal,
  ): Promise<Result<void, ErrorInfo>> {
    return this.runDualPathOp(
      sessionId,
      file.absolutePath,
      targetPath,
      (client, basePath, sanitizedSource, sanitizedTarget) =>
        this.moveImpl(client, sanitizedSource, sanitizedTarget, basePath),
      FILE_OPERATION.MOVE,
      signal,
      undefined,
      undefined,
      ERROR_CODE.MOVE_ABORTED,
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
