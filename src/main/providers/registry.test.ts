import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { Capabilities, ProviderKind } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import type { FileProvider } from './types.js'
import type { WebdavHttpPort } from './webdav/http.js'
import { createProvider } from './registry.js'

const sftpConfig: ConnectionConfig = {
  id: 'c1',
  name: 'sftp',
  protocol: 'sftp',
  host: 'example.com',
  port: 22,
  username: 'u',
  authKind: 'password',
}

const webdavConfig: ConnectionConfig = {
  id: 'c2',
  name: 'dav',
  protocol: 'webdav',
  host: 'dav.example.com',
  port: 443,
  username: 'u',
  scheme: 'https',
  authKind: 'password',
}

const capabilities: Capabilities = {
  chmod: false,
  symlink: false,
  serverSideCopy: true,
  serverSideMove: true,
  atomicRename: true,
  dirIsEntity: true,
  caseSensitive: false,
}

function createFakeProvider(): FileProvider {
  return {
    kind: 'webdav',
    capabilities,
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    list: async function* () {},
    stat: () => Promise.resolve({ name: 'a', kind: 'file', size: 0, mtime: 0, path: '/a' }),
    mkdir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    rename: () => Promise.resolve(),
    copy: () => Promise.resolve(),
    openRead: () =>
      Promise.resolve({
        stream: Readable.toWeb(Readable.from([])) as ReadableStream<Uint8Array>,
        close: () => Promise.resolve(),
      }),
    openWrite: () =>
      Promise.resolve({
        stream: new WritableStream<Uint8Array>(),
        commit: () => Promise.resolve(),
        abort: () => Promise.resolve(),
      }),
  }
}

describe('createProvider', () => {
  it('sftp 与 webdav 分别返回对应 kind', () => {
    expect(createProvider('sftp', { config: sftpConfig }).kind).toBe('sftp')
    expect(createProvider('webdav', { config: webdavConfig }).kind).toBe('webdav')
  })

  it('webdav 使用注入的 createHttp', async () => {
    const close = vi.fn(() => Promise.resolve())
    const port: WebdavHttpPort = {
      request: vi.fn(),
      close,
    }
    const createHttp = vi.fn((_credentials: Credentials) => port)
    const provider = createProvider('webdav', { config: webdavConfig, createHttp })

    await provider.connect({ kind: 'password', username: 'u', password: 'p' })
    expect(createHttp).toHaveBeenCalledTimes(1)
    await provider.disconnect()
    expect(close).toHaveBeenCalled()
  })

  it('webdav 非密码认证抛 INVALID_CONFIG', () => {
    expect(() =>
      createProvider('webdav', {
        config: { ...webdavConfig, authKind: 'agent' },
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_CONFIG' }))
  })

  it('运行时未知 kind 抛 NOT_SUPPORTED', () => {
    try {
      createProvider('smb' as ProviderKind, { config: sftpConfig })
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ code: 'NOT_SUPPORTED' })
    }
  })

  it('fake provider 满足 FileProvider 结构', () => {
    const provider: FileProvider = createFakeProvider()
    expect(provider.capabilities.dirIsEntity).toBe(true)
  })
})
