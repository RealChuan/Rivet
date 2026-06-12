/**
 * 协议操作状态码常量定义
 *
 * 状态码范围：
 * - 2000-2999: 成功状态
 * - 3000-3999: SFTP 特定状态
 * - 5000-5999: 内部错误状态
 */

/**
 * 协议通用状态码
 */
export const ProtocolStatus = {
  /** 操作成功 */
  OK: 2000,
  /** 首次连接（需要确认主机密钥） */
  FIRST_CONNECT: 2001,
} as const

/**
 * SFTP 特定状态码
 */
export const SftpStatus = {
  /** 主机密钥不匹配（可能存在安全风险） */
  HOST_KEY_MISMATCH: 3000,
} as const

/**
 * 状态码类型定义
 */
export type StatusCode =
  | (typeof ProtocolStatus)[keyof typeof ProtocolStatus]
  | (typeof SftpStatus)[keyof typeof SftpStatus]

/**
 * 获取状态码对应的国际化消息键
 * @param code - 状态码
 * @returns 国际化消息键
 */
export function getStatusMessage(code: StatusCode): string {
  const messages: Record<StatusCode, string> = {
    [ProtocolStatus.OK]: 'connection.ok',
    [ProtocolStatus.FIRST_CONNECT]: 'connection.firstConnect',
    [SftpStatus.HOST_KEY_MISMATCH]: 'connection.hostKeyMismatch',
  }
  return messages[code] ?? `Unknown status: ${code}`
}
