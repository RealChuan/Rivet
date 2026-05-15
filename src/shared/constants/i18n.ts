/**
 * 国际化相关常量和工具函数
 */

/**
 * 简体中文语言代码
 */
export const ZH_CN = 'zh-CN' as const

/**
 * 英文语言代码
 */
export const EN_US = 'en-US' as const

/**
 * 支持的语言字面量类型
 */
export type SupportedLanguageLiteral = typeof ZH_CN | typeof EN_US

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGUAGES: readonly string[] = [ZH_CN, EN_US]

/**
 * 支持的语言类型
 */
export type SupportedLanguage = typeof ZH_CN | typeof EN_US

/**
 * 默认语言（英文）
 */
export const DEFAULT_LANGUAGE = EN_US

/**
 * 将给定的语言环境字符串匹配到支持的语言
 * @param locale - 语言环境字符串（如 'zh-CN', 'en-US', 'zh' 等）
 * @returns 匹配到的支持语言，如果不匹配则返回 null
 */
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

/**
 * 检测系统语言并返回支持的语言，失败时返回默认语言
 * @param getLocale - 获取系统语言的函数（如 navigator.language）
 * @returns 匹配到的支持语言或默认语言
 */
export function detectLanguageWithFallback(getLocale: () => string): SupportedLanguageLiteral {
  try {
    const systemLocale = getLocale()
    const matched = matchSupportedLanguage(systemLocale)
    if (matched) return matched
  } catch {
    // no-op - 忽略错误，使用默认语言
  }
  return DEFAULT_LANGUAGE
}
