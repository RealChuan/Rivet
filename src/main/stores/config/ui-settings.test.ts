import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_THEME_VALUE, SORT_ORDER } from '@shared/constants/index.js'
import {
  defaultUiSettings,
  getUserInterfaceSettings,
  setUserInterfaceSettings,
} from './ui-settings.js'
import { isValidUiSettings } from './validation.js'

vi.mock('./validation.js', () => ({
  isValidUiSettings: vi.fn(),
}))

vi.mock('@main/utils/index.js', () => ({
  logger: {
    catch: vi.fn(),
  },
}))

describe('ui-settings utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('defaultUiSettings', () => {
    it('should have correct default values', () => {
      expect(defaultUiSettings.appearance).toBe(DEFAULT_THEME_VALUE)
      expect(defaultUiSettings.locale).toBe('')
      expect(defaultUiSettings.connectionSortOrder).toBe(SORT_ORDER.NONE)
    })
  })

  describe('getUserInterfaceSettings', () => {
    it('should return settings from memory', () => {
      const mockSettings = { appearance: 'dark', locale: 'en', connectionSortOrder: 'name-asc' }
      const getFromMemory = vi.fn().mockReturnValue(mockSettings)

      const result = getUserInterfaceSettings(getFromMemory)

      expect(getFromMemory).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockSettings)
    })

    it('should return error when getFromMemory throws', () => {
      const getFromMemory = vi.fn().mockImplementation(() => {
        throw new Error('Failed to get')
      })

      const result = getUserInterfaceSettings(getFromMemory)

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('CONFIG_ERROR')
      expect(result.error?.message).toBe('Failed to get UI settings')
    })
  })

  describe('setUserInterfaceSettings', () => {
    it('should set valid settings', () => {
      const mockSetToMemory = vi.fn()
      const settings = { appearance: 'dark', locale: 'en', connectionSortOrder: 'name-asc' }
      vi.mocked(isValidUiSettings).mockReturnValue(true)

      const result = setUserInterfaceSettings(mockSetToMemory, settings as never)

      expect(isValidUiSettings).toHaveBeenCalledWith(settings)
      expect(mockSetToMemory).toHaveBeenCalledWith(settings)
      expect(result.success).toBe(true)
    })

    it('should return error for invalid settings', () => {
      const mockSetToMemory = vi.fn()
      const invalidSettings = {
        appearance: 'invalid',
        locale: 'en',
        connectionSortOrder: 'name-asc',
      }
      vi.mocked(isValidUiSettings).mockReturnValue(false)

      const result = setUserInterfaceSettings(mockSetToMemory, invalidSettings as never)

      expect(isValidUiSettings).toHaveBeenCalled()
      expect(mockSetToMemory).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toBe('Invalid UI settings value')
    })

    it('should return error when setToMemory throws', () => {
      const mockSetToMemory = vi.fn().mockImplementation(() => {
        throw new Error('Failed to set')
      })
      const settings = { appearance: 'dark', locale: 'en', connectionSortOrder: 'name-asc' }
      vi.mocked(isValidUiSettings).mockReturnValue(true)

      const result = setUserInterfaceSettings(mockSetToMemory, settings as never)

      expect(result.success).toBe(false)
      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('CONFIG_ERROR')
    })
  })
})
