import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { clipboardApi } from '../../../api/clipboard.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'

export interface CopyPath {
  /** 多选时一行一个路径；空数组不做任何事。 */
  copyPaths: (paths: readonly string[]) => Promise<void>
}

export function useCopyPath(): CopyPath {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)

  const copyPaths = useCallback(
    async (paths: readonly string[]) => {
      if (paths.length === 0) return

      try {
        await clipboardApi.writeText(paths.join('\n'))
        addToast({ type: TOAST_TYPE.SUCCESS, message: t(($) => $.toast.copyPathSuccess) })
      } catch (error) {
        addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, error) })
      }
    },
    [addToast, t],
  )

  return { copyPaths }
}
