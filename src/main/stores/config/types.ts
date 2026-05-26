import type { ConnectionConfig, UiSettings } from '@shared/types/index.js'

export interface StoreSchema {
  savedConnections: ConnectionConfig[]
  uiSettings: UiSettings
}

export type ConfigKey = keyof StoreSchema
