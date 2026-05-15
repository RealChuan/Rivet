/**
 * 超时时间常量定义（毫秒）
 */
export const TIMEOUTS = {
  /** 应用退出前的强制超时时间（10秒） */
  FORCE_EXIT: 10000,
  /** 心跳检测间隔（30秒） */
  HEARTBEAT_INTERVAL: 30000,
  /** 连接 Ping 超时时间（5秒） */
  PING: 5000,
  /** 断开连接超时时间（5秒） */
  DISCONNECT: 5000,
  /** SFTP 连接就绪超时时间（20秒） */
  SFTP_READY: 20000,
  /** HTTP/HTTPS Agent 超时时间（30秒） */
  AGENT: 30000,
  /** 错误 Toast 显示时长（6秒） */
  TOAST_ERROR_DURATION: 6000,
  /** 默认 Toast 显示时长（3秒） */
  TOAST_DEFAULT_DURATION: 3000,
} as const

/**
 * 超时时间键类型
 */
export type TimeoutKey = keyof typeof TIMEOUTS
