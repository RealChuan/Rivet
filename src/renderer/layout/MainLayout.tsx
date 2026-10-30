import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGE } from '@shared/constants/index.js'
import { SIDEBAR_VIEW, type SidebarView } from '@shared/constants/transfer.js'
import { getWindowChrome } from '../api/env.js'
import { ConfirmationDialog } from '../components/common/index.js'
import { TitleBar, Toast } from '../components/common/index.js'
import { useActiveTaskGuard, useApplicationTheme, useInternationalization } from '../hooks/index.js'
import { ConnectionPage } from '../pages/ConnectionPage.js'
import { TransferPage } from '../pages/TransferPage.js'
import { useUiStore } from '../stores/ui.js'
import { ActivityBar } from './ActivityBar.js'
import { titlebarPadding } from './titlebar-padding.js'

const PageContent = ({ activeView }: { activeView: SidebarView }) => {
  const isTransferActive = activeView === SIDEBAR_VIEW.TRANSFERS

  return (
    <div className="flex-1 min-w-0">{isTransferActive ? <TransferPage /> : <ConnectionPage />}</div>
  )
}

export const MainLayout = () => {
  const { t } = useTranslation()
  const { theme, cycleTheme } = useApplicationTheme()
  const { language, changeLanguage } = useInternationalization()
  const activeView = useUiStore((state) => state.activeView)
  const setActiveView = useUiStore((state) => state.setActiveView)
  const { confirmOpen, handleConfirm, handleCancel, title, message } = useActiveTaskGuard()

  return (
    <div
      className="h-screen w-screen flex flex-col bg-bg overflow-hidden"
      style={{ paddingTop: titlebarPadding(getWindowChrome()) }}
    >
      <TitleBar
        title={t(($) => $.app.name)}
        subtitle={t(($) => $.app.subtitle)}
        theme={theme}
        onCycleTheme={cycleTheme}
        language={language || SUPPORTED_LANGUAGE.ZH_CN}
        onChangeLanguage={changeLanguage}
      />

      <div className="flex-1 flex overflow-hidden">
        <ActivityBar activeView={activeView} onViewChange={setActiveView} />
        <PageContent activeView={activeView} />
      </div>

      <Toast />

      <ConfirmationDialog
        open={confirmOpen}
        onClose={handleCancel}
        onConfirm={() => void handleConfirm()}
        title={title}
        message={message}
        confirmText={t(($) => $.common.action.confirm)}
        cancelText={t(($) => $.common.action.cancel)}
        type="warning"
      />
    </div>
  )
}
