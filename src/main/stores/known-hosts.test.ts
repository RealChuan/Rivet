/* eslint-disable @typescript-eslint/consistent-type-imports -- typeof import() 用于取模块类型 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/index.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), catch: vi.fn() },
}))

describe('known-hosts store', () => {
  let dir: string
  let getKnownHost: typeof import('./known-hosts.js').getKnownHost
  let trustHostKey: typeof import('./known-hosts.js').trustHostKey
  let disposeKnownHosts: typeof import('./known-hosts.js').disposeKnownHosts

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'rivet-known-hosts-'))
    const module = await import('./known-hosts.js')
    module.initializeKnownHosts(dir)
    getKnownHost = module.getKnownHost
    trustHostKey = module.trustHostKey
    disposeKnownHosts = module.disposeKnownHosts
  })

  afterEach(async () => {
    await disposeKnownHosts()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns undefined when no host matches', () => {
    const result = getKnownHost('example.com', 22, 'ssh-ed25519')

    expect(result.success).toBe(true)
    if (result.success) expect(result.value).toBeUndefined()
  })

  it('trusts and reads a host key with normalized host', () => {
    const trusted = trustHostKey({
      host: 'Example.COM',
      port: 22,
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:abc',
    })

    expect(trusted.success).toBe(true)
    const found = getKnownHost('example.com', 22, 'ssh-ed25519')
    expect(found.success).toBe(true)
    if (found.success) {
      expect(found.value).toMatchObject({
        host: 'example.com',
        port: 22,
        algorithm: 'ssh-ed25519',
        fingerprint: 'SHA256:abc',
      })
    }
  })

  it('replaces the same host/port/algorithm and keeps other algorithms separate', () => {
    trustHostKey({
      host: 'example.com',
      port: 22,
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:old',
    })
    trustHostKey({
      host: 'example.com',
      port: 22,
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:new',
    })
    trustHostKey({
      host: 'example.com',
      port: 22,
      algorithm: 'ssh-rsa',
      fingerprint: 'SHA256:rsa',
    })

    const ed = getKnownHost('example.com', 22, 'ssh-ed25519')
    const rsa = getKnownHost('example.com', 22, 'ssh-rsa')
    if (ed.success) expect(ed.value?.fingerprint).toBe('SHA256:new')
    if (rsa.success) expect(rsa.value?.fingerprint).toBe('SHA256:rsa')
  })
})
