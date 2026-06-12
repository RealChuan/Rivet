import type React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGE, THEME, type Theme } from '@shared/constants/index.js'
import { SIDEBAR_VIEW, type SidebarView } from '@shared/constants/transfer.js'
import { ConfirmationDialog } from '../components/common/index.js'
import { TitleBar, Toast } from '../components/common/index.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'
import { useActiveTaskGuard, useApplicationTheme, useInternationalization } from '../hooks/index.js'
import { ConnectionPage } from '../pages/ConnectionPage.js'
import { TransferPage } from '../pages/TransferPage.js'
import { useUiStore } from '../stores/ui.js'
import { ActivityBar } from './ActivityBar.js'

interface ThemeIconProps {
  theme: Theme
}

const ThemeIcon = ({ theme }: ThemeIconProps) => {
  if (theme === THEME.LIGHT) {
    return <Sun className="w-4 h-4" />
  } else if (theme === THEME.DARK) {
    return <Moon className="w-4 h-4" />
  }
  return <Monitor className="w-4 h-4" />
}

const PageContent = ({ activeView }: { activeView: SidebarView }) => {
  const isTransferActive = activeView === SIDEBAR_VIEW.TRANSFERS
  const setVisible = useTransferStore(state => state.setVisible)

  useEffect(() => {
    setVisible(isTransferActive)
  }, [isTransferActive, setVisible])

  return (
    <div className="flex-1 min-w-0">{isTransferActive ? <TransferPage /> : <ConnectionPage />}</div>
  )
}

export const MainLayout: React.FC = () => {
  const { t } = useTranslation()
  const { theme, cycleTheme } = useApplicationTheme()
  const { language, changeLanguage } = useInternationalization()
  const activeView = useUiStore(state => state.activeView)
  const setActiveView = useUiStore(state => state.setActiveView)
  const { guard, confirmOpen, handleConfirm, handleCancel, title, message } = useActiveTaskGuard()

  const handleClose = () => {
    guard(() => window.electronAPI.window.quit())
  }

  // 监听主进程系统级关闭拦截（Alt+F4 等），触发同样的守卫逻辑
  useEffect(() => {
    const unsubscribe = window.electronAPI.transfer.onHasActiveTasks(() => {
      guard(() => window.electronAPI.window.quit())
    })
    return unsubscribe
  }, [guard])

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      <TitleBar
        childMode={false}
        title={t('app.name')}
        onClose={handleClose}
        centerContent={
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                changeLanguage(
                  language === SUPPORTED_LANGUAGE.EN_US
                    ? SUPPORTED_LANGUAGE.ZH_CN
                    : SUPPORTED_LANGUAGE.EN_US
                )
              }
              className="px-2 py-1 rounded text-[10px] font-semibold text-text bg-transparent border-none cursor-default hover:bg-hover transition-colors"
              title={
                language === SUPPORTED_LANGUAGE.EN_US
                  ? t('language.english')
                  : t('language.chinese')
              }
            >
              {language === SUPPORTED_LANGUAGE.EN_US
                ? t('language.enShort')
                : t('language.zhShort')}
            </button>

            <button
              onClick={cycleTheme}
              className="p-1 rounded bg-transparent border-none cursor-default flex items-center justify-center hover:bg-hover transition-colors text-text focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              title={
                theme === THEME.LIGHT
                  ? t('mainLayout.lightMode')
                  : theme === THEME.DARK
                    ? t('mainLayout.darkMode')
                    : t('mainLayout.system')
              }
              aria-label={
                theme === THEME.LIGHT
                  ? t('mainLayout.lightMode')
                  : theme === THEME.DARK
                    ? t('mainLayout.darkMode')
                    : t('mainLayout.system')
              }
            >
              <ThemeIcon theme={theme} />
            </button>
          </div>
        }
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
        confirmText={t('common.action.confirm')}
        cancelText={t('common.action.cancel')}
        type="warning"
      />
    </div>
  )
}
