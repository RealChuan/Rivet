import { type ProtocolType } from '@shared/constants/protocol.js'

/**
 * 连接配置接口
 * 用于存储和管理远程服务器连接的配置信息
 *
 * @remarks
 * - 密码字段 (password) 仅在运行时使用，不持久化存储
 * - 密码通过 keytar 存储到系统凭据管理器
 * - connectionUuid 作为连接的唯一标识，同时用于 keytar 的存储键
 */
export interface ConnectionConfig {
  /** 连接唯一标识（UUID），用于区分不同连接 */
  connectionUuid: string

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

  /** 密码（运行时使用，不存储） */
  password?: string

  /** 是否保存密码到系统凭据管理器 */
  savePassword?: boolean

  /** WebDAV 基础路径（仅 WebDAV 协议使用） */
  basePath?: string

  /** WebDAV 协议类型（http/https），默认 https */
  scheme?: 'http' | 'https'

  /** 是否验证 SSL 证书（仅 WebDAV HTTPS 使用），默认 true */
  rejectUnauthorized?: boolean
}

/**
 * 不含密码的连接配置类型
 * 用于存储和传输配置时隐藏敏感信息
 */
export type ConnectionConfigWithoutPassword = Omit<ConnectionConfig, 'password'>
