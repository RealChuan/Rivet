import type { Theme } from '@shared/constants/theme.js'
import type { SupportedLanguageLiteral } from '@shared/constants/i18n.js'

export interface UiSettings {
  theme: Theme
  language: SupportedLanguageLiteral | ''
}
