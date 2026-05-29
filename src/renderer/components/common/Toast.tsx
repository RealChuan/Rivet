import type React from 'react'
import { useEffect, useState } from 'react'
import { useUiStore } from '../../stores/ui.js'

export const Toast: React.FC = () => {
  const toasts = useUiStore(state => state.toasts)
  const removeToast = useUiStore(state => state.removeToast)
  const [visibleToasts, setVisibleToasts] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = new Set(toasts.map(t => t.id))
    requestAnimationFrame(() => {
      setVisibleToasts(prev => {
        const next = new Set(prev)
        let changed = false
        for (const id of currentIds) {
          if (!next.has(id)) {
            next.add(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    })
  }, [toasts])

  if (toasts.length === 0) return null

  const toastConfig = {
    success: {
      bgClass: 'bg-toast-success',
      icon: (
        <svg className="w-4 h-4 stroke-white stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    },
    error: {
      bgClass: 'bg-toast-error',
      icon: (
        <svg className="w-4 h-4 stroke-white stroke-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    info: {
      bgClass: 'bg-toast-info',
      icon: (
        <svg className="w-4 h-4 stroke-white stroke-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
    warning: {
      bgClass: 'bg-warning text-white border-none',
      icon: (
        <svg className="w-4 h-4 stroke-white stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  }

  return (
    <div className="fixed bottom-5 right-5 z-100 flex flex-col gap-2">
      {toasts.map(toast => {
        const config = toastConfig[toast.type] || toastConfig.info
        const isVisible = visibleToasts.has(toast.id)
        return (
          <div
            key={toast.id}
            className={`
              px-4 py-3 rounded-lg flex items-center gap-2.5
              min-w-70 ${config.bgClass}
              shadow-[0_8px_24px_-4px_rgba(0,0,0,0.15)]
              dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4)]
              transition-all duration-150 ease-out
              ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.96]'}
            `}
          >
            {config.icon}
            <span className="flex-1 text-sm font-medium text-white">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className={`
                p-0.5 rounded bg-transparent border-none cursor-pointer
                text-white/70 hover:text-white transition-colors
                hover:bg-white/10
              `}
            >
              <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
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
