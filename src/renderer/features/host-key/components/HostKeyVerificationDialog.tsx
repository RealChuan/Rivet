import { useTranslation } from 'react-i18next'
import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog.js'
import { useHostKeyStore } from '../stores/host-key.js'
import { HostKeyNotification } from './HostKeyNotification.js'

export const HostKeyVerificationDialog = () => {
  const { t } = useTranslation()
  const hostKeyDialog = useHostKeyStore((state) => state.hostKeyDialog)
  const setHostKeyVerificationDialog = useHostKeyStore(
    (state) => state.setHostKeyVerificationDialog,
  )

  const handleTrust = () => {
    hostKeyDialog.onConfirm?.()
    setHostKeyVerificationDialog({ open: false })
  }

  const handleCancel = () => {
    hostKeyDialog.onCancel?.()
    setHostKeyVerificationDialog({ open: false })
  }

  if (!hostKeyDialog.open) return null

  const isMismatch = hostKeyDialog.type === HOST_KEY_DIALOG_TYPE.MISMATCH

  return (
    <ConfirmationDialog
      open={hostKeyDialog.open}
      onClose={handleCancel}
      onConfirm={handleTrust}
      title={isMismatch ? t(($) => $.hostKey.mismatchTitle) : t(($) => $.hostKey.unknownTitle)}
      type={isMismatch ? 'danger' : 'info'}
      confirmTestId="host-key-confirm"
      confirmText={isMismatch ? t(($) => $.hostKey.trustNew) : t(($) => $.hostKey.trustAndConnect)}
      cancelText={t(($) => $.common.action.cancel)}
      customContent={
        <HostKeyNotification
          type={hostKeyDialog.type}
          host={hostKeyDialog.host}
          port={hostKeyDialog.port}
          algorithm={hostKeyDialog.algorithm}
          fingerprint={hostKeyDialog.fingerprint}
          previousFingerprint={hostKeyDialog.previousFingerprint}
        />
      }
    />
  )
}

export default HostKeyVerificationDialog
