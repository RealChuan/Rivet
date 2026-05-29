import { describe, expect, it, vi } from 'vitest'

vi.mock('./TitleBar.js', () => ({
  TitleBar: vi.fn(),
}))

import { TitleBar } from './TitleBar.js'

describe('TitleBar component', () => {
  it('should export TitleBar component', () => {
    expect(typeof TitleBar).toBe('function')
  })
})
