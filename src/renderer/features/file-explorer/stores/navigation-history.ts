import { create } from 'zustand'

interface HistoryEntry {
  paths: string[]
  index: number
}

export interface NavigationHistoryStore {
  /** 按 `connectionId` 存：重连会换 sessionId，但路径仍然有效。 */
  histories: Record<string, HistoryEntry>
  /** 记录一次访问；与当前项相同时不动，避免前进/后退回写时重复入栈。 */
  record: (connectionId: string, path: string) => void
  /** 移动游标并返回目标路径；越界返回 null。 */
  step: (connectionId: string, delta: -1 | 1) => string | null
  clear: (connectionId: string) => void
}

export const useNavigationHistoryStore = create<NavigationHistoryStore>((set, get) => ({
  histories: {},

  record: (connectionId, path) => {
    set((state) => {
      const history = state.histories[connectionId]
      if (history?.paths[history.index] === path) return state

      // 从历史中间跳走时丢弃前进分支，与浏览器一致。
      const paths = history ? history.paths.slice(0, history.index + 1) : []
      paths.push(path)
      return {
        histories: {
          ...state.histories,
          [connectionId]: { paths, index: paths.length - 1 },
        },
      }
    })
  },

  step: (connectionId, delta) => {
    const history = get().histories[connectionId]
    if (!history) return null

    const nextIndex = history.index + delta
    const target = history.paths[nextIndex]
    if (target === undefined) return null

    set((state) => ({
      histories: {
        ...state.histories,
        [connectionId]: { paths: history.paths, index: nextIndex },
      },
    }))
    return target
  },

  clear: (connectionId) => {
    set((state) => {
      if (!(connectionId in state.histories)) return state
      const histories = { ...state.histories }
      delete histories[connectionId]
      return { histories }
    })
  },
}))
