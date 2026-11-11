import { useEffect } from 'react'
import { FILE_VIEW_MODE, PROTOCOL } from '@shared/constants/index.js'
import { useDirectoryInvalidation } from '../features/file-explorer/hooks/index.js'
import { useNavigationHistoryStore } from '../features/file-explorer/stores/navigation-history.js'
import { useConnectionStore } from '../features/session/stores/connection.js'
import { useSessionStore } from '../features/session/stores/session.js'
import { useTerminalStore } from '../features/terminal/stores/terminal.js'
import { useUiStore } from '../stores/ui.js'

export const useGlobalShortcuts = () => {
  const { invalidateSession, markSessionStale } = useDirectoryInvalidation()
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const activeConnectionId = useSessionStore(
    (state) => state.sessions.find((s) => s.sessionId === state.activeSessionId)?.connectionId,
  )
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const setFileViewMode = useUiStore((state) => state.setFileViewMode)
  const setAddressEditing = useUiStore((state) => state.setAddressEditing)
  const stepHistory = useNavigationHistoryStore((state) => state.step)
  const connections = useConnectionStore((state) => state.connections)
  const toggleTerminal = useTerminalStore((state) => state.toggle)
  const isSftpSession =
    connections.find((item) => item.id === activeConnectionId)?.protocol === PROTOCOL.SFTP

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+` 必须早于输入框守卫：xterm 的输入元件是 textarea。
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        if (!isSftpSession) return
        e.preventDefault()
        toggleTerminal()
        return
      }

      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return

      // Alt+←/→ 与资源管理器一致；只对当前会话生效，隐藏会话不响应。
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        if (!activeSessionId || !activeConnectionId) return
        e.preventDefault()
        const path = stepHistory(activeConnectionId, e.key === 'ArrowLeft' ? -1 : 1)
        if (path === null) return
        updateCurrentPath(activeSessionId, path)
        void markSessionStale(activeSessionId)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        if (!activeSessionId) return
        e.preventDefault()
        setAddressEditing(activeSessionId)
        return
      }

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
  }, [
    activeConnectionId,
    activeSessionId,
    invalidateSession,
    isSftpSession,
    markSessionStale,
    setAddressEditing,
    setFileViewMode,
    stepHistory,
    toggleTerminal,
    updateCurrentPath,
  ])
}
