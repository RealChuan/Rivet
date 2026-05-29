import { type ProtocolType, type SchemeType } from '@shared/constants/protocol.js'

/**
 * 连接配置接口
 * 用于存储和管理远程服务器连接的配置信息
 *
 * @remarks
 * - password 字段存储加密后的密码（base64 字符串），可安全传递和持久化
 * - 密码通过 safeStorage 加密，无需清除，可常驻内存
 * - id 作为连接的唯一标识
 */
export interface ConnectionConfig {
  /** 连接唯一标识（UUID），用于区分不同连接 */
  id: string

  /** 用户自定义的连接显示名称 */
  name: string

  /** 协议类型 */
  protocol: ProtocolType

  /** 服务器主机地址（IP 或域名） */
  host: string

  /** 服务器端口号 */
  port: number

  /** 登录用户名 */
  username: string

  /** 加密后的密码（base64 字符串），常驻内存 */
  password?: string

  /** 是否保存密码 */
  savePassword?: boolean

  /** WebDAV 基础路径（仅 WebDAV 协议使用） */
  basePath?: string

  /** WebDAV 协议类型（http/https），默认 https */
  scheme?: SchemeType

  /** 是否验证 SSL 证书（仅 WebDAV HTTPS 使用），默认 true */
  rejectUnauthorized?: boolean
}
