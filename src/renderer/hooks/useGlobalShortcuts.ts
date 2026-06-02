import { useEffect, useState } from 'react'
import { useSessionStore } from '../features/session/stores/session.js'

export const useGlobalShortcuts = () => {
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const activeSessionId = useSessionStore(state => state.activeSessionId)
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = window.electronAPI.transfer.onHasActiveTasks(() => {
      setQuitConfirmOpen(true)
    })
    return unsubscribe
  }, [])

  const handleConfirmQuit = async () => {
    await window.electronAPI.transfer.cancelAll()
    window.electronAPI.window.close()
  }

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

  return { quitConfirmOpen, setQuitConfirmOpen, handleConfirmQuit }
}
