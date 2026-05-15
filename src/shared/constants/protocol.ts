/**
 * SFTP 协议类型常量
 */
export const Protocol_SFTP = 'sftp' as const

/**
 * WebDAV 协议类型常量
 */
export const Protocol_WEBDAV = 'webdav' as const

/**
 * 协议类型联合类型
 */
export type ProtocolType = typeof Protocol_SFTP | typeof Protocol_WEBDAV
