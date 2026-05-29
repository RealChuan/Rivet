import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORE_KEY } from '@shared/constants/index.js'
import {
  flushConfigToDisk,
  getConfigurationValue,
  getUserInterfaceSettings,
  initializeConfig,
  removeConfigurationValue,
  saveConfig,
  setConfigurationValue,
  setUserInterfaceSettings,
  startAutoSave,
  stopAutoSave,
} from './persistence.js'

const mockStoreGet = vi.fn()
const mockStoreSet = vi.fn()

vi.mock('./store.js', () => ({
  store: {
    get: (..._args: unknown[]): unknown => mockStoreGet(..._args),
    set: (..._args: unknown[]): void => {
      void mockStoreSet(..._args)
    },
  },
  hasConfigChanged: vi.fn().mockReturnValue(false),
  resetConfigChanged: vi.fn(),
  getInMemoryConfig: vi.fn(),
  setInMemoryConfig: vi.fn(),
  setToMemory: vi.fn(),
}))

vi.mock('./validation.js', () => ({
  isValidConnection: vi.fn(),
  isValidUiSettings: vi.fn(),
  detectSystemLanguage: vi.fn(),
}))

vi.mock('./ui-settings.js', () => ({
  defaultUiSettings: {
    appearance: 'system',
    locale: '',
    connectionSortOrder: 'none',
  },
}))

vi.mock('../../utils/index.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    catch: vi.fn(),
  },
}))

vi.mock('@shared/constants/index.js', () => ({
  STORE_KEY: {
    SAVED_CONNECTIONS: 'savedConnections',
    UI_SETTINGS: 'uiSettings',
  },
  ERROR_CODE: { CONFIG_ERROR: 'CONFIG_ERROR' },
}))

vi.mock('@shared/types/index.js', () => ({
  ok: (value: unknown) => ({ success: true as const, value, error: null }),
  err: (error: unknown) => ({ success: false as const, value: null, error }),
  createErrorInfo: (code: string, message: string, detail?: string) => ({
    code,
    message,
    ...(detail !== undefined ? { detail } : {}),
  }),
  isErr: <T, E>(result: { success: boolean; value: T; error: E }) => result.success === false,
}))

import { logger } from '../../utils/index.js'
import {
  getInMemoryConfig,
  hasConfigChanged,
  resetConfigChanged,
  setInMemoryConfig,
  setToMemory,
} from './store.js'
import { defaultUiSettings } from './ui-settings.js'
import { detectSystemLanguage, isValidConnection, isValidUiSettings } from './validation.js'

describe('persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    stopAutoSave()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initializeConfig', () => {
    it('should load valid UI settings with locale', () => {
      const savedSettings = {
        appearance: 'dark',
        locale: 'zh-CN',
        connectionSortOrder: 'none',
      } as const
      mockStoreGet.mockImplementation((key: unknown) => {
        if (key === STORE_KEY.UI_SETTINGS) return savedSettings
        if (key === STORE_KEY.SAVED_CONNECTIONS) return []
        return undefined
      })
      vi.mocked(isValidUiSettings).mockReturnValue(true)

      initializeConfig()

      expect(setInMemoryConfig).toHaveBeenCalledWith({
        savedConnections: [],
        uiSettings: savedSettings,
      })
      expect(logger.info).toHaveBeenCalledWith('Config loaded successfully')
    })

    it('should auto-detect language when saved UI settings have empty locale', () => {
      const savedSettings = { appearance: 'dark', locale: '', connectionSortOrder: 'none' } as const
      mockStoreGet.mockImplementation((key: unknown) => {
        if (key === STORE_KEY.UI_SETTINGS) return savedSettings
        if (key === STORE_KEY.SAVED_CONNECTIONS) return []
        return undefined
      })
      vi.mocked(isValidUiSettings).mockReturnValue(true)
      vi.mocked(detectSystemLanguage).mockReturnValue('en-US')

      initializeConfig()

      expect(detectSystemLanguage).toHaveBeenCalled()
      expect(setInMemoryConfig).toHaveBeenCalledWith({
        savedConnections: [],
        uiSettings: { ...savedSettings, locale: 'en-US' },
      })
      expect(logger.info).toHaveBeenCalledWith('First launch: language auto-detected as en-US')
    })

    it('should reset to defaults and detect language when UI settings are invalid', () => {
      mockStoreGet.mockImplementation((key: unknown) => {
        if (key === STORE_KEY.UI_SETTINGS) return { invalid: true }
        if (key === STORE_KEY.SAVED_CONNECTIONS) return []
        return undefined
      })
      vi.mocked(isValidUiSettings).mockReturnValue(false)
      vi.mocked(detectSystemLanguage).mockReturnValue('zh-CN')

      initializeConfig()

      expect(detectSystemLanguage).toHaveBeenCalled()
      expect(setInMemoryConfig).toHaveBeenCalledWith({
        savedConnections: [],
        uiSettings: { ...defaultUiSettings, locale: 'zh-CN' },
      })
      expect(logger.warn).toHaveBeenCalledWith('Invalid UI settings detected, reset to defaults')
    })

    it('should filter invalid connections and log warning', () => {
      const validConn = {
        id: '1',
        name: 'Valid',
        protocol: 'sftp' as const,
        host: 'host1',
        port: 22,
        username: 'user1',
      }
      const invalidConn = { id: '2', bad: true }
      mockStoreGet.mockImplementation((key: unknown) => {
        if (key === STORE_KEY.UI_SETTINGS)
          return { appearance: 'dark', locale: 'en-US', connectionSortOrder: 'none' }
        if (key === STORE_KEY.SAVED_CONNECTIONS) return [validConn, invalidConn]
        return undefined
      })
      vi.mocked(isValidUiSettings).mockReturnValue(true)
      vi.mocked(isValidConnection).mockImplementation((c: unknown) => c === validConn)

      initializeConfig()

      expect(setInMemoryConfig).toHaveBeenCalledWith(
        expect.objectContaining({ savedConnections: [validConn] })
      )
      expect(logger.warn).toHaveBeenCalledWith('Filtered 1 invalid connection(s)')
    })

    it('should reset connections to empty array when format is invalid', () => {
      mockStoreGet.mockImplementation((key: unknown) => {
        if (key === STORE_KEY.UI_SETTINGS)
          return { appearance: 'dark', locale: 'en-US', connectionSortOrder: 'none' }
        if (key === STORE_KEY.SAVED_CONNECTIONS) return 'not-an-array'
        return undefined
      })
      vi.mocked(isValidUiSettings).mockReturnValue(true)

      initializeConfig()

      expect(setInMemoryConfig).toHaveBeenCalledWith(
        expect.objectContaining({ savedConnections: [] })
      )
      expect(logger.warn).toHaveBeenCalledWith('Invalid connections format, reset to empty array')
    })

    it('should fall back to defaults on exception', () => {
      mockStoreGet.mockImplementation(() => {
        throw new Error('disk read error')
      })
      vi.mocked(detectSystemLanguage).mockReturnValue('en-US')

      initializeConfig()

      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), { action: 'load-config' })
      expect(setInMemoryConfig).toHaveBeenCalledWith({
        savedConnections: [],
        uiSettings: { ...defaultUiSettings, locale: 'en-US' },
      })
    })
  })

  describe('flushConfigToDisk', () => {
    it('should skip flush when config has not changed', () => {
      vi.mocked(hasConfigChanged).mockReturnValue(false)

      const result = flushConfigToDisk()

      expect(result.success).toBe(true)
      expect(getInMemoryConfig).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith('Config not changed, skipping flush')
    })

    it('should flush config to disk when changed', () => {
      const mockConfig = {
        savedConnections: [
          {
            id: '1',
            name: 'Test',
            protocol: 'sftp' as const,
            host: 'host1',
            port: 22,
            username: 'user1',
          },
        ],
        uiSettings: {
          appearance: 'dark' as const,
          locale: 'en-US' as const,
          connectionSortOrder: 'none' as const,
        },
      }
      vi.mocked(hasConfigChanged).mockReturnValue(true)
      vi.mocked(getInMemoryConfig).mockReturnValue(mockConfig)

      const result = flushConfigToDisk()

      expect(result.success).toBe(true)
      expect(mockStoreSet).toHaveBeenCalledWith(
        STORE_KEY.SAVED_CONNECTIONS,
        mockConfig.savedConnections
      )
      expect(mockStoreSet).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, mockConfig.uiSettings)
      expect(resetConfigChanged).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('Config flushed to disk')
    })

    it('should return error when flush throws', () => {
      vi.mocked(hasConfigChanged).mockReturnValue(true)
      vi.mocked(getInMemoryConfig).mockImplementation(() => {
        throw new Error('disk write error')
      })

      const result = flushConfigToDisk()

      expect(result.success).toBe(false)
      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), { action: 'flush-config' })
    })
  })

  describe('saveConfig', () => {
    it('should call flushConfigToDisk and succeed silently', () => {
      vi.mocked(hasConfigChanged).mockReturnValue(false)

      saveConfig()

      expect(logger.error).not.toHaveBeenCalled()
    })

    it('should log error when flushConfigToDisk fails', () => {
      vi.mocked(hasConfigChanged).mockReturnValue(true)
      vi.mocked(getInMemoryConfig).mockImplementation(() => {
        throw new Error('flush fail')
      })

      saveConfig()

      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('startAutoSave', () => {
    it('should start auto-save with default interval', () => {
      startAutoSave()

      expect(logger.info).toHaveBeenCalledWith('Auto-save started with interval: 300000ms')
    })

    it('should start auto-save with custom interval', () => {
      startAutoSave(5000)

      expect(logger.info).toHaveBeenCalledWith('Auto-save started with interval: 5000ms')
    })

    it('should trigger flush on interval tick', () => {
      vi.mocked(hasConfigChanged).mockReturnValue(false)
      startAutoSave(1000)

      vi.advanceTimersByTime(1000)

      expect(logger.debug).toHaveBeenCalledWith('Auto-save triggered')
    })

    it('should restart timer if already running', () => {
      vi.mocked(hasConfigChanged).mockReturnValue(false)
      startAutoSave(1000)
      startAutoSave(2000)

      vi.advanceTimersByTime(1000)
      expect(logger.debug).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)
      expect(logger.debug).toHaveBeenCalledWith('Auto-save triggered')
    })
  })

  describe('stopAutoSave', () => {
    it('should stop auto-save and clear timer', () => {
      startAutoSave(1000)
      stopAutoSave()

      expect(logger.info).toHaveBeenCalledWith('Auto-save stopped')

      vi.advanceTimersByTime(2000)
      expect(logger.debug).not.toHaveBeenCalledWith('Auto-save triggered')
    })

    it('should do nothing when no auto-save is running', () => {
      stopAutoSave()

      expect(logger.info).not.toHaveBeenCalledWith('Auto-save stopped')
    })
  })

  describe('getUserInterfaceSettings', () => {
    it('should return UI settings from in-memory config', () => {
      const mockSettings = {
        appearance: 'dark' as const,
        locale: 'en-US' as const,
        connectionSortOrder: 'none' as const,
      }
      vi.mocked(getInMemoryConfig).mockReturnValue({
        savedConnections: [],
        uiSettings: mockSettings,
      })

      const result = getUserInterfaceSettings()

      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockSettings)
    })

    it('should return a copy of UI settings', () => {
      const mockSettings = {
        appearance: 'dark' as const,
        locale: 'en-US' as const,
        connectionSortOrder: 'none' as const,
      }
      vi.mocked(getInMemoryConfig).mockReturnValue({
        savedConnections: [],
        uiSettings: mockSettings,
      })

      const result = getUserInterfaceSettings()

      expect(result.value).not.toBe(mockSettings)
    })

    it('should return error when getInMemoryConfig throws', () => {
      vi.mocked(getInMemoryConfig).mockImplementation(() => {
        throw new Error('memory error')
      })

      const result = getUserInterfaceSettings()

      expect(result.success).toBe(false)
      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), { action: 'get-ui-settings' })
    })
  })

  describe('setUserInterfaceSettings', () => {
    it('should set valid UI settings', () => {
      const settings = {
        appearance: 'dark' as const,
        locale: 'zh-CN' as const,
        connectionSortOrder: 'asc' as const,
      }
      vi.mocked(isValidUiSettings).mockReturnValue(true)

      const result = setUserInterfaceSettings(settings)

      expect(result.success).toBe(true)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, { ...settings })
    })

    it('should return error for invalid UI settings', () => {
      const invalidSettings = {
        appearance: 'invalid' as unknown as 'dark',
        locale: '' as const,
        connectionSortOrder: 'none' as const,
      }
      vi.mocked(isValidUiSettings).mockReturnValue(false)

      const result = setUserInterfaceSettings(invalidSettings)

      expect(result.success).toBe(false)
      expect(setToMemory).not.toHaveBeenCalled()
    })

    it('should return error when setToMemory throws', () => {
      const settings = {
        appearance: 'dark' as const,
        locale: 'en-US' as const,
        connectionSortOrder: 'none' as const,
      }
      vi.mocked(isValidUiSettings).mockReturnValue(true)
      vi.mocked(setToMemory).mockImplementation(() => {
        throw new Error('set error')
      })

      const result = setUserInterfaceSettings(settings)

      expect(result.success).toBe(false)
      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), { action: 'set-ui-settings' })
    })
  })

  describe('getConfigurationValue', () => {
    const mockConfig = {
      savedConnections: [
        {
          id: '1',
          name: 'Test',
          protocol: 'sftp' as const,
          host: 'host1',
          port: 22,
          username: 'user1',
        },
      ],
      uiSettings: {
        appearance: 'dark' as const,
        locale: 'en-US' as const,
        connectionSortOrder: 'none' as const,
      },
    }

    it('should return a copy of saved connections', () => {
      vi.mocked(getInMemoryConfig).mockReturnValue(mockConfig)

      const result = getConfigurationValue(STORE_KEY.SAVED_CONNECTIONS)

      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockConfig.savedConnections)
      expect(result.value).not.toBe(mockConfig.savedConnections)
    })

    it('should return a copy of UI settings', () => {
      vi.mocked(getInMemoryConfig).mockReturnValue(mockConfig)

      const result = getConfigurationValue(STORE_KEY.UI_SETTINGS)

      expect(result.success).toBe(true)
      expect(result.value).toEqual(mockConfig.uiSettings)
      expect(result.value).not.toBe(mockConfig.uiSettings)
    })

    it('should return value for other keys', () => {
      vi.mocked(getInMemoryConfig).mockReturnValue({
        ...mockConfig,
        customKey: 'customValue',
      } as unknown as ReturnType<typeof getInMemoryConfig>)

      const allConfig = getInMemoryConfig() as unknown as Record<string, unknown>
      const customKey = Object.keys(allConfig).find(k => k === 'customKey') as keyof ReturnType<
        typeof getInMemoryConfig
      >
      const result = getConfigurationValue(customKey)

      expect(result.success).toBe(true)
      expect(result.value).toBe('customValue')
    })

    it('should return error when getInMemoryConfig throws', () => {
      vi.mocked(getInMemoryConfig).mockImplementation(() => {
        throw new Error('read error')
      })

      const result = getConfigurationValue(STORE_KEY.UI_SETTINGS)

      expect(result.success).toBe(false)
      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), {
        action: 'get-config-value',
        key: STORE_KEY.UI_SETTINGS,
      })
    })
  })

  describe('setConfigurationValue', () => {
    it('should filter and set connections for SAVED_CONNECTIONS key', () => {
      const validConn = {
        id: '1',
        name: 'Valid',
        protocol: 'sftp' as const,
        host: 'host1',
        port: 22,
        username: 'user1',
      }
      const invalidConn = { id: '2', bad: true }
      vi.mocked(isValidConnection).mockImplementation((c: unknown) => c === validConn)

      const result = setConfigurationValue(STORE_KEY.SAVED_CONNECTIONS, [validConn, invalidConn])

      expect(result.success).toBe(true)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [validConn])
    })

    it('should set valid UI settings for UI_SETTINGS key', () => {
      const settings = {
        appearance: 'dark' as const,
        locale: 'en-US' as const,
        connectionSortOrder: 'none' as const,
      }
      vi.mocked(isValidUiSettings).mockReturnValue(true)

      const result = setConfigurationValue(STORE_KEY.UI_SETTINGS, settings)

      expect(result.success).toBe(true)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, { ...settings })
    })

    it('should return error for invalid UI settings value', () => {
      vi.mocked(isValidUiSettings).mockReturnValue(false)

      const result = setConfigurationValue(STORE_KEY.UI_SETTINGS, { bad: true })

      expect(result.success).toBe(false)
      expect(setToMemory).not.toHaveBeenCalled()
    })

    it('should set arbitrary key via setInMemoryConfig for other keys', () => {
      const existingConfig = {
        savedConnections: [],
        uiSettings: {
          appearance: 'dark' as const,
          locale: 'en-US' as const,
          connectionSortOrder: 'none' as const,
        },
      }
      vi.mocked(getInMemoryConfig).mockReturnValue(existingConfig)

      const result = setConfigurationValue('customKey', 'customValue')

      expect(result.success).toBe(true)
      expect(setInMemoryConfig).toHaveBeenCalledWith({
        ...existingConfig,
        customKey: 'customValue',
      } as unknown as Parameters<typeof setInMemoryConfig>[0])
    })

    it('should log info on successful set', () => {
      vi.mocked(isValidConnection).mockReturnValue(true)

      setConfigurationValue(STORE_KEY.SAVED_CONNECTIONS, [])

      expect(logger.info).toHaveBeenCalledWith(`Config updated: ${STORE_KEY.SAVED_CONNECTIONS}`)
    })

    it('should return error when set throws', () => {
      vi.mocked(isValidConnection).mockImplementation(() => {
        throw new Error('set fail')
      })

      const result = setConfigurationValue(STORE_KEY.SAVED_CONNECTIONS, [
        {
          id: '1',
          name: 'Test',
          protocol: 'sftp' as const,
          host: 'host1',
          port: 22,
          username: 'user1',
        },
      ])

      expect(result.success).toBe(false)
      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), {
        action: 'set-config-value',
        key: STORE_KEY.SAVED_CONNECTIONS,
      })
    })
  })

  describe('removeConfigurationValue', () => {
    it('should reset saved connections to empty array', () => {
      const result = removeConfigurationValue(STORE_KEY.SAVED_CONNECTIONS)

      expect(result.success).toBe(true)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.SAVED_CONNECTIONS, [])
    })

    it('should reset UI settings to defaults', () => {
      const result = removeConfigurationValue(STORE_KEY.UI_SETTINGS)

      expect(result.success).toBe(true)
      expect(setToMemory).toHaveBeenCalledWith(STORE_KEY.UI_SETTINGS, { ...defaultUiSettings })
    })

    it('should return ok for other keys (no-op)', () => {
      const result = removeConfigurationValue('unknownKey')

      expect(result.success).toBe(true)
      expect(setToMemory).not.toHaveBeenCalled()
    })

    it('should return error when remove throws', () => {
      vi.mocked(setToMemory).mockImplementation(() => {
        throw new Error('remove fail')
      })

      const result = removeConfigurationValue(STORE_KEY.SAVED_CONNECTIONS)

      expect(result.success).toBe(false)
      expect(logger.catch).toHaveBeenCalledWith(expect.any(Error), {
        action: 'remove-config-value',
        key: STORE_KEY.SAVED_CONNECTIONS,
      })
    })
  })
})
