import type { ProviderKind } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/index.js'
import type { FileProvider } from './types.js'

export interface SessionHandle {
  readonly provider: FileProvider
  readonly config: ConnectionConfig
  readonly protocolType: ProviderKind
  isClosing: boolean
}

/**
 * 只负责 `sessionId → FileProvider` 的映射与销毁。
 * 不再有 `unknown` client，也不再做类型擦除补偿。
 */
export class SessionRegistry {
  private sessions = new Map<string, SessionHandle>()

  register(sessionId: string, handle: SessionHandle): void {
    this.sessions.set(sessionId, handle)
  }

  unregister(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  get(sessionId: string): SessionHandle | undefined {
    return this.sessions.get(sessionId)
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

export const providerSessionRegistry = new SessionRegistry()
