import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig, OpenTerminalRequest, Result } from '@shared/types/index.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { toAppError } from '@shared/domain/error.js'
import { createErrorInfo, err, ok } from '@shared/types/index.js'
import { sendToMainWindow } from '../app/main-window.js'
import { sessionCredentials } from '../providers/session-credentials.js'
import { providerSessionRegistry, type SessionHandle } from '../providers/session-registry.js'
import { ssh2 } from '../providers/sftp/ssh2-module.js'
import { logger } from '../utils/index.js'
import { TerminalSession, type Ssh2ShellClientPort } from './terminal-session.js'

/** 终端会话接口：服务只用到这四个方法，便于测试替身。 */
export interface TerminalSessionLike {
  open(request: { cols: number; rows: number; cwd?: string | undefined }): Promise<void>
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
  close(): Promise<void>
}

export interface TerminalServiceOptions {
  createSession: (
    id: string,
    config: ConnectionConfig,
    credentials: Credentials,
  ) => TerminalSessionLike
  getSession: (sessionId: string) => SessionHandle | undefined
  getCredentials: (sessionId: string) => Credentials | undefined
}

interface TerminalEntry {
  sessionId: string
  session: TerminalSessionLike
}

/** 终端表：一个文件会话可挂多个终端（多标签）；`close` 幂等，未知 id 静默丢弃。 */
export class TerminalService {
  private readonly options: TerminalServiceOptions
  private readonly byId = new Map<string, TerminalEntry>()
  private readonly bySession = new Map<string, Set<string>>()
  /** 正在连接的标签：同一 terminalId 并发 open 只建一条 SSH 连接。 */
  private readonly opening = new Map<string, Promise<Result<{ terminalId: string }>>>()

  constructor(options: TerminalServiceOptions) {
    this.options = options
  }

  async open(request: OpenTerminalRequest): Promise<Result<{ terminalId: string }>> {
    if (this.byId.has(request.terminalId)) return ok({ terminalId: request.terminalId })

    // StrictMode 双挂载会连开两次：复用同一次连接，避免漏掉一条 shell。
    const inflight = this.opening.get(request.terminalId)
    if (inflight) return inflight

    const task = this.openSession(request)
    this.opening.set(request.terminalId, task)
    try {
      return await task
    } finally {
      this.opening.delete(request.terminalId)
    }
  }

  private async openSession(request: OpenTerminalRequest): Promise<Result<{ terminalId: string }>> {
    const handle = this.options.getSession(request.sessionId)
    if (!handle) {
      return err(
        createErrorInfo(ERROR_CODE.SESSION_NOT_FOUND, `Session not found: ${request.sessionId}`),
      )
    }
    if (handle.protocolType !== 'sftp') {
      return err(
        createErrorInfo(ERROR_CODE.TERMINAL_NOT_SUPPORTED, 'Terminal requires an SFTP session'),
      )
    }

    const credentials = this.options.getCredentials(request.sessionId)
    if (!credentials) {
      return err(createErrorInfo(ERROR_CODE.TERMINAL_OPEN_FAILED, 'Credentials are not available'))
    }

    const terminalId = request.terminalId
    const session = this.options.createSession(terminalId, handle.config, credentials)

    try {
      await session.open({
        cols: request.cols,
        rows: request.rows,
        ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
      })
    } catch (error) {
      const info = toAppError(error, ERROR_CODE.TERMINAL_OPEN_FAILED)
      logger.warn('Terminal open failed', {
        sessionId: request.sessionId,
        code: info.code,
        message: info.message,
      })
      return err(info)
    }

    this.byId.set(terminalId, { sessionId: request.sessionId, session })
    const terminals = this.bySession.get(request.sessionId)
    if (terminals) {
      terminals.add(terminalId)
    } else {
      this.bySession.set(request.sessionId, new Set([terminalId]))
    }
    return ok({ terminalId })
  }

  write(terminalId: string, data: Uint8Array): void {
    const entry = this.byId.get(terminalId)
    if (!entry) {
      logger.warn('Terminal not found', { code: ERROR_CODE.TERMINAL_NOT_FOUND, terminalId })
      return
    }
    entry.session.write(data)
  }

  resize(terminalId: string, cols: number, rows: number): void {
    const entry = this.byId.get(terminalId)
    if (!entry) {
      logger.warn('Terminal not found', { code: ERROR_CODE.TERMINAL_NOT_FOUND, terminalId })
      return
    }
    entry.session.resize(cols, rows)
  }

  async close(terminalId: string): Promise<Result<void>> {
    const entry = this.byId.get(terminalId)
    if (!entry) return ok(undefined)

    this.forget(terminalId, entry.sessionId)
    await entry.session.close()
    return ok(undefined)
  }

  /** 会话结束时调用，一并关闭该会话的全部标签终端。 */
  closeBySession(sessionId: string): void {
    const terminalIds = this.bySession.get(sessionId)
    if (!terminalIds) return

    // 先快照：forget 会同步改动 bySession，边遍历边删会漏掉后面的 id。
    for (const terminalId of [...terminalIds]) {
      const entry = this.byId.get(terminalId)
      this.forget(terminalId, sessionId)
      if (!entry) continue

      entry.session.close().catch((error: unknown) => {
        logger.catch(error, { action: 'terminal-close', sessionId, terminalId })
      })
    }
  }

  private forget(terminalId: string, sessionId: string): void {
    this.byId.delete(terminalId)
    const terminals = this.bySession.get(sessionId)
    if (!terminals) return

    terminals.delete(terminalId)
    if (terminals.size === 0) this.bySession.delete(sessionId)
  }
}

function createSsh2Client(): Ssh2ShellClientPort {
  return new ssh2.Client()
}

export const terminalService = new TerminalService({
  createSession: (id, config, credentials) =>
    new TerminalSession(id, config, credentials, {
      createClient: createSsh2Client,
      onData: (terminalId, chunk) => {
        sendToMainWindow(EVENT_CHANNEL.TERMINAL_DATA, { terminalId, data: chunk })
      },
      onExit: (info) => {
        sendToMainWindow(EVENT_CHANNEL.TERMINAL_EXIT, info)
      },
    }),
  getSession: (sessionId) => providerSessionRegistry.get(sessionId),
  getCredentials: (sessionId) => sessionCredentials.get(sessionId),
})
