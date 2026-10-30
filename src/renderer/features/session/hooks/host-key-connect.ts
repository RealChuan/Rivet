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

const showHostKeyVerificationDialog = async (
  detail: HostKeyErrorDetail,
  type: typeof HOST_KEY_DIALOG_TYPE.UNKNOWN | typeof HOST_KEY_DIALOG_TYPE.MISMATCH,
) => {
  const hostKeyStore = useHostKeyStore.getState()

  return new Promise<boolean>((resolve) => {
    const handleConfirm = () => {
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(true)
    }
    const handleCancel = () => {
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(false)
    }

    hostKeyStore.setHostKeyVerificationDialog({
      type,
      host: detail.host,
      port: detail.port,
      algorithm: detail.algorithm,
      fingerprint: detail.fingerprint,
      previousFingerprint: detail.previousFingerprint,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      open: true,
    })
  })
}

export const handleConnectWithHostKey = async (
  request: ConnectRequest,
): Promise<{ success: boolean; sessionId: string | null; retry: boolean }> => {
  try {
    const result = await protocolApi.connect(request)
    return { success: true, sessionId: result.sessionId, retry: false }
  } catch (error) {
    if (!isApiError(error)) throw error

    const detail = parseHostKeyErrorDetail(error.appError.detail)
    if (!detail) throw error

    const type =
      error.code === 'HOST_KEY_MISMATCH'
        ? HOST_KEY_DIALOG_TYPE.MISMATCH
        : HOST_KEY_DIALOG_TYPE.UNKNOWN
    const confirmed = await showHostKeyVerificationDialog(detail, type)
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
