import { useTranslation } from 'react-i18next'
import { useFileOperation } from '@renderer/features/file-explorer/hooks/use-file-operation.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo, isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface UseFileRenamingReturn {
  handleRename: (file: FileInfo, newName: string) => Promise<void>
}

export const useFileRenaming = (sessionId: string): UseFileRenamingReturn => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const addToast = useUiStore(state => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleRename = async (file: FileInfo, newName: string) => {
    await execute(async () => {
      const result = await window.electronAPI.protocol.rename(sessionId, file, newName)

      if (isProtocolResponseErr(result)) {
        throw new Error(
          `${t('toast.renameFailed')}: ${formatErrorMessage(result.error) || t('error.unknown')}`
        )
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.renameSuccess') })
      await refreshCurrentDirectory(sessionId)
    })
  }

  return { handleRename }
}

export default useFileRenaming
