import crypto from 'node:crypto'
import {
  ERROR_CODE,
  PROTOCOL,
  ProtocolStatus,
  type ProtocolType,
  SftpStatus,
  TIMEOUTS,
} from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  createErrorInfo,
  err,
  type ErrorInfo,
  type FileInfo,
  isErr,
  isOk,
  ok,
  type OperationResult,
  type ProtocolResponse,
  type Result,
} from '@shared/types/index.js'
import { getHostKeyRecord } from '../../stores/index.js'
import { decryptPassword, logger } from '../../utils/index.js'
import { sessionRegistry } from '../session-registry.js'
import { transferService } from '../transfer/index.js'
import { type FileProtocol, type HostVerifierResult } from './protocol-types.js'
import { SftpProtocol } from './SftpProtocol.js'
import { WebdavProtocol } from './WebdavProtocol.js'

interface ActiveRequestInfo {
  controller: AbortController
  sessionId: string
}

export class ProtocolService {
  private protocols = new Map<ProtocolType, FileProtocol>()
  private activeRequests = new Map<string, ActiveRequestInfo>()

  cancel(requestId: string): void {
    const info = this.activeRequests.get(requestId)
    if (info) {
      info.controller.abort()
      this.activeRequests.delete(requestId)
    }
  }

  private getProtocol(protocol: ProtocolType): Result<FileProtocol, ErrorInfo> {
    if (!this.protocols.has(protocol)) {
      const instance = protocol === PROTOCOL.SFTP ? new SftpProtocol() : new WebdavProtocol()
      this.protocols.set(protocol, instance)
    }

    const instance = this.protocols.get(protocol)
    if (!instance) {
      return err(
        createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Protocol not initialized: ${protocol}`)
      )
    }

    return ok(instance)
  }

  private getProtocolBySessionId(sessionId: string): Result<FileProtocol, ErrorInfo> {
    const handle = sessionRegistry.get(sessionId)
    if (!handle) {
      return err(createErrorInfo(ERROR_CODE.CONN_NOT_FOUND, `Connection not found: ${sessionId}`))
    }
    return this.getProtocol(handle.protocolType)
  }

  private executeWithRequest<T>(
    sessionId: string,
    timeout: number | undefined,
    operation: (signal: AbortSignal) => Promise<Result<T, ErrorInfo>>,
    providedRequestId?: string
  ): Promise<ProtocolResponse<T>> {
    const requestId = providedRequestId ?? crypto.randomUUID()
    const controller = new AbortController()
    const signal = controller.signal

    const timeoutId =
      timeout !== undefined ? setTimeout(() => controller.abort(), timeout) : undefined

    this.activeRequests.set(requestId, { controller, sessionId })

    return (async () => {
      try {
        const result = await operation(signal)

        if (isErr(result)) {
          return {
            requestId,
            success: false,
            value: undefined,
            error: result.error,
          }
        }

        return {
          requestId,
          success: true,
          value: result.value,
          error: undefined,
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            requestId,
            success: false,
            value: undefined,
            error: createErrorInfo(
              ERROR_CODE.REQUEST_ABORTED,
              'Request was cancelled or timed out'
            ),
          }
        }
        throw error
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        this.activeRequests.delete(requestId)
      }
    })()
  }

  private async executeWithProtocol<R>(
    sessionId: string,
    operation: (protocol: FileProtocol, signal: AbortSignal) => Promise<Result<R, ErrorInfo>>,
    timeout: number | undefined = undefined,
    requestId?: string
  ): Promise<ProtocolResponse<R>> {
    return this.executeWithRequest(
      sessionId,
      timeout,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }
        return operation(protocolResult.value, signal)
      },
      requestId
    )
  }

  async connect(config: ConnectionConfig): Promise<ProtocolResponse<OperationResult>> {
    const requestId = crypto.randomUUID()

    try {
      let password: string | undefined

      if (config.password) {
        const decryptResult = decryptPassword(config.password)
        if (isOk(decryptResult) && decryptResult.value) {
          password = decryptResult.value
        }
      }

      if (!password) {
        return {
          requestId,
          success: false,
          value: undefined,
          error: createErrorInfo(ERROR_CODE.AUTH_ERROR, 'Password is required for connection'),
        }
      }

      const protocolResult = this.getProtocol(config.protocol)
      if (isErr(protocolResult)) {
        return {
          requestId,
          success: false,
          value: undefined,
          error: protocolResult.error,
        }
      }

      const protocol = protocolResult.value

      const hostVerifier =
        config.protocol === PROTOCOL.SFTP
          ? (hashedKey: string): HostVerifierResult => {
              const hostKeyResult = getHostKeyRecord(config.id)
              if (isErr(hostKeyResult) || !hostKeyResult.value) {
                return { detail: { hash: hashedKey }, status: ProtocolStatus.FIRST_CONNECT }
              }
              const hostKey = hostKeyResult.value
              if (hostKey.hash === hashedKey) {
                return { detail: { hash: hashedKey }, status: ProtocolStatus.OK }
              }
              return {
                detail: { hash: hashedKey, previousHash: hostKey.hash },
                status: SftpStatus.HOST_KEY_MISMATCH,
              }
            }
          : undefined

      const result = await protocol.connect(config, password, hostVerifier)

      if (isErr(result)) {
        return {
          requestId,
          success: false,
          value: undefined,
          error: result.error,
        }
      }

      const operationResult = result.value

      if (operationResult.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
        return {
          requestId,
          success: true,
          value: operationResult,
          error: undefined,
        }
      }

      if (!operationResult.sessionId) {
        return {
          requestId,
          success: false,
          value: undefined,
          error: createErrorInfo(
            ERROR_CODE.CONN_FAILED,
            'Connection failed: no session ID returned'
          ),
        }
      }

      logger.info(`Connection established: ${config.name} (${config.id})`)

      return {
        requestId,
        success: true,
        value: operationResult,
        error: undefined,
      }
    } catch (error) {
      return {
        requestId,
        success: false,
        value: undefined,
        error: createErrorInfo(ERROR_CODE.CONN_FAILED, String(error)),
      }
    }
  }

  async disconnect(sessionId: string, requestId?: string): Promise<ProtocolResponse<void>> {
    if (transferService.hasActiveTasks(sessionId)) {
      return {
        requestId: requestId ?? crypto.randomUUID(),
        success: false,
        value: undefined,
        error: createErrorInfo(ERROR_CODE.UPLOAD_IN_PROGRESS, 'Transfer in progress'),
      }
    }

    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.DISCONNECT,
      async () => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        const result = await protocol.disconnect(sessionId)
        logger.info(`Disconnected: ${sessionId}`)
        return result
      },
      requestId
    )
  }

  async list(
    sessionId: string,
    remotePath: string,
    requestId?: string
  ): Promise<ProtocolResponse<FileInfo[]>> {
    return this.executeWithProtocol(
      sessionId,
      (protocol, signal) => protocol.list(sessionId, remotePath, signal),
      TIMEOUTS.LIST,
      requestId
    )
  }

  async mkdir(
    sessionId: string,
    remotePath: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithProtocol(
      sessionId,
      (protocol, signal) => protocol.mkdir(sessionId, remotePath, signal),
      TIMEOUTS.MKDIR,
      requestId
    )
  }

  async rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithProtocol(
      sessionId,
      (protocol, signal) => protocol.rename(sessionId, file, newName, signal),
      TIMEOUTS.RENAME,
      requestId
    )
  }

  async delete(
    sessionId: string,
    file: FileInfo,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithProtocol(
      sessionId,
      (protocol, signal) => protocol.delete(sessionId, file, signal),
      TIMEOUTS.DELETE,
      requestId
    )
  }

  async copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithProtocol(
      sessionId,
      (protocol, signal) => protocol.copy(sessionId, file, targetPath, signal),
      undefined,
      requestId
    )
  }

  async move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithProtocol(
      sessionId,
      (protocol, signal) => protocol.move(sessionId, file, targetPath, signal),
      undefined,
      requestId
    )
  }

  async upload(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (transferred: number) => void,
    signal: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const protocolResult = this.getProtocolBySessionId(sessionId)
    if (isErr(protocolResult)) {
      return err(protocolResult.error)
    }

    const protocol = protocolResult.value
    return protocol.upload(sessionId, localPath, remotePath, onProgress, signal)
  }

  async download(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress: (transferred: number) => void,
    signal: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    const protocolResult = this.getProtocolBySessionId(sessionId)
    if (isErr(protocolResult)) {
      return err(protocolResult.error)
    }

    const protocol = protocolResult.value
    return protocol.download(sessionId, remotePath, localPath, onProgress, signal)
  }

  async ping(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const protocolResult = this.getProtocolBySessionId(sessionId)
    if (isErr(protocolResult)) {
      return err(protocolResult.error)
    }

    return protocolResult.value.ping(sessionId)
  }
}

export const protocolService = new ProtocolService()
