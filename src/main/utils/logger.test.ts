import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger } from './logger.js'

describe('logger utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have all log methods', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.catch).toBe('function')
  })

  it('should call info method', () => {
    logger.info('test info message')
  })

  it('should call warn method', () => {
    logger.warn('test warn message')
  })

  it('should call error method', () => {
    logger.error('test error message')
  })

  it('should call debug method', () => {
    logger.debug('test debug message')
  })

  it('should call catch method with error', () => {
    logger.catch(new Error('test error'), { action: 'test' })
  })

  it('should call catch method with string error', () => {
    logger.catch('test string error', { action: 'test' })
  })
})
