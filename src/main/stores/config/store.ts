import Store from 'electron-store'
import { TRANSFER_CONFIG } from '@shared/constants/index.js'
import type { StoreSchema } from './types.js'
import { defaultUiSettings } from './ui-settings.js'

export const defaultStore: StoreSchema = {
  savedConnections: [],
  uiSettings: defaultUiSettings,
  transferSettings: {
    maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
    maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  },
}

export const store = new Store<StoreSchema>({
  defaults: defaultStore,
})

let inMemoryConfig: StoreSchema = structuredClone(defaultStore)

let configChanged = false

export function markConfigChanged(): void {
  configChanged = true
}

export function resetConfigChanged(): void {
  configChanged = false
}

export function hasConfigChanged(): boolean {
  return configChanged
}

export function getFromMemory<T extends keyof StoreSchema>(key: T): StoreSchema[T] {
  return inMemoryConfig[key]
}

export function setToMemory<T extends keyof StoreSchema>(key: T, value: StoreSchema[T]): void {
  inMemoryConfig[key] = value
  markConfigChanged()
}

export function getInMemoryConfig(): StoreSchema {
  return inMemoryConfig
}

export function setInMemoryConfig(config: StoreSchema): void {
  inMemoryConfig = config
}
