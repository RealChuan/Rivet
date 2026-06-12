import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGE,
  type SupportedLanguageLiteral,
} from '@shared/constants/i18n.js'

export function detectLanguageWithFallback(getLocale: () => string): SupportedLanguageLiteral {
  try {
    const systemLocale = String(getLocale())
    if (systemLocale === SUPPORTED_LANGUAGE.ZH_CN || systemLocale === SUPPORTED_LANGUAGE.EN_US) {
      return systemLocale
    }
    const langPrefix = systemLocale.split('-')[0]
    if (langPrefix === 'zh') {
      return SUPPORTED_LANGUAGE.ZH_CN
    }
  } catch {
    // no-op
  }
  return DEFAULT_LANGUAGE
}
