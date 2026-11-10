import { create } from 'zustand'
import { STORE_KEY } from '@shared/constants/index.js'
import { configApi } from '../../../api/config.js'

/** connectionId → 上次停留的远端目录。 */
export type LastPathMap = Record<string, string>

export interface LastPathsStore {
  lastPaths: LastPathMap
  /** 从配置加载一次；失败时保持空表，不阻塞启动。 */
  load: () => Promise<void>
  /** 记录连接当前所在目录；与已记录值相同则不写盘。 */
  remember: (connectionId: string, path: string) => void
  /** 连接被删除时丢弃记录，避免留下再也用不到的孤儿键。 */
  forget: (connectionId: string) => void
  getPath: (connectionId: string) => string | undefined
}

/** 配置是 `unknown`，只接受非空字符串形态的条目。 */
function normalizeLastPaths(value: unknown): LastPathMap {
  if (typeof value !== 'object' || value === null) return {}

  const lastPaths: LastPathMap = {}
  for (const [connectionId, path] of Object.entries(value)) {
    if (typeof path === 'string' && path.length > 0) lastPaths[connectionId] = path
  }
  return lastPaths
}

function persist(lastPaths: LastPathMap): void {
  void configApi.set(STORE_KEY.LAST_PATHS, lastPaths)
}

export const useLastPathsStore = create<LastPathsStore>((set, get) => ({
  lastPaths: {},

  load: async () => {
    try {
      const value = await configApi.get<unknown>(STORE_KEY.LAST_PATHS)
      set({ lastPaths: normalizeLastPaths(value) })
    } catch {
      // 读取失败保持空表：恢复上次目录是辅助功能，不该拖住启动。
      set({ lastPaths: {} })
    }
  },

  remember: (connectionId, path) => {
    if (path.length === 0 || get().lastPaths[connectionId] === path) return

    const lastPaths = { ...get().lastPaths, [connectionId]: path }
    set({ lastPaths })
    persist(lastPaths)
  },

  forget: (connectionId) => {
    if (!(connectionId in get().lastPaths)) return

    const lastPaths = { ...get().lastPaths }
    delete lastPaths[connectionId]
    set({ lastPaths })
    persist(lastPaths)
  },

  getPath: (connectionId) => get().lastPaths[connectionId],
}))
