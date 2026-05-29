import type React from 'react'
import { useTranslation } from 'react-i18next'
import { FileExplorerContainer } from './features/file-explorer/index.js'
import { ConnectionSidebar } from './features/session/index.js'
import { useApplicationInitialization } from './hooks/useAppInit.js'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts.js'
import { useApplicationTheme } from './hooks/useTheme.js'
import { MainLayout } from './layout/MainLayout.js'
import { useUiStore } from './stores/ui.js'

const App: React.FC = () => {
  const { t } = useTranslation()
  const initialized = useUiStore(state => state.initialized)

  useApplicationInitialization()
  useApplicationTheme()
  useGlobalShortcuts()

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="text-text-muted text-sm">{t('fileExplorerList.loading')}</div>
      </div>
    )
  }

  return <MainLayout sidebar={<ConnectionSidebar />} content={<FileExplorerContainer />} />
}

export default App
