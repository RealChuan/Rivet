import { create } from 'zustand'
import type { UiSettings } from '@shared/types/index.js'
import {
  DEFAULT_CONNECTION_PANEL_WIDTH,
  DEFAULT_LANGUAGE,
  DEFAULT_QUEUE_PANEL_HEIGHT,
  DEFAULT_THEME_VALUE,
  type FileViewMode,
  STORE_KEY,
  type SupportedLanguageLiteral,
  type Theme,
  TIMEOUTS,
  TOAST_TYPE,
  type ToastType,
} from '@shared/constants/index.js'
import { QUEUE_PANEL_MODE, type QueuePanelMode } from '@shared/constants/transfer.js'
import { configApi } from '../api/config.js'

interface UiStore {
  appearance: Theme
  locale: SupportedLanguageLiteral | ''
  /** 是否显示以 `.` 开头的隐藏条目 */
  showHiddenFiles: boolean
  connectionPanelWidth: number
  queuePanelMode: QueuePanelMode
  queuePanelHeight: number
  initialized: boolean
  /** 每个 session/页面独立的视图模式；仅内存，默认 list */
  fileViewModes: Record<string, FileViewMode>
  toasts: Toast[]
  setAppearance: (appearance: Theme) => void
  setFileViewMode: (sessionId: string, mode: FileViewMode) => void
  setLocale: (locale: SupportedLanguageLiteral) => void
  setShowHiddenFiles: (showHiddenFiles: boolean) => void
  setConnectionPanelWidth: (width: number) => void
  setQueuePanelMode: (mode: QueuePanelMode) => void
  setQueuePanelHeight: (height: number) => void
  initialize: (settings: Partial<UiSettings>) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
  timer?: ReturnType<typeof setTimeout> | undefined
}

function getToastDuration(type: ToastType, customDuration?: number): number {
  if (customDuration !== undefined) return customDuration
  return type === TOAST_TYPE.ERROR ? TIMEOUTS.TOAST_ERROR_DURATION : TIMEOUTS.TOAST_DEFAULT_DURATION
}

export const useUiStore = create<UiStore>((set, get) => ({
  appearance: DEFAULT_THEME_VALUE,
  locale: DEFAULT_LANGUAGE,
  showHiddenFiles: false,
  connectionPanelWidth: DEFAULT_CONNECTION_PANEL_WIDTH,
  queuePanelMode: QUEUE_PANEL_MODE.EXPANDED,
  queuePanelHeight: DEFAULT_QUEUE_PANEL_HEIGHT,
  initialized: false,
  fileViewModes: {},
  toasts: [],

  setAppearance: (appearance) => {
    set({ appearance })
    const { locale, showHiddenFiles } = get()
    void configApi.set(STORE_KEY.UI, { appearance, locale, showHiddenFiles })
  },

  setFileViewMode: (sessionId, fileViewMode) => {
    set((state) => ({
      fileViewModes: { ...state.fileViewModes, [sessionId]: fileViewMode },
    }))
  },

  setLocale: (locale) => {
    set({ locale })
    const { appearance, showHiddenFiles } = get()
    void configApi.set(STORE_KEY.UI, { appearance, locale, showHiddenFiles })
  },

  setShowHiddenFiles: (showHiddenFiles) => {
    set({ showHiddenFiles })
    const { appearance, locale } = get()
    void configApi.set(STORE_KEY.UI, { appearance, locale, showHiddenFiles })
  },

  setConnectionPanelWidth: (connectionPanelWidth) => {
    set({ connectionPanelWidth })
  },

  setQueuePanelMode: (queuePanelMode) => {
    set({ queuePanelMode })
  },

  setQueuePanelHeight: (queuePanelHeight) => {
    set({ queuePanelHeight })
  },

  initialize: (settings) => {
    set({
      appearance: settings.appearance ?? DEFAULT_THEME_VALUE,
      locale: settings.locale ?? DEFAULT_LANGUAGE,
      showHiddenFiles: settings.showHiddenFiles ?? false,
      fileViewModes: {},
      initialized: true,
    })
  },

  addToast: (toast) => {
    const id = crypto.randomUUID()
    let timer: ReturnType<typeof setTimeout> | undefined

    if (toast.duration !== 0) {
      const duration = getToastDuration(toast.type, toast.duration)
      timer = setTimeout(() => {
        set((state) => {
          const existingToast = state.toasts.find((t) => t.id === id)
          if (!existingToast) return state
          if (existingToast.timer) {
            clearTimeout(existingToast.timer)
          }
          return {
            toasts: state.toasts.filter((t) => t.id !== id),
          }
        })
      }, duration)
    }

    const newToast: Toast = { ...toast, id, timer }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))
  },

  removeToast: (id) => {
    set((state) => {
      const toastToRemove = state.toasts.find((t) => t.id === id)
      if (toastToRemove?.timer) {
        clearTimeout(toastToRemove.timer)
      }
      return {
        toasts: state.toasts.filter((t) => t.id !== id),
      }
    })
  },
}))
