import {
  PORT_SFTP,
  PORT_SMB,
  PORT_WEBDAV_HTTPS,
  PROTOCOL,
  SCHEME,
  type ProtocolType,
  type SchemeType,
} from '@shared/constants/index.js'

/** 从地址串里能还原出来的连接字段；端口用字符串，直接对齐表单。 */
export interface ParsedConnectionAddress {
  protocol: ProtocolType
  host: string
  port: string
  username: string
  /** 仅 SMB：地址里的第一个路径段是共享名 */
  share?: string
  /** 仅 WebDAV：地址里的路径是连接根 */
  basePath?: string
  /** 仅 WebDAV：`webdav://` 是 http，`webdavs://` 是 https */
  scheme?: SchemeType
}

interface SchemeRule {
  protocol: ProtocolType
  defaultPort: number
  scheme?: SchemeType
}

/**
 * `s3://bucket/key` 里没有 endpoint，无法还原成一条能用的连接，因此不列在这里。
 */
const SCHEME_RULES: Record<string, SchemeRule> = {
  sftp: { protocol: PROTOCOL.SFTP, defaultPort: PORT_SFTP },
  smb: { protocol: PROTOCOL.SMB, defaultPort: PORT_SMB },
  webdav: { protocol: PROTOCOL.WEBDAV, defaultPort: 80, scheme: SCHEME.HTTP },
  dav: { protocol: PROTOCOL.WEBDAV, defaultPort: 80, scheme: SCHEME.HTTP },
  webdavs: { protocol: PROTOCOL.WEBDAV, defaultPort: PORT_WEBDAV_HTTPS, scheme: SCHEME.HTTPS },
  davs: { protocol: PROTOCOL.WEBDAV, defaultPort: PORT_WEBDAV_HTTPS, scheme: SCHEME.HTTPS },
}

const ADDRESS_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i

/** `[user[:password]@]host[:port]`；IPv6 允许方括号。 */
function splitAuthority(authority: string): { username: string; host: string; port: string } {
  const at = authority.lastIndexOf('@')
  const userInfo = at < 0 ? '' : authority.slice(0, at)
  const hostPort = at < 0 ? authority : authority.slice(at + 1)
  const username = userInfo.split(':')[0] ?? ''

  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']')
    if (end < 0) return { username, host: '', port: '' }
    const rest = hostPort.slice(end + 1)
    return {
      username,
      host: hostPort.slice(1, end),
      port: rest.startsWith(':') ? rest.slice(1) : '',
    }
  }

  const colon = hostPort.lastIndexOf(':')
  if (colon < 0) return { username, host: hostPort, port: '' }
  return { username, host: hostPort.slice(0, colon), port: hostPort.slice(colon + 1) }
}

function normalizePort(raw: string, fallback: number): string {
  const port = Number.parseInt(raw, 10)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? String(port) : String(fallback)
}

function decodePath(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/**
 * 把聊天或文档里粘来的地址还原成连接表单字段。
 * 认不出来就返回 `null`——调用方据此提示，而不是塞一个半残的表单。
 */
export function parseConnectionAddress(raw: string): ParsedConnectionAddress | null {
  const match = ADDRESS_PATTERN.exec(raw.trim())
  if (!match) return null

  const rule = SCHEME_RULES[(match[1] ?? '').toLowerCase()]
  if (!rule) return null

  const { username, host, port } = splitAuthority(match[2] ?? '')
  if (host.length === 0) return null

  const segments = decodePath(match[3] ?? '')
    .split('/')
    .filter((segment) => segment.length > 0)

  const base: ParsedConnectionAddress = {
    protocol: rule.protocol,
    host,
    port: normalizePort(port, rule.defaultPort),
    username,
  }

  if (rule.scheme) base.scheme = rule.scheme

  if (rule.protocol === PROTOCOL.SMB) {
    const share = segments[0]
    return share === undefined ? base : { ...base, share }
  }

  if (rule.protocol === PROTOCOL.WEBDAV) {
    return segments.length === 0 ? base : { ...base, basePath: `/${segments.join('/')}` }
  }

  // SFTP 的根由用户名决定，地址里的路径没有对应字段可回填。
  return base
}
