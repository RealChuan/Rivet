import { useEffect } from 'react'
import { useSessionStore } from '../features/session/stores/session.js'

export const useGlobalShortcuts = () => {
  const refreshCurrentDirectory = useSessionStore((state) => state.refreshCurrentDirectory)
  const activeSessionId = useSessionStore((state) => state.activeSessionId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (activeSessionId) {
          void refreshCurrentDirectory(activeSessionId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSessionId, refreshCurrentDirectory])
}
