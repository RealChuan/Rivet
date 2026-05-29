export const PROTOCOL = {
  SFTP: 'sftp',
  WEBDAV: 'webdav',
} as const

export type ProtocolType = (typeof PROTOCOL)[keyof typeof PROTOCOL]

export const SCHEME = {
  HTTP: 'http',
  HTTPS: 'https',
} as const

export type SchemeType = (typeof SCHEME)[keyof typeof SCHEME]

export const FILE_OPERATION = {
  COPY: 'copy',
  MOVE: 'move',
  DELETE: 'delete',
  RENAME: 'rename',
} as const

export type FileOperationType = (typeof FILE_OPERATION)[keyof typeof FILE_OPERATION]

export const PORT_SFTP = 22
export const PORT_WEBDAV_HTTP = 80
export const PORT_WEBDAV_HTTPS = 443
export const PORT_MAX = 65535
