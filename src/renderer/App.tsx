import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionSidebar } from './components/SessionSidebar/SessionSidebar'
import { FileAreaContainer } from './components/FileArea/FileAreaContainer'
import { QueueDrawer } from './components/QueueDrawer/QueueDrawer'
import { Toast } from './components/Toast'
import { useUiStore } from './stores/uiStore'
import { useQueueStore } from './stores/queueStore'
import { useSessionStore } from './stores/sessionStore'
import { useTheme } from './hooks/useTheme'
import { useI18n } from './hooks/useI18n'
import { useTransferQueue } from './hooks/useTransferQueue'

const App: React.FC = () => {
  const { i18n } = useTranslation()
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

        const getSystemLanguage = (): 'zh-CN' | 'en-US' => {
          const systemLang = navigator.language
          if (systemLang.startsWith('zh')) {
            return 'zh-CN'
          }
          return 'en-US'
        }

        if (savedSettings) {
          initialize(savedSettings)
          if (savedSettings.language) {
            i18n.changeLanguage(savedSettings.language)
          } else {
            const systemLanguage = getSystemLanguage()
            i18n.changeLanguage(systemLanguage)
          }
          if (savedSettings.theme) {
            const resolvedTheme =
              savedSettings.theme === 'system'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light'
                : savedSettings.theme
            document.documentElement.dataset.theme = resolvedTheme
          }
        } else {
          const systemLanguage = getSystemLanguage()
          initialize({ language: systemLanguage })
          i18n.changeLanguage(systemLanguage)
        }
      } catch (error) {
        const systemLanguage = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US'
        initialize({ language: systemLanguage })
        i18n.changeLanguage(systemLanguage)
      }
    }

    initApp()
  }, [initialize])

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
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ color: '#6b6b6b', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        backgroundColor: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: sidebarWidth, flexShrink: 0 }}>
        <SessionSidebar />
      </div>

      <div
        className="resizer"
        onMouseDown={() => setIsDraggingSidebar(true)}
        style={{
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
        onMouseLeave={e => {
          if (!isDraggingSidebar) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        <div
          style={{
            width: '2px',
            height: '24px',
            backgroundColor: 'var(--text-muted)',
            opacity: isDraggingSidebar ? 1 : 0.5,
            borderRadius: '1px',
          }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => changeLanguage(language === 'en-US' ? 'zh-CN' : 'en-US')}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {language === 'en-US' ? 'EN' : '中文'}
          </button>

          <button
            onClick={cycleTheme}
            style={{
              padding: '6px',
              borderRadius: '4px',
              color: 'var(--text)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ThemeIcon />
          </button>

          <button
            onClick={() => setQueueDrawerOpen(!queueDrawerOpen)}
            style={{
              padding: '6px',
              borderRadius: '4px',
              color: queueDrawerOpen ? 'var(--accent)' : 'var(--text)',
              backgroundColor: queueDrawerOpen ? 'var(--hover)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e =>
              (e.currentTarget.style.backgroundColor = queueDrawerOpen
                ? 'var(--hover)'
                : 'transparent')
            }
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
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: '#f14c4c',
                  borderRadius: '10px',
                  padding: '1px 4px',
                  minWidth: '14px',
                  textAlign: 'center',
                }}
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
            className="resizer"
            onMouseDown={() => setIsDraggingQueue(true)}
            style={{
              width: '4px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              transition: 'background-color 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={e => {
              if (!isDraggingQueue) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <div
              style={{
                width: '2px',
                height: '24px',
                backgroundColor: 'var(--text-muted)',
                opacity: isDraggingQueue ? 1 : 0.5,
                borderRadius: '1px',
              }}
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
