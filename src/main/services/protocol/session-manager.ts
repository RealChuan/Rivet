import { type ConnectionConfig, type ProtocolType } from '@shared/types/index.js'
import logger from '../../utils/logger.js'
import { ProtocolFactory } from './factory.js'
import { WindowManager } from '../../app/window-factory.js'
import { MAIN_WINDOW_ID } from '@shared/constants/index.js'

const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const PING_TIMEOUT = 5000 // 5 seconds

export interface SessionHandle<T = unknown> {
  client: T
  config: ConnectionConfig
  protocolType: ProtocolType
}

class SessionManager {
  private sessions = new Map<string, SessionHandle<unknown>>()
  private heartbeatInterval: NodeJS.Timeout | null = null

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
    // Stop heartbeat if no sessions left
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
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return
    logger.info('Starting session heartbeat...')
    this.heartbeatInterval = setInterval(() => {
      this.checkAllSessions().catch(err => {
        logger.error('Error during heartbeat check', err)
      })
    }, HEARTBEAT_INTERVAL)
  }

  private async checkAllSessions(): Promise<void> {
    const sessionsToCheck = Array.from(this.sessions.entries())
    for (const [sessionId, handle] of sessionsToCheck) {
      // Make sure session still exists (might have been cleaned up during check)
      if (!this.sessions.has(sessionId)) continue

      try {
        const protocol = ProtocolFactory.getProtocol(handle.protocolType)
        // Add a timeout to ping
        await Promise.race([
          protocol.ping(sessionId),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Ping timeout')), PING_TIMEOUT)
          ),
        ])
      } catch (error) {
        logger.warn(`Session ${sessionId} ping failed, disconnecting...`, error)
        this.handleSessionDisconnect(sessionId, handle)
      }
    }
  }

  private handleSessionDisconnect(sessionId: string, handle: SessionHandle<unknown>): void {
    try {
      const protocol = ProtocolFactory.getProtocol(handle.protocolType)
      protocol.disconnect(sessionId).catch(err => {
        logger.warn(`Cleanup disconnect failed for ${sessionId}`, err)
      })
    } catch (err) {
      logger.warn(`Disconnect failed for ${sessionId}`, err)
    }

    // Notify frontend via IPC
    const mainWindow = WindowManager.get(MAIN_WINDOW_ID)
    if (mainWindow) {
      mainWindow.webContents.send('session-disconnected', {
        sessionId,
        connectionUuid: handle.config.connectionUuid,
        protocol: handle.protocolType,
        name: handle.config.name,
      })
    }
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      logger.info('Stopped session heartbeat')
    }
  }
}

export const sessionManager = new SessionManager()
