import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import { TIMEOUTS } from '@shared/constants/index.js'
import { buildSshAuthConfig, mapSshAuthError, resolveAgentPath } from './auth.js'

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rivet-key-'))
})

afterEach(async () => {
  await fs.promises.rm(tempDir, { recursive: true, force: true })
})

describe('buildSshAuthConfig', () => {
  it('密码认证直接传递用户名与密码', async () => {
    const config = await buildSshAuthConfig({
      kind: 'password',
      username: 'alice',
      password: 'secret',
    })

    expect(config).toEqual({
      username: 'alice',
      password: 'secret',
      readyTimeout: TIMEOUTS.SFTP_READY,
    })
  })

  it('私钥认证读取文件路径并保留 passphrase', async () => {
    const keyPath = path.join(tempDir, 'id_ed25519')
    await fs.promises.writeFile(keyPath, 'PEM CONTENT')

    const config = await buildSshAuthConfig({
      kind: 'privateKey',
      username: 'alice',
      privateKeyPath: keyPath,
      passphrase: 'p@ss',
    })

    expect(config.privateKey?.toString()).toBe('PEM CONTENT')
    expect(config.passphrase).toBe('p@ss')
    expect(config.password).toBeUndefined()
  })

  it('私钥文件不存在时抛 KEY_FILE_UNREADABLE', async () => {
    await expect(
      buildSshAuthConfig({
        kind: 'privateKey',
        username: 'alice',
        privateKeyPath: path.join(tempDir, 'missing'),
      }),
    ).rejects.toMatchObject({ code: 'KEY_FILE_UNREADABLE' })
  })

  it('agent 认证使用解析后的路径', async () => {
    const config = await buildSshAuthConfig({
      kind: 'agent',
      username: 'alice',
      agentPath: '/tmp/custom-agent',
    })

    expect(config.agent).toBe('/tmp/custom-agent')
  })
})

describe('resolveAgentPath', () => {
  it('Windows 默认使用 OpenSSH agent 管道', () => {
    expect(resolveAgentPath(undefined, 'win32', {})).toBe('\\\\.\\pipe\\openssh-ssh-agent')
  })

  it('POSIX 优先使用 SSH_AUTH_SOCK', () => {
    expect(resolveAgentPath(undefined, 'linux', { SSH_AUTH_SOCK: '/tmp/agent.sock' })).toBe(
      '/tmp/agent.sock',
    )
  })

  it('POSIX 缺少 SSH_AUTH_SOCK 时抛 AGENT_NOT_AVAILABLE', () => {
    try {
      resolveAgentPath(undefined, 'linux', {})
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ code: 'AGENT_NOT_AVAILABLE' })
    }
  })

  it('显式路径覆盖默认值', () => {
    expect(resolveAgentPath('/custom', 'linux', { SSH_AUTH_SOCK: '/tmp/agent.sock' })).toBe(
      '/custom',
    )
  })
})

describe('mapSshAuthError', () => {
  const cases: Array<[string, Credentials['kind'], string]> = [
    ['Cannot parse privateKey: Bad passphrase?', 'privateKey', 'PASSPHRASE_REQUIRED'],
    ['Cannot parse privateKey: Unsupported key format', 'privateKey', 'KEY_PARSE_FAILED'],
    ['All configured authentication methods failed', 'agent', 'AGENT_NO_IDENTITY'],
  ]

  it.each(cases)('%s → %s', (message, kind, code) => {
    expect(mapSshAuthError(new Error(message), kind)).toMatchObject({ code })
  })

  it('无法分类时回退 CONN_FAILED', () => {
    expect(mapSshAuthError(new Error('socket hang up'), 'password')).toMatchObject({
      code: 'CONN_FAILED',
    })
  })
})
