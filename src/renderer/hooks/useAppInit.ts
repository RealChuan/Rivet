import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_THEME } from '@shared/constants/theme.js'
import { DEFAULT_LANGUAGE } from '@shared/constants/i18n.js'
import type { UiSettings } from '@shared/types/ui.js'
import { useUiStore } from '../stores/index.js'
import { useSessionStore } from '../features/session/stores/sessionStore.js'

export const useAppInit = () => {
  const { i18n } = useTranslation()
  const { initialize, initialized } = useUiStore()
  const { loadSavedConnections } = useSessionStore()

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedSettings = (await window.electronAPI.common.storeGet(
          'ui_settings'
        )) as UiSettings | null

        const theme = savedSettings?.theme ?? DEFAULT_THEME
        const language = savedSettings?.language ?? DEFAULT_LANGUAGE

        initialize({ theme, language })
        await i18n.changeLanguage(language)
      } catch (error) {
        console.error('Failed to load settings:', error)
        initialize({ theme: DEFAULT_THEME, language: DEFAULT_LANGUAGE })
        await i18n.changeLanguage(DEFAULT_LANGUAGE)
      }
    }

    void initApp()
  }, [i18n, initialize])

  useEffect(() => {
    if (!initialized) return
    void loadSavedConnections()
  }, [initialized, loadSavedConnections])

  return { initialized }
}
