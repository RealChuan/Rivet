import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '@renderer/features/session/stores/sessionStore.js'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog.js'
import { HostKeyMessage } from './HostKeyMessage.js'

export const HostKeyDialog: React.FC = () => {
  const { t } = useTranslation()
  const {
    hostKeyDialog,
    closeHostKeyDialog,
    reconnectSession,
    refreshCurrentDirectory,
    removeConnection,
  } = useSessionStore()

  const handleTrust = async () => {
    await window.electronAPI.common.saveKnownHost({
      connectionUuid: hostKeyDialog.connectionUuid,
      fingerprint: hostKeyDialog.fingerprint,
    })

    if (hostKeyDialog.type === 'mismatch') {
      await reconnectSession(hostKeyDialog.connectionUuid)
    } else if (hostKeyDialog.sessionId) {
      await refreshCurrentDirectory(hostKeyDialog.sessionId)
    }
  }

  const handleCancel = async () => {
    if (hostKeyDialog.sessionId) {
      await window.electronAPI.protocol.disconnect(hostKeyDialog.sessionId)
    }
    await removeConnection(hostKeyDialog.connectionUuid)
  }

  if (!hostKeyDialog.open) return null

  const isMismatch = hostKeyDialog.type === 'mismatch'

  return (
    <ConfirmDialog
      open={hostKeyDialog.open}
      onClose={closeHostKeyDialog}
      onConfirm={handleTrust}
      onCancel={handleCancel}
      title={isMismatch ? t('hostKey.mismatchTitle') : t('hostKey.firstConnectTitle')}
      type={isMismatch ? 'danger' : 'info'}
      confirmText={isMismatch ? t('hostKey.trustNew') : t('hostKey.trustAndSave')}
      cancelText={isMismatch ? t('common.close') : t('hostKey.disconnect')}
      customContent={
        <HostKeyMessage
          type={hostKeyDialog.type}
          fingerprint={hostKeyDialog.fingerprint}
          previousFingerprint={hostKeyDialog.previousFingerprint}
        />
      }
    />
  )
}

export default HostKeyDialog
