import { PROGRESS_BATCH_MS, TRANSFER_DIRECTION } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { sendToMainWindow } from '../../app/main-window.js'
import { providerSessionRegistry } from '../../providers/session-registry.js'
import { getTransferSettings } from '../../stores/index.js'
import { FileTransferExecutor } from '../../transfer/executor.js'
import { nodeLocalFs } from '../../transfer/local-fs.js'
import { ProgressAggregator } from '../../transfer/progress-aggregator.js'
import { TransferService } from '../../transfer/transfer-service.js'

const progress = new ProgressAggregator({
  flushMs: PROGRESS_BATCH_MS,
  send: (batch) => sendToMainWindow(EVENT_CHANNEL.PROGRESS, batch),
})

export const transferService = new TransferService({
  getProvider: (sessionId) => providerSessionRegistry.get(sessionId)?.provider,
  executor: new FileTransferExecutor({
    getProvider: (sessionId) => providerSessionRegistry.get(sessionId)?.provider,
    localFs: nodeLocalFs,
  }),
  localFs: nodeLocalFs,
  send: (channel, payload) =>
    sendToMainWindow(channel as (typeof EVENT_CHANNEL)[keyof typeof EVENT_CHANNEL], payload),
  progress,
})

export function applyPersistedConcurrency(): void {
  const settings = getTransferSettings()
  transferService.setConcurrency(settings.maxUploadConcurrency, TRANSFER_DIRECTION.UPLOAD)
  transferService.setConcurrency(settings.maxDownloadConcurrency, TRANSFER_DIRECTION.DOWNLOAD)
}

export { TransferService }
