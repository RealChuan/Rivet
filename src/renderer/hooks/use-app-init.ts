import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CLOSE_BEHAVIOR,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_VALUE,
  STORE_KEY,
} from '@shared/constants/index.js'
import { type UiSettings } from '@shared/types/index.js'
import { configApi } from '../api/config.js'
import { useFavoritesStore } from '../features/file-explorer/stores/favorites.js'
import { useConnectionStore } from '../features/session/stores/connection.js'
import { useLastPathsStore } from '../features/session/stores/last-paths.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'
import { useUiStore } from '../stores/index.js'
import { logger } from '../utils/index.js'

/** 配置读不到时的兜底：与主进程的默认设置保持一致。 */
const FALLBACK_UI_SETTINGS: UiSettings = {
  appearance: DEFAULT_THEME_VALUE,
  locale: DEFAULT_LANGUAGE,
  showHiddenFiles: false,
  closeBehavior: CLOSE_BEHAVIOR.TRAY,
}

export const useApplicationInitialization = () => {
  const { i18n } = useTranslation()
  const initialize = useUiStore((state) => state.initialize)
  const initialized = useUiStore((state) => state.initialized)
  const loadSavedConnections = useConnectionStore((state) => state.loadSavedConnections)
  const loadSortOrderFromSettings = useConnectionStore((state) => state.loadSortOrderFromSettings)
  const loadFavorites = useFavoritesStore((state) => state.load)
  const loadLastPaths = useLastPathsStore((state) => state.load)
  const startTransferListening = useTransferStore((state) => state.startListening)
  const restoreActiveTasks = useTransferStore((state) => state.restoreActiveTasks)
  const loadConcurrency = useTransferStore((state) => state.loadConcurrency)

  useEffect(() => {
    const initApp = async () => {
      let settings = FALLBACK_UI_SETTINGS
      try {
        settings = (await configApi.get<UiSettings>(STORE_KEY.UI)) ?? FALLBACK_UI_SETTINGS
      } catch (error) {
        logger.catch(error, { action: 'load-settings' })
      }

      initialize(settings)
      await i18n.changeLanguage(settings.locale)
    }

    void initApp()
  }, [i18n, initialize])

  useEffect(() => {
    if (!initialized) return
    void loadSavedConnections()
    void loadSortOrderFromSettings()
    void loadFavorites()
    void loadLastPaths()
    const unsubscribe = startTransferListening()
    void restoreActiveTasks()
    void loadConcurrency()
    return unsubscribe
  }, [
    initialized,
    loadSavedConnections,
    loadSortOrderFromSettings,
    loadFavorites,
    loadLastPaths,
    startTransferListening,
    restoreActiveTasks,
    loadConcurrency,
  ])

  return { initialized }
}
