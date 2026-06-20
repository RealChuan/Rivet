import { type ProtocolType } from '@shared/constants/index.js'
import { type ConnectionConfig } from '@shared/types/index.js'

export interface SessionHandle<T = unknown> {
  client: T
  config: ConnectionConfig
  protocolType: ProtocolType
  isClosing?: boolean
}

export class SessionRegistry {
  private sessions = new Map<string, SessionHandle<unknown>>()

  register<T>(
    sessionId: string,
    client: T,
    config: ConnectionConfig,
    protocolType: ProtocolType,
  ): void {
    this.sessions.set(sessionId, { client, config, protocolType })
  }

  unregister(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  get<T>(sessionId: string): SessionHandle<T> | undefined {
    return this.sessions.get(sessionId) as SessionHandle<T> | undefined
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getAllIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  get count(): number {
    return this.sessions.size
  }

  setClosing(sessionId: string): void {
    const handle = this.sessions.get(sessionId)
    if (handle) {
      handle.isClosing = true
    }
  }

  clear(): void {
    this.sessions.clear()
  }
}

export const sessionRegistry = new SessionRegistry()
