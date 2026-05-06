import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { logger } from '../../../utils/index.js'
import { useSessionStore } from '../../session/stores/session.js'

interface FileOperationResult {
  execute: <T>(operation: () => Promise<T>) => Promise<T | undefined>
  isOperating: boolean
}

export function useFileOperation(sessionId: string): FileOperationResult {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)
  const isOperating = useSessionStore((state) => {
    const session = state.sessions.find((s) => s.sessionId === sessionId)
    return session?.isOperating ?? false
  })
  const setOperating = useSessionStore((state) => state.setOperating)

  async function execute<T>(operation: () => Promise<T>): Promise<T | undefined> {
    setOperating(sessionId, true)
    try {
      return await operation()
    } catch (e) {
      logger.catch(e)
      addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, e) })
      return undefined
    } finally {
      setOperating(sessionId, false)
    }
  }

  return { execute, isOperating }
}
