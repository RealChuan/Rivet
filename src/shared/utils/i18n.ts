import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGE,
  type SupportedLanguageLiteral,
} from '@shared/constants/i18n.js'

export function matchSupportedLanguage(locale: string): SupportedLanguageLiteral | null {
  const localeStr = String(locale)

  if (localeStr === SUPPORTED_LANGUAGE.ZH_CN || localeStr === SUPPORTED_LANGUAGE.EN_US) {
    return localeStr
  }

  const langPrefix = localeStr.split('-')[0]
  if (langPrefix === 'zh') {
    return SUPPORTED_LANGUAGE.ZH_CN
  }
  return null
}

export function detectLanguageWithFallback(getLocale: () => string): SupportedLanguageLiteral {
  try {
    const systemLocale = getLocale()
    const matched = matchSupportedLanguage(systemLocale)
    if (matched) return matched
  } catch {
    // no-op
  }
  return DEFAULT_LANGUAGE
}
