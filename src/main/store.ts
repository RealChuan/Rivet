import Store from 'electron-store'
import logger from './logger'

interface UiSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en-US'
  sidebarWidth: number
  queueDrawerOpen: boolean
  queueDrawerWidth: number
}

interface ConnectionConfig {
  id: string
  name: string
  protocol: 'sftp' | 'webdav'
  host: string
  port: number
  username: string
  credentialId: string
}

interface StoreSchema {
  saved_connections: ConnectionConfig[]
  ui_settings: UiSettings
}

const defaultUiSettings: UiSettings = {
  theme: 'system',
  language: 'en-US',
  sidebarWidth: 260,
  queueDrawerOpen: false,
  queueDrawerWidth: 360,
}

export const store = new Store<StoreSchema>({
  defaults: {
    saved_connections: [],
    ui_settings: defaultUiSettings,
  },
})

export function getSavedConnections(): ConnectionConfig[] {
  return (store as any).saved_connections || []
}

export function saveConnection(config: ConnectionConfig): void {
  const connections = getSavedConnections()
  const index = connections.findIndex(c => c.id === config.id)
  if (index >= 0) {
    connections[index] = config
  } else {
    connections.push(config)
  }
  ;(store as any).saved_connections = connections
  logger.info(`Connection saved: ${config.name} (${config.id})`)
}

export function deleteConnection(id: string): void {
  const connections = getSavedConnections()
  const filtered = connections.filter(c => c.id !== id)
  ;(store as any).saved_connections = filtered
  logger.info(`Connection deleted: ${id}`)
}

export function getUiSettings(): UiSettings {
  return (store as any).ui_settings || defaultUiSettings
}

export function setUiSettings(settings: Partial<UiSettings>): void {
  const current = getUiSettings()
  ;(store as any).ui_settings = { ...current, ...settings }
}

export default store
