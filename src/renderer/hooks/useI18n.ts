import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguageLiteral } from '@shared/constants/i18n.js'
import { useUiStore } from '../stores/index.js'

export function useI18n() {
  const { i18n } = useTranslation()
  const { language, setLanguage } = useUiStore()

  const changeLanguage = useCallback(
    (lang: SupportedLanguageLiteral) => {
      void i18n.changeLanguage(lang)
      setLanguage(lang)
    },
    [i18n, setLanguage]
  )

  const t = useCallback(
    (key: string, options?: Record<string, unknown>) => {
      return i18n.t(key, options ?? {})
    },
    [i18n]
  )

  return {
    language,
    changeLanguage,
    t,
  }
}

export default useI18n
