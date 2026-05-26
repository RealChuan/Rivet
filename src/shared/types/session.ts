import type { FileInfo } from './file.js'

/**
 * 运行时会话状态
 * 一个 ConnectionConfig 创建后，通过 protocol.connect() 建立 Session
 */
export interface Session {
  /** 协议层返回的会话 ID（由主进程生成） */
  sessionId: string
  /** 关联的连接配置 ID */
  connectionId: string
  /** 当前所在远程路径 */
  currentPath: string
  /** 当前目录下的文件列表 */
  files: FileInfo[]
  /** 是否已连接 */
  isConnected: boolean
  /** 是否正在加载目录 */
  isLoading: boolean
  /** 错误信息（null 表示无错误） */
  error: string | null
}
