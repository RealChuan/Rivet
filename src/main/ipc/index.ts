import { setupProtocolIpcHandlers } from './protocol-handlers.js'
import { setupCommonIpcHandlers } from './common-handlers.js'
import { logger } from '../utils/index.js'

export function setupIpcHandlers(): void {
  setupProtocolIpcHandlers()
  setupCommonIpcHandlers()
  logger.info('All IPC handlers registered')
}
