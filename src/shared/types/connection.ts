export type ProtocolType = 'sftp' | 'webdav'

export interface ConnectionConfig {
  connectionUuid: string
  name: string
  protocol: ProtocolType
  host: string
  port: number
  username: string
  password?: string
  basePath?: string
  scheme?: 'http' | 'https'
  rejectUnauthorized?: boolean
}
