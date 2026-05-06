import React from 'react'
import { useUiStore } from '../stores/uiStore'

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useUiStore()

  if (toasts.length === 0) return null

  const toastConfig = {
    success: {
      bg: 'rgba(78, 201, 176, 0.95)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    error: {
      bg: 'rgba(241, 76, 76, 0.95)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.95)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {toasts.map(toast => {
        const config = toastConfig[toast.type] || toastConfig.info
        return (
          <div
            key={toast.id}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: '280px',
              backgroundColor: config.bg,
            }}
            className="animate-fadeIn"
          >
            {config.icon}
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                padding: '2px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.8)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default Toast
