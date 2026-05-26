import type { ConnectionConfig, UiSettings } from '@shared/types/index.js'
import {
  PROTOCOL_SFTP,
  PROTOCOL_WEBDAV,
  SCHEME_HTTP,
  SCHEME_HTTPS,
  SORT_ORDER_NONE,
  SORT_ORDER_ASC,
  SORT_ORDER_DESC,
} from '@shared/constants/index.js'
import {
  ZH_CN,
  EN_US,
  detectLanguageWithFallback,
  type SupportedLanguageLiteral,
} from '@shared/constants/i18n.js'
import { THEME_LIGHT, THEME_DARK, THEME_SYSTEM } from '@shared/constants/theme.js'
import { app } from 'electron'

export function detectSystemLanguage(): SupportedLanguageLiteral {
  return detectLanguageWithFallback(() => app.getLocale())
}

export function isValidConnection(config: unknown): config is ConnectionConfig {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    (c.protocol === PROTOCOL_SFTP || c.protocol === PROTOCOL_WEBDAV) &&
    typeof c.host === 'string' &&
    typeof c.port === 'number' &&
    typeof c.username === 'string' &&
    typeof c.savePassword === 'boolean' &&
    (c.password === undefined || typeof c.password === 'string') &&
    (c.basePath === undefined || typeof c.basePath === 'string') &&
    (c.scheme === undefined || c.scheme === SCHEME_HTTP || c.scheme === SCHEME_HTTPS) &&
    (c.rejectUnauthorized === undefined || typeof c.rejectUnauthorized === 'boolean')
  )
}

export function isValidUiSettings(settings: unknown): settings is UiSettings {
  if (!settings || typeof settings !== 'object') return false
  const s = settings as Record<string, unknown>
  return (
    (s.appearance === THEME_LIGHT ||
      s.appearance === THEME_DARK ||
      s.appearance === THEME_SYSTEM) &&
    (s.locale === ZH_CN || s.locale === EN_US || s.locale === '') &&
    (s.connectionSortOrder === SORT_ORDER_NONE ||
      s.connectionSortOrder === SORT_ORDER_ASC ||
      s.connectionSortOrder === SORT_ORDER_DESC ||
      s.connectionSortOrder === undefined)
  )
}
