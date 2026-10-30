import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { PROTOCOL, TIMEOUTS } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { providerSessionRegistry, type SessionHandle } from '../providers/session-registry.js'
import { createFakeProvider } from '../providers/test-utils/fake-provider.js'
import { SessionManager } from './session-manager.js'

const mockSend = vi.fn()

vi.mock('../app/main-window.js', () => ({
  sendToMainWindow: (...args: unknown[]): unknown => mockSend(...args),
}))

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    catch: vi.fn(),
  },
}))

const sftpConfig: ConnectionConfig = {
  id: 'conn-1',
  name: 'Test Connection',
  protocol: PROTOCOL.SFTP,
  host: 'localhost',
  port: 22,
  username: 'user',
  authKind: 'password',
}

const webdavConfig: ConnectionConfig = { ...sftpConfig, id: 'conn-2', protocol: PROTOCOL.WEBDAV }

describe('SessionManager', () => {
  const mockDisconnect = vi.fn().mockResolvedValue(undefined)
  const mockPing = vi.fn().mockResolvedValue(undefined)

  let sessionManager: SessionManager

  function register(
    sessionId: string,
    protocolType: 'sftp' | 'webdav' = 'sftp',
    config: ConnectionConfig = sftpConfig,
  ): void {
    providerSessionRegistry.register(sessionId, {
      provider: createFakeProvider(protocolType),
      config,
      protocolType,
      isClosing: false,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDisconnect.mockResolvedValue(undefined)
    mockPing.mockResolvedValue(undefined)
    providerSessionRegistry.clear()
    sessionManager = new SessionManager({ disconnect: mockDisconnect, ping: mockPing })
  })

  afterEach(() => {
    sessionManager.destroy()
  })

  describe('unregister', () => {
    it('should unregister an existing session', () => {
      register('session-1')
      sessionManager.unregister('session-1')

      expect(providerSessionRegistry.has('session-1')).toBe(false)
      expect(providerSessionRegistry.count).toBe(0)
    })

    it('should not throw when unregistering non-existent session', () => {
      expect(() => sessionManager.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('setClosing', () => {
    it('should mark session as closing', () => {
      register('session-1')

      providerSessionRegistry.setClosing('session-1')
      const handle = providerSessionRegistry.get('session-1') as SessionHandle

      expect(handle.isClosing).toBe(true)
    })
  })

  describe('safeUnregister', () => {
    it('should return ok for non-existent session', async () => {
      const result = await sessionManager.safeUnregister('nonexistent')
      expect(result.success).toBe(true)
    })

    it('should return ok for already closing session', async () => {
      register('session-1')
      providerSessionRegistry.setClosing('session-1')

      const result = await sessionManager.safeUnregister('session-1')
      expect(result.success).toBe(true)
    })

    it('should disconnect and unregister session', async () => {
      register('session-1')

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(true)
      expect(providerSessionRegistry.has('session-1')).toBe(false)
    })

    it('should return DISCONNECT_ERROR on disconnect timeout', async () => {
      vi.useFakeTimers()
      mockDisconnect.mockImplementation(() => new Promise(() => {}))

      register('session-1')

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

      register('session-1')

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DISCONNECT_ERROR')
      }
      expect(providerSessionRegistry.has('session-1')).toBe(false)
    })

    it('should clear disconnect timeout on successful disconnect', async () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      register('session-1')

      const result = await sessionManager.safeUnregister('session-1')

      expect(result.success).toBe(true)
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

      clearTimeoutSpy.mockRestore()
    })
  })

  describe('safeUnregisterAll', () => {
    it('should return ok when no sessions', async () => {
      const result = await sessionManager.safeUnregisterAll()
      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
    })

    it('should cleanup all sessions', async () => {
      register('session-1')
      register('session-2', 'webdav', webdavConfig)

      const result = await sessionManager.safeUnregisterAll()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
      expect(providerSessionRegistry.count).toBe(0)
    })

    it('should return ok(false) on partial failure', async () => {
      mockDisconnect.mockImplementation((id: string) => {
        if (id === 'session-1') return Promise.reject(new Error('disconnect failed'))
        return Promise.resolve(undefined)
      })

      register('session-1')
      register('session-2', 'webdav', webdavConfig)

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

      register('session-1')
      sessionManager.startHeartbeat()

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(mockSend).toHaveBeenCalledWith(EVENT_CHANNEL.SESSION_DISCONNECTED, {
        sessionId: 'session-1',
        connectionId: 'conn-1',
        protocol: PROTOCOL.SFTP,
        name: 'Test Connection',
      })

      vi.useRealTimers()
    })

    it('should broadcast SESSION_DISCONNECTED with correct protocol for each session', async () => {
      vi.useFakeTimers()
      mockPing.mockRejectedValue(new Error('ping failed'))

      register('session-1')
      register('session-2', 'webdav', webdavConfig)
      sessionManager.startHeartbeat()

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(mockSend).toHaveBeenCalledWith(EVENT_CHANNEL.SESSION_DISCONNECTED, {
        sessionId: 'session-1',
        connectionId: 'conn-1',
        protocol: PROTOCOL.SFTP,
        name: 'Test Connection',
      })
      expect(mockSend).toHaveBeenCalledWith(EVENT_CHANNEL.SESSION_DISCONNECTED, {
        sessionId: 'session-2',
        connectionId: 'conn-2',
        protocol: PROTOCOL.WEBDAV,
        name: 'Test Connection',
      })

      vi.useRealTimers()
    })

    it('should not broadcast SESSION_DISCONNECTED when ping succeeds', async () => {
      vi.useFakeTimers()
      mockPing.mockResolvedValue(undefined)

      register('session-1')
      sessionManager.startHeartbeat()

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(mockSend).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should clear ping timeout on successful ping', async () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      register('session-1')
      sessionManager.startHeartbeat()

      await vi.advanceTimersByTimeAsync(TIMEOUTS.HEARTBEAT_INTERVAL + 1)

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
      expect(mockSend).not.toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
      vi.useRealTimers()
    })
  })

  describe('destroy', () => {
    it('should stop heartbeat', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      register('session-1')
      sessionManager.startHeartbeat()
      sessionManager.destroy()

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearIntervalSpy.mockRestore()
    })
  })

  describe('unregister - heartbeat management', () => {
    it('should stop heartbeat when last session is unregistered', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      register('session-1')
      sessionManager.startHeartbeat()
      sessionManager.unregister('session-1')

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

      clearIntervalSpy.mockRestore()
    })

    it('should start heartbeat only once for multiple starts', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      register('session-1')
      register('session-2', 'webdav', webdavConfig)
      register('session-3')
      sessionManager.startHeartbeat()
      sessionManager.startHeartbeat()
      sessionManager.startHeartbeat()

      expect(setIntervalSpy).toHaveBeenCalledTimes(1)

      setIntervalSpy.mockRestore()
    })
  })
})
