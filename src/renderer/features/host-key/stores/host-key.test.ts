import { describe, it, expect } from 'vitest'

describe('host key store', () => {
  it('should be importable', async () => {
    await import('./host-key.js')
    expect(true).toBe(true)
  })
})
