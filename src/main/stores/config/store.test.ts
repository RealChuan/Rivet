import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  defaultStore,
  markConfigChanged,
  resetConfigChanged,
  hasConfigChanged,
  getFromMemory,
  setToMemory,
  getInMemoryConfig,
  setInMemoryConfig,
  setDefaultUiSettings,
} from './store.js'

describe('config store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('defaultStore', () => {
    it('should have correct default values', () => {
      expect(defaultStore.savedConnections).toEqual([])
      expect(defaultStore.uiSettings.appearance).toBeDefined()
      expect(defaultStore.uiSettings.locale).toBe('')
      expect(defaultStore.uiSettings.connectionSortOrder).toBeDefined()
    })
  })

  describe('configChanged flag', () => {
    it('should track config changes', () => {
      expect(hasConfigChanged()).toBe(false)
      markConfigChanged()
      expect(hasConfigChanged()).toBe(true)
      resetConfigChanged()
      expect(hasConfigChanged()).toBe(false)
    })
  })

  describe('in-memory config operations', () => {
    it('should get and set values in memory', () => {
      const testConnections = [{ id: 'test', name: 'Test' }]
      setToMemory('savedConnections', testConnections as never)
      expect(getFromMemory('savedConnections')).toEqual(testConnections)
      expect(hasConfigChanged()).toBe(true)
    })

    it('should get full in-memory config', () => {
      const config = getInMemoryConfig()
      expect(config.savedConnections).toBeDefined()
      expect(config.uiSettings).toBeDefined()
    })

    it('should set full in-memory config', () => {
      const newConfig = {
        savedConnections: [{ id: 'new', name: 'New' }],
        uiSettings: {
          appearance: 'dark',
          locale: 'en',
          connectionSortOrder: 'name-asc',
        },
      }
      setInMemoryConfig(newConfig as never)
      expect(getInMemoryConfig()).toEqual(newConfig)
    })

    it('should set default ui settings', () => {
      const newSettings = {
        appearance: 'light',
        locale: 'zh',
        connectionSortOrder: 'name-desc',
      }
      setDefaultUiSettings(newSettings as never)
      const config = getInMemoryConfig()
      expect(config.uiSettings).toEqual(newSettings)
    })
  })
})
