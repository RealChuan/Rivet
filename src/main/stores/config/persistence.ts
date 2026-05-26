import { logger } from '../../utils/index.js'
import { ERROR_CODES } from '../constants.js'
import {
  store,
  hasConfigChanged,
  resetConfigChanged,
  getInMemoryConfig,
  setInMemoryConfig,
  setToMemory,
} from './store.js'
import { isValidConnection, isValidUiSettings, detectSystemLanguage } from './validation.js'
import { defaultUiSettings } from './ui-settings.js'
import { STORE_KEYS } from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  type UiSettings,
  type Result,
  type ErrorInfo,
  ok,
  err,
  createErrorInfo,
  isErr,
} from '@shared/types/index.js'

export function initializeConfig(): void {
  try {
    const savedUiSettings = store.get(STORE_KEYS.UI_SETTINGS)
    const savedConnections = store.get(STORE_KEYS.SAVED_CONNECTIONS)

    let uiSettings = { ...defaultUiSettings }
    let connections: ConnectionConfig[] = []

    if (isValidUiSettings(savedUiSettings)) {
      if (!savedUiSettings.locale) {
        const systemLang = detectSystemLanguage()
        uiSettings = { ...savedUiSettings, locale: systemLang }
        logger.info(`First launch: language auto-detected as ${systemLang}`)
      } else {
        uiSettings = { ...savedUiSettings }
      }
    } else {
      const systemLang = detectSystemLanguage()
      uiSettings = { ...defaultUiSettings, locale: systemLang }
      logger.warn('Invalid UI settings detected, reset to defaults')
    }

    if (Array.isArray(savedConnections)) {
      const validConnections = savedConnections.filter(isValidConnection)
      connections = validConnections
      if (validConnections.length !== savedConnections.length) {
        const removedCount = savedConnections.length - validConnections.length
        logger.warn(`Filtered ${removedCount} invalid connection(s)`)
      }
    } else {
      logger.warn('Invalid connections format, reset to empty array')
    }

    setInMemoryConfig({ savedConnections: connections, uiSettings })
    logger.info('Config loaded successfully')
  } catch (error) {
    logger.catch(error, { action: 'load-config' })
    const systemLang = detectSystemLanguage()
    setInMemoryConfig({
      savedConnections: [],
      uiSettings: { ...defaultUiSettings, locale: systemLang },
    })
  }
}

export function flushConfigToDisk(): Result<void, ErrorInfo> {
  if (!hasConfigChanged()) {
    logger.debug('Config not changed, skipping flush')
    return ok(undefined)
  }

  try {
    const config = getInMemoryConfig()
    store.set(STORE_KEYS.SAVED_CONNECTIONS, config.savedConnections)
    store.set(STORE_KEYS.UI_SETTINGS, config.uiSettings)
    resetConfigChanged()
    logger.info('Config flushed to disk')
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'flush-config' })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to flush config to disk'))
  }
}

export function saveConfig(): void {
  const result = flushConfigToDisk()
  if (isErr(result)) {
    logger.error(`Failed to save config: ${result.error.message}`)
  }
}

let autoSaveTimer: ReturnType<typeof setInterval> | null = null

export function startAutoSave(intervalMs: number = 300000): void {
  if (autoSaveTimer) {
    stopAutoSave()
  }

  autoSaveTimer = setInterval(() => {
    logger.debug('Auto-save triggered')
    void flushConfigToDisk()
  }, intervalMs)

  logger.info(`Auto-save started with interval: ${intervalMs}ms`)
}

export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
    logger.info('Auto-save stopped')
  }
}

export function getUserInterfaceSettings(): Result<UiSettings, ErrorInfo> {
  try {
    const config = getInMemoryConfig()
    return ok({ ...config.uiSettings })
  } catch (error) {
    logger.catch(error, { action: 'get-ui-settings' })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to get UI settings'))
  }
}

export function setUserInterfaceSettings(settings: UiSettings): Result<void, ErrorInfo> {
  try {
    if (!isValidUiSettings(settings)) {
      return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Invalid UI settings value'))
    }
    setToMemory(STORE_KEYS.UI_SETTINGS, { ...settings })
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-ui-settings' })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to set UI settings'))
  }
}

export function getConfigurationValue(key: string): Result<unknown, ErrorInfo> {
  try {
    if (key === STORE_KEYS.SAVED_CONNECTIONS) {
      const config = getInMemoryConfig()
      return ok([...config.savedConnections])
    }
    if (key === STORE_KEYS.UI_SETTINGS) {
      const config = getInMemoryConfig()
      return ok({ ...config.uiSettings })
    }
    const config = getInMemoryConfig()
    return ok(config[key as keyof typeof config])
  } catch (error) {
    logger.catch(error, { action: 'get-config-value', key })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to get config value'))
  }
}

export function setConfigurationValue(key: string, value: unknown): Result<void, ErrorInfo> {
  try {
    if (key === STORE_KEYS.SAVED_CONNECTIONS) {
      const connections = (value as ConnectionConfig[]).filter(isValidConnection)
      setToMemory(STORE_KEYS.SAVED_CONNECTIONS, connections)
    } else if (key === STORE_KEYS.UI_SETTINGS) {
      if (!isValidUiSettings(value)) {
        return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Invalid UI settings value'))
      }
      setToMemory(STORE_KEYS.UI_SETTINGS, { ...value })
    } else {
      const config = getInMemoryConfig()
      setInMemoryConfig({ ...config, [key]: value })
    }
    logger.info(`Config updated: ${key}`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-config-value', key })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to set config value'))
  }
}

export function removeConfigurationValue(key: string): Result<void, ErrorInfo> {
  try {
    if (key === STORE_KEYS.SAVED_CONNECTIONS) {
      setToMemory(STORE_KEYS.SAVED_CONNECTIONS, [])
    } else if (key === STORE_KEYS.UI_SETTINGS) {
      setToMemory(STORE_KEYS.UI_SETTINGS, { ...defaultUiSettings })
    }
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'remove-config-value', key })
    return err(createErrorInfo(ERROR_CODES.CONFIG_ERROR, 'Failed to delete config value'))
  }
}
