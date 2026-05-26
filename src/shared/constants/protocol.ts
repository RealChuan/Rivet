export const PROTOCOL_SFTP = 'sftp' as const
export const PROTOCOL_WEBDAV = 'webdav' as const

export type ProtocolType = typeof PROTOCOL_SFTP | typeof PROTOCOL_WEBDAV

export const PORT_SFTP = 22
export const PORT_WEBDAV_HTTP = 80
export const PORT_WEBDAV_HTTPS = 443
export const PORT_MAX = 65535

export const SCHEME_HTTP = 'http' as const
export const SCHEME_HTTPS = 'https' as const

export type SchemeType = typeof SCHEME_HTTP | typeof SCHEME_HTTPS
