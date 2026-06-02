import type React from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmationDialog } from './components/common/index.js'
import { useTransferStore } from './features/transfer/stores/transfer.js'
import { useApplicationInitialization } from './hooks/useAppInit.js'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts.js'
import { useApplicationTheme } from './hooks/useTheme.js'
import { MainLayout } from './layout/MainLayout.js'
import { useUiStore } from './stores/ui.js'

const App: React.FC = () => {
  const { t } = useTranslation()
  const initialized = useUiStore(state => state.initialized)
  const { quitConfirmOpen, setQuitConfirmOpen, handleConfirmQuit } = useGlobalShortcuts()
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

  return (
    <>
      <MainLayout />
      <ConfirmationDialog
        open={quitConfirmOpen}
        onClose={() => setQuitConfirmOpen(false)}
        onConfirm={() => handleConfirmQuit()}
        title={t('transfer.confirmQuit.title')}
        message={t('transfer.confirmQuit.message')}
        confirmText={t('action.confirm')}
        cancelText={t('action.cancel')}
        type="warning"
      />
    </>
  )
}

export default App
