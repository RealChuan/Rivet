import { app } from 'electron'
import type { ConnectionConfig, UiSettings } from '@shared/types/index.js'
import {
  PROTOCOL,
  SCHEME,
  SUPPORTED_LANGUAGE,
  type SupportedLanguageLiteral,
  THEME,
} from '@shared/constants/index.js'
import { detectLanguageWithFallback } from '@shared/utils/i18n.js'

export function detectSystemLanguage(): SupportedLanguageLiteral {
  return detectLanguageWithFallback(() => app.getLocale())
}

export function isValidConnection(config: unknown): config is ConnectionConfig {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    (c.protocol === PROTOCOL.SFTP || c.protocol === PROTOCOL.WEBDAV) &&
    typeof c.host === 'string' &&
    typeof c.port === 'number' &&
    typeof c.username === 'string' &&
    typeof c.savePassword === 'boolean' &&
    (c.password === undefined || typeof c.password === 'string') &&
    (c.basePath === undefined || typeof c.basePath === 'string') &&
    (c.scheme === undefined || c.scheme === SCHEME.HTTP || c.scheme === SCHEME.HTTPS) &&
    (c.rejectUnauthorized === undefined || typeof c.rejectUnauthorized === 'boolean')
  )
}

export function isValidUiSettings(settings: unknown): settings is UiSettings {
  if (!settings || typeof settings !== 'object') return false
  const s = settings as Record<string, unknown>
  return (
    (s.appearance === THEME.LIGHT ||
      s.appearance === THEME.DARK ||
      s.appearance === THEME.SYSTEM) &&
    (s.locale === SUPPORTED_LANGUAGE.ZH_CN ||
      s.locale === SUPPORTED_LANGUAGE.EN_US ||
      s.locale === '')
  )
}
