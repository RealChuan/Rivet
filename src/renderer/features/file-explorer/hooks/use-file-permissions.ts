import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useFileOperation } from './use-file-operation.js'

interface UseFilePermissionsReturn {
  handleChangePermissions: (file: FileInfo, mode: number) => Promise<void>
}

export const useFilePermissions = (sessionId: string): UseFilePermissionsReturn => {
  const { t } = useTranslation()
  const { invalidateSession } = useDirectoryInvalidation()
  const addToast = useUiStore((state) => state.addToast)
  const { execute } = useFileOperation(sessionId)

  const handleChangePermissions = async (file: FileInfo, mode: number) => {
    await execute(async () => {
      try {
        await protocolApi.chmod(sessionId, file, mode)
      } catch (error) {
        addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, error) })
        return
      }

      addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.permissionsSuccess) })
      await invalidateSession(sessionId)
    })
  }

  return { handleChangePermissions }
}

export default useFilePermissions
