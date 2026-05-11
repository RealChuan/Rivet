import { type ConnectionConfig } from '@shared/types/index.js'

export const activeConnections: Map<string, { sessionId: string; config: ConnectionConfig }> =
  new Map()

export const transferControllers: Map<string, AbortController> = new Map()
