import { describe, it, expect, vi } from 'vitest'
import {
  handleIpcResultAsync,
  handleIpcResult,
  toIpcResult,
  wrapIpcHandler,
  wrapSyncIpcHandler,
} from './ipc-result.js'

describe('ipc-result utilities', () => {
  describe('handleIpcResultAsync', () => {
    it('should return ok result when handler succeeds', async () => {
      const result = await handleIpcResultAsync('test-operation', () => Promise.resolve('success'))
      expect(result.success).toBe(true)
      expect(result.value).toBe('success')
    })

    it('should return error result when handler throws', async () => {
      const result = await handleIpcResultAsync('test-operation', () =>
        Promise.reject(new Error('test error'))
      )
      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('IPC_ERROR')
      expect(result.error?.message).toBe('test-operation failed')
    })
  })

  describe('handleIpcResult', () => {
    it('should return ok result when handler succeeds', () => {
      const result = handleIpcResult('test-operation', () => 'success')
      expect(result.success).toBe(true)
      expect(result.value).toBe('success')
    })

    it('should return error result when handler throws', () => {
      const result = handleIpcResult('test-operation', () => {
        throw new Error('test error')
      })
      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('IPC_ERROR')
    })
  })

  describe('toIpcResult', () => {
    it('should return ok result when value is defined', () => {
      const result = toIpcResult('test-value', 'error message')
      expect(result.success).toBe(true)
      expect(result.value).toBe('test-value')
    })

    it('should return error result when value is null', () => {
      const result = toIpcResult(null, 'error message')
      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('IPC_NULL')
      expect(result.error?.message).toBe('error message')
    })

    it('should return error result when value is undefined', () => {
      const result = toIpcResult(undefined, 'error message')
      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('IPC_NULL')
    })
  })

  describe('wrapIpcHandler', () => {
    it('should wrap async handler and return result', async () => {
      const handler = vi.fn().mockResolvedValue('wrapped-result')
      const wrapped = wrapIpcHandler('test-wrap', handler)

      const result = await wrapped('arg1', 'arg2')

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result.success).toBe(true)
      expect(result.value).toBe('wrapped-result')
    })

    it('should catch errors from async handler', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('async error'))
      const wrapped = wrapIpcHandler('test-wrap', handler)

      const result = await wrapped()

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('IPC_ERROR')
    })
  })

  describe('wrapSyncIpcHandler', () => {
    it('should wrap sync handler and return result', () => {
      const handler = vi.fn().mockReturnValue('sync-result')
      const wrapped = wrapSyncIpcHandler('test-wrap', handler)

      const result = wrapped('arg')

      expect(handler).toHaveBeenCalledWith('arg')
      expect(result.success).toBe(true)
      expect(result.value).toBe('sync-result')
    })

    it('should catch errors from sync handler', () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('sync error')
      })
      const wrapped = wrapSyncIpcHandler('test-wrap', handler)

      const result = wrapped()

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('IPC_ERROR')
    })
  })
})
