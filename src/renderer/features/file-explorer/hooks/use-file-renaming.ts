import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useFileOperation } from './use-file-operation.js'

interface UseFileRenamingReturn {
  handleRename: (file: FileInfo, newName: string) => Promise<void>
}

export const useFileRenaming = (sessionId: string): UseFileRenamingReturn => {
  const { t } = useTranslation()
  const { invalidateSession } = useDirectoryInvalidation()
  const addToast = useUiStore((state) => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleRename = async (file: FileInfo, newName: string) => {
    await execute(async () => {
      try {
        await protocolApi.rename(sessionId, file, newName)
      } catch (error) {
        addToast({
          type: TOAST_TYPE.ERROR,
          message: `${t(($) => $.toast.renameFailed)}: ${resolveErrorMessage(t, error)}`,
        })
        return
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.renameSuccess) })
      await invalidateSession(sessionId)
    })
  }

  return { handleRename }
}

export default useFileRenaming
