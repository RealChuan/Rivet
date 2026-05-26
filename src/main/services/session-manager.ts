import {
  type ConnectionConfig,
  type Result,
  ok,
  err,
  type ErrorInfo,
  createErrorInfo,
} from '@shared/types/index.js'
import { type ProtocolType, TIMEOUTS } from '@shared/constants/index.js'
import { logger } from '../utils/logger.js'
import { protocolService } from './protocol/protocol-service.js'

export interface SessionHandle<T = unknown> {
  client: T
  config: ConnectionConfig
  protocolType: ProtocolType
  _closing?: boolean
}

class SessionManager {
  private sessions = new Map<string, SessionHandle<unknown>>()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isShuttingDown = false

  register<T>(
    sessionId: string,
    client: T,
    config: ConnectionConfig,
    protocolType: ProtocolType
  ): void {
    this.sessions.set(sessionId, { client, config, protocolType })
    this.startHeartbeat()
  }

  unregister(sessionId: string): void {
    this.sessions.delete(sessionId)
    if (this.sessions.size === 0 && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  get<T>(sessionId: string): SessionHandle<T> | undefined {
    return this.sessions.get(sessionId) as SessionHandle<T> | undefined
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getByProtocol(
    protocolType: ProtocolType
  ): Array<{ sessionId: string; handle: SessionHandle<unknown> }> {
    const result: Array<{ sessionId: string; handle: SessionHandle<unknown> }> = []
    for (const [sessionId, handle] of this.sessions) {
      if (handle.protocolType === protocolType) {
        result.push({ sessionId, handle })
      }
    }
    return result
  }

  getAllIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  get count(): number {
    return this.sessions.size
  }

  clear(): void {
    this.sessions.clear()
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  setClosing(sessionId: string): void {
    const handle = this.sessions.get(sessionId)
    if (handle) {
      handle._closing = true
    }
  }

  async safeUnregister(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const handle = this.sessions.get(sessionId)
    if (!handle) return ok(undefined)

    if (handle._closing) return ok(undefined)
    handle._closing = true

    try {
      await Promise.race([
        protocolService.disconnect(sessionId),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Disconnect timeout')), TIMEOUTS.DISCONNECT)
        ),
      ])
    } catch (e) {
      const error = e as Error
      this.sessions.delete(sessionId)
      return err(createErrorInfo('DISCONNECT_ERROR', 'Disconnect failed', error.message))
    }

    this.sessions.delete(sessionId)
    return ok(undefined)
  }

  async safeUnregisterAll(): Promise<Result<boolean, ErrorInfo>> {
    this.isShuttingDown = true
    const sessionIds = Array.from(this.sessions.keys())

    if (sessionIds.length === 0) {
      return ok(true)
    }

    logger.info(`Starting cleanup for ${sessionIds.length} sessions...`)

    let allSucceeded = true

    try {
      await Promise.allSettled(
        sessionIds.map(async sessionId => {
          const result = await this.safeUnregister(sessionId)
          if (!result.success) {
            logger.error(`Failed to cleanup session ${sessionId}:`, result.error)
            allSucceeded = false
          }
        })
      )

      this.destroy()

      const status = allSucceeded ? 'completed successfully' : 'completed with failures'
      logger.info(`Cleanup ${status} for ${sessionIds.length} sessions`)
      return ok(allSucceeded)
    } catch (error) {
      logger.catch(error, { action: 'safe-unregister-all' })
      return err(createErrorInfo('CLEANUP_ERROR', 'Cleanup failed', String(error)))
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return
    logger.info('Starting session heartbeat...')
    this.heartbeatInterval = setInterval(() => {
      this.checkAllSessions().catch(err => {
        logger.catch(err, { action: 'heartbeat-check' })
      })
    }, TIMEOUTS.HEARTBEAT_INTERVAL)
  }

  private async checkAllSessions(): Promise<void> {
    if (this.isShuttingDown) return

    const sessionsToCheck = Array.from(this.sessions.entries())

    await Promise.allSettled(
      sessionsToCheck.map(async ([sessionId, handle]) => {
        if (handle._closing) return

        try {
          await Promise.race([
            protocolService.ping(sessionId),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Ping timeout')), TIMEOUTS.PING)
            ),
          ])
        } catch (_error) {
          this.safeUnregister(sessionId).catch(() => {})
        }
      })
    )
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      logger.info('Stopped session heartbeat')
    }
    this.isShuttingDown = true
  }
}

export const sessionManager = new SessionManager()
