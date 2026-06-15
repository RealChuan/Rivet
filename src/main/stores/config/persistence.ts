import type { SortOrder } from '@shared/constants/sort.js'
import {
  ERROR_CODE,
  SORT_ORDER,
  STORE_KEY,
  TIMEOUTS,
  TRANSFER_CONFIG,
} from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  createErrorInfo,
  err,
  type ErrorInfo,
  isErr,
  ok,
  type Result,
  type TransferSettings,
  type UiSettings,
} from '@shared/types/index.js'
import { logger } from '../../utils/index.js'
import {
  getInMemoryConfig,
  hasConfigChanged,
  resetConfigChanged,
  setInMemoryConfig,
  setToMemory,
  store,
} from './store.js'
import { defaultUiSettings } from './ui-settings.js'
import { detectSystemLanguage, isValidConnection, isValidUiSettings } from './validation.js'

function loadUiSettings(): UiSettings {
  const saved = store.get(STORE_KEY.UI_SETTINGS)
  if (isValidUiSettings(saved)) {
    if (!saved.locale) {
      const systemLang = detectSystemLanguage()
      logger.info(`First launch: language auto-detected as ${systemLang}`)
      return { ...saved, locale: systemLang }
    }
    return { ...saved }
  }
  const systemLang = detectSystemLanguage()
  logger.warn('Invalid UI settings detected, reset to defaults')
  return { ...defaultUiSettings, locale: systemLang }
}

function loadConnections(): ConnectionConfig[] {
  const saved = store.get(STORE_KEY.SAVED_CONNECTIONS)
  if (Array.isArray(saved)) {
    const validConnections = saved.filter(isValidConnection)
    if (validConnections.length !== saved.length) {
      const removedCount = saved.length - validConnections.length
      logger.warn(`Filtered ${removedCount} invalid connection(s)`)
    }
    return validConnections
  }
  logger.warn('Invalid connections format, reset to empty array')
  return []
}

function loadTransferSettings(): TransferSettings {
  const saved = store.get(STORE_KEY.TRANSFER_SETTINGS)
  if (
    saved &&
    typeof saved === 'object' &&
    typeof saved.maxUploadConcurrency === 'number' &&
    typeof saved.maxDownloadConcurrency === 'number'
  ) {
    return {
      maxUploadConcurrency: Math.min(
        TRANSFER_CONFIG.MAX_CONCURRENCY,
        Math.max(TRANSFER_CONFIG.MIN_CONCURRENCY, saved.maxUploadConcurrency)
      ),
      maxDownloadConcurrency: Math.min(
        TRANSFER_CONFIG.MAX_CONCURRENCY,
        Math.max(TRANSFER_CONFIG.MIN_CONCURRENCY, saved.maxDownloadConcurrency)
      ),
    }
  }
  return {
    maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
    maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  }
}

function loadConnectionSortOrder(): SortOrder {
  const saved = store.get(STORE_KEY.CONNECTION_SORT_ORDER)
  if (saved === SORT_ORDER.NONE || saved === SORT_ORDER.ASC || saved === SORT_ORDER.DESC) {
    return saved
  }
  return SORT_ORDER.NONE
}

export function initializeConfig(): void {
  try {
    setInMemoryConfig({
      uiSettings: loadUiSettings(),
      savedConnections: loadConnections(),
      transferSettings: loadTransferSettings(),
      connectionSortOrder: loadConnectionSortOrder(),
    })
    logger.info('Config loaded successfully')
  } catch (error) {
    logger.catch(error, { action: 'load-config' })
    const systemLang = detectSystemLanguage()
    setInMemoryConfig({
      savedConnections: [],
      uiSettings: { ...defaultUiSettings, locale: systemLang },
      transferSettings: {
        maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
        maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
      },
      connectionSortOrder: SORT_ORDER.NONE,
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
    // savePassword=false 的连接不将密码写入磁盘
    const connectionsToSave = config.savedConnections.map(connection => {
      if (!connection.savePassword) {
        const { password: _, ...rest } = connection
        return rest
      }
      return connection
    })
    store.set(STORE_KEY.SAVED_CONNECTIONS, connectionsToSave)
    store.set(STORE_KEY.UI_SETTINGS, config.uiSettings)
    store.set(STORE_KEY.TRANSFER_SETTINGS, config.transferSettings)
    store.set(STORE_KEY.CONNECTION_SORT_ORDER, config.connectionSortOrder)
    resetConfigChanged()
    logger.info('Config flushed to disk')
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'flush-config' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to flush config to disk'))
  }
}

export function saveConfig(): void {
  void flushConfigToDisk()
}

let autoSaveTimer: ReturnType<typeof setInterval> | null = null

export function startAutoSave(intervalMs: number = TIMEOUTS.AUTO_SAVE_INTERVAL): void {
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
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to get UI settings'))
  }
}

export function setUserInterfaceSettings(settings: UiSettings): Result<void, ErrorInfo> {
  try {
    if (!isValidUiSettings(settings)) {
      return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Invalid UI settings value'))
    }
    setToMemory(STORE_KEY.UI_SETTINGS, { ...settings })
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-ui-settings' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to set UI settings'))
  }
}

const configGetHandlers: Record<string, () => Result<unknown, ErrorInfo>> = {
  [STORE_KEY.SAVED_CONNECTIONS]: () => {
    const config = getInMemoryConfig()
    return ok([...config.savedConnections])
  },
  [STORE_KEY.UI_SETTINGS]: () => {
    const config = getInMemoryConfig()
    return ok({ ...config.uiSettings })
  },
}

const configSetHandlers: Record<string, (value: unknown) => Result<void, ErrorInfo>> = {
  [STORE_KEY.SAVED_CONNECTIONS]: value => {
    const connections = (value as ConnectionConfig[]).filter(isValidConnection)
    setToMemory(STORE_KEY.SAVED_CONNECTIONS, connections)
    return ok(undefined)
  },
  [STORE_KEY.UI_SETTINGS]: value => {
    if (!isValidUiSettings(value)) {
      return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Invalid UI settings value'))
    }
    setToMemory(STORE_KEY.UI_SETTINGS, { ...value })
    return ok(undefined)
  },
}

export function getConfigurationValue(key: string): Result<unknown, ErrorInfo> {
  try {
    const handler = configGetHandlers[key]
    if (handler) return handler()
    const config = getInMemoryConfig()
    return ok(config[key as keyof typeof config])
  } catch (error) {
    logger.catch(error, { action: 'get-config-value', key })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to get config value'))
  }
}

export function setConfigurationValue(key: string, value: unknown): Result<void, ErrorInfo> {
  try {
    const handler = configSetHandlers[key]
    if (handler) {
      const result = handler(value)
      if (isErr(result)) return result
    } else {
      return err(createErrorInfo(ERROR_CODE.INVALID_CONFIG, `Unknown config key: ${key}`))
    }
    logger.info(`Config updated: ${key}`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-config-value', key })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to set config value'))
  }
}
