import type React from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGE, THEME, type Theme } from '@shared/constants/index.js'
import { TitleBar, Toast } from '../components/common/index.js'
import { useApplicationTheme, useInternationalization } from '../hooks/index.js'
import { ResizablePanel } from './ResizablePanel.js'

interface MainLayoutProps {
  sidebar: React.ReactNode
  content: React.ReactNode
}

interface ThemeIconProps {
  theme: Theme
}

const ThemeIcon = ({ theme }: ThemeIconProps) => {
  if (theme === THEME.LIGHT) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    )
  } else if (theme === THEME.DARK) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    )
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export const MainLayout: React.FC<MainLayoutProps> = ({ sidebar, content }) => {
  const { t } = useTranslation()
  const { theme, cycleTheme } = useApplicationTheme()
  const { language, changeLanguage } = useInternationalization()

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      <TitleBar
        childMode={false}
        title={t('app.name')}
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
              title={language === SUPPORTED_LANGUAGE.EN_US ? 'English' : '中文'}
            >
              {language === SUPPORTED_LANGUAGE.EN_US ? 'EN' : '中文'}
            </button>

            <button
              onClick={cycleTheme}
              className="p-1 rounded bg-transparent border-none cursor-default flex items-center justify-center hover:bg-hover transition-colors text-text"
              title={
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

      <ResizablePanel sidebar={sidebar} content={content} />

      <Toast />
    </div>
  )
}
