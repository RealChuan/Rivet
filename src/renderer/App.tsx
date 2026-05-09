import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionSidebar } from './components/SessionSidebar/SessionSidebar.js'
import { FileAreaContainer } from './components/FileArea/FileAreaContainer.js'
import { QueueDrawer } from './components/QueueDrawer/QueueDrawer.js'
import { Toast } from './components/Toast.js'
import { useUiStore } from './stores/uiStore.js'
import { useQueueStore } from './stores/queueStore.js'
import { useSessionStore } from './stores/sessionStore.js'
import { useTheme } from './hooks/useTheme.js'
import { useI18n } from './hooks/useI18n.js'
import { useTransferQueue } from './hooks/useTransferQueue.js'

const App: React.FC = () => {
  const { i18n, t } = useTranslation()
  const {
    queueDrawerOpen,
    sidebarWidth,
    setSidebarWidth,
    setQueueDrawerWidth,
    setQueueDrawerOpen,
    initialize,
    initialized,
  } = useUiStore()
  const { tasks } = useQueueStore()
  const { refreshCurrentDirectory, activeSessionId } = useSessionStore()
  const { theme, cycleTheme } = useTheme()
  const { language, changeLanguage } = useI18n()
  useTransferQueue()

  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const [isDraggingQueue, setIsDraggingQueue] = useState(false)

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedSettings = (await window.electronAPI.storeGet('ui_settings')) as any

        if (savedSettings) {
          const theme = savedSettings.theme || 'system'
          const language = savedSettings.language || 'en-US'

          initialize({ theme, language })
          i18n.changeLanguage(language)

          const resolvedTheme =
            theme === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : theme
          document.documentElement.dataset.theme = resolvedTheme
        } else {
          const theme = 'system'
          const language = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'
          initialize({ theme, language })
          i18n.changeLanguage(language)
        }
      } catch {
        const theme = 'system'
        const language = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'
        initialize({ theme, language })
        i18n.changeLanguage(language)
      }
    }

    initApp()
  }, [i18n, initialize])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (activeSessionId) {
          refreshCurrentDirectory(activeSessionId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSessionId, refreshCurrentDirectory])

  useEffect(() => {
    if (!initialized) return

    const handleSystemThemeChange = () => {
      const uiSettings = useUiStore.getState()
      if (uiSettings.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
      }
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [initialized])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(180, Math.min(400, e.clientX))
        setSidebarWidth(newWidth)
      } else if (isDraggingQueue) {
        const newWidth = Math.max(200, Math.min(500, window.innerWidth - e.clientX))
        setQueueDrawerWidth(newWidth)
      }
    },
    [isDraggingSidebar, isDraggingQueue, setSidebarWidth, setQueueDrawerWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false)
    setIsDraggingQueue(false)
  }, [])

  useEffect(() => {
    if (isDraggingSidebar || isDraggingQueue) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingSidebar, isDraggingQueue, handleMouseMove, handleMouseUp])

  const ThemeIcon = () => {
    if (theme === 'light') {
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
    } else if (theme === 'dark') {
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

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex bg-bg overflow-hidden">
      <div className="shrink-0" style={{ width: sidebarWidth }}>
        <SessionSidebar />
      </div>

      <div
        className={`
          resizer flex items-center justify-center w-1
          cursor-col-resize bg-transparent
          transition-colors duration-150
        `}
        onMouseDown={() => setIsDraggingSidebar(true)}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
        onMouseLeave={e => {
          if (!isDraggingSidebar) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        <div
          className={`
            w-0.5 h-6 bg-text-muted rounded-sm
            ${isDraggingSidebar ? 'opacity-100' : 'opacity-50'}
          `}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className={`
          flex items-center justify-end gap-2 px-4 py-2
          border-b border-border bg-bg shrink-0
        `}
        >
          <button
            onClick={() => changeLanguage(language === 'en-US' ? 'zh-CN' : 'en-US')}
            className={`
              px-2.5 py-1.5 rounded text-xs font-semibold text-text
              bg-transparent border-none cursor-pointer
              hover:bg-hover transition-colors
            `}
            title={language === 'en-US' ? 'English' : '中文'}
          >
            {language === 'en-US' ? 'EN' : '中文'}
          </button>

          <button
            onClick={cycleTheme}
            className={`
              p-1.5 rounded bg-transparent border-none cursor-pointer
              flex items-center justify-center hover:bg-hover transition-colors
              text-text
            `}
            title={
              theme === 'light'
                ? t('toolbar.lightMode')
                : theme === 'dark'
                  ? t('toolbar.darkMode')
                  : t('toolbar.system')
            }
          >
            <ThemeIcon />
          </button>

          <button
            onClick={() => setQueueDrawerOpen(!queueDrawerOpen)}
            className={`
              p-1.5 rounded bg-transparent border-none cursor-pointer
              flex items-center justify-center hover:bg-hover transition-colors
              ${queueDrawerOpen ? 'text-accent bg-hover' : 'text-text bg-transparent'}
              relative
            `}
            title={`${queueDrawerOpen ? t('toolbar.hide') : t('toolbar.show')} ${t('toolbar.queue')}${tasks.length > 0 ? ` (${tasks.length})` : ''}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            {tasks.length > 0 && (
              <span
                className={`
                absolute -top-1 -right-1 text-[10px] font-bold
                text-white bg-danger rounded-full px-1 min-w-3.5 text-center
              `}
              >
                {tasks.length}
              </span>
            )}
          </button>
        </div>

        <FileAreaContainer />
      </div>

      {queueDrawerOpen && (
        <>
          <div
            className={`
              resizer flex items-center justify-center w-1
              cursor-col-resize bg-transparent
              transition-colors duration-150
            `}
            onMouseDown={() => setIsDraggingQueue(true)}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={e => {
              if (!isDraggingQueue) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <div
              className={`
              w-0.5 h-6 bg-text-muted rounded-sm
              ${isDraggingQueue ? 'opacity-100' : 'opacity-50'}
            `}
            />
          </div>
          <QueueDrawer />
        </>
      )}

      <Toast />
    </div>
  )
}

export default App
