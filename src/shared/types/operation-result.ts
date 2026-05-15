import type { StatusCode } from '../constants/protocol-status.js'

/**
 * SFTP 连接详情接口
 * 包含主机密钥指纹信息，用于 SSH 主机密钥验证
 */
export interface SftpConnectDetail {
  /** 当前连接的主机密钥指纹（SHA256 哈希） */
  fingerprint: string

  /** 之前保存的主机密钥指纹（用于检测密钥变更） */
  previousFingerprint?: string
}

/**
 * 操作结果接口
 * 用于封装协议操作（如连接）的返回结果
 */
export interface OperationResult {
  /**
   * 会话 ID
   * 连接成功时由主进程生成，失败时为空字符串
   */
  sessionId: string

  /**
   * 状态码
   * 表示操作的结果状态（如成功、首次连接、密钥不匹配等）
   */
  statusCode: StatusCode

  /** 连接详情（包含主机密钥指纹信息） */
  detail: SftpConnectDetail
}
