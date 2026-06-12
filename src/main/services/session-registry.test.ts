import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL } from '@shared/constants/index.js'
import { SessionRegistry, type SessionHandle } from './session-registry.js'

describe('SessionRegistry', () => {
  let registry: SessionRegistry
  const mockConfig = {
    id: 'conn-1',
    name: 'Test Connection',
    protocol: PROTOCOL.SFTP,
    host: 'localhost',
    port: 22,
    username: 'user',
    savePassword: false,
  }

  beforeEach(() => {
    registry = new SessionRegistry()
  })

  describe('register', () => {
    it('should register a new session', () => {
      const mockClient = { connect: vi.fn() }
      registry.register('session-1', mockClient, mockConfig, PROTOCOL.SFTP)

      expect(registry.has('session-1')).toBe(true)
      expect(registry.count).toBe(1)
    })

    it('should allow multiple sessions', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      registry.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      expect(registry.count).toBe(2)
      expect(registry.has('session-1')).toBe(true)
      expect(registry.has('session-2')).toBe(true)
    })
  })

  describe('unregister', () => {
    it('should unregister an existing session', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      registry.unregister('session-1')

      expect(registry.has('session-1')).toBe(false)
      expect(registry.count).toBe(0)
    })

    it('should not throw when unregistering non-existent session', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow()
    })
  })

  describe('get', () => {
    it('should return session handle for existing session', () => {
      const mockClient = { key: 'value' }
      registry.register('session-1', mockClient, mockConfig, PROTOCOL.SFTP)

      const handle = registry.get('session-1')

      expect(handle).toBeDefined()
      expect(handle?.client).toEqual(mockClient)
      expect(handle?.config).toEqual(mockConfig)
      expect(handle?.protocolType).toBe(PROTOCOL.SFTP)
    })

    it('should return undefined for non-existent session', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing session', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      expect(registry.has('session-1')).toBe(true)
    })

    it('should return false for non-existent session', () => {
      expect(registry.has('nonexistent')).toBe(false)
    })
  })

  describe('getAllIds', () => {
    it('should return all session ids', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      registry.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      const ids = registry.getAllIds()

      expect(ids.length).toBe(2)
      expect(ids).toContain('session-1')
      expect(ids).toContain('session-2')
    })

    it('should return empty array when no sessions', () => {
      expect(registry.getAllIds()).toEqual([])
    })
  })

  describe('count', () => {
    it('should return 0 when no sessions', () => {
      expect(registry.count).toBe(0)
    })

    it('should return correct count after register/unregister', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      expect(registry.count).toBe(1)
      registry.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)
      expect(registry.count).toBe(2)
      registry.unregister('session-1')
      expect(registry.count).toBe(1)
    })
  })

  describe('setClosing', () => {
    it('should mark session as closing', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)

      registry.setClosing('session-1')
      const handle = registry.get('session-1') as SessionHandle

      expect(handle.isClosing).toBe(true)
    })

    it('should not throw for non-existent session', () => {
      expect(() => registry.setClosing('nonexistent')).not.toThrow()
    })
  })

  describe('clear', () => {
    it('should clear all sessions', () => {
      registry.register('session-1', {}, mockConfig, PROTOCOL.SFTP)
      registry.register('session-2', {}, { ...mockConfig, id: 'conn-2' }, PROTOCOL.WEBDAV)

      registry.clear()

      expect(registry.count).toBe(0)
      expect(registry.getAllIds()).toEqual([])
    })
  })
})
