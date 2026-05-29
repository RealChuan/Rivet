import type React from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmationDialog } from '@renderer/components/common/ConfirmationDialog.js'
import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { useHostKeyStore } from '../stores/host-key.js'
import { HostKeyNotification } from './HostKeyNotification.js'

export const HostKeyVerificationDialog: React.FC = () => {
  const { t } = useTranslation()
  const hostKeyDialog = useHostKeyStore(state => state.hostKeyDialog)
  const setHostKeyVerificationDialog = useHostKeyStore(state => state.setHostKeyVerificationDialog)

  const handleTrust = () => {
    if (hostKeyDialog.onConfirm) {
      hostKeyDialog.onConfirm()
    }
    setHostKeyVerificationDialog({ open: false })
  }

  const handleCancel = () => {
    if (hostKeyDialog.onCancel) {
      hostKeyDialog.onCancel()
    }
    setHostKeyVerificationDialog({ open: false })
  }

  if (!hostKeyDialog.open) return null

  const isMismatch = hostKeyDialog.type === HOST_KEY_DIALOG_TYPE.MISMATCH

  return (
    <ConfirmationDialog
      open={hostKeyDialog.open}
      onClose={handleCancel}
      onConfirm={handleTrust}
      title={isMismatch ? t('hostKey.mismatchTitle') : t('hostKey.firstConnectTitle')}
      type={isMismatch ? 'danger' : 'info'}
      confirmText={isMismatch ? t('hostKey.trustNew') : t('hostKey.trustAndSave')}
      cancelText={isMismatch ? t('action.close') : t('hostKey.disconnect')}
      customContent={
        <HostKeyNotification
          type={hostKeyDialog.type}
          hash={hostKeyDialog.hash}
          previousHash={hostKeyDialog.previousHash}
        />
      }
    />
  )
}

export default HostKeyVerificationDialog
