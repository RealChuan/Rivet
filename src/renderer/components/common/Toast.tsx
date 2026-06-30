import type { ReactNode } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { AlertCircle, Check, Info, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToastType } from '@shared/constants/index.js'
import { cn } from '@renderer/utils/index.js'
import { useUiStore } from '../../stores/ui.js'

interface ToastConfig {
  bgClass: string
  icon: ReactNode
  ariaType: 'foreground' | 'background'
}

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface GhostState {
  items: ToastItem[]
  openMap: Record<string, boolean>
}

const toastConfig: Record<ToastType, ToastConfig> = {
  success: {
    bgClass: 'bg-toast-success',
    icon: <Check className="w-4 h-4 stroke-white stroke-2" />,
    ariaType: 'background',
  },
  error: {
    bgClass: 'bg-toast-error',
    icon: <AlertCircle className="w-4 h-4 stroke-white stroke-2" />,
    ariaType: 'foreground',
  },
  info: {
    bgClass: 'bg-toast-info',
    icon: <Info className="w-4 h-4 stroke-white stroke-2" />,
    ariaType: 'background',
  },
  warning: {
    bgClass: 'bg-toast-warning',
    icon: <TriangleAlert className="w-4 h-4 stroke-white stroke-2" />,
    ariaType: 'foreground',
  },
}

// Ghost-list exit 动画时长（需 ≥ CSS animate-toast-out 的 100ms）
const CLEANUP_DELAY = 150

function syncGhostState(prev: GhostState, toasts: ToastItem[]): GhostState {
  const existingIds = new Set(prev.items.map((x) => x.id))
  const storeIds = new Set(toasts.map((x) => x.id))

  let changed = false
  const items = [...prev.items]
  const openMap = { ...prev.openMap }

  // 新增 toast：加入 items 并标记 open=true
  for (const toast of toasts) {
    if (!existingIds.has(toast.id)) {
      items.push(toast)
      openMap[toast.id] = true
      changed = true
    } else if (openMap[toast.id] !== true) {
      openMap[toast.id] = true
      changed = true
    }
  }

  // 移除的 toast：标记 open=false 触发 exit 动画
  for (const item of prev.items) {
    if (!storeIds.has(item.id) && openMap[item.id] !== false) {
      openMap[item.id] = false
      changed = true
    }
  }

  return changed ? { items, openMap } : prev
}

function toToastItems(
  toasts: ReadonlyArray<{ id: string; type: ToastType; message: string }>,
): ToastItem[] {
  return toasts.map((x) => ({ id: x.id, type: x.type, message: x.message }))
}

export const Toast = () => {
  const { t } = useTranslation()
  const toasts = useUiStore((state) => state.toasts)
  const removeToast = useUiStore((state) => state.removeToast)

  // Ghost-list：items 是 store toasts 的超集，包含正在退出动画的 toast
  // 用 lazy initializer 在挂载时同步 store toasts（处理 store 先有 toast 再 render 的场景）
  const [state, setState] = useState<GhostState>(() =>
    syncGhostState({ items: [], openMap: {} }, toToastItems(toasts)),
  )
  // 用于检测 store toasts 引用变化（React 推荐：render 中 setState 响应外部状态变化）
  // 参考：https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevToasts, setPrevToasts] = useState(toasts)
  const cleanupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // 在 render 中检测 store 变化并同步 ghost-list 状态（避免 effect 中同步 setState）
  if (toasts !== prevToasts) {
    setPrevToasts(toasts)
    setState((prev) => syncGhostState(prev, toToastItems(toasts)))
  }

  // 延迟从 items 移除已退出动画的 toast，保证 exit 动画播放完毕
  // setState 在 setTimeout 回调中（异步），符合 react-hooks/set-state-in-effect 规则
  const scheduleCleanup = useCallback((id: string) => {
    if (cleanupTimers.current[id]) return
    cleanupTimers.current[id] = setTimeout(() => {
      setState((prev) => {
        const items = prev.items.filter((x) => x.id !== id)
        if (items.length === prev.items.length) return prev
        const openMap = { ...prev.openMap }
        delete openMap[id]
        return { items, openMap }
      })
      delete cleanupTimers.current[id]
    }, CLEANUP_DELAY)
  }, [])

  // 检测被标记为 open=false 的 toast，调度 cleanup（异步，允许）
  useEffect(() => {
    for (const item of state.items) {
      if (state.openMap[item.id] === false && !cleanupTimers.current[item.id]) {
        scheduleCleanup(item.id)
      }
    }
  }, [state, scheduleCleanup])

  // 用户点击关闭或滑动关闭：标记 open=false 触发 exit 动画，并从 store 移除
  const handleOpenChange = useCallback(
    (id: string, open: boolean) => {
      if (open) return
      setState((prev) =>
        prev.openMap[id] === false ? prev : { ...prev, openMap: { ...prev.openMap, [id]: false } },
      )
      removeToast(id)
      scheduleCleanup(id)
    },
    [removeToast, scheduleCleanup],
  )

  // 卸载时清理所有定时器，避免内存泄漏
  useEffect(() => {
    const timers = cleanupTimers.current
    return () => {
      for (const id in timers) {
        clearTimeout(timers[id])
      }
    }
  }, [])

  if (state.items.length === 0) return null

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={Infinity}>
      {state.items.map((item) => {
        const config = toastConfig[item.type] ?? toastConfig.info
        return (
          <ToastPrimitive.Root
            asChild
            key={item.id}
            open={state.openMap[item.id] === true}
            type={config.ariaType}
            onOpenChange={(nextOpen) => handleOpenChange(item.id, nextOpen)}
          >
            <li
              role="listitem"
              className={cn(
                'px-4 py-3 rounded-lg flex items-center gap-2.5 min-w-70',
                'shadow-toast outline-none',
                'data-[state=open]:animate-toast-in',
                'data-[state=closed]:animate-toast-out',
                'data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)',
                'data-[swipe=cancel]:translate-x-0',
                'data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x)',
                config.bgClass,
              )}
            >
              {config.icon}
              <div
                role="status"
                aria-live={config.ariaType === 'foreground' ? 'assertive' : 'polite'}
                className="flex-1"
              >
                <ToastPrimitive.Description className="text-sm font-medium text-white">
                  {item.message}
                </ToastPrimitive.Description>
              </div>
              <ToastPrimitive.Close
                aria-label={t(($) => $.common.close)}
                className={cn(
                  'p-0.5 rounded bg-transparent border-none cursor-pointer',
                  'text-white/70 hover:text-white transition-colors hover:bg-white/10',
                  'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
                )}
              >
                <X className="w-3.5 h-3.5 stroke-current stroke-2" />
              </ToastPrimitive.Close>
            </li>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-5 right-5 z-100 flex flex-col gap-2 m-0 p-0 list-none outline-none" />
    </ToastPrimitive.Provider>
  )
}

export default Toast
