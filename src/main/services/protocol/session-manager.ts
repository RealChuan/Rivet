import { type ConnectionConfig, type ProtocolType } from '@shared/types/index.js'

export interface SessionHandle<T = unknown> {
  client: T
  config: ConnectionConfig
  protocolType: ProtocolType
}

class SessionManager {
  private sessions = new Map<string, SessionHandle<unknown>>()

  register<T>(
    sessionId: string,
    client: T,
    config: ConnectionConfig,
    protocolType: ProtocolType
  ): void {
    this.sessions.set(sessionId, { client, config, protocolType })
  }

  unregister(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  get<T>(sessionId: string, protocolType: ProtocolType): SessionHandle<T> | undefined {
    const handle = this.sessions.get(sessionId)
    if (handle?.protocolType !== protocolType) {
      return undefined
    }
    return handle as SessionHandle<T>
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getByProtocol(
    protocolType: ProtocolType
  ): Array<{ sessionId: string; handle: SessionHandle<unknown> }> {
    const result: Array<{ sessionId: string; handle: SessionHandle<unknown> }> = []
    for (const [sessionId, handle] of this.sessions) {
      if (handle.protocolType === protocolType) {
        result.push({ sessionId, handle })
      }
    }
    return result
  }

  getAllIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  get count(): number {
    return this.sessions.size
  }

  clear(): void {
    this.sessions.clear()
  }
}

export const sessionManager = new SessionManager()
