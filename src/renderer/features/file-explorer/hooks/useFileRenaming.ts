import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { type FileInfo, isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'

interface UseFileRenamingReturn {
  handleRename: (file: FileInfo, newName: string) => Promise<void>
}

export const useFileRenaming = (sessionId: string): UseFileRenamingReturn => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const addToast = useUiStore(state => state.addToast)

  const handleRename = async (file: FileInfo, newName: string) => {
    const result = await window.electronAPI.protocol.rename(sessionId, file, newName)

    if (isProtocolResponseErr(result)) {
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t('toast.renameFailed')}: ${formatErrorMessage(result.error) || t('error.unknown')}`,
      })
      return
    }

    addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.renameSuccess') })
    await refreshCurrentDirectory(sessionId)
  }

  return { handleRename }
}

export default useFileRenaming
