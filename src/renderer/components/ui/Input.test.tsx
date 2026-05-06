import { describe, expect, it } from 'vitest'

describe('Input component', () => {
  it('should export Input component', async () => {
    const { Input } = await import('./Input.js')
    expect(typeof Input).toBe('function')
  })
})
