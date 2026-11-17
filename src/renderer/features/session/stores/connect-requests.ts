import { create } from 'zustand'

/**
 * 在飞的连接请求：列表项靠它显示"连接中"，用户靠它取消。
 * 用 store 而不是组件内 state，因为发起入口有三个（列表项菜单、对话框保存、对话框重连提交），
 * 而状态的展示方只有列表项。
 */
export interface ConnectRequestsStore {
  /** connectionId → 本次连接尝试的 controller；同一台同时只允许一次尝试。 */
  pending: Record<string, AbortController>
  /** 最近一次发起连接的 connectionId：对话框在"新建连接"时还没有可展示的 id。 */
  lastRequestedId: string | null

  /** 返回 null 表示这台已有连接在跑，调用方应直接忽略本次点击。 */
  begin: (connectionId: string) => AbortSignal | null
  end: (connectionId: string) => void
  cancel: (connectionId: string) => void
  cancelLatest: () => void
}

export const useConnectRequestsStore = create<ConnectRequestsStore>((set, get) => ({
  pending: {},
  lastRequestedId: null,

  begin: (connectionId) => {
    if (get().pending[connectionId] !== undefined) return null

    const controller = new AbortController()
    set((state) => ({
      pending: { ...state.pending, [connectionId]: controller },
      lastRequestedId: connectionId,
    }))
    return controller.signal
  },

  end: (connectionId) => {
    set((state) => {
      const pending = { ...state.pending }
      delete pending[connectionId]
      return { pending }
    })
  },

  cancel: (connectionId) => {
    get().pending[connectionId]?.abort()
  },

  cancelLatest: () => {
    const latest = get().lastRequestedId
    if (latest !== null) get().cancel(latest)
  },
}))

/** 列表项用的布尔选择器：避免订阅整个 pending 表。 */
export const useIsConnecting = (connectionId: string): boolean =>
  useConnectRequestsStore((state) => state.pending[connectionId] !== undefined)
