import { logger } from '../utils/index.js'
import { setupAppIpcHandlers } from './app.js'
import { setupConfigIpcHandlers } from './config.js'
import { setupDialogIpcHandlers } from './dialog.js'
import { setupHostKeyIpcHandlers } from './host-key.js'
import { setupProtocolIpcHandlers } from './protocol.js'
import { setupSystemIpcHandlers } from './system.js'
import { setupTransferIpcHandlers } from './transfer.js'
import { setupWindowIpcHandlers } from './window.js'

export function setupIpcHandlers(): void {
  setupAppIpcHandlers()
  setupProtocolIpcHandlers()
  setupConfigIpcHandlers()
  setupDialogIpcHandlers()
  setupHostKeyIpcHandlers()
  setupSystemIpcHandlers()
  setupTransferIpcHandlers()
  setupWindowIpcHandlers()
  logger.info('All IPC handlers registered')
}
