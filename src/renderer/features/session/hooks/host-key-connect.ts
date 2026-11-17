import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import {
  parseHostKeyErrorDetail,
  type ConnectRequest,
  type HostKeyErrorDetail,
} from '@shared/types/index.js'
import { hostKeyApi } from '../../../api/hostKey.js'
import { protocolApi } from '../../../api/protocol.js'
import { isApiError } from '../../../api/result.js'
import { useHostKeyStore } from '../../host-key/stores/host-key.js'

/**
 * 指纹确认与连接共用同一个 signal：连接被取消时对话框必须一起收掉，
 * 否则用户点了「取消连接」还卡在指纹框上，等于假取消。
 */
const showHostKeyVerificationDialog = async (
  detail: HostKeyErrorDetail,
  type: typeof HOST_KEY_DIALOG_TYPE.UNKNOWN | typeof HOST_KEY_DIALOG_TYPE.MISMATCH,
  signal: AbortSignal,
): Promise<boolean> => {
  const hostKeyStore = useHostKeyStore.getState()

  return new Promise<boolean>((resolve) => {
    const finish = (confirmed: boolean): void => {
      signal.removeEventListener('abort', onAbort)
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(confirmed)
    }
    function onAbort(): void {
      finish(false)
    }

    if (signal.aborted) {
      finish(false)
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
    hostKeyStore.setHostKeyVerificationDialog({
      type,
      host: detail.host,
      port: detail.port,
      algorithm: detail.algorithm,
      fingerprint: detail.fingerprint,
      previousFingerprint: detail.previousFingerprint,
      onConfirm: () => finish(true),
      onCancel: () => finish(false),
      open: true,
    })
  })
}

export const handleConnectWithHostKey = async (
  request: ConnectRequest,
  signal: AbortSignal,
): Promise<{ success: boolean; sessionId: string | null; retry: boolean }> => {
  try {
    const result = await protocolApi.connect(request, signal)
    return { success: true, sessionId: result.sessionId, retry: false }
  } catch (error) {
    if (!isApiError(error) || signal.aborted) throw error

    const detail = parseHostKeyErrorDetail(error.appError.detail)
    if (!detail) throw error

    const type =
      error.code === 'HOST_KEY_MISMATCH'
        ? HOST_KEY_DIALOG_TYPE.MISMATCH
        : HOST_KEY_DIALOG_TYPE.UNKNOWN
    const confirmed = await showHostKeyVerificationDialog(detail, type, signal)
    if (!confirmed) {
      return { success: false, sessionId: null, retry: false }
    }

    await hostKeyApi.trust({
      host: detail.host,
      port: detail.port,
      algorithm: detail.algorithm,
      fingerprint: detail.fingerprint,
    })
    return { success: false, sessionId: null, retry: true }
  }
}
