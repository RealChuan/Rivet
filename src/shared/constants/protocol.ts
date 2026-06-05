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
  LIST: 'list',
  MKDIR: 'mkdir',
  COPY: 'copy',
  MOVE: 'move',
  DELETE: 'delete',
  RENAME: 'rename',
  UPLOAD: 'upload',
  PING: 'ping',
} as const

export type FileOperationType = (typeof FILE_OPERATION)[keyof typeof FILE_OPERATION]

export const LOG_ACTION = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CLOSE_CONNECTION: 'close-connection',
  CHECK_TARGET_BEFORE_MOVE: 'check-target-before-move',
  DELETE_ABORTED_UPLOAD_REMNANT: 'delete-aborted-upload-remnant',
} as const

export const PORT_SFTP = 22
export const PORT_WEBDAV_HTTP = 80
export const PORT_WEBDAV_HTTPS = 443
export const PORT_MAX = 65535
