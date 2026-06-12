import type React from 'react'
import { AlertCircle, TriangleAlert, Check, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/utils/index.js'
import { useUiStore } from '../../stores/ui.js'

export const Toast: React.FC = () => {
  const { t } = useTranslation()
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
      icon: <Check className="w-4 h-4 stroke-white stroke-2" />,
    },
    error: {
      bgClass: 'bg-toast-error',
      icon: <AlertCircle className="w-4 h-4 stroke-white stroke-2" />,
    },
    info: {
      bgClass: 'bg-toast-info',
      icon: <Info className="w-4 h-4 stroke-white stroke-2" />,
    },
    warning: {
      bgClass: 'bg-toast-warning',
      icon: <TriangleAlert className="w-4 h-4 stroke-white stroke-2" />,
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
            className={cn(
              'px-4 py-3 rounded-lg flex items-center gap-2.5',
              'min-w-70',
              config.bgClass,
              'shadow-toast',
              'transition-all duration-150 ease-out',
              isVisible
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-2 scale-[0.96]'
            )}
          >
            {config.icon}
            <span className="flex-1 text-sm font-medium text-white">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label={t('common.close')}
              className={`
                p-0.5 rounded bg-transparent border-none cursor-pointer
                text-white/70 hover:text-white transition-colors
                hover:bg-white/10
                focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
              `}
            >
              <X className="w-3.5 h-3.5 stroke-current stroke-2" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default Toast
