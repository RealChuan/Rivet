import { useTranslation } from 'react-i18next'
import { useApplicationInitialization } from './hooks/use-app-init.js'
import { useGlobalShortcuts } from './hooks/use-global-shortcuts.js'
import { useApplicationTheme } from './hooks/use-theme.js'
import { MainLayout } from './layout/MainLayout.js'
import { useUiStore } from './stores/ui.js'

const App = () => {
  const { t } = useTranslation()
  const initialized = useUiStore((state) => state.initialized)

  useApplicationInitialization()
  useApplicationTheme()
  useGlobalShortcuts()

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-transparent">
        <div className="text-text-muted text-sm">{t(($) => $.fileExplorerList.loading)}</div>
      </div>
    )
  }

  return <MainLayout />
}

export default App
