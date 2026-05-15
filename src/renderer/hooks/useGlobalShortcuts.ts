import { useEffect } from 'react'
import { useSessionStore } from '../features/session/stores/sessionStore.js'
import { fireAndForget } from '@shared/utils/index.js'

export const useGlobalShortcuts = () => {
  const { refreshCurrentDirectory, activeSessionId } = useSessionStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (activeSessionId) {
          fireAndForget(refreshCurrentDirectory(activeSessionId), 'Failed to refresh directory')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSessionId, refreshCurrentDirectory])
}
