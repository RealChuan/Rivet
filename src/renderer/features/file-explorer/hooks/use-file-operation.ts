import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { logger } from '@renderer/utils/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface FileOperationResult {
  execute: <T>(operation: () => Promise<T>) => Promise<T | undefined>
  isOperating: boolean
}

export function useFileOperation(sessionId: string): FileOperationResult {
  const addToast = useUiStore(state => state.addToast)
  const isOperating = useSessionStore(state => {
    const session = state.sessions.find(s => s.sessionId === sessionId)
    return session?.isOperating ?? false
  })
  const setOperating = useSessionStore(state => state.setOperating)

  async function execute<T>(operation: () => Promise<T>): Promise<T | undefined> {
    setOperating(sessionId, true)
    try {
      return await operation()
    } catch (e) {
      const message = formatErrorMessage(e)
      logger.catch(e)
      addToast({ type: TOAST_TYPE.ERROR, message })
      return undefined
    } finally {
      setOperating(sessionId, false)
    }
  }

  return { execute, isOperating }
}
