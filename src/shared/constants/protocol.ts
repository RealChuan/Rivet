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
export const PORT_WEBDAV_HTTPS = 443

/** 单次目录列举的上限。超过后截断并记录一条警告，UI 标注留给计划 3。 */
export const MAX_LIST_ENTRIES = 20000
