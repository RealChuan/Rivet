import {
  PROGRESS_BATCH_MS,
  TRANSFER_DIRECTION,
  type TransferDirection,
} from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { sendToMainWindow } from '../../app/main-window.js'
import { notifyTransferFinished } from '../../app/notifications.js'
import { providerSessionRegistry } from '../../providers/session-registry.js'
import { getTransferSettings } from '../../stores/index.js'
import { FileTransferExecutor } from '../../transfer/executor.js'
import { nodeLocalFs } from '../../transfer/local-fs.js'
import { ProgressAggregator } from '../../transfer/progress-aggregator.js'
import { TransferRateLimiter } from '../../transfer/rate-limiter.js'
import { cleanupLocalTemps } from '../../transfer/temp-cleanup.js'
import { TransferService } from '../../transfer/transfer-service.js'
import { logger } from '../../utils/index.js'

const progress = new ProgressAggregator({
  flushMs: PROGRESS_BATCH_MS,
  send: (batch) => sendToMainWindow(EVENT_CHANNEL.PROGRESS, batch),
})

/** 同一方向的并发任务共享一份配额。 */
const rateLimiters: Record<TransferDirection, TransferRateLimiter> = {
  [TRANSFER_DIRECTION.UPLOAD]: new TransferRateLimiter(),
  [TRANSFER_DIRECTION.DOWNLOAD]: new TransferRateLimiter(),
}

export const transferService = new TransferService({
  getProvider: (sessionId) => providerSessionRegistry.get(sessionId)?.provider,
  executor: new FileTransferExecutor({
    getProvider: (sessionId) => providerSessionRegistry.get(sessionId)?.provider,
    localFs: nodeLocalFs,
    rateLimiters,
  }),
  localFs: nodeLocalFs,
  send: (channel, payload) =>
    sendToMainWindow(channel as (typeof EVENT_CHANNEL)[keyof typeof EVENT_CHANNEL], payload),
  progress,
  notify: notifyTransferFinished,
  cleanupLocalTemps: (task) =>
    cleanupLocalTemps(nodeLocalFs, task).catch((error: unknown) => {
      logger.catch(error, { action: 'cleanup-local-temps', taskId: task.id })
    }),
})

export function applyPersistedConcurrency(): void {
  const settings = getTransferSettings()
  transferService.setConcurrency(settings.maxUploadConcurrency, TRANSFER_DIRECTION.UPLOAD)
  transferService.setConcurrency(settings.maxDownloadConcurrency, TRANSFER_DIRECTION.DOWNLOAD)
}

export function getTransferSpeedLimit(direction: TransferDirection): number {
  return rateLimiters[direction].bytesPerSecond
}

/** 返回实际生效的值（已夹到 0..MAX_SPEED_LIMIT），调用方据此持久化。 */
export function setTransferSpeedLimit(
  direction: TransferDirection,
  bytesPerSecond: number,
): number {
  rateLimiters[direction].setBytesPerSecond(bytesPerSecond)
  return rateLimiters[direction].bytesPerSecond
}

export function applyPersistedSpeedLimits(): void {
  const settings = getTransferSettings()
  setTransferSpeedLimit(TRANSFER_DIRECTION.UPLOAD, settings.maxUploadBytesPerSecond)
  setTransferSpeedLimit(TRANSFER_DIRECTION.DOWNLOAD, settings.maxDownloadBytesPerSecond)
}

export { TransferService }
