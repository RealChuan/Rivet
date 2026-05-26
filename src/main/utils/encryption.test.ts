/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeStorage } from 'electron'
import { encryptPassword, decryptPassword } from './encryption.js'

vi.mock('./index', () => ({
  logger: {
    warn: vi.fn(),
    catch: vi.fn(),
  },
}))

describe('encryption utilities', () => {
  beforeEach(() => {
    vi.stubEnv('RIVET_HMAC_KEY', '')
  })

  describe('encryptPassword', () => {
    it('should return null when safeStorage is unavailable', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      const result = encryptPassword('test-password')
      expect(result.success).toBe(true)
      expect(result.value).toBeNull()
    })

    it('should encrypt password with safe: prefix when safeStorage is available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
      vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('encrypted-data'))

      const result = encryptPassword('test-password')
      expect(result.success).toBe(true)
      expect(result.value).not.toBeNull()
      expect(result.value?.startsWith('safe:')).toBe(true)
    })

    it('should return error when encryption throws', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
      vi.mocked(safeStorage.encryptString).mockImplementation(() => {
        throw new Error('Encryption failed')
      })

      const result = encryptPassword('test-password')
      expect(result.success).toBe(false)
    })
  })

  describe('decryptPassword', () => {
    it('should return null for non-safe: prefix data (old format)', () => {
      const result = decryptPassword('fallback:someolddata')
      expect(result.success).toBe(true)
      expect(result.value).toBeNull()
    })

    it('should return null for bare base64 data (legacy format)', () => {
      const result = decryptPassword('c29tZWJhc2U2NGRhdGE=')
      expect(result.success).toBe(true)
      expect(result.value).toBeNull()
    })

    it('should return null when safeStorage is unavailable for safe: prefix data', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false)
      const result = decryptPassword('safe:test-data')
      expect(result.success).toBe(true)
      expect(result.value).toBeNull()
    })

    it('should return null when HMAC verification fails (tampered data)', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
      vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('encrypted-data'))

      const encrypted = encryptPassword('test-password')
      expect(encrypted.success).toBe(true)
      const encryptedValue = encrypted.value
      if (encryptedValue === null) {
        throw new Error('Expected encrypted value to be non-null')
      }

      // Tamper with the HMAC by flipping a character
      const tampered = encryptedValue.slice(0, 10) + 'x' + encryptedValue.slice(11)
      const result = decryptPassword(tampered)
      expect(result.success).toBe(true)
      expect(result.value).toBeNull()
    })

    it('should decrypt password encrypted with safeStorage', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
      vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('encrypted-data'))
      vi.mocked(safeStorage.decryptString).mockReturnValue('test-password')

      const encrypted = encryptPassword('test-password')
      expect(encrypted.success).toBe(true)
      const encryptedValue = encrypted.value
      if (encryptedValue === null) {
        throw new Error('Expected encrypted value to be non-null')
      }

      const decrypted = decryptPassword(encryptedValue)
      expect(decrypted.success).toBe(true)
      expect(decrypted.value).toBe('test-password')
    })
  })
})
