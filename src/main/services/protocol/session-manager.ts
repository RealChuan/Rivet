import { type ConnectionConfig, type ProtocolType } from '@shared/types/index.js'
import { TIMEOUTS } from '@shared/constants/timeouts.js'
import logger from '../../utils/logger.js'
import { ProtocolFactory } from './factory.js'
import { Mutex } from 'async-mutex'

export interface SessionHandle<T = unknown> {
  client: T
  config: ConnectionConfig
  protocolType: ProtocolType
  _closing?: boolean
}

class SessionManager {
  private sessions = new Map<string, SessionHandle<unknown>>()
  private sessionMutexes = new Map<string, Mutex>()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isShuttingDown = false

  private getSessionMutex(sessionId: string): Mutex {
    if (!this.sessionMutexes.has(sessionId)) {
      this.sessionMutexes.set(sessionId, new Mutex())
    }
    return this.sessionMutexes.get(sessionId)!
  }

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
    this.sessionMutexes.delete(sessionId)
    if (this.sessions.size === 0 && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  get<T>(sessionId: string, protocolType: ProtocolType): SessionHandle<T> | undefined {
    const handle = this.sessions.get(sessionId)
    if (handle?.protocolType !== protocolType) {
      return undefined
    }
    return handle as SessionHandle<T>
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
    this.sessionMutexes.clear()
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  async safeUnregister(sessionId: string): Promise<void> {
    const mutex = this.getSessionMutex(sessionId)
    const release = await mutex.acquire()

    try {
      const handle = this.sessions.get(sessionId)
      if (!handle) return

      handle._closing = true

      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      try {
        await Promise.race([
          protocol.disconnect(sessionId),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Disconnect timeout')), TIMEOUTS.DISCONNECT)
          ),
        ])
      } catch (err) {
        logger.warn(`Disconnect failed for ${sessionId}, forcing cleanup`, err)
      }

      this.sessions.delete(sessionId)
    } catch (err) {
      logger.error(`Failed to safely unregister session ${sessionId}:`, err)
      this.sessions.delete(sessionId)
    } finally {
      release()
      this.sessionMutexes.delete(sessionId)
    }
  }

  async safeUnregisterAll(): Promise<{ succeeded: string[]; failed: string[] }> {
    this.isShuttingDown = true
    const sessionIds = Array.from(this.sessions.keys())
    const succeeded: string[] = []
    const failed: string[] = []

    if (sessionIds.length === 0) {
      return { succeeded, failed }
    }

    logger.info(`Starting cleanup for ${sessionIds.length} sessions...`)

    await Promise.allSettled(
      sessionIds.map(async sessionId => {
        try {
          await this.safeUnregister(sessionId)
          succeeded.push(sessionId)
        } catch (err) {
          logger.error(`Failed to cleanup session ${sessionId}:`, err)
          failed.push(sessionId)
          this.sessions.delete(sessionId)
          this.sessionMutexes.delete(sessionId)
        }
      })
    )

    this.destroy()

    logger.info(`Cleanup completed: ${succeeded.length} succeeded, ${failed.length} failed`)
    return { succeeded, failed }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return
    logger.info('Starting session heartbeat...')
    this.heartbeatInterval = setInterval(() => {
      this.checkAllSessions().catch(err => {
        logger.error('Error during heartbeat check', err)
      })
    }, TIMEOUTS.HEARTBEAT_INTERVAL)
  }

  private async checkAllSessions(): Promise<void> {
    if (this.isShuttingDown) return

    const sessionsToCheck = Array.from(this.sessions.entries())

    await Promise.allSettled(
      sessionsToCheck.map(async ([sessionId, originalHandle]) => {
        if (originalHandle._closing) return

        const mutex = this.getSessionMutex(sessionId)
        const release = await mutex.acquire()

        try {
          if (!this.sessions.has(sessionId)) return
          const handle = this.sessions.get(sessionId)
          if (!handle) return
          if (handle._closing) return

          const protocol = ProtocolFactory.getProtocol(handle.protocolType)
          await Promise.race([
            protocol.ping(sessionId),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Ping timeout')), TIMEOUTS.PING)
            ),
          ])
        } catch (error) {
          logger.warn(`Session ${sessionId} ping failed, scheduling disconnect...`, error)
          this.safeUnregister(sessionId).catch(err =>
            logger.error(`Auto-disconnect failed for ${sessionId}:`, err)
          )
        } finally {
          release()
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
