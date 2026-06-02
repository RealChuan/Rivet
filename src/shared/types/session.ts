import type { FileInfo } from './file.js'

/**
 * 运行时会话状态
 * 一个 ConnectionConfig 创建后，通过 protocol.connect() 建立 Session
 */
export interface Session {
  sessionId: string
  connectionId: string
  currentPath: string
  files: FileInfo[]
  isConnected: boolean
  isLoading: boolean
  isOperating: boolean
  error: string | null
}
