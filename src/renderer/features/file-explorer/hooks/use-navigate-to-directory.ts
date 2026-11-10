import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_TYPE, TOAST_TYPE } from '@shared/constants/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import { useUiStore } from '../../../stores/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'

export interface NavigateToDirectory {
  /** 校验通过并已切换目录返回 true；失败时保持原目录并提示。 */
  navigate: (path: string) => Promise<boolean>
}

/**
 * 由用户输入的路径跳转的唯一入口：先 `stat` 确认存在且是目录，再写 `currentPath`。
 * 先把坏路径写进状态会让列表进错误态，面包屑本身也变成不可用路径。
 */
export function useNavigateToDirectory(sessionId: string): NavigateToDirectory {
  const { t } = useTranslation()
  const updateCurrentPath = useSessionStore((state) => state.updateCurrentPath)
  const addToast = useUiStore((state) => state.addToast)
  const { markSessionStale } = useDirectoryInvalidation()

  const navigate = useCallback(
    async (path: string) => {
      try {
        const entry = await protocolApi.stat(sessionId, path)
        if (entry.type !== FILE_TYPE.DIRECTORY) {
          addToast({ type: TOAST_TYPE.ERROR, message: t(($) => $.fileExplorerList.notDirectory) })
          return false
        }
        updateCurrentPath(sessionId, path)
        void markSessionStale(sessionId)
        return true
      } catch (error) {
        addToast({ type: TOAST_TYPE.ERROR, message: resolveErrorMessage(t, error) })
        return false
      }
    },
    [addToast, markSessionStale, sessionId, t, updateCurrentPath],
  )

  return { navigate }
}
