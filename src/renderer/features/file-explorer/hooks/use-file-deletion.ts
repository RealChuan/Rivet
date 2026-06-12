import { useTranslation } from 'react-i18next'
import { useFileOperation } from '@renderer/features/file-explorer/hooks/use-file-operation.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo, isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface UseFileDeletionReturn {
  handleDelete: (files: FileInfo[]) => Promise<void>
}

export const useFileDeletion = (sessionId: string): UseFileDeletionReturn => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const addToast = useUiStore(state => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleDelete = async (files: FileInfo[]) => {
    if (files.length === 0) return

    await execute(async () => {
      for (const file of files) {
        const result = await window.electronAPI.protocol.delete(sessionId, file)
        if (isProtocolResponseErr(result)) {
          throw new Error(
            `${t('toast.deleteFailed')}: ${formatErrorMessage(result.error) || t('error.unknown')}`
          )
        }
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.deleteSuccess') })
      await refreshCurrentDirectory(sessionId)
    })
  }

  return { handleDelete }
}

export default useFileDeletion
