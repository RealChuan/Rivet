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
    // 类型安全保证：register<T> 时调用方已通过 protocol 实例的泛型参数约束 T
    // Map 运行时存储为 unknown，泛型 T 在编译期被擦除，此处断言是不可避免的类型擦除补偿
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
