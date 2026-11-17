import type { AppError } from '../domain/error.js'

/** 终端只对 SFTP 会话开放，`sessionId` 取自文件会话。 */
export interface OpenTerminalRequest {
  /** 由渲染层按标签生成：标签身份即终端身份，重复 open 复用同一终端。 */
  terminalId: string
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
