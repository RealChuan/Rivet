import { describe, expect, it, vi } from 'vitest'

vi.unmock('i18next')
vi.unmock('react-i18next')

describe('i18n config', () => {
  it('should export initialized i18n instance', async () => {
    const i18n = (await import('./config.js')).default
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on('initialized', () => resolve())
      })
    }
    expect(i18n.isInitialized).toBe(true)
  })

  it('should have zh-CN and en-US resources', async () => {
    const i18n = (await import('./config.js')).default
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on('initialized', () => resolve())
      })
    }
    const resources = i18n.options.resources as Record<string, unknown>
    expect(resources).toBeDefined()
    expect(resources['zh-CN']).toBeDefined()
    expect(resources['en-US']).toBeDefined()
  })

  it('should use en-US as fallback language', async () => {
    const i18n = (await import('./config.js')).default
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on('initialized', () => resolve())
      })
    }
    expect(i18n.options.fallbackLng).toEqual(['en-US'])
  })
})
