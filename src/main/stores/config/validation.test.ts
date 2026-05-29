import { describe, expect, it } from 'vitest'
import { PROTOCOL, SCHEME, SORT_ORDER, SUPPORTED_LANGUAGE, THEME } from '@shared/constants/index.js'
import { isValidConnection, isValidUiSettings } from './validation.js'

describe('validation utilities', () => {
  describe('isValidConnection', () => {
    it('should return true for valid SFTP connection', () => {
      const config = {
        id: 'test-id',
        name: 'Test Connection',
        protocol: PROTOCOL.SFTP,
        host: 'localhost',
        port: 22,
        username: 'user',
        savePassword: false,
      }
      expect(isValidConnection(config)).toBe(true)
    })

    it('should return true for valid WebDAV connection', () => {
      const config = {
        id: 'test-id',
        name: 'Test WebDAV',
        protocol: PROTOCOL.WEBDAV,
        host: 'localhost',
        port: 8080,
        username: 'user',
        savePassword: true,
        password: 'secret',
        scheme: SCHEME.HTTP,
        basePath: '/webdav',
        rejectUnauthorized: false,
      }
      expect(isValidConnection(config)).toBe(true)
    })

    it('should return false for missing required fields', () => {
      expect(isValidConnection({})).toBe(false)
      expect(isValidConnection(null)).toBe(false)
      expect(isValidConnection(undefined)).toBe(false)
      expect(isValidConnection('string')).toBe(false)
    })

    it('should return false for invalid protocol', () => {
      const config = {
        id: 'test-id',
        name: 'Test',
        protocol: 'invalid',
        host: 'localhost',
        port: 22,
        username: 'user',
        savePassword: false,
      }
      expect(isValidConnection(config)).toBe(false)
    })

    it('should return false for invalid port type', () => {
      const config = {
        id: 'test-id',
        name: 'Test',
        protocol: PROTOCOL.SFTP,
        host: 'localhost',
        port: '22',
        username: 'user',
        savePassword: false,
      }
      expect(isValidConnection(config as never)).toBe(false)
    })

    it('should return false for invalid scheme', () => {
      const config = {
        id: 'test-id',
        name: 'Test',
        protocol: PROTOCOL.WEBDAV,
        host: 'localhost',
        port: 8080,
        username: 'user',
        savePassword: false,
        scheme: 'ftp',
      }
      expect(isValidConnection(config as never)).toBe(false)
    })

    it('should return true for WebDAV with https scheme', () => {
      const config = {
        id: 'test-id',
        name: 'Test',
        protocol: PROTOCOL.WEBDAV,
        host: 'localhost',
        port: 443,
        username: 'user',
        savePassword: false,
        scheme: SCHEME.HTTPS,
      }
      expect(isValidConnection(config)).toBe(true)
    })
  })

  describe('isValidUiSettings', () => {
    it('should return true for valid settings', () => {
      const settings = {
        appearance: THEME.DARK,
        locale: SUPPORTED_LANGUAGE.ZH_CN,
        connectionSortOrder: SORT_ORDER.ASC,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })

    it('should return true for system theme', () => {
      const settings = {
        appearance: THEME.SYSTEM,
        locale: SUPPORTED_LANGUAGE.EN_US,
        connectionSortOrder: SORT_ORDER.NONE,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })

    it('should return true for light theme', () => {
      const settings = {
        appearance: THEME.LIGHT,
        locale: '',
        connectionSortOrder: SORT_ORDER.DESC,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })

    it('should return false for invalid settings', () => {
      expect(isValidUiSettings({})).toBe(false)
      expect(isValidUiSettings(null)).toBe(false)
      expect(isValidUiSettings(undefined)).toBe(false)
    })

    it('should return false for invalid appearance', () => {
      const settings = {
        appearance: 'invalid',
        locale: SUPPORTED_LANGUAGE.EN_US,
        connectionSortOrder: SORT_ORDER.ASC,
      }
      expect(isValidUiSettings(settings as never)).toBe(false)
    })

    it('should return false for invalid locale', () => {
      const settings = {
        appearance: THEME.DARK,
        locale: 'fr-FR',
        connectionSortOrder: SORT_ORDER.ASC,
      }
      expect(isValidUiSettings(settings as never)).toBe(false)
    })

    it('should return false for invalid sort order', () => {
      const settings = {
        appearance: THEME.DARK,
        locale: SUPPORTED_LANGUAGE.EN_US,
        connectionSortOrder: 'invalid',
      }
      expect(isValidUiSettings(settings as never)).toBe(false)
    })

    it('should return true when connectionSortOrder is undefined', () => {
      const settings = {
        appearance: THEME.DARK,
        locale: SUPPORTED_LANGUAGE.EN_US,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })
  })
})
