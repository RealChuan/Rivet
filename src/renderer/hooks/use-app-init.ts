import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, DEFAULT_THEME_VALUE, STORE_KEY } from '@shared/constants/index.js'
import { type UiSettings } from '@shared/types/index.js'
import { configApi } from '../api/config.js'
import { useConnectionStore } from '../features/session/stores/connection.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'
import { useUiStore } from '../stores/index.js'
import { logger } from '../utils/index.js'

export const useApplicationInitialization = () => {
  const { i18n } = useTranslation()
  const initialize = useUiStore((state) => state.initialize)
  const initialized = useUiStore((state) => state.initialized)
  const loadSavedConnections = useConnectionStore((state) => state.loadSavedConnections)
  const loadSortOrderFromSettings = useConnectionStore((state) => state.loadSortOrderFromSettings)
  const startTransferListening = useTransferStore((state) => state.startListening)
  const loadExistingTasks = useTransferStore((state) => state.loadExistingTasks)
  const loadConcurrency = useTransferStore((state) => state.loadConcurrency)

  useEffect(() => {
    const initApp = async () => {
      let savedSettings: UiSettings | null = null
      try {
        savedSettings = await configApi.get<UiSettings>(STORE_KEY.UI)
      } catch (error) {
        logger.catch(error, { action: 'load-settings' })
        initialize({ appearance: DEFAULT_THEME_VALUE, locale: DEFAULT_LANGUAGE })
        await i18n.changeLanguage(DEFAULT_LANGUAGE)
        return
      }

      const appearance = savedSettings?.appearance ?? DEFAULT_THEME_VALUE
      const locale = savedSettings?.locale ?? DEFAULT_LANGUAGE

      initialize({ appearance, locale })
      await i18n.changeLanguage(locale)
    }

    void initApp()
  }, [i18n, initialize])

  useEffect(() => {
    if (!initialized) return
    void loadSavedConnections()
    void loadSortOrderFromSettings()
    const unsubscribe = startTransferListening()
    void loadExistingTasks()
    void loadConcurrency()
    return unsubscribe
  }, [
    initialized,
    loadSavedConnections,
    loadSortOrderFromSettings,
    startTransferListening,
    loadExistingTasks,
    loadConcurrency,
  ])

  return { initialized }
}
