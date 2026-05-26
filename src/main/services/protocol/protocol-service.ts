import { v4 as uuidv4 } from 'uuid'
import { type FileProtocol } from './protocol-types.js'
import { SftpProtocol } from './SftpProtocol.js'
import { WebdavProtocol } from './WebdavProtocol.js'
import { type ProtocolType, PROTOCOL_SFTP, SftpStatus, TIMEOUTS } from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  type FileInfo,
  type OperationResult,
  type ProtocolResponse,
} from '@shared/types/index.js'
import { sessionManager } from '../session-manager.js'
import { logger, decryptPassword } from '../../utils/index.js'
import {
  type Result,
  ok,
  err,
  isErr,
  isOk,
  type ErrorInfo,
  createErrorInfo,
} from '@shared/types/result.js'

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

  private getProtocol(protocol: ProtocolType): FileProtocol {
    if (!this.protocols.has(protocol)) {
      const instance = protocol === PROTOCOL_SFTP ? new SftpProtocol() : new WebdavProtocol()
      this.protocols.set(protocol, instance)
    }

    const instance = this.protocols.get(protocol)
    if (!instance) {
      throw new Error(`Protocol not initialized: ${protocol}`)
    }

    return instance
  }

  private getProtocolBySessionId(sessionId: string): Result<FileProtocol, ErrorInfo> {
    const handle = sessionManager.get(sessionId)
    if (!handle) {
      return err(createErrorInfo('CONN_NOT_FOUND', `Connection not found: ${sessionId}`))
    }
    return ok(this.getProtocol(handle.protocolType))
  }

  private executeWithRequest<T>(
    sessionId: string,
    timeout: number,
    operation: (signal: AbortSignal) => Promise<Result<T, ErrorInfo>>,
    providedRequestId?: string
  ): Promise<ProtocolResponse<T>> {
    const requestId = providedRequestId ?? uuidv4()
    const controller = new AbortController()
    const signal = controller.signal

    const timeoutId = setTimeout(() => controller.abort(), timeout)

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
        if (error instanceof DOMException && error.name === 'AbortError') {
          return {
            requestId,
            success: false,
            value: undefined,
            error: createErrorInfo('REQUEST_ABORTED', 'Request was cancelled or timed out'),
          }
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
        this.activeRequests.delete(requestId)
      }
    })()
  }

  async connect(config: ConnectionConfig): Promise<ProtocolResponse<OperationResult>> {
    const requestId = uuidv4()

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
          error: createErrorInfo('AUTH_ERROR', 'Password is required for connection'),
        }
      }

      const protocol = this.getProtocol(config.protocol)
      const result = await protocol.connect(config, password)

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
          error: createErrorInfo('CONN_FAILED', 'Connection failed: no session ID returned'),
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
        error: createErrorInfo('CONN_FAILED', String(error)),
      }
    }
  }

  async disconnect(sessionId: string, requestId?: string): Promise<ProtocolResponse<void>> {
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.LIST,
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
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.LIST,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        return protocol.list(sessionId, remotePath, signal)
      },
      requestId
    )
  }

  async mkdir(
    sessionId: string,
    remotePath: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.MKDIR,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        return protocol.mkdir(sessionId, remotePath, signal)
      },
      requestId
    )
  }

  async rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.RENAME,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        return protocol.rename(sessionId, file, newName, signal)
      },
      requestId
    )
  }

  async delete(
    sessionId: string,
    file: FileInfo,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.DELETE,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        return protocol.delete(sessionId, file, signal)
      },
      requestId
    )
  }

  async copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.COPY,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        return protocol.copy(sessionId, file, targetPath, signal)
      },
      requestId
    )
  }

  async move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string
  ): Promise<ProtocolResponse<void>> {
    return this.executeWithRequest(
      sessionId,
      TIMEOUTS.MOVE,
      async signal => {
        const protocolResult = this.getProtocolBySessionId(sessionId)
        if (isErr(protocolResult)) {
          return protocolResult
        }

        const protocol = protocolResult.value
        return protocol.move(sessionId, file, targetPath, signal)
      },
      requestId
    )
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
