import { useCallback, useMemo } from 'react'
import { useSessionStore } from '../../session/stores/session.js'
import { useFavoritesStore } from '../stores/favorites.js'

/** 稳定空数组：selector 每次返回新数组会触发 useSyncExternalStore 反复重渲染。 */
const NO_PATHS: readonly string[] = []

export interface ConnectionFavorites {
  paths: readonly string[]
  favoritePaths: ReadonlySet<string>
  toggleFavorite: (path: string) => void
}

/** 当前连接下的收藏；收藏按 `connectionId` 归属，重连后仍然有效。 */
export function useConnectionFavorites(sessionId: string): ConnectionFavorites {
  const connectionId =
    useSessionStore(
      (state) => state.sessions.find((s) => s.sessionId === sessionId)?.connectionId,
    ) ?? ''
  const paths = useFavoritesStore((state) => state.favorites[connectionId] ?? NO_PATHS)
  const toggle = useFavoritesStore((state) => state.toggle)
  const favoritePaths = useMemo(() => new Set(paths), [paths])

  const toggleFavorite = useCallback(
    (path: string) => {
      if (connectionId === '') return
      toggle(connectionId, path)
    },
    [connectionId, toggle],
  )

  return { paths, favoritePaths, toggleFavorite }
}
