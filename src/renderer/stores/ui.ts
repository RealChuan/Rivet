import { create } from 'zustand'
import type { UiSettings } from '@shared/types/index.js'
import {
  CLOSE_BEHAVIOR,
  type CloseBehavior,
  DEFAULT_CONNECTION_PANEL_WIDTH,
  DEFAULT_LANGUAGE,
  DEFAULT_QUEUE_PANEL_HEIGHT,
  DEFAULT_THEME_VALUE,
  type FileViewMode,
  STORE_KEY,
  type SupportedLanguageLiteral,
  TERMINAL_FONT_SIZE,
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
  /** 关闭主窗口时的行为 */
  closeBehavior: CloseBehavior
  /** 终端字号（px） */
  terminalFontSize: number
  connectionPanelWidth: number
  queuePanelMode: QueuePanelMode
  queuePanelHeight: number
  initialized: boolean
  /** 每个 session/页面独立的视图模式；仅内存，默认 list */
  fileViewModes: Record<string, FileViewMode>
  /** 正在编辑地址栏的 sessionId；null 表示全部处于面包屑状态 */
  addressEditingSessionId: string | null
  toasts: Toast[]
  setAppearance: (appearance: Theme) => void
  setFileViewMode: (sessionId: string, mode: FileViewMode) => void
  setAddressEditing: (sessionId: string | null) => void
  setLocale: (locale: SupportedLanguageLiteral) => void
  setShowHiddenFiles: (showHiddenFiles: boolean) => void
  setCloseBehavior: (closeBehavior: CloseBehavior) => void
  setConnectionPanelWidth: (width: number) => void
  setTerminalFontSize: (fontSize: number) => void
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

/** UI 设置的持久化入口：四个字段始终整体写入，避免部分更新漏字段。 */
function persistUiSettings(state: {
  appearance: Theme
  locale: SupportedLanguageLiteral | ''
  showHiddenFiles: boolean
  closeBehavior: CloseBehavior
  terminalFontSize: number
}): void {
  void configApi.set(STORE_KEY.UI, {
    appearance: state.appearance,
    locale: state.locale,
    showHiddenFiles: state.showHiddenFiles,
    closeBehavior: state.closeBehavior,
    terminalFontSize: state.terminalFontSize,
  })
}

export const useUiStore = create<UiStore>((set, get) => ({
  appearance: DEFAULT_THEME_VALUE,
  locale: DEFAULT_LANGUAGE,
  showHiddenFiles: false,
  closeBehavior: CLOSE_BEHAVIOR.TRAY,
  terminalFontSize: TERMINAL_FONT_SIZE.DEFAULT,
  connectionPanelWidth: DEFAULT_CONNECTION_PANEL_WIDTH,
  queuePanelMode: QUEUE_PANEL_MODE.EXPANDED,
  queuePanelHeight: DEFAULT_QUEUE_PANEL_HEIGHT,
  initialized: false,
  fileViewModes: {},
  addressEditingSessionId: null,
  toasts: [],

  setAddressEditing: (addressEditingSessionId) => {
    set({ addressEditingSessionId })
  },

  setAppearance: (appearance) => {
    set({ appearance })
    persistUiSettings(get())
  },

  setFileViewMode: (sessionId, fileViewMode) => {
    set((state) => ({
      fileViewModes: { ...state.fileViewModes, [sessionId]: fileViewMode },
    }))
  },

  setLocale: (locale) => {
    set({ locale })
    persistUiSettings(get())
  },

  setShowHiddenFiles: (showHiddenFiles) => {
    set({ showHiddenFiles })
    persistUiSettings(get())
  },

  setCloseBehavior: (closeBehavior) => {
    set({ closeBehavior })
    persistUiSettings(get())
  },

  setConnectionPanelWidth: (connectionPanelWidth) => {
    set({ connectionPanelWidth })
  },

  setTerminalFontSize: (terminalFontSize) => {
    set({
      terminalFontSize: Math.min(
        TERMINAL_FONT_SIZE.MAX,
        Math.max(TERMINAL_FONT_SIZE.MIN, Math.round(terminalFontSize)),
      ),
    })
    persistUiSettings(get())
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
      closeBehavior: settings.closeBehavior ?? CLOSE_BEHAVIOR.TRAY,
      terminalFontSize: settings.terminalFontSize ?? TERMINAL_FONT_SIZE.DEFAULT,
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
