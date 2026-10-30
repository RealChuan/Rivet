import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useFileOperation } from './use-file-operation.js'

interface UseFileDeletionReturn {
  handleDelete: (files: FileInfo[]) => Promise<void>
}

export const useFileDeletion = (sessionId: string): UseFileDeletionReturn => {
  const { t } = useTranslation()
  const { invalidateSession } = useDirectoryInvalidation()
  const addToast = useUiStore((state) => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleDelete = async (files: FileInfo[]) => {
    if (files.length === 0) return

    await execute(async () => {
      for (const file of files) {
        try {
          await protocolApi.delete(sessionId, file)
        } catch (error) {
          addToast({
            type: TOAST_TYPE.ERROR,
            message: `${t(($) => $.toast.deleteFailed)}: ${resolveErrorMessage(t, error)}`,
          })
          return
        }
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.deleteSuccess) })
      await invalidateSession(sessionId)
    })
  }

  return { handleDelete }
}

export default useFileDeletion
