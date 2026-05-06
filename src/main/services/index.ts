export { SessionRegistry } from '../providers/session-registry.js'
export type { SessionHandle } from '../providers/session-registry.js'
export { providerSessionRegistry as sessionRegistry } from '../providers/session-registry.js'
export { SessionManager } from './session-manager.js'

import { protocolService } from '../protocol/protocol-service.js'
import { SessionManager } from './session-manager.js'
import { transferService } from './transfer/index.js'

protocolService.setHasActiveTasksChecker((sessionId) => transferService.hasActiveTasks(sessionId))

export const sessionManager = new SessionManager({
  disconnect: (sessionId) => protocolService.disconnect(sessionId),
  ping: (sessionId) => protocolService.ping(sessionId),
})

protocolService.setSessionOpenedHandler(() => sessionManager.startHeartbeat())
