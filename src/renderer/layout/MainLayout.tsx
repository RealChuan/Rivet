import React from 'react'
import { useTranslation } from 'react-i18next'
import { THEME_LIGHT, THEME_DARK } from '@shared/constants/theme.js'
import { ZH_CN, EN_US } from '@shared/constants/i18n.js'
import { useApplicationTheme, useInternationalization } from '../hooks/index.js'
import { Toast, TitleBar } from '../components/common/index.js'
import { ResizablePanel } from './ResizablePanel.js'

interface MainLayoutProps {
  sidebar: React.ReactNode
  content: React.ReactNode
}

export const MainLayout: React.FC<MainLayoutProps> = ({ sidebar, content }) => {
  const { t } = useTranslation()
  const { theme, cycleTheme } = useApplicationTheme()
  const { language, changeLanguage } = useInternationalization()

  const ThemeIcon = () => {
    if (theme === THEME_LIGHT) {
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
    } else if (theme === THEME_DARK) {
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

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      <TitleBar
        childMode={false}
        title={t('app.name')}
        centerContent={
          <div className="flex items-center gap-1">
            <button
              onClick={() => changeLanguage(language === EN_US ? ZH_CN : EN_US)}
              className="px-2 py-1 rounded text-[10px] font-semibold text-text bg-transparent border-none cursor-default hover:bg-hover transition-colors"
              title={language === EN_US ? 'English' : '中文'}
            >
              {language === EN_US ? 'EN' : '中文'}
            </button>

            <button
              onClick={cycleTheme}
              className="p-1 rounded bg-transparent border-none cursor-default flex items-center justify-center hover:bg-hover transition-colors text-text"
              title={
                theme === THEME_LIGHT
                  ? t('mainLayout.lightMode')
                  : theme === THEME_DARK
                    ? t('mainLayout.darkMode')
                    : t('mainLayout.system')
              }
            >
              <ThemeIcon />
            </button>
          </div>
        }
      />

      <ResizablePanel sidebar={sidebar} content={content} />

      <Toast />
    </div>
  )
}
