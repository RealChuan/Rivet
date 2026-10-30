import { describe, expect, it } from 'vitest'
import { TITLEBAR_HEIGHT } from '@shared/constants/index.js'
import { titlebarPadding } from './titlebar-padding.js'

describe('titlebarPadding', () => {
  it('uses env() for WCO', () => {
    expect(titlebarPadding('wco')).toBe('env(titlebar-area-height, 36px)')
  })

  it('uses the fixed height for macOS hidden titlebar', () => {
    expect(titlebarPadding('mac-hidden')).toBe(TITLEBAR_HEIGHT)
  })

  it('uses the fixed height for the custom Win10/Linux titlebar', () => {
    expect(titlebarPadding('custom')).toBe(TITLEBAR_HEIGHT)
  })
})
