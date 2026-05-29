import Store from 'electron-store'
import { SORT_ORDER, THEME } from '@shared/constants/index.js'
import type { StoreSchema } from './types.js'

export const defaultStore: StoreSchema = {
  savedConnections: [],
  uiSettings: {
    appearance: THEME.SYSTEM,
    locale: '',
    connectionSortOrder: SORT_ORDER.NONE,
  },
}

export const store = new Store<StoreSchema>({
  defaults: defaultStore,
})

let inMemoryConfig: StoreSchema = {
  savedConnections: [],
  uiSettings: {
    appearance: THEME.SYSTEM,
    locale: '',
    connectionSortOrder: SORT_ORDER.NONE,
  },
}

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

export function setDefaultUiSettings(settings: StoreSchema['uiSettings']): void {
  inMemoryConfig.uiSettings = { ...settings }
}
