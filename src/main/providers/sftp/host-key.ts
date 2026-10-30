import { createHash } from 'node:crypto'
import { ERROR_CODE } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'
import { ssh2 } from './ssh2-module.js'

export interface ParsedHostKey {
  algorithm: string
  fingerprint: string
}

function fingerprintOf(blob: Buffer): string {
  const digest = createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')
  return `SHA256:${digest}`
}

/**
 * ssh2 在未设置 hostHash 时把原始 host key 以 Buffer 传给 hostVerifier；
 * 字符串形式（OpenSSH 公钥）用于测试与兜底。
 */
export function parseHostPublicKey(raw: string | Buffer): ParsedHostKey {
  if (typeof raw === 'string') {
    const [algorithm, encoded] = raw.trim().split(/\s+/)
    if (!algorithm || !encoded) {
      throw new ProviderError(ERROR_CODE.KEY_PARSE_FAILED, 'Malformed OpenSSH host key')
    }
    const blob = Buffer.from(encoded, 'base64')
    if (blob.length === 0) {
      throw new ProviderError(ERROR_CODE.KEY_PARSE_FAILED, 'Empty host key blob')
    }
    return { algorithm, fingerprint: fingerprintOf(blob) }
  }

  const parsed = ssh2.utils.parseKey(raw)
  if (!parsed || parsed instanceof Error) {
    throw new ProviderError(ERROR_CODE.KEY_PARSE_FAILED, 'Cannot parse host key buffer')
  }
  return { algorithm: parsed.type, fingerprint: fingerprintOf(raw) }
}
