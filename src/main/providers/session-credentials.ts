import type { Credentials } from '@shared/domain/credentials.js'

/**
 * 会话级已解密凭证：只在主进程内存，随会话生灭。未保存密码的连接不落盘，
 * 终端重连只能靠它；不导出给渲染层。
 */
export class SessionCredentialVault {
  private readonly entries = new Map<string, Credentials>()

  set(sessionId: string, credentials: Credentials): void {
    this.entries.set(sessionId, credentials)
  }

  get(sessionId: string): Credentials | undefined {
    return this.entries.get(sessionId)
  }

  delete(sessionId: string): void {
    this.entries.delete(sessionId)
  }

  get size(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }
}

export const sessionCredentials = new SessionCredentialVault()
