import type React from 'react'
import { useTranslation } from 'react-i18next'
import { HOST_KEY_DIALOG_TYPE, type HostKeyDialogType } from '@shared/constants/index.js'

export interface HostKeyNotificationProps {
  type: HostKeyDialogType
  hash: string
  previousHash?: string | undefined
}

export const HostKeyNotification: React.FC<HostKeyNotificationProps> = ({
  type,
  hash,
  previousHash,
}) => {
  const { t } = useTranslation()
  const isMismatch = type === HOST_KEY_DIALOG_TYPE.MISMATCH

  return (
    <>
      <div className="mb-4 p-3 bg-subtle-hover rounded-md">
        <div className="text-xs text-text-muted mb-1">{t('hostKey.currentHash')}:</div>
        <div className="font-mono text-xs text-text break-all select-all">{hash}</div>
      </div>

      {isMismatch && previousHash && (
        <div className="mb-4 p-3 bg-danger-subtle border border-danger/20 rounded-md">
          <div className="text-xs text-danger mb-1">{t('hostKey.previousHash')}:</div>
          <div className="font-mono text-xs text-danger/70 break-all select-all">
            {previousHash}
          </div>
        </div>
      )}

      <div className="text-xs text-text-muted">
        {isMismatch ? t('hostKey.mismatchWarning') : t('hostKey.firstConnectWarning')}
      </div>
    </>
  )
}

export default HostKeyNotification
