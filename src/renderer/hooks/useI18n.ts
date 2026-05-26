import { useTranslation } from 'react-i18next'
import type { SupportedLanguageLiteral } from '@shared/constants/i18n.js'
import { useUiStore } from '../stores/index.js'

export function useInternationalization() {
  const { i18n } = useTranslation()
  const locale = useUiStore(state => state.locale)
  const setLocale = useUiStore(state => state.setLocale)

  const changeLanguage = (lang: SupportedLanguageLiteral) => {
    void i18n.changeLanguage(lang)
    setLocale(lang)
  }

  const t = (key: string, options?: Record<string, unknown>) => {
    return i18n.t(key, options ?? {})
  }

  return {
    language: locale,
    changeLanguage,
    t,
  }
}

export default useInternationalization
