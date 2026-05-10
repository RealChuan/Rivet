import { ConnectionConfig } from '../../shared/types.js'
import { setupProtocolIpcHandlers } from './protocol-ipc.js'
import { setupCommonIpcHandlers } from './common-ipc.js'
import logger from '../utils/logger.js'

export const activeConnections: Map<string, { sessionId: string; config: ConnectionConfig }> =
  new Map()
export const transferControllers: Map<string, AbortController> = new Map()

export function setupIpcHandlers(): void {
  setupProtocolIpcHandlers()
  setupCommonIpcHandlers()
  logger.info('All IPC handlers registered')
}
