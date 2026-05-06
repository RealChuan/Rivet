import { useEffect } from 'react'
import { FILE_VIEW_MODE } from '@shared/constants/index.js'
import { useDirectoryInvalidation } from '../features/file-explorer/hooks/index.js'
import { useSessionStore } from '../features/session/stores/session.js'
import { useUiStore } from '../stores/ui.js'

export const useGlobalShortcuts = () => {
  const { invalidateSession } = useDirectoryInvalidation()
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const setFileViewMode = useUiStore((state) => state.setFileViewMode)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return

      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        if (activeSessionId) setFileViewMode(activeSessionId, FILE_VIEW_MODE.LIST)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        if (activeSessionId) setFileViewMode(activeSessionId, FILE_VIEW_MODE.GRID)
        return
      }

      if (e.key === 'F5') {
        e.preventDefault()
        if (activeSessionId) {
          void invalidateSession(activeSessionId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSessionId, invalidateSession, setFileViewMode])
}
