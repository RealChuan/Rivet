import crypto from 'node:crypto'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ProviderKind } from '@shared/domain/entry.js'
import type { ErrorCode } from '@shared/domain/error.js'
import { ERROR_CODE, FILE_TYPE, MAX_LIST_ENTRIES, TIMEOUTS } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { createAppError, toAppError } from '@shared/domain/error.js'
import {
  type ConnectionConfig,
  type ConnectRequest,
  createErrorInfo,
  err,
  type ErrorInfo,
  type FileInfo,
  type HostKeyErrorDetail,
  ok,
  type OperationResult,
  type Result,
} from '@shared/types/index.js'
import { getParentPath, joinPaths, sanitizePath } from '@shared/utils/index.js'
import type { FileProvider } from '../providers/types.js'
import { sendToMainWindow, type EventChannel } from '../app/main-window.js'
import { requestRegistry, type RequestRegistry } from '../ipc/request-registry.js'
import { ProviderError } from '../providers/errors.js'
import { createProvider, type ProviderFactoryOptions } from '../providers/registry.js'
import {
  providerSessionRegistry,
  type SessionHandle,
  type SessionRegistry,
} from '../providers/session-registry.js'
import { parseHostPublicKey } from '../providers/sftp/host-key.js'
import {
  deleteConnectionSecret,
  getConnectionSecret,
  saveConnectionSecret,
} from '../stores/connections-repository.js'
import { getKnownHost } from '../stores/known-hosts.js'
import { generateSessionId, logger } from '../utils/index.js'
import { toFileInfo } from './entry-mapper.js'
import { calculateFolderStats as collectFolderStats } from './folder-stats.js'
import { copyRemoteEntry } from './remote-copy.js'

export interface ProtocolServiceOptions {
  sessions: SessionRegistry
  requests: RequestRegistry
  createProvider: (kind: ProviderKind, options: ProviderFactoryOptions) => FileProvider
  getConnectionSecret: (connectionId: string) => Promise<Result<string | undefined, ErrorInfo>>
  saveConnectionSecret: (
    connectionId: string,
    plain: string,
  ) => Promise<Result<{ stored: boolean }, ErrorInfo>>
  deleteConnectionSecret: (connectionId: string) => void
  hasActiveTasks?: (sessionId: string) => boolean
}

type HostKeyCapture =
  | { status: 'ok' }
  | { status: 'unknown'; detail?: HostKeyErrorDetail }
  | { status: 'mismatch'; detail: HostKeyErrorDetail }
  | { status: 'error'; error: ErrorInfo }

function sanitize(path: string): string {
  try {
    return sanitizePath(path)
  } catch (error) {
    throw new ProviderError(
      ERROR_CODE.PATH_TRAVERSAL,
      error instanceof Error ? error.message : String(error),
    )
  }
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true
  return 'code' in error && error.code === ERROR_CODE.REQUEST_ABORTED
}

/**
 * 协议门面：只依赖 `FileProvider`，取消/超时全部交给 `RequestRegistry`。
 * 会话表按 `sessionId → provider` 存储，协议差异只存在于 provider 内部。
 */
export class ProtocolService {
  private readonly options: ProtocolServiceOptions
  private hasActiveTasksFn: (sessionId: string) => boolean
  private sessionOpenedHandler: (() => void) | undefined

  constructor(options: ProtocolServiceOptions) {
    this.options = options
    this.hasActiveTasksFn = options.hasActiveTasks ?? (() => false)
  }

  setHasActiveTasksChecker(fn: (sessionId: string) => boolean): void {
    this.hasActiveTasksFn = fn
  }

  setSessionOpenedHandler(fn: (() => void) | undefined): void {
    this.sessionOpenedHandler = fn
  }

  private send(channel: string, data: unknown): void {
    sendToMainWindow(channel as EventChannel, data)
  }

  private success<T>(_requestId: string, value: T): Result<T> {
    return ok(value)
  }

  private failure<T>(_requestId: string, error: ErrorInfo): Result<T> {
    return err(error)
  }

  private getSession(sessionId: string): SessionHandle | undefined {
    return this.options.sessions.get(sessionId)
  }

  private buildCredentials(config: ConnectionConfig, secret: string | undefined): Credentials {
    switch (config.authKind ?? 'password') {
      case 'password': {
        if (!secret) {
          throw new ProviderError(ERROR_CODE.AUTH_ERROR, 'Password is required for connection')
        }
        return { kind: 'password', username: config.username, password: secret }
      }

      case 'privateKey': {
        if (!config.privateKeyPath) {
          throw new ProviderError(
            ERROR_CODE.INVALID_CONFIG,
            'privateKeyPath is required for privateKey authentication',
          )
        }
        return {
          kind: 'privateKey',
          username: config.username,
          privateKeyPath: config.privateKeyPath,
          ...(secret ? { passphrase: secret } : {}),
        }
      }

      case 'agent':
        return {
          kind: 'agent',
          username: config.username,
          ...(config.agentPath !== undefined ? { agentPath: config.agentPath } : {}),
        }
    }
  }

  async connect(request: ConnectRequest): Promise<Result<OperationResult>> {
    const requestId = crypto.randomUUID()
    const { connection: config, secret: providedSecret, saveSecret } = request

    let provider: FileProvider
    let credentials: Credentials
    try {
      const stored = await this.options.getConnectionSecret(config.id)
      if (!providedSecret && !stored.success) {
        return this.failure(requestId, stored.error)
      }
      const secret = providedSecret ?? (stored.success ? stored.value : undefined)
      credentials = this.buildCredentials(config, secret)
      const capture: { current: HostKeyCapture | null } = { current: null }

      const hostVerifier =
        config.protocol === 'sftp'
          ? (publicKey: Buffer): boolean => {
              try {
                const parsed = parseHostPublicKey(publicKey)
                const known = getKnownHost(config.host, config.port, parsed.algorithm)
                if (!known.success) {
                  capture.current = { status: 'error', error: known.error }
                  return false
                }
                if (!known.value) {
                  capture.current = {
                    status: 'unknown',
                    detail: {
                      host: config.host,
                      port: config.port,
                      algorithm: parsed.algorithm,
                      fingerprint: parsed.fingerprint,
                    },
                  }
                  return false
                }
                if (known.value.fingerprint === parsed.fingerprint) {
                  capture.current = { status: 'ok' }
                  return true
                }
                capture.current = {
                  status: 'mismatch',
                  detail: {
                    host: config.host,
                    port: config.port,
                    algorithm: parsed.algorithm,
                    fingerprint: parsed.fingerprint,
                    previousFingerprint: known.value.fingerprint,
                  },
                }
                return false
              } catch (error) {
                capture.current = {
                  status: 'error',
                  error: toErrorInfo(error, ERROR_CODE.HOST_KEY_ERROR),
                }
                return false
              }
            }
          : undefined

      provider = this.options.createProvider(config.protocol, {
        config,
        ...(hostVerifier !== undefined ? { hostVerifier } : {}),
      })

      try {
        await provider.connect(credentials)
      } catch (error) {
        await provider.disconnect().catch(() => {})
        const captured = capture.current
        if (captured?.status === 'unknown') {
          return this.failure(
            requestId,
            createAppError(
              ERROR_CODE.HOST_KEY_UNKNOWN,
              'Unknown host key',
              captured.detail ? { ...captured.detail } : undefined,
            ),
          )
        }
        if (captured?.status === 'mismatch') {
          return this.failure(
            requestId,
            createAppError(ERROR_CODE.HOST_KEY_MISMATCH, 'Host key mismatch', {
              ...captured.detail,
            }),
          )
        }
        if (captured?.status === 'error') {
          return this.failure(requestId, captured.error)
        }
        return this.failure(requestId, toErrorInfo(error, ERROR_CODE.CONN_FAILED))
      }

      const sessionId = generateSessionId(provider.kind)
      this.options.sessions.register(sessionId, {
        provider,
        config,
        protocolType: provider.kind,
        isClosing: false,
      })
      this.sessionOpenedHandler?.()

      logger.info(`Connection established: ${config.name} (${config.id})`)

      if (saveSecret && secret) {
        await this.options.saveConnectionSecret(config.id, secret)
      }
      if (saveSecret === false) {
        this.options.deleteConnectionSecret(config.id)
      }

      return this.success(requestId, {
        sessionId,
        capabilities: provider.capabilities,
      })
    } catch (error) {
      const info = toErrorInfo(error, ERROR_CODE.CONN_FAILED)
      logger.warn('Connection failed', {
        connectionId: config.id,
        protocol: config.protocol,
        code: info.code,
        message: info.message,
      })
      return this.failure(requestId, info)
    }
  }

  private async runSessionRequest<T>(
    sessionId: string,
    requestId: string | undefined,
    timeoutMs: number | null,
    fallback: ErrorCode,
    action: string,
    mutation: boolean,
    operation: (provider: FileProvider, signal: AbortSignal) => Promise<T>,
  ): Promise<Result<T>> {
    const id = requestId ?? crypto.randomUUID()
    const startedAt = Date.now()
    const handle = this.getSession(sessionId)
    if (!handle) {
      const error = createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Session not found: ${sessionId}`)
      logger.warn(`Protocol ${action} rejected`, { sessionId, requestId: id, code: error.code })
      return this.failure(id, error)
    }
    if (handle.isClosing) {
      const error = createErrorInfo(ERROR_CODE.SESSION_CLOSING, `Session is closing: ${sessionId}`)
      logger.warn(`Protocol ${action} rejected`, { sessionId, requestId: id, code: error.code })
      return this.failure(id, error)
    }

    try {
      const tracked = await this.options.requests.run({ requestId: id, timeoutMs }, (signal) =>
        operation(handle.provider, signal),
      )
      logger[mutation ? 'info' : 'debug'](`Protocol ${action} succeeded`, {
        sessionId,
        requestId: tracked.requestId,
        durationMs: Date.now() - startedAt,
      })
      return this.success(tracked.requestId, tracked.value)
    } catch (error) {
      const info = toErrorInfo(error, fallback)
      logger.warn(`Protocol ${action} failed`, {
        sessionId,
        requestId: id,
        code: info.code,
        message: info.message,
        durationMs: Date.now() - startedAt,
      })
      return this.failure(id, info)
    }
  }

  async disconnect(sessionId: string, requestId?: string): Promise<Result<void>> {
    const id = requestId ?? crypto.randomUUID()
    const handle = this.getSession(sessionId)
    if (!handle) {
      return this.failure(
        id,
        createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Session not found: ${sessionId}`),
      )
    }
    if (this.hasActiveTasksFn(sessionId)) {
      return this.failure(
        id,
        createErrorInfo(ERROR_CODE.UPLOAD_IN_PROGRESS, 'Transfer in progress'),
      )
    }

    try {
      await this.options.requests.run({ requestId: id, timeoutMs: TIMEOUTS.DISCONNECT }, () =>
        handle.provider.disconnect(),
      )
      logger.info(`Disconnected: ${sessionId}`)
      return this.success(id, undefined)
    } catch (error) {
      return this.failure(id, toErrorInfo(error, ERROR_CODE.DISCONNECT_ERROR))
    } finally {
      this.options.sessions.unregister(sessionId)
    }
  }

  cancel(requestId: string): void {
    this.options.requests.cancel(requestId)
  }

  async list(
    sessionId: string,
    remotePath: string,
    requestId?: string,
  ): Promise<Result<FileInfo[]>> {
    return this.runSessionRequest(
      sessionId,
      requestId,
      TIMEOUTS.LIST,
      ERROR_CODE.LIST_ERROR,
      'list',
      false,
      async (provider, signal) => {
        const path = sanitize(remotePath)
        const entries: FileInfo[] = []
        let warned = false

        for await (const entry of provider.list(path, { signal })) {
          if (entries.length >= MAX_LIST_ENTRIES) {
            if (!warned) {
              warned = true
              logger.warn('Directory listing truncated', {
                sessionId,
                path,
                limit: MAX_LIST_ENTRIES,
              })
            }
            break
          }
          entries.push(toFileInfo(entry))
        }

        return entries
      },
    )
  }

  async mkdir(sessionId: string, remotePath: string, requestId?: string): Promise<Result<void>> {
    return this.runSessionRequest(
      sessionId,
      requestId,
      TIMEOUTS.MKDIR,
      ERROR_CODE.MKDIR_ERROR,
      'mkdir',
      true,
      async (provider, signal) => {
        await provider.mkdir(sanitize(remotePath), { recursive: true, signal })
      },
    )
  }

  async rename(
    sessionId: string,
    file: FileInfo,
    newName: string,
    requestId?: string,
  ): Promise<Result<void>> {
    return this.runSessionRequest(
      sessionId,
      requestId,
      TIMEOUTS.RENAME,
      ERROR_CODE.RENAME_ERROR,
      'rename',
      true,
      async (provider, signal) => {
        const from = sanitize(file.absolutePath)
        const to = sanitize(joinPaths(getParentPath(from), newName))
        await provider.rename(from, to, signal)
      },
    )
  }

  async delete(sessionId: string, file: FileInfo, requestId?: string): Promise<Result<void>> {
    return this.runSessionRequest(
      sessionId,
      requestId,
      TIMEOUTS.DELETE,
      ERROR_CODE.DELETE_ERROR,
      'delete',
      true,
      async (provider, signal) => {
        await provider.remove(sanitize(file.absolutePath), signal)
      },
    )
  }

  async copy(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string,
  ): Promise<Result<void>> {
    return this.runSessionRequest(
      sessionId,
      requestId,
      null,
      ERROR_CODE.COPY_ERROR,
      'copy',
      true,
      async (provider, signal) => {
        await copyRemoteEntry(
          provider,
          {
            path: sanitize(file.absolutePath),
            kind: file.type === FILE_TYPE.DIRECTORY ? 'directory' : 'file',
          },
          sanitize(targetPath),
          { signal, overwrite: true },
        )
      },
    )
  }

  async move(
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string,
  ): Promise<Result<void>> {
    return this.runSessionRequest(
      sessionId,
      requestId,
      null,
      ERROR_CODE.MOVE_ERROR,
      'move',
      true,
      async (provider, signal) => {
        await provider.rename(sanitize(file.absolutePath), sanitize(targetPath), signal)
      },
    )
  }

  async ping(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const handle = this.getSession(sessionId)
    if (!handle) {
      return err(createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Session not found: ${sessionId}`))
    }

    try {
      await handle.provider.ping()
      return ok(undefined)
    } catch (error) {
      const info = toErrorInfo(error, ERROR_CODE.PING_ERROR)
      logger.warn('Protocol ping failed', {
        sessionId,
        code: info.code,
        message: info.message,
      })
      return err(info)
    }
  }

  async calculateFolderStats(sessionId: string, path: string): Promise<Result<void, ErrorInfo>> {
    const handle = this.getSession(sessionId)
    if (!handle) {
      return err(createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Session not found: ${sessionId}`))
    }

    const root = sanitize(path)
    const tag = `stats:${sessionId}`
    this.options.requests.cancelByTag(tag)

    let operation: Promise<unknown> | undefined
    try {
      await this.options.requests.run({ timeoutMs: null, tag }, (signal) => {
        operation = collectFolderStats(handle.provider, root, {
          signal,
          onProgress: (progress) => {
            this.send(EVENT_CHANNEL.FOLDER_STATS_PROGRESS, { sessionId, ...progress })
          },
        })
        return operation
      })
      return ok(undefined)
    } catch (error) {
      if (isAbortError(error)) {
        // 取消时等 helper 把 isCancelled 终态事件发完，再返回成功。
        await operation?.catch(() => {})
        return ok(undefined)
      }
      return err(toErrorInfo(error, ERROR_CODE.LIST_ERROR))
    }
  }

  cancelCalculateFolderStats(sessionId: string): void {
    this.options.requests.cancelByTag(`stats:${sessionId}`)
  }
}

function toErrorInfo(error: unknown, fallback: ErrorCode): ErrorInfo {
  return toAppError(error, fallback)
}

export const protocolService = new ProtocolService({
  sessions: providerSessionRegistry,
  requests: requestRegistry,
  createProvider,
  getConnectionSecret,
  saveConnectionSecret,
  deleteConnectionSecret,
})
