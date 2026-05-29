export const SUPPORTED_LANGUAGE = {
  ZH_CN: 'zh-CN',
  EN_US: 'en-US',
} as const

export type SupportedLanguageLiteral = (typeof SUPPORTED_LANGUAGE)[keyof typeof SUPPORTED_LANGUAGE]

export const SUPPORTED_LANGUAGES: readonly string[] = [
  SUPPORTED_LANGUAGE.ZH_CN,
  SUPPORTED_LANGUAGE.EN_US,
]

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE)[keyof typeof SUPPORTED_LANGUAGE]

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGE.EN_US
