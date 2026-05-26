import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sessionManager, type SessionHandle } from './session-manager.js'
import { PROTOCOL_SFTP, PROTOCOL_WEBDAV, TIMEOUTS } from '@shared/constants/index.js'
import { protocolService } from './protocol/protocol-service.js'

vi.mock('./protocol/protocol-service.js', () => ({
  protocolService: {
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    catch: vi.fn(),
  },
}))

describe('SessionManager', () => {
  const mockConfig = {
    id: 'conn-1',
    name: 'Test Connection',
    protocol: PROTOCOL_SFTP,
    host: 'localhost',
    port: 22,
    username: 'user',
    savePassword: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager.clear()
  })

  afterEach(() => {
    sessionManager.destroy()
  })

  describe('register', () => {
    it('should register a new session', () => {
      const mockClient = { connect: vi.fn() }
      sessionManager.register('session-1', mockClient, mockConfig, PROTOCOL_SFTP)

      expect(sessionManager.has('session-1')).toBe(true)
      expect(sessionManager.count).toBe(1)
    })

    it('should allow multiple sessions', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)

      expect(sessionManager.count).toBe(2)
      expect(sessionManager.has('session-1')).toBe(true)
      expect(sessionManager.has('session-2')).toBe(true)
    })
  })

  describe('unregister', () => {
    it('should unregister an existing session', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.unregister('session-1')

      expect(sessionManager.has('session-1')).toBe(false)
      expect(sessionManager.count).toBe(0)
    })

    it('should not throw when unregistering non-existent session', () => {
      expect(() => sessionManager.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('get', () => {
    it('should return session handle for existing session', () => {
      const mockClient = { key: 'value' }
      sessionManager.register('session-1', mockClient, mockConfig, PROTOCOL_SFTP)

      const handle = sessionManager.get('session-1')

      expect(handle).toBeDefined()
      expect(handle?.client).toEqual(mockClient)
      expect(handle?.config).toEqual(mockConfig)
      expect(handle?.protocolType).toBe(PROTOCOL_SFTP)
    })

    it('should return undefined for non-existent session', () => {
      expect(sessionManager.get('nonexistent')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing session', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      expect(sessionManager.has('session-1')).toBe(true)
    })

    it('should return false for non-existent session', () => {
      expect(sessionManager.has('nonexistent')).toBe(false)
    })
  })

  describe('getByProtocol', () => {
    it('should return sessions filtered by protocol', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)
      sessionManager.register('session-3', {}, { ...mockConfig, id: 'conn-3' }, PROTOCOL_SFTP)

      const sftpSessions = sessionManager.getByProtocol(PROTOCOL_SFTP)
      const webdavSessions = sessionManager.getByProtocol(PROTOCOL_WEBDAV)

      expect(sftpSessions.length).toBe(2)
      expect(sftpSessions.map(s => s.sessionId)).toEqual(['session-1', 'session-3'])
      expect(webdavSessions.length).toBe(1)
      expect(webdavSessions[0]).toBeDefined()
      expect(webdavSessions[0]?.sessionId).toBe('session-2')
    })

    it('should return empty array when no sessions match', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      const result = sessionManager.getByProtocol('ftp' as never)
      expect(result).toEqual([])
    })
  })

  describe('getAllIds', () => {
    it('should return all session ids', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)

      const ids = sessionManager.getAllIds()

      expect(ids.length).toBe(2)
      expect(ids).toContain('session-1')
      expect(ids).toContain('session-2')
    })

    it('should return empty array when no sessions', () => {
      expect(sessionManager.getAllIds()).toEqual([])
    })
  })

  describe('clear', () => {
    it('should clear all sessions', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)

      sessionManager.clear()

      expect(sessionManager.count).toBe(0)
      expect(sessionManager.getAllIds()).toEqual([])
    })
  })

  describe('setClosing', () => {
    it('should mark session as closing', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)

      sessionManager.setClosing('session-1')
      const handle = sessionManager.get('session-1') as SessionHandle

      expect(handle._closing).toBe(true)
    })
  })

  describe('safeUnregister', () => {
    it('should return ok for non-existent session', async () => {
      const result = await sessionManager.safeUnregister('nonexistent')
      expect(result.success).toBe(true)
    })

    it('should return ok for already closing session', async () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.setClosing('session-1')

      const result = await sessionManager.safeUnregister('session-1')
      expect(result.success).toBe(true)
    })

    it('should disconnect and unregister session', async () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(true)
      expect(sessionManager.has('session-1')).toBe(false)
    })
  })

  describe('safeUnregisterAll', () => {
    it('should return ok when no sessions', async () => {
      const result = await sessionManager.safeUnregisterAll()
      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
    })

    it('should cleanup all sessions', async () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)

      const result = await sessionManager.safeUnregisterAll()

      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
      expect(sessionManager.count).toBe(0)
    })
  })

  describe('safeUnregister - additional', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return DISCONNECT_ERROR on disconnect timeout', async () => {
      vi.useFakeTimers()
      // eslint-disable-next-line @typescript-eslint/unbound-method -- mock implementation
      vi.mocked(protocolService.disconnect).mockImplementation(() => new Promise(() => {}))

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)

      const resultPromise = sessionManager.safeUnregister('session-1')
      await vi.advanceTimersByTimeAsync(TIMEOUTS.DISCONNECT + 1)
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DISCONNECT_ERROR')
      }
    })

    it('should still delete session on disconnect failure', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- mock implementation
      vi.mocked(protocolService.disconnect).mockRejectedValue(new Error('disconnect failed'))

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DISCONNECT_ERROR')
      }
      expect(sessionManager.has('session-1')).toBe(false)
    })
  })

  describe('safeUnregisterAll - additional', () => {
    it('should return ok(false) on partial failure', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- mock implementation
      vi.mocked(protocolService.disconnect).mockImplementation((id: string) => {
        if (id === 'session-1') return Promise.reject(new Error('disconnect failed'))
        return Promise.resolve({
          requestId: 'test',
          success: true,
          value: undefined,
          error: undefined,
        })
      })

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)

      const result = await sessionManager.safeUnregisterAll()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe('destroy', () => {
    it('should stop heartbeat', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.destroy()

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearIntervalSpy.mockRestore()
    })
  })

  describe('unregister - heartbeat management', () => {
    it('should stop heartbeat when last session is unregistered', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.unregister('session-1')

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearIntervalSpy.mockRestore()
    })

    it('should start heartbeat only once for multiple registers', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL_SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL_WEBDAV)
      sessionManager.register('session-3', {}, { ...mockConfig, id: 'conn-3' }, PROTOCOL_SFTP)

      expect(setIntervalSpy).toHaveBeenCalledTimes(1)

      setIntervalSpy.mockRestore()
    })
  })
})
