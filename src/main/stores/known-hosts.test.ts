/* eslint-disable @typescript-eslint/consistent-type-imports -- typeof import() 用于获取值导出的类型 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  catch: vi.fn(),
}

vi.mock('../utils/index.js', () => ({
  logger: mockLogger,
}))

vi.mock('@shared/types/index.js', () => ({
  ok: <T>(value: T): { success: true; value: T; error?: never } => ({
    success: true as const,
    value,
  }),
  err: <E>(error: E): { success: false; error: E; value?: never } => ({
    success: false as const,
    error,
  }),
  createErrorInfo: (code: string, message: string) => ({ code, message }),
}))

describe('known-hosts store', () => {
  let getHostKeyRecord: typeof import('./known-hosts.js').getHostKeyRecord
  let saveHostKeyRecord: typeof import('./known-hosts.js').saveHostKeyRecord
  let removeHostKeyRecord: typeof import('./known-hosts.js').removeHostKeyRecord

  beforeEach(async () => {
    vi.clearAllMocks()

    const module = await import('./known-hosts.js')
    getHostKeyRecord = module.getHostKeyRecord
    saveHostKeyRecord = module.saveHostKeyRecord
    removeHostKeyRecord = module.removeHostKeyRecord
  })

  describe('getHostKeyRecord', () => {
    it('should return ok with undefined when no host found', () => {
      const result = getHostKeyRecord('non-existent')

      expect(result.success).toBe(true)
      expect(result.value).toBeUndefined()
    })
  })

  describe('saveHostKeyRecord', () => {
    it('should save new host key record successfully', () => {
      const result = saveHostKeyRecord({
        connectionId: 'new-conn',
        hash: 'ssh-ed25519 AAAA...',
      })

      expect(result.success).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Saved host key'))
    })

    it('should log connection id when saving', () => {
      saveHostKeyRecord({
        connectionId: 'test-conn-123',
        hash: 'some-hash',
      })

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('test-conn-123'))
    })
  })

  describe('removeHostKeyRecord', () => {
    it('should complete removal operation successfully', () => {
      const result = removeHostKeyRecord('to-remove')

      expect(result.success).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted host key'))
    })

    it('should handle removing non-existent record gracefully', () => {
      const result = removeHostKeyRecord('non-existent')

      expect(result.success).toBe(true)
    })

    it('should log connection id when removing', () => {
      removeHostKeyRecord('remove-conn-456')

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('remove-conn-456'))
    })
  })
})
