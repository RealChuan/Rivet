import { setupProtocolIpcHandlers } from './protocol.js'
import { setupConfigIpcHandlers } from './config.js'
import { setupDialogIpcHandlers } from './dialog.js'
import { setupHostKeyIpcHandlers } from './host-key.js'
import { setupSystemIpcHandlers } from './system.js'
import { setupUtilsIpcHandlers } from './utils.js'
import { setupWindowIpcHandlers } from './window.js'
import { logger } from '../utils/index.js'

export function setupIpcHandlers(): void {
  setupProtocolIpcHandlers()
  setupConfigIpcHandlers()
  setupDialogIpcHandlers()
  setupHostKeyIpcHandlers()
  setupSystemIpcHandlers()
  setupUtilsIpcHandlers()
  setupWindowIpcHandlers()
  logger.info('All IPC handlers registered')
}
