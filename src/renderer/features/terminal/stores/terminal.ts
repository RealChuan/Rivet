import { create } from 'zustand'
import { terminalApi } from '../../../api/index.js'

export type TerminalStatus = 'idle' | 'connecting' | 'ready' | 'exited' | 'error'

export const DEFAULT_TERMINAL_HEIGHT = 240
const MIN_HEIGHT = 160
const MAX_HEIGHT = 640

/** 一条终端标签，terminalId 与主进程的终端一一对应。 */
export interface TerminalTab {
  terminalId: string
  /** 会话内序号，用作「终端 N」标题；关闭后不回收。 */
  index: number
  /** 打开时所在的目录，之后换目录不跟着变。 */
  cwd: string
}

/** 终端抽屉：开合、高度、每个会话的标签与每条标签的状态，不持久化。 */
interface TerminalStore {
  isOpen: boolean
  /** 占满整个文件区，等价于传输队列的「最大化」。 */
  isMaximized: boolean
  height: number
  tabsBySession: Record<string, TerminalTab[]>
  activeTabBySession: Record<string, string>
  statusByTab: Record<string, TerminalStatus>
  errorByTab: Record<string, string>
  toggle: () => void
  close: () => void
  toggleMaximize: () => void
  setHeight: (height: number) => void
  /** 会话没有标签时补一条。 */
  ensureTab: (sessionId: string, cwd: string) => void
  addTab: (sessionId: string, cwd: string) => string
  removeTab: (sessionId: string, terminalId: string) => void
  setActiveTab: (sessionId: string, terminalId: string) => void
  setStatus: (terminalId: string, status: TerminalStatus, error?: string) => void
  /** 标签是否还在：面板 open 返回后据此决定要不要收终端。 */
  hasTab: (terminalId: string) => boolean
  /** 清掉该会话的标签并收掉对应终端。 */
  forget: (sessionId: string) => void
}

function clampHeight(height: number): number {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)))
}

/** 终端生命周期归 store：面板只附着，StrictMode 重挂载不会关掉 ssh。 */
function closeTerminal(terminalId: string): void {
  void terminalApi.close(terminalId).catch(() => undefined)
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  isOpen: false,
  isMaximized: false,
  height: DEFAULT_TERMINAL_HEIGHT,
  tabsBySession: {},
  activeTabBySession: {},
  statusByTab: {},
  errorByTab: {},

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

  ensureTab: (sessionId, cwd) => {
    const tabs = get().tabsBySession[sessionId]
    if (tabs !== undefined && tabs.length > 0) return
    get().addTab(sessionId, cwd)
  },

  addTab: (sessionId, cwd) => {
    const terminalId = crypto.randomUUID()
    set((state) => {
      const tabs = state.tabsBySession[sessionId] ?? []
      const index = tabs.reduce((max, tab) => Math.max(max, tab.index), 0) + 1
      return {
        isOpen: true,
        tabsBySession: {
          ...state.tabsBySession,
          [sessionId]: [...tabs, { terminalId, index, cwd }],
        },
        activeTabBySession: { ...state.activeTabBySession, [sessionId]: terminalId },
      }
    })
    return terminalId
  },

  removeTab: (sessionId, terminalId) => {
    const state = get()
    const tabs = state.tabsBySession[sessionId] ?? []
    const index = tabs.findIndex((tab) => tab.terminalId === terminalId)
    if (index === -1) return

    const nextTabs = tabs.filter((tab) => tab.terminalId !== terminalId)
    const statusByTab = { ...state.statusByTab }
    const errorByTab = { ...state.errorByTab }
    const activeTabBySession = { ...state.activeTabBySession }
    delete statusByTab[terminalId]
    delete errorByTab[terminalId]

    if (nextTabs.length === 0) {
      // 关掉最后一条标签等同于收起抽屉。
      delete activeTabBySession[sessionId]
      set({
        isOpen: false,
        isMaximized: false,
        tabsBySession: { ...state.tabsBySession, [sessionId]: nextTabs },
        activeTabBySession,
        statusByTab,
        errorByTab,
      })
    } else {
      // 关掉当前标签时落到左邻，左边没有就取右边。
      if (activeTabBySession[sessionId] === terminalId) {
        const nextActive = nextTabs[Math.min(index, nextTabs.length - 1)]
        if (nextActive) activeTabBySession[sessionId] = nextActive.terminalId
      }
      set({
        tabsBySession: { ...state.tabsBySession, [sessionId]: nextTabs },
        activeTabBySession,
        statusByTab,
        errorByTab,
      })
    }

    closeTerminal(terminalId)
  },

  setActiveTab: (sessionId, terminalId) => {
    set((state) => ({
      activeTabBySession: { ...state.activeTabBySession, [sessionId]: terminalId },
    }))
  },

  setStatus: (terminalId, status, error) => {
    // 标签关掉之后才到的 exit 事件不该把状态写回来。
    if (!get().hasTab(terminalId)) return
    set((state) => {
      const statusByTab = { ...state.statusByTab, [terminalId]: status }
      const errorByTab = { ...state.errorByTab }
      if (error === undefined) {
        delete errorByTab[terminalId]
      } else {
        errorByTab[terminalId] = error
      }
      return { statusByTab, errorByTab }
    })
  },

  hasTab: (terminalId) =>
    Object.values(get().tabsBySession).some((tabs) =>
      tabs.some((tab) => tab.terminalId === terminalId),
    ),

  forget: (sessionId) => {
    const state = get()
    const tabs = state.tabsBySession[sessionId] ?? []

    const tabsBySession = { ...state.tabsBySession }
    const activeTabBySession = { ...state.activeTabBySession }
    const statusByTab = { ...state.statusByTab }
    const errorByTab = { ...state.errorByTab }
    delete tabsBySession[sessionId]
    delete activeTabBySession[sessionId]
    for (const tab of tabs) {
      delete statusByTab[tab.terminalId]
      delete errorByTab[tab.terminalId]
    }

    set({ tabsBySession, activeTabBySession, statusByTab, errorByTab })
    for (const tab of tabs) closeTerminal(tab.terminalId)
  },
}))
