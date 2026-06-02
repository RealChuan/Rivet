import { logger } from '../utils/index.js'
import { setupConfigIpcHandlers } from './config.js'
import { setupCryptoIpcHandlers } from './crypto.js'
import { setupDialogIpcHandlers } from './dialog.js'
import { setupHostKeyIpcHandlers } from './host-key.js'
import { setupProtocolIpcHandlers } from './protocol.js'
import { setupSystemIpcHandlers } from './system.js'
import { setupTransferIpcHandlers } from './transfer.js'
import { setupWindowIpcHandlers } from './window.js'

export function setupIpcHandlers(): void {
  setupProtocolIpcHandlers()
  setupConfigIpcHandlers()
  setupDialogIpcHandlers()
  setupHostKeyIpcHandlers()
  setupSystemIpcHandlers()
  setupCryptoIpcHandlers()
  setupWindowIpcHandlers()
  setupTransferIpcHandlers()
  logger.info('All IPC handlers registered')
}
