import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { PROTOCOL, TIMEOUTS } from '@shared/constants/index.js'
import { err, type ErrorInfo, ok, type Result } from '@shared/types/result.js'
import { AbstractProtocol, type SessionInfo } from './abstract-protocol.js'

vi.mock('@main/utils/index.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), catch: vi.fn() },
}))

class TestableProtocol extends AbstractProtocol<{ id: string }> {
  readonly protocolType = PROTOCOL.SFTP
  private sessions = new Map<string, SessionInfo<{ id: string }>>()

  connect = vi.fn()
  disconnect = vi.fn()

  listImpl = vi.fn()
  mkdirImpl = vi.fn()
  renameImpl = vi.fn()
  deleteImpl = vi.fn()
  copyImpl = vi.fn()
  moveImpl = vi.fn()
  uploadImpl = vi.fn()
  downloadImpl = vi.fn()
  pingImpl = vi.fn()

  protected getSessionInfo(sessionId: string): SessionInfo<{ id: string }> | null {
    return this.sessions.get(sessionId) ?? null
  }
  protected setSessionClosing(sessionId: string): void {
    const info = this.sessions.get(sessionId)
    if (info) info.isClosing = true
  }

  addSession(sessionId: string, client: { id: string }, basePath: string): void {
    this.sessions.set(sessionId, { client, basePath, isClosing: false })
  }
  setSessionClosingState(sessionId: string): void {
    const info = this.sessions.get(sessionId)
    if (info) info.isClosing = true
  }
}

const { logger } = vi.mocked(await import('@main/utils/index.js'))

describe('AbstractProtocol', () => {
  let protocol: TestableProtocol

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    protocol = new TestableProtocol()
  })

  describe('getClient', () => {
    it('should return SESSION_NOT_FOUND when session does not exist', () => {
      const result = protocol['getClient']('non-existent')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('SESSION_NOT_FOUND')
    })

    it('should return SESSION_CLOSING when session is closing', () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.setSessionClosingState('s1')
      const result = protocol['getClient']('s1')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('SESSION_CLOSING')
    })

    it('should return ok(client) for a valid session', () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      const result = protocol['getClient']('s1')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value).toEqual({ id: 'c1' })
    })
  })

  describe('getBasePath', () => {
    it('should return empty string when session not found', () => {
      expect(protocol['getBasePath']('non-existent')).toBe('')
    })

    it('should return basePath for a valid session', () => {
      protocol.addSession('s1', { id: 'c1' }, '/home/user')
      expect(protocol['getBasePath']('s1')).toBe('/home/user')
    })
  })

  describe('list', () => {
    const files: FileInfo[] = [
      { name: 'a.txt', type: 'file', size: 100, modifyTime: 0, absolutePath: '/base/a.txt' },
    ]

    it('should return file list on success', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.listImpl.mockImplementation(() => ok(files))
      const result = await protocol.list('s1', '/some/path')
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.value).toEqual(files)
    })

    it('should return error when session not found', async () => {
      const result = await protocol.list('non-existent', '/path')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('SESSION_NOT_FOUND')
    })

    it('should pass sanitizedPath and basePath to listImpl', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.listImpl.mockImplementation(() => ok([]))
      await protocol.list('s1', '/some/path')
      expect(protocol.listImpl).toHaveBeenCalledWith({ id: 'c1' }, '/some/path', '/base')
    })

    it('should log error via logger.warn on failure', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      const errorInfo: ErrorInfo = { code: 'LIST_FAILED', message: 'fail' }
      protocol.listImpl.mockImplementation(() => err(errorInfo))
      const result = await protocol.list('s1', '/path')
      expect(result.success).toBe(false)
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('mkdir', () => {
    it('should succeed', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.mkdirImpl.mockImplementation(() => ok(undefined))
      const result = await protocol.mkdir('s1', '/new/dir')
      expect(result.success).toBe(true)
    })

    it('should pass sanitizedPath to mkdirImpl', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.mkdirImpl.mockImplementation(() => ok(undefined))
      await protocol.mkdir('s1', '/new/dir')
      expect(protocol.mkdirImpl).toHaveBeenCalledWith({ id: 'c1' }, '/new/dir', '/base')
    })
  })

  describe('rename', () => {
    it('should construct correct new path from parentPath + newName', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.renameImpl.mockImplementation(() => ok(undefined))
      const file: FileInfo = {
        name: 'old.txt',
        type: 'file',
        size: 10,
        modifyTime: 0,
        absolutePath: '/home/user/old.txt',
      }
      await protocol.rename('s1', file, 'new.txt')
      expect(protocol.renameImpl).toHaveBeenCalledWith(
        { id: 'c1' },
        '/home/user/old.txt',
        '/home/user/new.txt',
        '/base',
      )
    })
  })

  describe('delete', () => {
    it('should pass sanitizedPath to deleteImpl', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.deleteImpl.mockImplementation(() => ok(undefined))
      const file: FileInfo = {
        name: 'file.txt',
        type: 'file',
        size: 10,
        modifyTime: 0,
        absolutePath: '/some/deep/file.txt',
      }
      await protocol.delete('s1', file)
      expect(protocol.deleteImpl).toHaveBeenCalledWith(
        { id: 'c1' },
        '/some/deep/file.txt',
        '/base',
        'file',
      )
    })
  })

  describe('copy', () => {
    it('should pass sanitized source and target paths', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.copyImpl.mockImplementation(() => ok(undefined))
      const file: FileInfo = {
        name: 'src.txt',
        type: 'file',
        size: 10,
        modifyTime: 0,
        absolutePath: '/source/src.txt',
      }
      await protocol.copy('s1', file, '/target/dst.txt')
      expect(protocol.copyImpl).toHaveBeenCalledWith(
        { id: 'c1' },
        '/source/src.txt',
        '/target/dst.txt',
        '/base',
        'file',
      )
    })
  })

  describe('move', () => {
    it('should pass sanitized source and target paths', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.moveImpl.mockImplementation(() => ok(undefined))
      const file: FileInfo = {
        name: 'src.txt',
        type: 'file',
        size: 10,
        modifyTime: 0,
        absolutePath: '/source/src.txt',
      }
      await protocol.move('s1', file, '/target/dst.txt')
      expect(protocol.moveImpl).toHaveBeenCalledWith(
        { id: 'c1' },
        '/source/src.txt',
        '/target/dst.txt',
        '/base',
      )
    })
  })

  describe('ping', () => {
    it('should succeed', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.pingImpl.mockImplementation(() => ok(undefined))
      const result = await protocol.ping('s1')
      expect(result.success).toBe(true)
    })

    it('should log error on failure', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      const errorInfo: ErrorInfo = { code: 'PING_FAILED', message: 'fail' }
      protocol.pingImpl.mockImplementation(() => err(errorInfo))
      const result = await protocol.ping('s1')
      expect(result.success).toBe(false)
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('withAbort (indirect via list)', () => {
    it('should execute directly when no signal is provided', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.listImpl.mockImplementation(() => ok([]))
      const result = await protocol.list('s1', '/path')
      expect(result.success).toBe(true)
    })

    it('should return error when signal is already aborted', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      const controller = new AbortController()
      controller.abort()
      const result = await protocol.list('s1', '/path', controller.signal)
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('LIST_ABORTED')
    })

    it('should return INVALID_STATE error when operation throws', async () => {
      protocol.addSession('s1', { id: 'c1' }, '/base')
      protocol.listImpl.mockImplementation(() => {
        throw new Error('unexpected failure')
      })
      const controller = new AbortController()
      const result = await protocol.list('s1', '/path', controller.signal)
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('INVALID_STATE')
    })

    it('should return timeout error when operation times out', async () => {
      vi.useFakeTimers()
      protocol.addSession('s1', { id: 'c1' }, '/base')
      // Create a pending promise that never resolves on its own
      protocol.listImpl.mockReturnValue(
        new Promise<never>(() => {
          /* never resolves */
        }),
      )
      // Must provide a signal so withAbort enters the timeout/abort path
      const controller = new AbortController()
      let resolved = false
      let result: Result<FileInfo[], ErrorInfo> | undefined
      void protocol.list('s1', '/path', controller.signal).then((r) => {
        resolved = true
        result = r
      })
      // Advance past the LIST timeout - this triggers the setTimeout callback
      vi.advanceTimersByTime(TIMEOUTS.LIST + 100)
      // Flush microtasks to let the promise chain settle
      for (let i = 0; i < 10; i++) {
        await Promise.resolve()
      }
      expect(resolved).toBe(true)
      if (!result || result.success) return
      expect(result.error.code).toBe('LIST_TIMEOUT')
    })
  })
})
