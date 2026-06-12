import { useTranslation } from 'react-i18next'
import { useFileOperation } from '@renderer/features/file-explorer/hooks/use-file-operation.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { ROOT_PATH, TOAST_TYPE } from '@shared/constants/index.js'
import { isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface UseFolderCreationReturn {
  handleCreateFolder: (currentPath: string, folderName: string) => Promise<void>
}

export const useFolderCreation = (sessionId: string): UseFolderCreationReturn => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const addToast = useUiStore(state => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleCreateFolder = async (currentPath: string, folderName: string) => {
    const newFolderPath =
      currentPath === ROOT_PATH ? `/${folderName}` : `${currentPath}/${folderName}`

    await execute(async () => {
      const result = await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)

      if (isProtocolResponseErr(result)) {
        throw new Error(
          `${t('toast.createFolderFailed')}: ${formatErrorMessage(result.error) || t('error.unknown')}`
        )
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.createFolderSuccess') })
      await refreshCurrentDirectory(sessionId)
    })
  }

  return { handleCreateFolder }
}

export default useFolderCreation
