import { useHostKeyStore } from '@renderer/features/host-key/stores/host-key.js'
import {
  HOST_KEY_DIALOG_TYPE,
  type HostKeyDialogType,
  ProtocolStatus,
  SftpStatus,
} from '@shared/constants/index.js'
import { type ConnectionConfig, isProtocolResponseErr } from '@shared/types/index.js'

const showHostKeyVerificationDialog = async (config: {
  type: HostKeyDialogType
  hash: string
  previousHash: string | undefined
  sessionId: string
  connectionId: string
}) => {
  const hostKeyStore = useHostKeyStore.getState()

  return new Promise<boolean>(resolve => {
    const handleConfirm = () => {
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(true)
    }

    const handleCancel = () => {
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(false)
    }

    hostKeyStore.setHostKeyVerificationDialog({
      type: config.type,
      hash: config.hash,
      previousHash: config.previousHash,
      sessionId: config.sessionId,
      connectionId: config.connectionId,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      open: true,
    })
  })
}

export const handleConnectWithHostKey = async (
  fullConfig: ConnectionConfig
): Promise<{ success: boolean; sessionId: string | null; retry: boolean }> => {
  const response = await window.electronAPI.protocol.connect(fullConfig)

  if (isProtocolResponseErr(response)) {
    throw new Error(response.error.message)
  }

  const operationResult = response.value

  if (operationResult.statusCode === ProtocolStatus.OK) {
    return { success: true, sessionId: operationResult.sessionId, retry: false }
  }

  if (operationResult.statusCode === ProtocolStatus.FIRST_CONNECT) {
    const userConfirmed = await showHostKeyVerificationDialog({
      type: HOST_KEY_DIALOG_TYPE.FIRST_CONNECT,
      hash: operationResult.detail.hash,
      previousHash: undefined,
      sessionId: operationResult.sessionId,
      connectionId: fullConfig.id,
    })

    if (!userConfirmed) {
      await window.electronAPI.protocol.disconnect(operationResult.sessionId)
      await window.electronAPI.hostKey.delete(fullConfig.id)
      return { success: false, sessionId: null, retry: false }
    }

    await window.electronAPI.hostKey.save({
      connectionId: fullConfig.id,
      hash: operationResult.detail.hash,
    })

    return { success: true, sessionId: operationResult.sessionId, retry: false }
  }

  if (operationResult.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
    const userConfirmed = await showHostKeyVerificationDialog({
      type: HOST_KEY_DIALOG_TYPE.MISMATCH,
      hash: operationResult.detail.hash,
      previousHash: operationResult.detail.previousHash,
      sessionId: '',
      connectionId: fullConfig.id,
    })

    if (!userConfirmed) {
      return { success: false, sessionId: null, retry: false }
    }

    await window.electronAPI.hostKey.save({
      connectionId: fullConfig.id,
      hash: operationResult.detail.hash,
    })

    return { success: false, sessionId: null, retry: true }
  }

  return { success: false, sessionId: null, retry: false }
}
