import { useTranslation } from 'react-i18next'
import { ROOT_PATH, TOAST_TYPE } from '@shared/constants/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useFileOperation } from './use-file-operation.js'

interface UseFolderCreationReturn {
  handleCreateFolder: (currentPath: string, folderName: string) => Promise<void>
}

export const useFolderCreation = (sessionId: string): UseFolderCreationReturn => {
  const { t } = useTranslation()
  const { invalidateSession } = useDirectoryInvalidation()
  const addToast = useUiStore((state) => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleCreateFolder = async (currentPath: string, folderName: string) => {
    const newFolderPath =
      currentPath === ROOT_PATH ? `/${folderName}` : `${currentPath}/${folderName}`

    await execute(async () => {
      try {
        await protocolApi.mkdir(sessionId, newFolderPath)
      } catch (error) {
        addToast({
          type: TOAST_TYPE.ERROR,
          message: `${t(($) => $.toast.createFolderFailed)}: ${resolveErrorMessage(t, error)}`,
        })
        return
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.createFolderSuccess) })
      await invalidateSession(sessionId)
    })
  }

  return { handleCreateFolder }
}

export default useFolderCreation
