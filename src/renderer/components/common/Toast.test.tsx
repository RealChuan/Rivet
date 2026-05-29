import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('setTimeout', vi.fn())
vi.stubGlobal('clearTimeout', vi.fn())

describe('Toast component', () => {
  it('should export Toast component', async () => {
    const { Toast } = await import('./Toast.js')
    expect(typeof Toast).toBe('function')
  })
})
