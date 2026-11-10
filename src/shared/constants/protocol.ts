export const PROTOCOL = {
  SFTP: 'sftp',
  SMB: 'smb',
  WEBDAV: 'webdav',
  S3: 's3',
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
  DOWNLOAD: 'download',
  PING: 'ping',
} as const

export const LOG_ACTION = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CLOSE_CONNECTION: 'close-connection',
  CHECK_TARGET_BEFORE_MOVE: 'check-target-before-move',
  DELETE_ABORTED_UPLOAD_REMNANT: 'delete-aborted-upload-remnant',
} as const

export const PORT_SFTP = 22
export const PORT_SMB = 445
export const PORT_WEBDAV_HTTP = 80
export const PORT_WEBDAV_HTTPS = 443
export const PORT_S3 = 443

/** 单次目录列举的默认上限，也是「加载更多」的步长：点一次多列一页。 */
export const MAX_LIST_ENTRIES = 20000
