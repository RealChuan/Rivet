import type { AppError } from '../domain/error.js'

/** 终端只对 SFTP 会话开放，`sessionId` 取自文件会话。 */
export interface OpenTerminalRequest {
  sessionId: string
  cols: number
  rows: number
  /** 打开后 `cd` 到该目录；缺省留在登录目录。 */
  cwd?: string
}

export type TerminalExitReason = 'exited' | 'closed' | 'error'

export interface TerminalExitInfo {
  terminalId: string
  reason: TerminalExitReason
  code?: number
  signal?: string
  error?: AppError
}
