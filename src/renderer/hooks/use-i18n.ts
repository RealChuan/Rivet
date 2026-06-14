import { useTranslation } from 'react-i18next'
import type { SupportedLanguageLiteral } from '@shared/constants/index.js'
import { useUiStore } from '../stores/index.js'

export function useInternationalization() {
  const { i18n } = useTranslation()
  const locale = useUiStore(state => state.locale)
  const setLocale = useUiStore(state => state.setLocale)

  const changeLanguage = (lang: SupportedLanguageLiteral) => {
    void i18n.changeLanguage(lang)
    setLocale(lang)
  }

  return {
    language: locale,
    changeLanguage,
  }
}

export default useInternationalization
