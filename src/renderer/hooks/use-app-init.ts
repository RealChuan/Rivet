import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { logger } from '@renderer/utils/index.js'
import { DEFAULT_LANGUAGE, DEFAULT_THEME_VALUE, STORE_KEY } from '@shared/constants/index.js'
import { isErr, type UiSettings } from '@shared/types/index.js'
import { useConnectionStore } from '../features/session/stores/connection.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'
import { useUiStore } from '../stores/index.js'

export const useApplicationInitialization = () => {
  const { i18n } = useTranslation()
  const initialize = useUiStore((state) => state.initialize)
  const initialized = useUiStore((state) => state.initialized)
  const loadSavedConnections = useConnectionStore((state) => state.loadSavedConnections)
  const loadSortOrderFromSettings = useConnectionStore((state) => state.loadSortOrderFromSettings)
  const startTransferListening = useTransferStore((state) => state.startListening)
  const loadExistingTasks = useTransferStore((state) => state.loadExistingTasks)

  useEffect(() => {
    const initApp = async () => {
      const result = await window.electronAPI.config.get(STORE_KEY.UI_SETTINGS)

      if (isErr(result)) {
        logger.catch(result.error, { action: 'load-settings' })
        initialize({ appearance: DEFAULT_THEME_VALUE, locale: DEFAULT_LANGUAGE })
        await i18n.changeLanguage(DEFAULT_LANGUAGE)
        return
      }

      const savedSettings = result.value as UiSettings | null // IPC 返回值，主进程保证类型
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
    return unsubscribe
  }, [
    initialized,
    loadSavedConnections,
    loadSortOrderFromSettings,
    startTransferListening,
    loadExistingTasks,
  ])

  return { initialized }
}
