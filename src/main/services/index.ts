export { SessionRegistry } from '../providers/session-registry.js'
export type { SessionHandle } from '../providers/session-registry.js'
export { providerSessionRegistry as sessionRegistry } from '../providers/session-registry.js'
export { SessionManager } from './session-manager.js'
export { transferService } from './transfer/index.js'

import { protocolService } from '../protocol/protocol-service.js'
import { terminalService } from '../terminal/terminal-service.js'
import { SessionManager } from './session-manager.js'
import { transferService } from './transfer/index.js'

protocolService.setHasActiveTasksChecker((sessionId) => transferService.hasActiveTasks(sessionId))
// 主动断开与心跳掉线都要收掉终端：终端与本会话同生共死。
protocolService.setSessionClosedHandler((sessionId) => {
  transferService.cleanupSessionTasks(sessionId)
  terminalService.closeBySession(sessionId)
})

export const sessionManager = new SessionManager({
  disconnect: (sessionId) => protocolService.disconnect(sessionId),
  ping: (sessionId) => protocolService.ping(sessionId),
  closeTerminals: (sessionId) => terminalService.closeBySession(sessionId),
})

protocolService.setSessionOpenedHandler(() => sessionManager.startHeartbeat())
