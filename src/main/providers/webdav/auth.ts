import crypto from 'node:crypto'
import { ERROR_CODE } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'

export interface DigestChallenge {
  realm: string
  nonce: string
  qop?: string
  opaque?: string
  algorithm?: string
}

export interface DigestParams {
  method: string
  uri: string
  username: string
  password: string
  nc: string
  cnonce: string
}

function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex')
}

export function buildBasicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

export function parseDigestChallenge(header: string): DigestChallenge | null {
  if (!header.startsWith('Digest ')) return null

  const values = new Map<string, string>()
  const pattern = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g

  for (const match of header.slice(7).matchAll(pattern)) {
    const key = match[1]?.toLowerCase()
    if (!key) continue
    values.set(key, match[2] ?? match[3] ?? '')
  }

  const realm = values.get('realm')
  const nonce = values.get('nonce')
  if (!realm || !nonce) return null

  const qop = values.get('qop')
  const opaque = values.get('opaque')
  const algorithm = values.get('algorithm')

  return {
    realm,
    nonce,
    ...(qop !== undefined ? { qop } : {}),
    ...(opaque !== undefined ? { opaque } : {}),
    ...(algorithm !== undefined ? { algorithm } : {}),
  }
}

/**
 * 只支持 MD5 / MD5-sess 与 qop=auth（无 qop 时兼容 RFC 2069）。
 */
export function buildDigestAuthorization(challenge: DigestChallenge, params: DigestParams): string {
  const algorithm = (challenge.algorithm ?? 'MD5').toUpperCase()
  if (algorithm !== 'MD5' && algorithm !== 'MD5-SESS') {
    throw new ProviderError(ERROR_CODE.AUTH_ERROR, `unsupported digest algorithm: ${algorithm}`)
  }

  const qopList = (challenge.qop ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const qop = qopList.length > 0 ? (qopList.includes('auth') ? 'auth' : undefined) : undefined
  if (qopList.length > 0 && qop === undefined) {
    throw new ProviderError(ERROR_CODE.AUTH_ERROR, 'digest qop=auth is required')
  }

  const ha1Base = md5(`${params.username}:${challenge.realm}:${params.password}`)
  const ha1 =
    algorithm === 'MD5-SESS' ? md5(`${ha1Base}:${challenge.nonce}:${params.cnonce}`) : ha1Base
  const ha2 = md5(`${params.method}:${params.uri}`)

  const response =
    qop !== undefined
      ? md5(`${ha1}:${challenge.nonce}:${params.nc}:${params.cnonce}:${qop}:${ha2}`)
      : md5(`${ha1}:${challenge.nonce}:${ha2}`)

  const parts = [
    `username="${params.username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${params.uri}"`,
    `response="${response}"`,
    `algorithm=${algorithm}`,
  ]

  if (qop !== undefined) {
    parts.push(`qop=${qop}`, `nc=${params.nc}`, `cnonce="${params.cnonce}"`)
  }
  if (challenge.opaque !== undefined) {
    parts.push(`opaque="${challenge.opaque}"`)
  }

  return `Digest ${parts.join(', ')}`
}
