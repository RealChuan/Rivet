import { create } from 'zustand'
import { STORE_KEY } from '@shared/constants/index.js'
import { configApi } from '../../../api/config.js'

/** connectionId → 收藏的远端目录（按添加顺序）。 */
export type FavoriteMap = Record<string, string[]>

export interface FavoritesStore {
  favorites: FavoriteMap
  /** 从配置加载一次；失败时保持空表，不阻塞启动。 */
  load: () => Promise<void>
  /** 已收藏则移除，否则追加到末尾。 */
  toggle: (connectionId: string, path: string) => void
  remove: (connectionId: string, path: string) => void
}

/** 配置是 `unknown`，只接受 `string[]` 形态的条目。 */
function normalizeFavorites(value: unknown): FavoriteMap {
  if (typeof value !== 'object' || value === null) return {}

  const favorites: FavoriteMap = {}
  for (const [connectionId, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) continue
    const valid = paths.filter((path): path is string => typeof path === 'string')
    if (valid.length > 0) favorites[connectionId] = valid
  }
  return favorites
}

function persist(favorites: FavoriteMap): void {
  void configApi.set(STORE_KEY.FAVORITES, favorites)
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: {},

  load: async () => {
    try {
      const value = await configApi.get<unknown>(STORE_KEY.FAVORITES)
      set({ favorites: normalizeFavorites(value) })
    } catch {
      // 读取失败保持空表：收藏是辅助功能，不该拖住启动。
      set({ favorites: {} })
    }
  },

  toggle: (connectionId, path) => {
    const current = get().favorites[connectionId] ?? []
    const next = current.includes(path)
      ? current.filter((item) => item !== path)
      : [...current, path]

    const favorites = { ...get().favorites }
    if (next.length === 0) delete favorites[connectionId]
    else favorites[connectionId] = next

    set({ favorites })
    persist(favorites)
  },

  remove: (connectionId, path) => {
    const current = get().favorites[connectionId] ?? []
    const next = current.filter((item) => item !== path)

    const favorites = { ...get().favorites }
    if (next.length === 0) delete favorites[connectionId]
    else favorites[connectionId] = next

    set({ favorites })
    persist(favorites)
  },
}))
