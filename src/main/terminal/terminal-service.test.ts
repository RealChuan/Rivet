/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/index.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { SessionHandle } from '../providers/session-registry.js'
import { createFakeProvider } from '../providers/test-utils/fake-provider.js'
import { TerminalService, type TerminalSessionLike } from './terminal-service.js'

const config: ConnectionConfig = {
  id: 'conn-1',
  name: 'Test',
  protocol: 'sftp',
  host: 'localhost',
  port: 22,
  username: 'user',
}

const credentials: Credentials = { kind: 'password', username: 'user', password: 'secret' }

function handleOf(protocolType: 'sftp' | 'webdav' = 'sftp'): SessionHandle {
  return {
    provider: createFakeProvider(protocolType),
    config,
    protocolType,
    isClosing: false,
  }
}

function stubSession(overrides: Partial<TerminalSessionLike> = {}): TerminalSessionLike {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    resize: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const request = { sessionId: 'session-1', cols: 80, rows: 24 }

type CreateSession = (
  id: string,
  config: ConnectionConfig,
  credentials: Credentials,
) => TerminalSessionLike

describe('TerminalService', () => {
  let sessions: Map<string, SessionHandle>
  let createSession: Mock<CreateSession>
  let service: TerminalService

  beforeEach(() => {
    sessions = new Map([['session-1', handleOf()]])
    createSession = vi.fn<CreateSession>(() => stubSession())
    service = new TerminalService({
      createSession: (id, cfg, creds) => createSession(id, cfg, creds),
      getSession: (sessionId) => sessions.get(sessionId),
      getCredentials: (sessionId) => (sessionId === 'session-1' ? credentials : undefined),
    })
  })

  it('非 SFTP 会话拒绝开终端', async () => {
    sessions.set('session-2', handleOf('webdav'))
    const result = await service.open({ ...request, sessionId: 'session-2' })

    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.code).toBe(ERROR_CODE.TERMINAL_NOT_SUPPORTED)
  })

  it('会话不存在时返回 SESSION_NOT_FOUND', async () => {
    const result = await service.open({ ...request, sessionId: 'missing' })

    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.code).toBe(ERROR_CODE.SESSION_NOT_FOUND)
  })

  it('没有缓存凭证时拒绝开终端', async () => {
    sessions.set('session-2', handleOf())
    const result = await service.open({ ...request, sessionId: 'session-2' })

    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.code).toBe(ERROR_CODE.TERMINAL_OPEN_FAILED)
  })

  it('同一会话重复 open 返回同一个 terminalId', async () => {
    const first = await service.open(request)
    const second = await service.open(request)

    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(second.value.terminalId).toBe(first.value.terminalId)
    expect(createSession).toHaveBeenCalledTimes(1)
  })

  it('closeBySession 关闭该会话的终端并清空映射', async () => {
    const session = stubSession()
    createSession.mockReturnValue(session)

    const opened = await service.open(request)
    expect(opened.success).toBe(true)

    service.closeBySession('session-1')
    expect(session.close).toHaveBeenCalledTimes(1)

    const again = await service.open(request)
    expect(again.success).toBe(true)
    expect(createSession).toHaveBeenCalledTimes(2)
  })

  it('未知 terminalId 的写入被静默忽略', () => {
    expect(() => service.write('nope', new Uint8Array([1]))).not.toThrow()
    expect(() => service.resize('nope', 80, 24)).not.toThrow()
  })

  it('未知 terminalId 的 close 幂等返回成功', async () => {
    const result = await service.close('nope')
    expect(result.success).toBe(true)
  })

  it('open 失败时不登记终端', async () => {
    const session = stubSession({ open: vi.fn().mockRejectedValue(new Error('boom')) })
    createSession.mockReturnValue(session)

    const result = await service.open(request)
    expect(result.success).toBe(false)

    service.closeBySession('session-1')
    expect(session.close).not.toHaveBeenCalled()
  })
})
