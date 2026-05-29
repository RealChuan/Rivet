import { describe, expect, it } from 'vitest'
import { handleIpcResult, handleIpcResultAsync, toIpcResult } from './ipc-result.js'

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
})
