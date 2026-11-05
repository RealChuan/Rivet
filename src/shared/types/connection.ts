import { type ProtocolType, type SchemeType } from '@shared/constants/protocol.js'

export type AuthKind = 'password' | 'privateKey' | 'agent' | 'accessKey'

/**
 * 连接配置接口
 *
 * 秘密不进渲染层持久化：只保留 `secretRef`（指向 connections.json.secrets 的 key）。
 * `askPasswordOnConnect` 是读取时派生的运行时字段，不落盘。
 */
export interface ConnectionConfig {
  id: string
  name: string
  protocol: ProtocolType
  host: string
  port: number
  username: string
  /** 持久化时必填；旧记录/测试 fixture 缺省按 password 处理 */
  authKind?: AuthKind | undefined
  privateKeyPath?: string | undefined
  agentPath?: string | undefined
  secretRef?: string | undefined
  /** SMB 共享名（不含主机与斜杠） */
  share?: string | undefined
  /** SMB NTLM 域；工作组可留空 */
  domain?: string | undefined
  basePath?: string | undefined
  scheme?: SchemeType | undefined
  rejectUnauthorized?: boolean | undefined
  /** S3 桶名 */
  bucket?: string | undefined
  /** S3 区域；自建兼容服务通常填 us-east-1 */
  region?: string | undefined
  /** S3 寻址方式：true 为 path-style（R2/B2 等），false 为 virtual-host（AWS） */
  pathStyle?: boolean | undefined
  /** 运行时派生：密码认证且没有已存秘密 */
  askPasswordOnConnect?: boolean | undefined
}

export interface ConnectRequest {
  connection: ConnectionConfig
  secret?: string
  saveSecret?: boolean
}

export type ConnectionSaveInput = {
  connection: Omit<ConnectionConfig, 'id' | 'secretRef' | 'askPasswordOnConnect'>
  secret?: string
  saveSecret: boolean
}
