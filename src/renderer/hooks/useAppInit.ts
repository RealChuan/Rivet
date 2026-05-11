import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../stores/index.js'
import { useSessionStore } from '../features/session/stores/sessionStore.js'

interface UiSettingsResult {
  theme?: 'light' | 'dark' | 'system'
  language?: 'zh-CN' | 'en-US' | ''
}

export const useAppInit = () => {
  const { i18n } = useTranslation()
  const { initialize, initialized } = useUiStore()
  const { loadSavedConnections } = useSessionStore()

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedSettings = (await window.electronAPI.common.storeGet(
          'ui_settings'
        )) as UiSettingsResult | null

        if (savedSettings) {
          const theme = savedSettings.theme ?? 'system'
          const language = savedSettings.language ?? 'en-US'

          initialize({ theme, language })
          await i18n.changeLanguage(language)

          const resolvedTheme =
            theme === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : theme
          document.documentElement.dataset.theme = resolvedTheme
        } else {
          const theme = 'system'
          const language = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'
          initialize({ theme, language })
          await i18n.changeLanguage(language)
        }
      } catch {
        const theme = 'system'
        const language = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'
        initialize({ theme, language })
        void i18n.changeLanguage(language)
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
