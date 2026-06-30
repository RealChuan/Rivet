import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS, PROTOCOL, TIMEOUTS } from '@shared/constants/index.js'
import { SessionManager } from './session-manager.js'
import { sessionRegistry, type SessionHandle } from './session-registry.js'

const mockBroadcast = vi.fn()

vi.mock('../app/window-factory.js', () => ({
  WindowManager: {
    broadcast: (...args: unknown[]): unknown => mockBroadcast(...args),
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
    protocol: PROTOCOL.SFTP,
    host: 'localhost',
    port: 22,
    username: 'user',
    savePassword: false,
  }

  const mockDisconnect = vi.fn().mockResolvedValue(undefined)
  const mockPing = vi.fn().mockResolvedValue(undefined)

  let sessionManager: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockDisconnect.mockResolvedValue(undefined)
    mockPing.mockResolvedValue(undefined)
    sessionRegistry.clear()
    sessionManager = new SessionManager({ disconnect: mockDisconnect, ping: mockPing })
  })

  afterEach(() => {
    sessionManager.destroy()
  })

  describe('register', () => {
    it('should register a new session', () => {
      const mockClient = { connect: vi.fn() }
      sessionManager.register('session-1', mockClient, mockConfig, PROTOCOL.SFTP)

      expect(sessionRegistry.has('session-1')).toBe(true)
      expect(sessionRegistry.count).toBe(1)
    })

    it('should allow multiple sessions', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      expect(sessionRegistry.count).toBe(2)
      expect(sessionRegistry.has('session-1')).toBe(true)
      expect(sessionRegistry.has('session-2')).toBe(true)
    })
  })

  describe('unregister', () => {
    it('should unregister an existing session', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.unregister('session-1')

      expect(sessionRegistry.has('session-1')).toBe(false)
      expect(sessionRegistry.count).toBe(0)
    })

    it('should not throw when unregistering non-existent session', () => {
      expect(() => sessionManager.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('get', () => {
    it('should return session handle for existing session', () => {
      const mockClient = { key: 'value' }
      sessionManager.register('session-1', mockClient, mockConfig, PROTOCOL.SFTP)

      const handle = sessionRegistry.get('session-1')

      expect(handle).toBeDefined()
      expect(handle?.client).toEqual(mockClient)
      expect(handle?.config).toEqual(mockConfig)
      expect(handle?.protocolType).toBe(PROTOCOL.SFTP)
    })

    it('should return undefined for non-existent session', () => {
      expect(sessionRegistry.get('nonexistent')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing session', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      expect(sessionRegistry.has('session-1')).toBe(true)
    })

    it('should return false for non-existent session', () => {
      expect(sessionRegistry.has('nonexistent')).toBe(false)
    })
  })

  describe('getAllIds', () => {
    it('should return all session ids', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      const ids = sessionRegistry.getAllIds()

      expect(ids.length).toBe(2)
      expect(ids).toContain('session-1')
      expect(ids).toContain('session-2')
    })

    it('should return empty array when no sessions', () => {
      expect(sessionRegistry.getAllIds()).toEqual([])
    })
  })

  describe('clear', () => {
    it('should clear all sessions', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      sessionRegistry.clear()

      expect(sessionRegistry.count).toBe(0)
      expect(sessionRegistry.getAllIds()).toEqual([])
    })
  })

  describe('setClosing', () => {
    it('should mark session as closing', () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      sessionRegistry.setClosing('session-1')
      const handle = sessionRegistry.get('session-1') as SessionHandle

      expect(handle.isClosing).toBe(true)
    })
  })

  describe('safeUnregister', () => {
    it('should return ok for non-existent session', async () => {
      const result = await sessionManager.safeUnregister('nonexistent')
      expect(result.success).toBe(true)
    })

    it('should return ok for already closing session', async () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionRegistry.setClosing('session-1')

      const result = await sessionManager.safeUnregister('session-1')
      expect(result.success).toBe(true)
    })

    it('should disconnect and unregister session', async () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(true)
      expect(sessionRegistry.has('session-1')).toBe(false)
    })
  })

  describe('safeUnregisterAll', () => {
    it('should return ok when no sessions', async () => {
      const result = await sessionManager.safeUnregisterAll()
      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
    })

    it('should cleanup all sessions', async () => {
      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      const result = await sessionManager.safeUnregisterAll()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
      expect(sessionRegistry.count).toBe(0)
    })
  })

  describe('safeUnregister - additional', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return DISCONNECT_ERROR on disconnect timeout', async () => {
      vi.useFakeTimers()
      mockDisconnect.mockImplementation(() => new Promise(() => {}))

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      const resultPromise = sessionManager.safeUnregister('session-1')
      await vi.advanceTimersByTimeAsync(TIMEOUTS.DISCONNECT + 1)
      const result = await resultPromise

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DISCONNECT_ERROR')
      }
    })

    it('should still delete session on disconnect failure', async () => {
      mockDisconnect.mockRejectedValue(new Error('disconnect failed'))

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DISCONNECT_ERROR')
      }
      expect(sessionRegistry.has('session-1')).toBe(false)
    })

    it('should clear disconnect timeout on successful disconnect', async () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(true)
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

      clearTimeoutSpy.mockRestore()
    })
  })

  describe('safeUnregisterAll - additional', () => {
    it('should return ok(false) on partial failure', async () => {
      mockDisconnect.mockImplementation((id: string) => {
        if (id === 'session-1') return Promise.reject(new Error('disconnect failed'))
        return Promise.resolve(undefined)
      })

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      const result = await sessionManager.safeUnregisterAll()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(false)
      }
    })
  })

  describe('checkAllSessions - heartbeat disconnect', () => {
    it('should broadcast SESSION_DISCONNECTED when heartbeat detects disconnect', async () => {
      vi.useFakeTimers()
      mockPing.mockRejectedValue(new Error('ping failed'))

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      // Trigger a heartbeat check
      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(mockBroadcast).toHaveBeenCalledWith(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, {
        sessionId: 'session-1',
        protocolType: PROTOCOL.SFTP,
      })

      vi.useRealTimers()
    })

    it('should broadcast SESSION_DISCONNECTED with correct protocolType for each session', async () => {
      vi.useFakeTimers()
      mockPing.mockRejectedValue(new Error('ping failed'))

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(mockBroadcast).toHaveBeenCalledWith(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, {
        sessionId: 'session-1',
        protocolType: PROTOCOL.SFTP,
      })
      expect(mockBroadcast).toHaveBeenCalledWith(IPC_CHANNELS.EVENTS.SESSION_DISCONNECTED, {
        sessionId: 'session-2',
        protocolType: PROTOCOL.WEBDAV,
      })

      vi.useRealTimers()
    })

    it('should not broadcast SESSION_DISCONNECTED when ping succeeds', async () => {
      vi.useFakeTimers()
      mockPing.mockResolvedValue(undefined)

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(mockBroadcast).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should clear ping timeout on successful ping', async () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(mockBroadcast).not.toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
      vi.useRealTimers()
    })
  })

  describe('destroy', () => {
    it('should stop heartbeat', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.destroy()

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearIntervalSpy.mockRestore()
    })
  })

  describe('unregister - heartbeat management', () => {
    it('should stop heartbeat when last session is unregistered', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.unregister('session-1')

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearIntervalSpy.mockRestore()
    })

    it('should start heartbeat only once for multiple registers', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      sessionManager.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      sessionManager.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)
      sessionManager.register('session-3', {}, { ...mockConfig, id: 'conn-3' }, PROTOCOL.SFTP)

      expect(setIntervalSpy).toHaveBeenCalledTimes(1)

      setIntervalSpy.mockRestore()
    })
  })
})
