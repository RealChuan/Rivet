/**
 * 运行时会话状态
 * 一个 ConnectionConfig 创建后，通过 protocol.connect() 建立 Session
 *
 * 目录内容、加载态与错误属于远端状态，由 TanStack Query 的目录缓存持有，
 * 不进入会话对象。
 */
export interface Session {
  sessionId: string
  connectionId: string
  currentPath: string
  isConnected: boolean
  isOperating: boolean
}
