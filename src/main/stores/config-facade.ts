import { ERROR_CODE, STORE_KEY } from '@shared/constants/index.js'
import {
  connectionsFileSchema,
  favoritesSchema,
  lastPathsSchema,
  transferSettingsSchema,
  uiSettingsSchema,
} from '@shared/schemas/config.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { getConnections, replaceConnections } from './connections-repository.js'
import {
  getConnectionSortOrder,
  getFavorites,
  getLastPaths,
  getTransferSettings,
  getUiSettings,
  setConnectionSortOrder,
  setFavorites,
  setLastPaths,
  setTransferSettings,
  setUiSettings,
} from './settings-repository.js'

export function getConfigurationValue(key: string): Result<unknown, ErrorInfo> {
  switch (key) {
    case STORE_KEY.UI:
      return ok(getUiSettings())
    case STORE_KEY.TRANSFER:
      return ok(getTransferSettings())
    case STORE_KEY.CONNECTIONS:
      return ok(getConnections())
    case STORE_KEY.CONNECTION_SORT_ORDER:
      return ok(getConnectionSortOrder())
    case STORE_KEY.FAVORITES:
      return ok(getFavorites())
    case STORE_KEY.LAST_PATHS:
      return ok(getLastPaths())
    default:
      return invalid(`Unknown config key: ${key}`)
  }
}

export function setConfigurationValue(key: string, value: unknown): Result<void, ErrorInfo> {
  switch (key) {
    case STORE_KEY.UI: {
      const parsed = uiSettingsSchema.safeParse(value)
      if (!parsed.success) return invalid('Invalid UI settings value')
      return setUiSettings(parsed.data)
    }
    case STORE_KEY.TRANSFER: {
      const parsed = transferSettingsSchema.safeParse(value)
      if (!parsed.success) return invalid('Invalid transfer settings value')
      return setTransferSettings(parsed.data)
    }
    case STORE_KEY.CONNECTIONS: {
      const parsed = connectionsFileSchema.shape.connections.safeParse(value)
      if (!parsed.success) return invalid('Invalid connection list')
      return replaceConnections(parsed.data)
    }
    case STORE_KEY.CONNECTION_SORT_ORDER:
      if (value !== 'none' && value !== 'asc' && value !== 'desc') {
        return invalid('Invalid sort order')
      }
      return setConnectionSortOrder(value)
    case STORE_KEY.FAVORITES: {
      const parsed = favoritesSchema.safeParse(value)
      if (!parsed.success) return invalid('Invalid favorites value')
      return setFavorites(parsed.data)
    }
    case STORE_KEY.LAST_PATHS: {
      const parsed = lastPathsSchema.safeParse(value)
      if (!parsed.success) return invalid('Invalid lastPaths value')
      return setLastPaths(parsed.data)
    }
    default:
      return invalid(`Unknown config key: ${key}`)
  }
}

function invalid(message: string): Result<never, ErrorInfo> {
  return err(createErrorInfo(ERROR_CODE.INVALID_CONFIG, message))
}
