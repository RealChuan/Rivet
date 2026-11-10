import { ERROR_CODE, TIMEOUTS } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { sendToMainWindow } from '../app/main-window.js'
import { providerSessionRegistry, type SessionHandle } from '../providers/session-registry.js'
import { logger } from '../utils/logger.js'
import { transferService } from './transfer/index.js'

export type { SessionHandle } from '../providers/session-registry.js'

interface SessionManagerCallbacks {
  disconnect: (sessionId: string) => Promise<Result<void, ErrorInfo>>
  ping: (sessionId: string) => Promise<Result<void, ErrorInfo>>
}

/**
 * 会话生命周期：心跳、断开与清理。
 * `sessionId → FileProvider` 的注册由协议层直接写入 provider 版 registry。
 */
class SessionManager {
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isShuttingDown = false
  private callbacks: SessionManagerCallbacks

  constructor(callbacks: SessionManagerCallbacks) {
    this.callbacks = callbacks
  }

  startHeartbeat(): void {
    if (this.heartbeatInterval) return
    logger.info('Starting session heartbeat...')
    this.heartbeatInterval = setInterval(() => {
      this.checkAllSessions().catch((err) => {
        logger.catch(err, { action: 'heartbeat-check' })
      })
    }, TIMEOUTS.HEARTBEAT_INTERVAL)
  }

  unregister(sessionId: string): void {
    providerSessionRegistry.unregister(sessionId)
    // 心跳判定死亡会绕过守卫直接拆会话，这里补一次任务清理。
    transferService.cleanupSessionTasks(sessionId)
    if (providerSessionRegistry.count === 0 && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  async safeUnregister(sessionId: string): Promise<Result<void, ErrorInfo>> {
    const handle = providerSessionRegistry.get(sessionId)
    if (!handle) return ok(undefined)

    if (handle.isClosing) return ok(undefined)

    if (transferService.hasActiveTasks(sessionId)) {
      return err(createErrorInfo(ERROR_CODE.UPLOAD_IN_PROGRESS, 'Upload in progress'))
    }

    providerSessionRegistry.setClosing(sessionId)

    let timeoutId: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        this.callbacks.disconnect(sessionId),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Disconnect timeout')), TIMEOUTS.DISCONNECT)
        }),
      ])
      if (!result.success) throw new Error(result.error.message)
    } catch (e) {
      providerSessionRegistry.unregister(sessionId)
      return err(
        createErrorInfo(ERROR_CODE.DISCONNECT_ERROR, 'Disconnect failed', formatErrorMessage(e)),
      )
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }

    providerSessionRegistry.unregister(sessionId)
    return ok(undefined)
  }

  async safeUnregisterAll(): Promise<Result<boolean, ErrorInfo>> {
    this.isShuttingDown = true
    const sessionIds = providerSessionRegistry.getAllIds()

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

  private async checkAllSessions(): Promise<void> {
    if (this.isShuttingDown) return

    const sessionsToCheck = Array.from(providerSessionRegistry.getAllIds())

    await Promise.allSettled(
      sessionsToCheck.map(async (sessionId) => {
        const handle = providerSessionRegistry.get(sessionId)
        if (!handle || handle.isClosing) return

        let timeoutId: NodeJS.Timeout | undefined
        let alive = false
        try {
          // ping 以 Result 返回失败（而非 reject），这里必须显式判定，
          // 否则连接被服务端关闭后会一直显示为已连接。
          const result = await Promise.race([
            this.callbacks.ping(sessionId),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Ping timeout')), TIMEOUTS.PING)
            }),
          ])
          alive = result.success
        } catch (_error) {
          alive = false
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }

        if (!alive) {
          await this.dropDeadSession(sessionId, handle)
        }
      }),
    )
  }

  /**
   * 心跳判定连接已死时强制清理：即使仍有传输任务也要断开，
   * 否则主进程会残留一个永远 ping 不通的会话，且事件会每个周期重复发送。
   */
  private async dropDeadSession(sessionId: string, handle: SessionHandle): Promise<void> {
    if (handle.isClosing) return

    providerSessionRegistry.setClosing(sessionId)
    let timeoutId: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.callbacks.disconnect(sessionId),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Disconnect timeout')), TIMEOUTS.DISCONNECT)
        }),
      ])
    } catch (error) {
      logger.catch(error, { action: 'heartbeat-disconnect', sessionId })
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      this.unregister(sessionId)
    }

    sendToMainWindow(EVENT_CHANNEL.SESSION_DISCONNECTED, {
      sessionId,
      connectionId: handle.config.id,
      protocol: handle.protocolType,
      name: handle.config.name,
    })
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
