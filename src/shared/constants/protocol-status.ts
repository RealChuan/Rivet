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
 * 内部错误状态码
 */
export const InternalStatus = {
  /** 存储操作失败 */
  STORE_ERROR: 5000,
} as const

/**
 * 所有状态码的联合枚举
 */
export const StatusCodeEnum = {
  ...ProtocolStatus,
  ...SftpStatus,
  ...InternalStatus,
} as const

/**
 * 状态码类型定义
 */
export type StatusCode = (typeof StatusCodeEnum)[keyof typeof StatusCodeEnum]

/**
 * 获取状态码对应的国际化消息键
 * @param code - 状态码
 * @returns 国际化消息键
 */
export function getStatusMessage(code: StatusCode): string {
  const messages: Record<number, string> = {
    2000: 'connection.ok',
    2001: 'connection.firstConnect',
    3000: 'connection.hostKeyMismatch',
    5000: 'connection.storeError',
  }
  return messages[code] ?? `Unknown status: ${code}`
}
