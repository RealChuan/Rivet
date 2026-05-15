export const ZH_CN = 'zh-CN' as const
export const EN_US = 'en-US' as const
export type SupportedLanguageLiteral = typeof ZH_CN | typeof EN_US
export const SUPPORTED_LANGUAGES: readonly string[] = [ZH_CN, EN_US]
export type SupportedLanguage = typeof ZH_CN | typeof EN_US

export const DEFAULT_LANGUAGE = EN_US

export function matchSupportedLanguage(locale: string): SupportedLanguageLiteral | null {
  const localeStr = String(locale)

  if (localeStr === ZH_CN || localeStr === EN_US) {
    return localeStr
  }

  const langPrefix = localeStr.split('-')[0]
  if (langPrefix === 'zh') {
    return ZH_CN
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
