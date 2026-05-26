import { describe, it, expect } from 'vitest'
import { isValidConnection, isValidUiSettings } from './validation.js'
import {
  PROTOCOL_SFTP,
  PROTOCOL_WEBDAV,
  SCHEME_HTTP,
  SCHEME_HTTPS,
} from '@shared/constants/index.js'
import { THEME_LIGHT, THEME_DARK, THEME_SYSTEM } from '@shared/constants/theme.js'
import { ZH_CN, EN_US } from '@shared/constants/i18n.js'
import { SORT_ORDER_NONE, SORT_ORDER_ASC, SORT_ORDER_DESC } from '@shared/constants/sort.js'

describe('validation utilities', () => {
  describe('isValidConnection', () => {
    it('should return true for valid SFTP connection', () => {
      const config = {
        id: 'test-id',
        name: 'Test Connection',
        protocol: PROTOCOL_SFTP,
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
        protocol: PROTOCOL_WEBDAV,
        host: 'localhost',
        port: 8080,
        username: 'user',
        savePassword: true,
        password: 'secret',
        scheme: SCHEME_HTTP,
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
        protocol: PROTOCOL_SFTP,
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
        protocol: PROTOCOL_WEBDAV,
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
        protocol: PROTOCOL_WEBDAV,
        host: 'localhost',
        port: 443,
        username: 'user',
        savePassword: false,
        scheme: SCHEME_HTTPS,
      }
      expect(isValidConnection(config)).toBe(true)
    })
  })

  describe('isValidUiSettings', () => {
    it('should return true for valid settings', () => {
      const settings = {
        appearance: THEME_DARK,
        locale: ZH_CN,
        connectionSortOrder: SORT_ORDER_ASC,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })

    it('should return true for system theme', () => {
      const settings = {
        appearance: THEME_SYSTEM,
        locale: EN_US,
        connectionSortOrder: SORT_ORDER_NONE,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })

    it('should return true for light theme', () => {
      const settings = {
        appearance: THEME_LIGHT,
        locale: '',
        connectionSortOrder: SORT_ORDER_DESC,
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
        locale: EN_US,
        connectionSortOrder: SORT_ORDER_ASC,
      }
      expect(isValidUiSettings(settings as never)).toBe(false)
    })

    it('should return false for invalid locale', () => {
      const settings = {
        appearance: THEME_DARK,
        locale: 'fr-FR',
        connectionSortOrder: SORT_ORDER_ASC,
      }
      expect(isValidUiSettings(settings as never)).toBe(false)
    })

    it('should return false for invalid sort order', () => {
      const settings = {
        appearance: THEME_DARK,
        locale: EN_US,
        connectionSortOrder: 'invalid',
      }
      expect(isValidUiSettings(settings as never)).toBe(false)
    })

    it('should return true when connectionSortOrder is undefined', () => {
      const settings = {
        appearance: THEME_DARK,
        locale: EN_US,
      }
      expect(isValidUiSettings(settings)).toBe(true)
    })
  })
})
