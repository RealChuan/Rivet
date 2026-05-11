export interface ConnectionConfig {
  connectionUuid: string
  name: string
  protocol: 'sftp' | 'webdav'
  host: string
  port: number
  username: string
  password?: string
  basePath?: string
  scheme?: 'http' | 'https'
  rejectUnauthorized?: boolean
}
