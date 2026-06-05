import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { logger } from '@renderer/utils/index.js'
import { ROOT_PATH, TOAST_TYPE } from '@shared/constants/index.js'
import { isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface UseFolderCreationReturn {
  handleCreateFolder: (currentPath: string, folderName: string) => Promise<void>
}

export const useFolderCreation = (sessionId: string): UseFolderCreationReturn => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const setOperating = useSessionStore(state => state.setOperating)
  const addToast = useUiStore(state => state.addToast)

  const handleCreateFolder = async (currentPath: string, folderName: string) => {
    const newFolderPath =
      currentPath === ROOT_PATH ? `/${folderName}` : `${currentPath}/${folderName}`

    setOperating(sessionId, true)
    try {
      const result = await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)

      if (isProtocolResponseErr(result)) {
        const errorMsg = formatErrorMessage(result.error) || t('error.unknown')
        logger.catch(new Error(errorMsg), { action: 'mkdir', sessionId, path: newFolderPath })
        addToast({
          type: TOAST_TYPE.ERROR,
          message: `${t('toast.createFolderFailed')}: ${errorMsg}`,
        })
        return
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.createFolderSuccess') })
      await refreshCurrentDirectory(sessionId)
    } finally {
      setOperating(sessionId, false)
    }
  }

  return { handleCreateFolder }
}

export default useFolderCreation
