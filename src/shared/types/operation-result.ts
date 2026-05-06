import type { Capabilities } from '../domain/entry.js'

/** 协议连接的返回值；主机密钥错误走 `AppError`，不再有状态码。 */
export interface OperationResult {
  sessionId: string
  capabilities: Capabilities
}
