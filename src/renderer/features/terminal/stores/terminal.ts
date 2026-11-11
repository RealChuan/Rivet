import { create } from 'zustand'

export type TerminalStatus = 'idle' | 'connecting' | 'ready' | 'exited' | 'error'

export const DEFAULT_TERMINAL_HEIGHT = 240
const MIN_HEIGHT = 160
const MAX_HEIGHT = 640

/** 终端抽屉：只有开合、高度和每个会话的状态，不持久化。 */
interface TerminalStore {
  isOpen: boolean
  /** 占满整个文件区，等价于传输队列的「最大化」。 */
  isMaximized: boolean
  height: number
  statusBySession: Record<string, TerminalStatus>
  errorBySession: Record<string, string>
  toggle: () => void
  close: () => void
  toggleMaximize: () => void
  setHeight: (height: number) => void
  setStatus: (sessionId: string, status: TerminalStatus, error?: string) => void
  forget: (sessionId: string) => void
}

function clampHeight(height: number): number {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)))
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  isOpen: false,
  isMaximized: false,
  height: DEFAULT_TERMINAL_HEIGHT,
  statusBySession: {},
  errorBySession: {},

  // 收起时顺手取消最大化，否则下次打开会直接铺满。
  toggle: () => {
    set((state) => (state.isOpen ? { isOpen: false, isMaximized: false } : { isOpen: true }))
  },

  close: () => {
    set({ isOpen: false, isMaximized: false })
  },

  toggleMaximize: () => {
    set((state) => ({ isMaximized: !state.isMaximized }))
  },

  setHeight: (height) => {
    set({ height: clampHeight(height) })
  },

  setStatus: (sessionId, status, error) => {
    set((state) => {
      const statusBySession = { ...state.statusBySession, [sessionId]: status }
      const errorBySession = { ...state.errorBySession }
      if (error === undefined) {
        delete errorBySession[sessionId]
      } else {
        errorBySession[sessionId] = error
      }
      return { statusBySession, errorBySession }
    })
  },

  forget: (sessionId) => {
    set((state) => {
      const statusBySession = { ...state.statusBySession }
      const errorBySession = { ...state.errorBySession }
      delete statusBySession[sessionId]
      delete errorBySession[sessionId]
      return { statusBySession, errorBySession }
    })
  },
}))
