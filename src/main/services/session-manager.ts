import { ERROR_CODE, IPC_CHANNELS, type ProtocolType, TIMEOUTS } from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  createErrorInfo,
  err,
  type ErrorInfo,
  ok,
  type Result,
} from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { WindowManager } from '../app/window-factory.js'
import { logger } from '../utils/logger.js'
import { sessionRegistry } from './session-registry.js'
import { transferService } from './transfer/index.js'

export type { SessionHandle } from './session-registry.js'

interface SessionManagerCallbacks {
  disconnect: (sessionId: string) => Promise<unknown>
  ping: (sessionId: string) => Promise<unknown>
}

class SessionManager {
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isShuttingDown = false
  private callbacks: SessionManagerCallbacks

  constructor(callbacks: SessionManagerCallbacks) {
    this.callbacks = callbacks
  }

  register<T>(
    sessionId: string,
    client: T,
    config: ConnectionConfig,
    protocolType: ProtocolType,
  ): void {
    sessionRegistry.register(sessionId, client, config, protocolType)
    this.startHeartbeat()
  }

  unregister(sessionId: string): void {
    sessionRegistry.unregister(sessionId)
    if (sessionRegistry.count === 0 && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  async safeUnregister(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const handle = sessionRegistry.get(sessionId)
    if (!handle) return ok(undefined)

    if (handle.isClosing) return ok(undefined)

    if (transferService.hasActiveTasks(sessionId)) {
      return err(createErrorInfo(ERROR_CODE.UPLOAD_IN_PROGRESS, 'Upload in progress'))
    }

    sessionRegistry.setClosing(sessionId)

    try {
      await Promise.race([
        this.callbacks.disconnect(sessionId),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Disconnect timeout')), TIMEOUTS.DISCONNECT),
        ),
      ])
    } catch (e) {
      sessionRegistry.unregister(sessionId)
      return err(
        createErrorInfo(ERROR_CODE.DISCONNECT_ERROR, 'Disconnect failed', formatErrorMessage(e)),
      )
    }

    sessionRegistry.unregister(sessionId)
    return ok(undefined)
  }

  async safeUnregisterAll(): Promise<Result<boolean, ErrorInfo>> {
    this.isShuttingDown = true
    const sessionIds = sessionRegistry.getAllIds()

    if (sessionIds.length === 0) {
      return ok(true)
    }

    logger.info(`Starting cleanup for ${sessionIds.length} sessions...`)

    let allSucceeded = true

    try {
      await Promise.allSettled(
        sessionIds.map(async (sessionId) => {
          const result = await this.safeUnregister(sessionId)
          if (!result.success) {
            logger.error(`Failed to cleanup session ${sessionId}:`, result.error)
            allSucceeded = false
          }
        }),
      )

      this.destroy()

      const status = allSucceeded ? 'completed successfully' : 'completed with failures'
      logger.info(`Cleanup ${status} for ${sessionIds.length} sessions`)
      return ok(allSucceeded)
    } catch (error) {
      logger.catch(error, { action: 'safe-unregister-all' })
      return err(createErrorInfo(ERROR_CODE.CLEANUP_ERROR, 'Cleanup failed', String(error)))
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return
    logger.info('Starting session heartbeat...')
    this.heartbeatInterval = setInterval(() => {
      this.checkAllSessions().catch((err) => {
        logger.catch(err, { action: 'heartbeat-check' })
      })
    }, TIMEOUTS.HEARTBEAT_INTERVAL)
  }

  private async checkAllSessions(): Promise<void> {
    if (this.isShuttingDown) return

    const sessionsToCheck = Array.from(sessionRegistry.getAllIds())

    await Promise.allSettled(
      sessionsToCheck.map(async (sessionId) => {
        const handle = sessionRegistry.get(sessionId)
        if (!handle || handle.isClosing) return

        try {
          await Promise.race([
            this.callbacks.ping(sessionId),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Ping timeout')), TIMEOUTS.PING),
            ),
          ])
        } catch (_error) {
          const protocolType: ProtocolType | undefined = handle.protocolType
          this.safeUnregister(sessionId).catch((err) => {
            logger.catch(err, { action: 'heartbeat-unregister', sessionId })
          })
          WindowManager.broadcast(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, {
            sessionId,
            protocolType,
          })
        }
      }),
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

export { SessionManager }
