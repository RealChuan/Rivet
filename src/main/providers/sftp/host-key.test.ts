import { createHash } from 'node:crypto'
import { utils } from 'ssh2'
import { describe, expect, it } from 'vitest'
import { parseHostPublicKey } from './host-key.js'

const { public: publicKey } = utils.generateKeyPairSync('ed25519')
const encoded = publicKey.split(' ')[1] ?? ''
const blob = Buffer.from(encoded, 'base64')
const expectedFingerprint = `SHA256:${createHash('sha256')
  .update(blob)
  .digest('base64')
  .replace(/=+$/, '')}`

describe('parseHostPublicKey', () => {
  it('parses an OpenSSH public key string', () => {
    expect(parseHostPublicKey(publicKey)).toEqual({
      algorithm: 'ssh-ed25519',
      fingerprint: expectedFingerprint,
    })
  })

  it('parses the raw Buffer form used by ssh2.hostVerifier', () => {
    expect(parseHostPublicKey(blob)).toEqual({
      algorithm: 'ssh-ed25519',
      fingerprint: expectedFingerprint,
    })
  })

  it('rejects a malformed key', () => {
    expect(() => parseHostPublicKey('not-a-key')).toThrow()
    expect(() => parseHostPublicKey(Buffer.from('garbage'))).toThrow()
  })
})
