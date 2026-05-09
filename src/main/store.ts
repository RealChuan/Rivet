import Store from 'electron-store'
import { app } from 'electron'
import logger from './logger.js'

// ============ 类型定义 ============

interface UiSettings {
  theme: 'light' | 'dark' | 'system'
  language: SupportedLanguage | '' // '' 表示未设置，跟随系统
}

interface ConnectionConfig {
  id: string
  name: string
  protocol: 'sftp' | 'webdav'
  host: string
  port: number
  username: string
  credentialId: string
  basePath?: string
}

interface StoreSchema {
  saved_connections: ConnectionConfig[]
  ui_settings: UiSettings
}

const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// ============ 常量与默认值 ============

export const defaultUiSettings: UiSettings = {
  theme: 'system',
  language: '', // 空字符串表示首次启动，需要检测系统语言
}

const defaultStore: StoreSchema = {
  saved_connections: [],
  ui_settings: defaultUiSettings,
}

// ============ Store 实例 ============

const store = new Store<StoreSchema>({
  defaults: defaultStore,
  // 可选：增加 schema 校验
  // schema: { ... }
})

// ============ 工具函数 ============

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
    logger.warn(`Failed to detect system language: ${error}`)
  }

  return 'en-US' // 兜底
}

function isValidConnection(config: unknown): config is ConnectionConfig {
  if (!config || typeof config !== 'object') return false

  const c = config as Record<string, unknown>

  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    (c.protocol === 'sftp' || c.protocol === 'webdav') &&
    typeof c.host === 'string' &&
    typeof c.port === 'number' &&
    typeof c.username === 'string' &&
    typeof c.credentialId === 'string' &&
    (c.basePath === undefined || typeof c.basePath === 'string')
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

// ============ 配置加载与初始化 ============

/**
 * 初始化配置
 * - 首次启动：检测系统语言并保存
 * - 配置损坏：重置为默认值
 * - 已有配置：校验并清理无效数据
 */
export function loadConfig(): void {
  try {
    const savedUiSettings = store.get('ui_settings')
    const savedConnections = store.get('saved_connections')

    // 处理 UI 设置
    if (isValidUiSettings(savedUiSettings)) {
      // 如果语言未设置（首次启动），检测系统语言
      if (!savedUiSettings.language) {
        const systemLang = detectSystemLanguage()
        store.set('ui_settings', {
          ...savedUiSettings,
          language: systemLang,
        })
        logger.info(`First launch: language auto-detected as ${systemLang}`)
      }
    } else {
      // 配置损坏或无效，重置
      const systemLang = detectSystemLanguage()
      store.set('ui_settings', {
        ...defaultUiSettings,
        language: systemLang,
      })
      logger.warn('Invalid UI settings detected, reset to defaults')
    }

    // 处理连接配置：过滤无效项
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
    logger.error(`Critical error loading config: ${error}`)
    // 极端情况：完全重置
    const systemLang = detectSystemLanguage()
    store.set('ui_settings', { ...defaultUiSettings, language: systemLang })
    store.set('saved_connections', [])
  }
}

// ============ 连接管理 ============

export function getSavedConnections(): ConnectionConfig[] {
  const connections = store.get('saved_connections')
  if (!Array.isArray(connections)) return []
  return connections.filter(isValidConnection)
}

export function saveConnection(config: ConnectionConfig): void {
  if (!isValidConnection(config)) {
    logger.error(`Invalid connection config rejected: ${JSON.stringify(config)}`)
    throw new Error('Invalid connection configuration')
  }

  const connections = getSavedConnections()
  const index = connections.findIndex(c => c.id === config.id)

  if (index >= 0) {
    connections[index] = config
  } else {
    connections.push(config)
  }

  store.set('saved_connections', connections)
  logger.info(`Connection ${index >= 0 ? 'updated' : 'added'}: ${config.name} (${config.id})`)
}

export function deleteConnection(id: string): void {
  const connections = getSavedConnections().filter(c => c.id !== id)
  store.set('saved_connections', connections)
  logger.info(`Connection deleted: ${id}`)
}

// ============ UI 设置管理 ============

export function getUiSettings(): UiSettings {
  const settings = store.get('ui_settings')

  if (isValidUiSettings(settings)) {
    return { ...settings }
  }

  // 回退到默认值（但不自动覆盖存储，留给 loadConfig 处理）
  return { ...defaultUiSettings }
}

export function setUiSettings(settings: Partial<UiSettings>): void {
  // 只允许更新支持的字段
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

  // 校验合并后的结果
  if (!isValidUiSettings(updated)) {
    throw new Error('Invalid UI settings combination')
  }

  store.set('ui_settings', updated)
  logger.info(`UI settings updated: ${JSON.stringify(updates)}`)
}

// ============ 通用配置接口 ============

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
    const connections = (value as ConnectionConfig[]).filter(isValidConnection)
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

// ============ 兼容性保留 ============

/**
 * @deprecated electron-store 已自动持久化，无需手动调用
 */
export function saveConfig(): void {
  logger.debug('saveConfig() is no-op: electron-store auto-saves')
}

// 导出 store 实例供高级使用
export default store
