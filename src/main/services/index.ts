export * from './protocol/index.js'
export { SessionManager } from './session-manager.js'
export * from './session-registry.js'
export { sessionRegistry } from './session-registry.js'

import { protocolService } from './protocol/protocol-service.js'
import { SessionManager } from './session-manager.js'

export const sessionManager = new SessionManager({
  disconnect: (sessionId) => protocolService.disconnect(sessionId),
  ping: (sessionId) => protocolService.ping(sessionId),
})
