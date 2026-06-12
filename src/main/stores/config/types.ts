import type { ConnectionConfig, TransferSettings, UiSettings } from '@shared/types/index.js'

export interface StoreSchema {
  savedConnections: ConnectionConfig[]
  uiSettings: UiSettings
  transferSettings: TransferSettings
}
