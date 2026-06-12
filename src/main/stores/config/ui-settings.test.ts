import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_VALUE, SORT_ORDER } from '@shared/constants/index.js'
import { defaultUiSettings } from './ui-settings.js'

describe('ui-settings utilities', () => {
  describe('defaultUiSettings', () => {
    it('should have correct default values', () => {
      expect(defaultUiSettings.appearance).toBe(DEFAULT_THEME_VALUE)
      expect(defaultUiSettings.locale).toBe('')
      expect(defaultUiSettings.connectionSortOrder).toBe(SORT_ORDER.NONE)
    })
  })
})
