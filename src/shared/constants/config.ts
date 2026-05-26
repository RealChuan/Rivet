export const STORE_KEYS = {
  SAVED_CONNECTIONS: 'savedConnections',
  UI_SETTINGS: 'uiSettings',
} as const

export type StoreKey = (typeof STORE_KEYS)[keyof typeof STORE_KEYS]
