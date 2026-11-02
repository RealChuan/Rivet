import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGE } from '@shared/constants/index.js'
import { getWindowChrome } from '../api/env.js'
import { ConfirmationDialog, TitleBar, Toast } from '../components/common/index.js'
import { useActiveTaskGuard, useApplicationTheme, useInternationalization } from '../hooks/index.js'
import { titlebarPadding } from './titlebar-padding.js'
import { Workspace } from './Workspace.js'

export const MainLayout = () => {
  const { t } = useTranslation()
  const { theme, cycleTheme } = useApplicationTheme()
  const { language, changeLanguage } = useInternationalization()
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

      <div className="flex-1 overflow-hidden border-t border-border">
        <Workspace />
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
