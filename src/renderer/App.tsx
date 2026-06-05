import type React from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from './features/transfer/stores/transfer.js'
import { useApplicationInitialization } from './hooks/use-app-init.js'
import { useGlobalShortcuts } from './hooks/use-global-shortcuts.js'
import { useApplicationTheme } from './hooks/use-theme.js'
import { MainLayout } from './layout/MainLayout.js'
import { useUiStore } from './stores/ui.js'

const App: React.FC = () => {
  const { t } = useTranslation()
  const initialized = useUiStore(state => state.initialized)
  useGlobalShortcuts()
  const startTransferListening = useTransferStore(state => state.startListening)
  const loadExistingTasks = useTransferStore(state => state.loadExistingTasks)

  useApplicationInitialization()
  useApplicationTheme()

  useEffect(() => {
    const unsubscribe = startTransferListening()
    void loadExistingTasks()
    return unsubscribe
  }, [startTransferListening, loadExistingTasks])

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="text-text-muted text-sm">{t('fileExplorerList.loading')}</div>
      </div>
    )
  }

  return <MainLayout />
}

export default App
