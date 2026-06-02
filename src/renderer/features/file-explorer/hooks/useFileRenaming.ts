import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { logger } from '@renderer/utils/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo, isProtocolResponseErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

interface UseFileRenamingReturn {
  handleRename: (file: FileInfo, newName: string) => Promise<void>
}

export const useFileRenaming = (sessionId: string): UseFileRenamingReturn => {
  const { t } = useTranslation()
  const refreshCurrentDirectory = useSessionStore(state => state.refreshCurrentDirectory)
  const setOperating = useSessionStore(state => state.setOperating)
  const addToast = useUiStore(state => state.addToast)

  const handleRename = async (file: FileInfo, newName: string) => {
    setOperating(sessionId, true)
    try {
      const result = await window.electronAPI.protocol.rename(sessionId, file, newName)

      if (isProtocolResponseErr(result)) {
        const errorMsg = formatErrorMessage(result.error) || t('error.unknown')
        logger.catch(new Error(errorMsg), { action: 'rename', sessionId, path: file.absolutePath })
        addToast({
          type: TOAST_TYPE.ERROR,
          message: `${t('toast.renameFailed')}: ${errorMsg}`,
        })
        return
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t('toast.renameSuccess') })
      await refreshCurrentDirectory(sessionId)
    } finally {
      setOperating(sessionId, false)
    }
  }

  return { handleRename }
}

export default useFileRenaming
