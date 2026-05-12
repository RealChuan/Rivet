import Store from 'electron-store'
import { app } from 'electron'
import { logger } from '../utils/index.js'
import type { ConnectionConfig, UiSettings } from '@shared/types/index.js'

type StoredConnection = Omit<ConnectionConfig, 'password'>

interface StoreSchema {
  saved_connections: StoredConnection[]
  ui_settings: UiSettings
}

const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const defaultUiSettings: UiSettings = {
  theme: 'system',
  language: '',
}

const defaultStore: StoreSchema = {
  saved_connections: [],
  ui_settings: defaultUiSettings,
}

const store = new Store<StoreSchema>({
  defaults: defaultStore,
})

function detectSystemLanguage(): SupportedLanguage {
  try {
    const systemLang = app.getLocale()
    if (systemLang.startsWith('zh')) {
      return 'zh-CN'
    }
    if (SUPPORTED_LANGUAGES.includes(systemLang as SupportedLanguage)) {
      return systemLang as SupportedLanguage
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.warn(`Failed to detect system language: ${errMsg}`)
  }
  return 'en-US'
}

function isValidConnection(config: unknown): config is StoredConnection {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>
  return (
    typeof c.connectionUuid === 'string' &&
    typeof c.name === 'string' &&
    (c.protocol === 'sftp' || c.protocol === 'webdav') &&
    typeof c.host === 'string' &&
    typeof c.port === 'number' &&
    typeof c.username === 'string' &&
    (c.basePath === undefined || typeof c.basePath === 'string') &&
    (c.scheme === undefined || c.scheme === 'http' || c.scheme === 'https') &&
    (c.rejectUnauthorized === undefined || typeof c.rejectUnauthorized === 'boolean') &&
    (c.savePassword === undefined || typeof c.savePassword === 'boolean')
  )
}

function isValidUiSettings(settings: unknown): settings is UiSettings {
  if (!settings || typeof settings !== 'object') return false
  const s = settings as Record<string, unknown>
  return (
    (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') &&
    (s.language === 'zh-CN' || s.language === 'en-US' || s.language === '')
  )
}

export function loadConfig(): void {
  try {
    const savedUiSettings = store.get('ui_settings')
    const savedConnections = store.get('saved_connections')

    if (isValidUiSettings(savedUiSettings)) {
      if (!savedUiSettings.language) {
        const systemLang = detectSystemLanguage()
        store.set('ui_settings', {
          ...savedUiSettings,
          language: systemLang,
        })
        logger.info(`First launch: language auto-detected as ${systemLang}`)
      }
    } else {
      const systemLang = detectSystemLanguage()
      store.set('ui_settings', {
        ...defaultUiSettings,
        language: systemLang,
      })
      logger.warn('Invalid UI settings detected, reset to defaults')
    }

    if (Array.isArray(savedConnections)) {
      const validConnections = savedConnections.filter(isValidConnection)
      if (validConnections.length !== savedConnections.length) {
        store.set('saved_connections', validConnections)
        const removedCount = savedConnections.length - validConnections.length
        logger.warn(`Filtered ${removedCount} invalid connection(s)`)
      }
    } else {
      store.set('saved_connections', [])
      logger.warn('Invalid connections format, reset to empty array')
    }

    logger.info('Config loaded successfully')
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Critical error loading config: ${errMsg}`)
    const systemLang = detectSystemLanguage()
    store.set('ui_settings', { ...defaultUiSettings, language: systemLang })
    store.set('saved_connections', [])
  }
}

export function getSavedConnections(): StoredConnection[] {
  const connections = store.get('saved_connections')
  if (!Array.isArray(connections)) return []
  return connections.filter(isValidConnection)
}

export function saveConnection(config: ConnectionConfig): void {
  const { password, ...configToSave } = config
  void password

  if (!isValidConnection(configToSave)) {
    logger.error(`Invalid connection config rejected: ${JSON.stringify(configToSave)}`)
    throw new Error('Invalid connection configuration')
  }

  const connections = getSavedConnections()
  const index = connections.findIndex(c => c.connectionUuid === config.connectionUuid)

  if (index >= 0) {
    connections[index] = configToSave
  } else {
    connections.push(configToSave)
  }

  store.set('saved_connections', connections)
  logger.info(
    `Connection ${index >= 0 ? 'updated' : 'added'}: ${config.name} (${config.connectionUuid})`
  )
}

export function deleteConnection(connectionUuid: string): void {
  const connections = getSavedConnections().filter(c => c.connectionUuid !== connectionUuid)
  store.set('saved_connections', connections)
  logger.info(`Connection deleted: ${connectionUuid}`)
}

export function getUiSettings(): UiSettings {
  const settings = store.get('ui_settings')

  if (isValidUiSettings(settings)) {
    return { ...settings }
  }

  return { ...defaultUiSettings }
}

export function setUiSettings(settings: Partial<UiSettings>): void {
  const allowedKeys: (keyof UiSettings)[] = ['theme', 'language']
  const updates = Object.fromEntries(
    Object.entries(settings).filter(([key]) => allowedKeys.includes(key as keyof UiSettings))
  )

  if (Object.keys(updates).length === 0) {
    logger.warn('No valid UI settings to update')
    return
  }

  const current = getUiSettings()
  const updated: UiSettings = { ...current, ...(updates as Partial<UiSettings>) }

  if (!isValidUiSettings(updated)) {
    throw new Error('Invalid UI settings combination')
  }

  store.set('ui_settings', updated)
  logger.info(`UI settings updated: ${JSON.stringify(updates)}`)
}

export function getConfigValue(key: string): unknown {
  if (key === 'saved_connections') {
    return getSavedConnections()
  }
  if (key === 'ui_settings') {
    return getUiSettings()
  }
  return store.get(key)
}

export function setConfigValue(key: string, value: unknown): void {
  if (key === 'saved_connections') {
    const connections = (value as StoredConnection[]).filter(isValidConnection)
    store.set(key, connections)
  } else if (key === 'ui_settings') {
    if (!isValidUiSettings(value)) {
      throw new Error('Invalid UI settings value')
    }
    store.set(key, value)
  } else {
    store.set(key, value)
  }

  logger.info(`Config updated: ${key}`)
}

/**
 * @deprecated electron-store 已自动持久化，无需手动调用
 */
export function saveConfig(): void {
  logger.debug('saveConfig() is no-op: electron-store auto-saves')
}

export default store
