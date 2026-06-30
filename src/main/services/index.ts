export * from './protocol/index.js'
export { SessionManager } from './session-manager.js'
export * from './session-registry.js'
export { sessionRegistry } from './session-registry.js'

import { protocolService } from './protocol/protocol-service.js'
import { SessionManager } from './session-manager.js'
import { transferService } from './transfer/index.js'

// 解耦注入：让 protocolService 能查询活跃任务，避免 protocol → transfer 反向依赖
protocolService.setHasActiveTasksChecker((sessionId) => transferService.hasActiveTasks(sessionId))

export const sessionManager = new SessionManager({
  disconnect: (sessionId) => protocolService.disconnect(sessionId),
  ping: (sessionId) => protocolService.ping(sessionId),
})
