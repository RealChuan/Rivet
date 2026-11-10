import { useCallback, useEffect } from 'react'
import { useSessionStore } from '../../session/stores/session.js'
import { useNavigationHistoryStore } from '../stores/navigation-history.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'

export interface NavigationHistoryControls {
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
}

/**
 * 历史栈只存路径，不存目录内容：跳转后仍由 queryKey 重新列目录，
 * 新鲜度与正常进入目录一致。
 */
export function useNavigationHistory(
  sessionId: string,
  connectionId: string,
  currentPath: string,
): NavigationHistoryControls {
  const history = useNavigationHistoryStore((state) => state.histories[connectionId])
  const record = useNavigationHistoryStore((state) => state.record)
  const step = useNavigationHistoryStore((state) => state.step)
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const { markSessionStale } = useDirectoryInvalidation()

  useEffect(() => {
    if (connectionId === '' || sessionId === '') return
    record(connectionId, currentPath)
  }, [connectionId, currentPath, record, sessionId])

  const go = useCallback(
    (delta: -1 | 1) => {
      if (connectionId === '' || sessionId === '') return
      const target = step(connectionId, delta)
      if (target === null) return
      updateCurrentPath(sessionId, target)
      void markSessionStale(sessionId)
    },
    [connectionId, markSessionStale, sessionId, step, updateCurrentPath],
  )

  return {
    canGoBack: (history?.index ?? 0) > 0,
    canGoForward: history !== undefined && history.index < history.paths.length - 1,
    goBack: () => go(-1),
    goForward: () => go(1),
  }
}
